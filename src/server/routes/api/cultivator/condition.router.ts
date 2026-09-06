import {
  redisLockErrorResponse,
  requireActiveCultivatorRef,
} from '@server/lib/hono/middleware';
import type { AppEnv } from '@server/lib/hono/types';
import { AttributeResetServiceError } from '@server/lib/services/AttributeResetService';
import {
  getBodyCultivationBreakthroughPreviewData,
  loadPlayerBodyCultivationFacts,
} from '@server/lib/services/BodyCultivationBreakthroughService';
import {
  breakthroughBodyCultivation,
  breakthroughCultivatorMarrowWash,
  consumeCultivatorConsumable,
  recoverCultivatorAtInn,
} from '@server/lib/services/CultivatorConditionApplicationService';
import {
  QiInsufficientError,
  QiServiceError,
} from '@server/lib/services/QiService';
import { toPlayerStateMutationResponse } from '@server/lib/services/ResourceMutationResponse';
import type {
  BodyCultivationBreakthroughReadinessResponse,
} from '@shared/contracts/bodyCultivation';
import { Hono, type Context } from 'hono';
import { z } from 'zod';

const ConsumeSchema = z.object({ consumableId: z.string().uuid() });
const BodyCultivationBreakthroughSchema = z.object({}).strict();

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

const conditionRouter = new Hono<AppEnv>();

conditionRouter.post('/consume', requireActiveCultivatorRef(), async (c) => {
  const user = c.get('user');
  const cultivator = c.get('activeCultivatorRef');
  if (!user || !cultivator) {
    return c.json({ success: false, error: '未授权访问' }, 401);
  }
  const parsed = ConsumeSchema.safeParse(await c.req.json());
  if (!parsed.success) {
    return c.json({ success: false, error: '请求参数格式错误' }, 400);
  }
  try {
    const committed = await consumeCultivatorConsumable({
      actor: {
        userId: user.id,
        cultivatorId: cultivator.cultivatorId,
      },
      consumableId: parsed.data.consumableId,
    });
    return c.json(toPlayerStateMutationResponse(committed));
  } catch (error) {
    const lockErrorResponse = redisLockErrorResponse(error);
    if (lockErrorResponse) return lockErrorResponse;
    if (error instanceof AttributeResetServiceError) {
      return c.json({ error: error.message }, error.status as 400 | 404);
    }
    const qiResponse = qiErrorResponse(c, error);
    if (qiResponse) return qiResponse;
    return c.json(
      {
        success: false,
        error: error instanceof Error ? error.message : '使用失败',
      },
      400,
    );
  }
});

conditionRouter.post(
  '/inn-recovery',
  requireActiveCultivatorRef(),
  async (c) => {
    const user = c.get('user');
    const cultivator = c.get('activeCultivatorRef');
    if (!user || !cultivator) {
      return c.json({ success: false, error: '未授权访问' }, 401);
    }
    try {
      const committed = await recoverCultivatorAtInn({
        actor: {
          userId: user.id,
          cultivatorId: cultivator.cultivatorId,
        },
      });
      return c.json(toPlayerStateMutationResponse(committed));
    } catch (error) {
      if (
        !(error instanceof Error) ||
        !error.message.startsWith('囊中羞涩，灵石不足')
      ) {
        throw error;
      }
      return c.json({ success: false, error: error.message }, 400);
    }
  },
);

conditionRouter.get(
  '/body-cultivation/breakthrough',
  requireActiveCultivatorRef(),
  async (c) => {
    const user = c.get('user');
    const activeCultivator = c.get('activeCultivatorRef');
    if (!user || !activeCultivator) {
      return c.json({ success: false, error: '未授权访问' }, 401);
    }
    const cultivator = await loadPlayerBodyCultivationFacts(
      user.id,
      activeCultivator.cultivatorId,
    );
    if (!cultivator) {
      return c.json({ success: false, error: '角色不存在' }, 404);
    }
    const response: BodyCultivationBreakthroughReadinessResponse = {
      success: true,
      data: getBodyCultivationBreakthroughPreviewData(cultivator),
    };
    return c.json(response);
  },
);

conditionRouter.post(
  '/body-cultivation/breakthrough',
  requireActiveCultivatorRef(),
  async (c) => {
    const user = c.get('user');
    const activeCultivator = c.get('activeCultivatorRef');
    if (!user || !activeCultivator) {
      return c.json({ success: false, error: '未授权访问' }, 401);
    }
    try {
      BodyCultivationBreakthroughSchema.parse(
        await c.req.json().catch(() => ({})),
      );
      const committed = await breakthroughBodyCultivation({
        actor: {
          userId: user.id,
          cultivatorId: activeCultivator.cultivatorId,
        },
      });
      return c.json(toPlayerStateMutationResponse(committed));
    } catch (error) {
      const lockErrorResponse = redisLockErrorResponse(error);
      if (lockErrorResponse) return lockErrorResponse;
      return c.json(
        {
          success: false,
          error: error instanceof Error ? error.message : '肉身进阶失败',
        },
        400,
      );
    }
  },
);

conditionRouter.post(
  '/marrow-wash/breakthrough',
  requireActiveCultivatorRef(),
  async (c) => {
    const user = c.get('user');
    const activeCultivator = c.get('activeCultivatorRef');
    if (!user || !activeCultivator) {
      return c.json({ success: false, error: '未授权访问' }, 401);
    }
    try {
      const committed = await breakthroughCultivatorMarrowWash({
        actor: {
          userId: user.id,
          cultivatorId: activeCultivator.cultivatorId,
        },
      });
      return c.json(toPlayerStateMutationResponse(committed));
    } catch (error) {
      const lockErrorResponse = redisLockErrorResponse(error);
      if (lockErrorResponse) return lockErrorResponse;
      const qiResponse = qiErrorResponse(c, error);
      if (qiResponse) return qiResponse;
      const message = error instanceof Error ? error.message : '洗髓破限失败';
      return c.json(
        { success: false, error: message },
        message === '角色不存在' ? 404 : 400,
      );
    }
  },
);

export default conditionRouter;
