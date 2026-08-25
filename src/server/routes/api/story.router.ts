import { DungeonFlowError } from '@server/lib/dungeon/service_v2';
import {
  redisLockErrorResponse,
  requireActiveCultivatorRef,
} from '@server/lib/hono/middleware';
import { jsonWithStatus } from '@server/lib/hono/response';
import type { AppEnv } from '@server/lib/hono/types';
import { DungeonStartError } from '@server/lib/services/DungeonApplicationService';
import {
  choosePersonalStory,
  PersonalStoryCommandError,
  startPersonalStoryDungeon,
} from '@server/lib/services/PersonalStoryApplicationService';
import {
  QiInsufficientError,
  QiServiceError,
} from '@server/lib/services/QiService';
import {
  chooseActivityStory,
  chooseTravelStoryEvent,
  getPendingActivityStory,
  getPendingTravelStoryEvent,
  TravelStoryCommandError,
} from '@server/lib/services/TravelStoryApplicationService';
import { loadPersonalStoryArchive } from '@server/lib/story/PersonalStoryRepository';
import { StoryChoiceKeySchema } from '@shared/lib/story/personalStory';
import { TravelStoryChoiceKeySchema } from '@shared/lib/story/travelStory';
import { Hono } from 'hono';
import { z } from 'zod';

const ChoiceSchema = z
  .object({
    intentId: z.string().uuid(),
    choiceKey: StoryChoiceKeySchema,
  })
  .strict();
const IntentParamsSchema = z.object({ intentId: z.string().uuid() }).strict();
const TravelChoiceSchema = z
  .object({ choiceKey: TravelStoryChoiceKeySchema })
  .strict();

const storyRouter = new Hono<AppEnv>();

storyRouter.get('/archive', requireActiveCultivatorRef(), async (c) => {
  const cultivator = c.get('activeCultivatorRef');
  if (!cultivator) return c.json({ error: '当前没有活跃角色' }, 404);

  return c.json({
    success: true,
    data: await loadPersonalStoryArchive(cultivator.cultivatorId),
  });
});

storyRouter.get(
  '/activity-stories/pending',
  requireActiveCultivatorRef(),
  async (c) => {
    const cultivator = c.get('activeCultivatorRef');
    if (!cultivator) return c.json({ error: '当前没有活跃角色' }, 404);
    return c.json({
      success: true,
      event: await getPendingActivityStory(cultivator.cultivatorId),
    });
  },
);

storyRouter.post(
  '/activity-stories/:intentId/choices',
  requireActiveCultivatorRef(),
  async (c) => {
    const user = c.get('user');
    const cultivator = c.get('activeCultivatorRef');
    if (!user || !cultivator) return c.json({ error: '未授权访问' }, 401);

    try {
      const { intentId } = IntentParamsSchema.parse(c.req.param());
      const { choiceKey } = TravelChoiceSchema.parse(await c.req.json());
      return c.json({
        success: true,
        ...(await chooseActivityStory({
          userId: user.id,
          cultivatorId: cultivator.cultivatorId,
          intentId,
          choiceKey,
        })),
      });
    } catch (error) {
      const lockErrorResponse = redisLockErrorResponse(error);
      if (lockErrorResponse) return lockErrorResponse;
      if (error instanceof z.ZodError) {
        return c.json({ error: '活动剧情选择参数无效' }, 400);
      }
      if (error instanceof TravelStoryCommandError) {
        return jsonWithStatus(c, { error: error.message }, error.status);
      }
      throw error;
    }
  },
);

storyRouter.get(
  '/travel-events/pending',
  requireActiveCultivatorRef(),
  async (c) => {
    const cultivator = c.get('activeCultivatorRef');
    if (!cultivator) return c.json({ error: '当前没有活跃角色' }, 404);
    return c.json({
      success: true,
      event: await getPendingTravelStoryEvent(cultivator.cultivatorId),
    });
  },
);

storyRouter.post(
  '/travel-events/:intentId/choices',
  requireActiveCultivatorRef(),
  async (c) => {
    const user = c.get('user');
    const cultivator = c.get('activeCultivatorRef');
    if (!user || !cultivator) return c.json({ error: '未授权访问' }, 401);

    try {
      const { intentId } = IntentParamsSchema.parse(c.req.param());
      const { choiceKey } = TravelChoiceSchema.parse(await c.req.json());
      return c.json({
        success: true,
        ...(await chooseTravelStoryEvent({
          userId: user.id,
          cultivatorId: cultivator.cultivatorId,
          intentId,
          choiceKey,
        })),
      });
    } catch (error) {
      const lockErrorResponse = redisLockErrorResponse(error);
      if (lockErrorResponse) return lockErrorResponse;
      if (error instanceof z.ZodError) {
        return c.json({ error: '云游选择参数无效' }, 400);
      }
      if (error instanceof TravelStoryCommandError) {
        return jsonWithStatus(c, { error: error.message }, error.status);
      }
      throw error;
    }
  },
);

storyRouter.post('/choices', requireActiveCultivatorRef(), async (c) => {
  const cultivator = c.get('activeCultivatorRef');
  if (!cultivator) return c.json({ error: '当前没有活跃角色' }, 404);

  try {
    const input = ChoiceSchema.parse(await c.req.json());
    return c.json(
      await choosePersonalStory({
        cultivatorId: cultivator.cultivatorId,
        intentId: input.intentId,
        choiceKey: input.choiceKey,
      }),
    );
  } catch (error) {
    const lockErrorResponse = redisLockErrorResponse(error);
    if (lockErrorResponse) return lockErrorResponse;
    if (error instanceof z.ZodError) {
      return c.json({ error: '剧情选择参数无效', details: error.issues }, 400);
    }
    if (error instanceof PersonalStoryCommandError) {
      return jsonWithStatus(c, { error: error.message }, error.status);
    }
    throw error;
  }
});

storyRouter.post(
  '/intents/:intentId/start-dungeon',
  requireActiveCultivatorRef(),
  async (c) => {
    const user = c.get('user');
    const cultivator = c.get('activeCultivatorRef');
    if (!user || !cultivator) return c.json({ error: '未授权访问' }, 401);

    try {
      const { intentId } = IntentParamsSchema.parse(c.req.param());
      return c.json(
        await startPersonalStoryDungeon({
          userId: user.id,
          cultivatorId: cultivator.cultivatorId,
          intentId,
        }),
      );
    } catch (error) {
      const lockErrorResponse = redisLockErrorResponse(error);
      if (lockErrorResponse) return lockErrorResponse;
      if (error instanceof z.ZodError) {
        return c.json({ error: '剧情编号无效' }, 400);
      }
      if (error instanceof PersonalStoryCommandError) {
        return jsonWithStatus(c, { error: error.message }, error.status);
      }
      if (error instanceof DungeonStartError) {
        return jsonWithStatus(
          c,
          {
            error: error.message,
            ...(error.readiness ? { readiness: error.readiness } : {}),
          },
          error.status,
        );
      }
      if (error instanceof DungeonFlowError) {
        return jsonWithStatus(
          c,
          { error: error.message, code: error.code },
          error.status,
        );
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
      throw error;
    }
  },
);

export default storyRouter;
