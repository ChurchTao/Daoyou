import {
  redisLockErrorResponse,
  requireActiveCultivatorRef,
} from '@server/lib/hono/middleware';
import { jsonWithStatus } from '@server/lib/hono/response';
import type { AppEnv } from '@server/lib/hono/types';
import { PlayerCommandIdempotencyError } from '@server/lib/services/CommandExecutors';
import {
  confirmMarketSell,
  purchaseMarketItems,
} from '@server/lib/services/MarketApplicationService';
import {
  MarketRecycleError,
  previewAllLowTierSell,
  previewSell,
} from '@server/lib/services/MarketRecycleService';
import {
  getMarketListings,
  MarketServiceError,
  resolveLayer,
  resolveNodeId,
} from '@server/lib/services/MarketService';
import { toPlayerStateMutationResponse } from '@server/lib/services/ResourceMutationResponse';
import { readCultivatorRealm } from '@server/lib/services/cultivator/CultivatorFactsReader';
import { getPlayerPreHeavenFates } from '@server/lib/services/cultivator/CultivatorProfileRepository';
import { MAX_PLAYER_ITEM_QUANTITY } from '@shared/config/itemQuantity';
import { MarketBuySchema } from '@shared/contracts/market';
import type { PreHeavenFate } from '@shared/types/cultivator';
import { Hono } from 'hono';
import { z } from 'zod';

import {
  confirmBagRecycle,
  previewBagRecycle,
} from '@server/lib/services/BagRecycleService';
import { RecycleRequestSchema } from '@shared/contracts/recycle';

const PreviewSchema = z
  .object({
    phase: z.literal('preview'),
    itemType: z.enum(['material', 'artifact', 'consumable']).optional(),
    itemIds: z.array(z.string()).min(1).optional(),
    items: z
      .array(
        z.object({
          id: z.string().uuid(),
          quantity: z.number().int().min(1).max(MAX_PLAYER_ITEM_QUANTITY),
        }),
      )
      .min(1)
      .optional(),
    materialIds: z.array(z.string()).min(1).optional(),
    selection: z.literal('low-tier-all').optional(),
  })
  .superRefine((value, ctx) => {
    const hasItemIds = Array.isArray(value.itemIds) && value.itemIds.length > 0;
    const hasMaterialIds =
      Array.isArray(value.materialIds) && value.materialIds.length > 0;
    const hasItems = Array.isArray(value.items) && value.items.length > 0;

    if (!hasItemIds && !hasMaterialIds && !hasItems && !value.selection) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        message: '请至少选择一件物品',
      });
    }

    if (value.itemType === 'artifact' && hasMaterialIds && !hasItemIds) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        message: '法宝回收请使用 itemIds 参数',
      });
    }
  });

const ConfirmSchema = z.object({
  phase: z.literal('confirm'),
  sessionId: z.string().min(1),
});

const SellSchema = z.discriminatedUnion('phase', [
  PreviewSchema,
  ConfirmSchema,
]);

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

router.post('/sell', requireActiveCultivatorRef(), async (c) => {
  const cultivator = c.get('activeCultivatorRef');
  if (!cultivator) {
    return c.json({ error: '当前没有活跃角色' }, 404);
  }

  try {
    const parsed = SellSchema.parse(await c.req.json());

    if (parsed.phase === 'preview') {
      const itemType = parsed.itemType || 'material';
      if (itemType !== 'artifact')
        return c.json(
          { error: '请将旧物取入随身物品栏后向回收掌柜询价。' },
          410,
        );
      if (parsed.selection === 'low-tier-all') {
        const result = await previewAllLowTierSell({
          id: cultivator.cultivatorId,
        });
        return c.json(result);
      }
      const itemIds = parsed.itemIds || parsed.materialIds || [];
      const result = await previewSell(
        { id: cultivator.cultivatorId },
        itemIds,
      );
      return c.json(result);
    }

    const committed = await confirmMarketSell({
      actor: {
        userId: cultivator.userId,
        cultivatorId: cultivator.cultivatorId,
      },
      sessionId: parsed.sessionId,
    });
    return c.json(toPlayerStateMutationResponse(committed));
  } catch (error) {
    const lockErrorResponse = redisLockErrorResponse(error);
    if (lockErrorResponse) return lockErrorResponse;
    if (error instanceof z.ZodError) {
      return c.json({ error: error.issues[0]?.message || '参数格式错误' }, 400);
    }
    if (error instanceof MarketRecycleError) {
      return jsonWithStatus(c, { error: error.message }, error.status);
    }

    console.error('market sell api error:', error);
    return c.json({ error: '回收失败，请稍后再试' }, 500);
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
