import {
  redisLockErrorResponse,
  requireActiveCultivatorRef,
  validateJson,
} from '@server/lib/hono/middleware';
import { JournalIdempotencyError } from '@server/lib/repositories/playerJournalRepository';
import { streamSseEvents } from '@server/lib/hono/streaming';
import type { AppEnv } from '@server/lib/hono/types';
import {
  executeRetreatCommand,
  RetreatCommandError,
  type RetreatStorySource,
} from '@server/lib/services/RetreatApplicationService';
import {
  QiInsufficientError,
  QiServiceError,
} from '@server/lib/services/QiService';
import { streamAiText } from '@server/utils/aiClient';
import {
  getBreakthroughStoryPrompt,
  getLifespanExhaustedStoryPrompt,
} from '@server/utils/prompts';
import type { PlayerResourceMutationMeta } from '@shared/contracts/player';
import { RetreatRequestSchema, type RetreatResultData } from '@shared/contracts/retreat';
import { Hono, type Context } from 'hono';
import { z } from 'zod';

function qiErrorResponse(c: Context<AppEnv>, error: unknown) {
  if (error instanceof QiInsufficientError) {
    return c.json(
      {
        error: error.code,
        message: error.message,
        required: error.required,
        current: error.current,
        action: error.action,
      },
      409,
    );
  }
  if (error instanceof QiServiceError) {
    return c.json({ error: error.message }, error.status as 400 | 404 | 409);
  }
  return null;
}

function createRetreatStreamResponse(
  c: Context<AppEnv>,
  args: {
    result: RetreatResultData;
    state?: PlayerResourceMutationMeta;
    storySource: RetreatStorySource;
    onStoryComplete?: (story: string) => Promise<void> | void;
  },
): Response {
  return streamSseEvents(c, async (stream, _isAborted, signal) => {
    await stream.writeSSE({
      data: JSON.stringify({ type: 'result', data: args.result }),
    });
    if (args.state && (args.state.changes.length || args.state.replayed)) {
      await stream.writeSSE({
        data: JSON.stringify({ type: 'state', state: args.state }),
      });
    }
    if (!args.storySource) {
      return;
    }

    let accumulatedStory = '';
    try {
      const prompt =
        args.storySource.type === 'breakthrough'
          ? getBreakthroughStoryPrompt(args.storySource.payload)
          : getLifespanExhaustedStoryPrompt(args.storySource.payload);
      const aiStreamResult = streamAiText({
        system: prompt[0],
        prompt: prompt[1],
        abortSignal: signal,
        sceneId:
          args.storySource.type === 'breakthrough'
            ? 'breakthrough-story'
            : 'lifespan-exhausted',
      });
      for await (const chunk of aiStreamResult.textStream) {
        accumulatedStory += chunk;
        await stream.writeSSE({
          data: JSON.stringify({ type: 'chunk', text: chunk }),
        });
      }
    } catch (error) {
      console.error('Retreat story stream error:', error);
      await stream.writeSSE({
        data: JSON.stringify({
          type: 'error',
          error: '天机推演中断，此番结果已然落定。',
        }),
      });
    } finally {
      try {
        await args.onStoryComplete?.(accumulatedStory);
      } catch (persistError) {
        console.error('Retreat story persist error:', persistError);
      }
    }
  });
}

const retreatRouter = new Hono<AppEnv>();
retreatRouter.onError((error, c) => {
  if (error instanceof z.ZodError) return c.json({ error: '闭关突破参数无效' }, 400);
  console.error('闭关突破请求失败:', error);
  return c.json({ error: '闭关突破暂时无法完成' }, 500);
});

retreatRouter.post('/', requireActiveCultivatorRef(), validateJson(RetreatRequestSchema), async (c) => {
  const user = c.get('user');
  const activeCultivator = c.get('activeCultivatorRef');
  if (!user || !activeCultivator) {
    return c.json({ error: '未授权访问' }, 401);
  }

  try {
    const input = c.get('validatedJson') as import('@shared/contracts/retreat').RetreatRequest;
    const execution = await executeRetreatCommand({
      userId: user.id,
      cultivatorId: activeCultivator.cultivatorId,
      action: input.action,
      years: input.action === 'cultivate' ? input.years : 0,
      requestId: input.requestId,
    });
    return createRetreatStreamResponse(c, {
      result: execution.committed.result,
      state: execution.committed.state,
      storySource: execution.storySource,
      onStoryComplete: execution.onStoryComplete,
    });
  } catch (error) {
    const lockErrorResponse = redisLockErrorResponse(error);
    if (lockErrorResponse) return lockErrorResponse;
    const qiResponse = qiErrorResponse(c, error);
    if (qiResponse) return qiResponse;
    if (error instanceof JournalIdempotencyError) {
      return c.json({ error: error.message }, 409);
    }
    if (error instanceof RetreatCommandError) {
      return c.json(
        { success: false, error: error.message, ...error.payload },
        error.status,
      );
    }
    console.error('闭关突破 API 错误:', error);
    throw error;
  }
});

export default retreatRouter;
