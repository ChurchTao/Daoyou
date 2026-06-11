import { requireActiveCultivator } from '@server/lib/hono/middleware';
import { jsonWithStatus } from '@server/lib/hono/response';
import type { AppEnv } from '@server/lib/hono/types';
import { redis } from '@server/lib/redis';
import {
  commitPlayerStateMutation,
  toPlayerStateMutationResponse,
  type StateChangeDescriptor,
} from '@server/lib/services/PlayerStateMutationService';
import {
  buyReputationShopItem,
  listReputationShopItems,
  ReputationShopError,
} from '@server/lib/services/ReputationShopService';
import { ReputationShopBuyParamsSchema } from '@shared/contracts/reputationShop';
import type { ResourceOperation } from '@shared/engine/resource/types';
import { Hono } from 'hono';
import { z } from 'zod';

const router = new Hono<AppEnv>();

const BUY_LOCK_TTL_SECONDS = 10;

function buildBuyChanges(args: {
  reputation: number;
  gains: ResourceOperation[];
}): StateChangeDescriptor[] {
  const changes: StateChangeDescriptor[] = [
    {
      domain: 'currency',
      eventType: 'currency.reputation.spent',
      patch: { currency: { reputation: args.reputation } },
      invalidates: ['currency'],
    },
  ];

  const hasInventoryGain = args.gains.some((gain) =>
    ['material', 'consumable'].includes(gain.type),
  );
  const hasProductGain = args.gains.some((gain) => gain.type === 'artifact');

  if (hasInventoryGain) {
    changes.push({
      domain: 'inventory',
      eventType: 'inventory.reputation_shop.gained',
      invalidates: ['inventory'],
    });
  }
  if (hasProductGain) {
    changes.push({
      domain: 'products',
      eventType: 'products.reputation_shop.gained',
      invalidates: ['products'],
    });
  }

  return changes;
}

router.get('/', requireActiveCultivator(), async (c) => {
  const cultivator = c.get('cultivator');
  if (!cultivator) {
    return c.json({ error: '当前没有活跃角色' }, 404);
  }

  const items = await listReputationShopItems({
    cultivatorId: cultivator.id,
    userVisibleOnly: true,
  });

  return c.json({
    items,
    reputation: cultivator.reputation ?? 0,
  });
});

router.post('/:id/buy', requireActiveCultivator(), async (c) => {
  const user = c.get('user');
  const cultivator = c.get('cultivator');
  if (!user || !cultivator) {
    return c.json({ error: '未授权访问' }, 401);
  }

  try {
    const params = ReputationShopBuyParamsSchema.parse({
      id: c.req.param('id'),
    });
    const lockKey = `reputation-shop:buy:lock:${cultivator.id}:${params.id}`;
    const acquiredLock = await redis.set(
      lockKey,
      'locked',
      'EX',
      BUY_LOCK_TTL_SECONDS,
      'NX',
    );
    if (!acquiredLock) {
      return c.json({ error: '兑换正在处理中，请稍后' }, 429);
    }

    try {
      const committed = await commitPlayerStateMutation({
        userId: user.id,
        cultivatorId: cultivator.id,
        source: 'reputation_shop_buy',
        run: async (tx) => {
          const result = await buyReputationShopItem({
            id: params.id,
            userId: user.id,
            cultivatorId: cultivator.id,
            tx,
          });

          return {
            result: {
              purchasedItem: result.item,
              reputation: result.reputation,
            },
            changes: buildBuyChanges({
              reputation: result.reputation,
              gains: result.gains,
            }),
          };
        },
      });

      return c.json(toPlayerStateMutationResponse(committed));
    } finally {
      await redis.del(lockKey);
    }
  } catch (error) {
    if (error instanceof ReputationShopError) {
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
