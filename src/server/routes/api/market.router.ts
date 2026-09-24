import {
  redisLockErrorResponse,
  requireActiveCultivatorRef,
} from '@server/lib/hono/middleware';
import { jsonWithStatus } from '@server/lib/hono/response';
import type { AppEnv } from '@server/lib/hono/types';
import { PlayerCommandIdempotencyError } from '@server/lib/services/CommandExecutors';
import { purchaseMarketItems } from '@server/lib/services/MarketApplicationService';
import { MarketRecycleError } from '@server/lib/services/MarketRecycleService';
import {
  getMarketListings,
  MarketServiceError,
  resolveLayer,
  resolveNodeId,
} from '@server/lib/services/MarketService';
import { toPlayerStateMutationResponse } from '@server/lib/services/ResourceMutationResponse';
import { readCultivatorRealm } from '@server/lib/services/cultivator/CultivatorFactsReader';
import { getPlayerPreHeavenFates } from '@server/lib/services/cultivator/CultivatorProfileRepository';
import { MarketBuySchema } from '@shared/contracts/market';
import type { PreHeavenFate } from '@shared/types/cultivator';
import { Hono } from 'hono';
import { z } from 'zod';

import {
  confirmBagRecycle,
  previewBagRecycle,
} from '@server/lib/services/BagRecycleService';
import { RecycleRequestSchema } from '@shared/contracts/recycle';

const router = new Hono<AppEnv>();

async function loadMarketFates(cultivator: {
  cultivatorId: string;
  userId: string;
}): Promise<PreHeavenFate[]> {
  return (
    (await getPlayerPreHeavenFates(
      cultivator.userId,
      cultivator.cultivatorId,
    )) ?? []
  );
}

router.post('/recycle', requireActiveCultivatorRef(), async (c) => {
  const ref = c.get('activeCultivatorRef')!;
  try {
    const input = RecycleRequestSchema.parse(await c.req.json());
    if (input.phase === 'preview')
      return c.json({
        success: true,
        data: await previewBagRecycle(ref.cultivatorId, input.items),
      });
    const committed = await confirmBagRecycle(
      { userId: ref.userId, cultivatorId: ref.cultivatorId },
      input.quoteId,
    );
    return c.json(toPlayerStateMutationResponse(committed));
  } catch (error) {
    const lockResponse = redisLockErrorResponse(error);
    if (lockResponse) return lockResponse;
    if (error instanceof z.ZodError)
      return c.json({ error: error.issues[0]?.message ?? '参数格式错误' }, 400);
    if (error instanceof MarketRecycleError)
      return jsonWithStatus(c, { error: error.message }, error.status);
    throw error;
  }
});

router.get('/:nodeId', requireActiveCultivatorRef(), async (c) => {
  const cultivator = c.get('activeCultivatorRef');
  if (!cultivator) {
    return c.json({ error: '当前没有活跃角色' }, 404);
  }

  try {
    const nodeId = resolveNodeId(c.req.param('nodeId'));
    const layer = resolveLayer(c.req.query('layer'));
    if (layer === 'black') {
      throw new MarketServiceError(410, '黑市已经移入暗巷，请从坊市入口前往');
    }
    const [{ realm }, fates] = await Promise.all([
      readCultivatorRealm(cultivator.cultivatorId),
      loadMarketFates(cultivator),
    ]);
    const result = await getMarketListings({
      nodeId,
      layer,
      userId: cultivator.userId,
      cultivatorRealm: realm,
      fates,
    });

    return c.json(result);
  } catch (error) {
    if (error instanceof MarketServiceError) {
      return jsonWithStatus(c, { error: error.message }, error.status);
    }

    console.error('Market node API error:', error);
    return c.json({ error: 'Failed to fetch market listings' }, 500);
  }
});

router.post('/:nodeId/buy', requireActiveCultivatorRef(), async (c) => {
  const cultivator = c.get('activeCultivatorRef');
  if (!cultivator) {
    return c.json({ error: '当前没有活跃角色' }, 404);
  }

  try {
    const input = MarketBuySchema.parse(await c.req.json());
    const committed = await purchaseMarketItems({
      actor: {
        userId: cultivator.userId,
        cultivatorId: cultivator.cultivatorId,
      },
      nodeId: resolveNodeId(c.req.param('nodeId')),
      input,
    });
    return c.json(toPlayerStateMutationResponse(committed));
  } catch (error) {
    const lockErrorResponse = redisLockErrorResponse(error);
    if (lockErrorResponse) return lockErrorResponse;
    if (
      error instanceof MarketServiceError ||
      error instanceof PlayerCommandIdempotencyError
    ) {
      return jsonWithStatus(c, { error: error.message }, error.status);
    }
    if (error instanceof z.ZodError) {
      return c.json({ error: error.issues[0]?.message || '参数错误' }, 400);
    }

    console.error('Market buy API error:', error);
    return c.json({ error: '购买失败' }, 500);
  }
});

export default router;
