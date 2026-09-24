import {
  redisLockErrorResponse,
  requireActiveCultivatorRef,
} from '@server/lib/hono/middleware';
import { jsonWithStatus } from '@server/lib/hono/response';
import type { AppEnv } from '@server/lib/hono/types';
import { PlayerCommandIdempotencyError } from '@server/lib/services/CommandExecutors';
import { readCultivatorReputation } from '@server/lib/services/cultivator/CultivatorFactsReader';
import { purchaseReputationShopItemCommand } from '@server/lib/services/ReputationShopApplicationService';
import {
  listReputationShopItems,
  ReputationShopError,
} from '@server/lib/services/ReputationShopService';
import { toPlayerStateMutationResponse } from '@server/lib/services/ResourceMutationResponse';
import {
  ReputationShopBuyBodySchema,
  ReputationShopBuyParamsSchema,
} from '@shared/contracts/reputationShop';
import { Hono } from 'hono';
import { z } from 'zod';

const router = new Hono<AppEnv>();

router.get('/', requireActiveCultivatorRef(), async (c) => {
  const cultivator = c.get('activeCultivatorRef');
  if (!cultivator) {
    return c.json({ error: '当前没有活跃角色' }, 404);
  }

  const items = await listReputationShopItems({
    cultivatorId: cultivator.cultivatorId,
    userVisibleOnly: true,
  });
  const { reputation } = await readCultivatorReputation(
    cultivator.cultivatorId,
  );

  return c.json({
    items,
    reputation,
  });
});

router.post('/:id/buy', requireActiveCultivatorRef(), async (c) => {
  const user = c.get('user');
  const cultivator = c.get('activeCultivatorRef');
  if (!user || !cultivator) {
    return c.json({ error: '未授权访问' }, 401);
  }

  try {
    const params = ReputationShopBuyParamsSchema.parse({
      id: c.req.param('id'),
    });
    const body = ReputationShopBuyBodySchema.parse(await c.req.json());
    const committed = await purchaseReputationShopItemCommand({
      id: params.id,
      requestId: body.requestId,
      userId: user.id,
      cultivatorId: cultivator.cultivatorId,
    });
    return c.json(toPlayerStateMutationResponse(committed));
  } catch (error) {
    const lockErrorResponse = redisLockErrorResponse(error);
    if (lockErrorResponse) return lockErrorResponse;
    if (
      error instanceof ReputationShopError ||
      error instanceof PlayerCommandIdempotencyError
    ) {
      return jsonWithStatus(c, { error: error.message }, error.status);
    }
    if (error instanceof z.ZodError) {
      return c.json({ error: '参数错误', details: error.flatten() }, 400);
    }

    console.error('reputation shop buy error:', error);
    return c.json({ error: '兑换失败，请稍后再试' }, 500);
  }
});

export default router;
