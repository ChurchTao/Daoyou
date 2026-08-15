import {
  redisLockErrorResponse,
  requireActiveCultivatorRef,
} from '@server/lib/hono/middleware';
import { jsonWithStatus } from '@server/lib/hono/response';
import { streamSseEvents } from '@server/lib/hono/streaming';
import type { AppEnv } from '@server/lib/hono/types';
import { blackMarketConversationService } from '@server/lib/services/black-market/BlackMarketConversationService';
import {
  BlackMarketServiceError,
  commitBlackMarketPurchase,
  completeBlackMarketReply,
  getBlackMarketOverview,
  leaveBlackMarketSession,
  openBlackMarketSession,
  prepareBlackMarketInteraction,
} from '@server/lib/services/black-market/BlackMarketService';
import { toPlayerStateMutationResponse } from '@server/lib/services/ResourceMutationResponse';
import {
  QiInsufficientError,
  QiServiceError,
} from '@server/lib/services/QiService';
import { BLACK_MARKET_NPC_IDS } from '@shared/types/blackMarket';
import { Hono, type Context } from 'hono';
import { z } from 'zod';

const OpenSessionSchema = z.object({
  npcId: z.enum(BLACK_MARKET_NPC_IDS),
});

const InteractSchema = z
  .object({
    message: z.string().trim().min(1).max(240).optional(),
    offeredPrice: z.number().int().min(1).max(2_000_000_000).optional(),
    version: z.number().int().min(1),
  })
  .superRefine((value, context) => {
    if (!value.message && !value.offeredPrice) {
      context.addIssue({
        code: 'custom',
        message: '请说点什么，或给出灵石报价',
      });
    }
  });

const LeaveSchema = z.object({ version: z.number().int().min(1) });
const CommitSchema = z.object({
  version: z.number().int().min(1),
  expectedPrice: z.number().int().min(1).max(2_000_000_000),
});

const router = new Hono<AppEnv>();
router.use('*', requireActiveCultivatorRef());

function actor(c: Context<AppEnv>) {
  const active = c.get('activeCultivatorRef');
  if (!active) throw new BlackMarketServiceError(404, '当前没有活跃角色');
  return { userId: active.userId, cultivatorId: active.cultivatorId };
}

function errorResponse(c: Context<AppEnv>, error: unknown) {
  const lockResponse = redisLockErrorResponse(error);
  if (lockResponse) return lockResponse;
  if (error instanceof z.ZodError) {
    return c.json({ error: error.issues[0]?.message || '参数错误' }, 400);
  }
  if (error instanceof BlackMarketServiceError) {
    return jsonWithStatus(c, { error: error.message }, error.status);
  }
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
    return jsonWithStatus(c, { error: error.message }, error.status);
  }
  console.error('black market api error:', error);
  return c.json({ error: '黑市暂时闭门，请稍后再来' }, 500);
}

router.get('/:nodeId', async (c) => {
  try {
    return c.json(
      await getBlackMarketOverview({
        actor: actor(c),
        nodeId: c.req.param('nodeId'),
      }),
    );
  } catch (error) {
    return errorResponse(c, error);
  }
});

router.post('/:nodeId/sessions', async (c) => {
  try {
    const parsed = OpenSessionSchema.parse(await c.req.json());
    const opened = await openBlackMarketSession({
        actor: actor(c),
        nodeId: c.req.param('nodeId'),
        npcId: parsed.npcId,
      });
    return c.json(toPlayerStateMutationResponse(opened));
  } catch (error) {
    return errorResponse(c, error);
  }
});

router.post('/:nodeId/sessions/:sessionId/interact', async (c) => {
  try {
    const command = InteractSchema.parse(await c.req.json());
    const prepared = await prepareBlackMarketInteraction({
      actor: actor(c),
      nodeId: c.req.param('nodeId'),
      sessionId: c.req.param('sessionId'),
      command,
      abortSignal: c.req.raw.signal,
    });
    return streamSseEvents(
      c,
      async (stream, isAborted) => {
        await stream.writeSSE({
          data: JSON.stringify({
            type: 'resolved',
            result: prepared.result,
            messageId: prepared.messageId,
            gesture: prepared.gesture,
            fallbackBody: prepared.fallbackBody,
          }),
        });
        if (isAborted()) {
          return;
        }

        let body = '';
        try {
          const reply = blackMarketConversationService.streamTurnReply({
            context: prepared.replyContext,
            proposal: prepared.proposal,
            negotiationOutcome: prepared.negotiationOutcome,
            abortSignal: c.req.raw.signal,
          });
          for await (const chunk of reply.textStream) {
            if (isAborted()) {
              throw new Error('black market reply stream disconnected');
            }
            body += chunk;
            await stream.writeSSE({
              data: JSON.stringify({
                type: 'reply-chunk',
                messageId: prepared.messageId,
                text: chunk,
              }),
            });
          }
          body = body.trim();
          if (!body) throw new Error('empty black market reply');
          if (isAborted()) {
            throw new Error('black market reply stream disconnected');
          }
          await completeBlackMarketReply({
            sessionId: prepared.sessionId,
            messageId: prepared.messageId,
            body,
          });
          await stream.writeSSE({
            data: JSON.stringify({
              type: 'reply-complete',
              messageId: prepared.messageId,
              body,
            }),
          });
        } catch (error) {
          console.warn('[black-market] reply stream fallback', { error });
          await stream.writeSSE({
            data: JSON.stringify({
              type: 'reply-error',
              messageId: prepared.messageId,
              fallbackBody: prepared.fallbackBody,
            }),
          });
        }
      },
    );
  } catch (error) {
    return errorResponse(c, error);
  }
});

router.post('/:nodeId/sessions/:sessionId/commit', async (c) => {
  try {
    const parsed = CommitSchema.parse(await c.req.json());
    const committed = await commitBlackMarketPurchase({
      actor: actor(c),
      nodeId: c.req.param('nodeId'),
      sessionId: c.req.param('sessionId'),
      version: parsed.version,
      expectedPrice: parsed.expectedPrice,
    });
    return c.json(toPlayerStateMutationResponse(await committed));
  } catch (error) {
    return errorResponse(c, error);
  }
});

router.post('/:nodeId/sessions/:sessionId/leave', async (c) => {
  try {
    const parsed = LeaveSchema.parse(await c.req.json());
    return c.json(
      await leaveBlackMarketSession({
        actor: actor(c),
        nodeId: c.req.param('nodeId'),
        sessionId: c.req.param('sessionId'),
        version: parsed.version,
      }),
    );
  } catch (error) {
    return errorResponse(c, error);
  }
});

export default router;
