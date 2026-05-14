import {
  requireActiveCultivator,
} from '@server/lib/hono/middleware';
import { jsonWithStatus } from '@server/lib/hono/response';
import type { AppEnv } from '@server/lib/hono/types';
import {
  batchBuyMarketItems,
  buyMarketItem,
  clearMarketCache,
  getMarketListings,
  MarketServiceError,
  resolveLayer,
  resolveNodeId,
} from '@server/lib/services/MarketService';
import {
  MarketRecycleError,
  previewSell,
  confirmSell,
} from '@server/lib/services/MarketRecycleService';
import { RealmType } from '@shared/types/constants';
import { Hono } from 'hono';
import { z } from 'zod';

const BuySchema = z.object({
  listingId: z.string().optional(),
  quantity: z.number().min(1).default(1),
  layer: z.enum(['common', 'treasure', 'heaven', 'black']).optional(),
  items: z
    .array(
      z.object({
        listingId: z.string(),
        quantity: z.number().min(1),
      }),
    )
    .optional(),
});

const PreviewSchema = z
  .object({
    phase: z.literal('preview'),
    itemType: z.enum(['material', 'artifact']).optional(),
    itemIds: z.array(z.string()).min(1).optional(),
    materialIds: z.array(z.string()).min(1).optional(),
  })
  .superRefine((value, ctx) => {
    const hasItemIds = Array.isArray(value.itemIds) && value.itemIds.length > 0;
    const hasMaterialIds =
      Array.isArray(value.materialIds) && value.materialIds.length > 0;

    if (!hasItemIds && !hasMaterialIds) {
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

const SellSchema = z.discriminatedUnion('phase', [PreviewSchema, ConfirmSchema]);

const router = new Hono<AppEnv>();

router.get('/:nodeId', requireActiveCultivator(), async (c) => {
  const cultivator = c.get('cultivator');
  if (!cultivator) {
    return c.json({ error: '当前没有活跃角色' }, 404);
  }

  try {
    const nodeId = resolveNodeId(c.req.param('nodeId'));
    const layer = resolveLayer(c.req.query('layer'));
    const result = await getMarketListings({
      nodeId,
      layer,
      cultivatorRealm: cultivator.realm as RealmType,
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

router.post('/:nodeId', requireActiveCultivator(), async (c) => {
  const cultivator = c.get('cultivator');
  if (!cultivator) {
    return c.json({ error: '当前没有活跃角色' }, 404);
  }

  try {
    const nodeId = resolveNodeId(c.req.param('nodeId'));
    const layer = resolveLayer(c.req.query('layer'));
    await clearMarketCache(nodeId, layer);

    const result = await getMarketListings({
      nodeId,
      layer,
      cultivatorRealm: cultivator.realm as RealmType,
    });

    return c.json(result);
  } catch (error) {
    if (error instanceof MarketServiceError) {
      return jsonWithStatus(c, { error: error.message }, error.status);
    }

    console.error('Market node refresh API error:', error);
    return c.json({ error: 'Failed to refresh market listings' }, 500);
  }
});

router.post('/:nodeId/buy', requireActiveCultivator(), async (c) => {
  const cultivator = c.get('cultivator');
  if (!cultivator) {
    return c.json({ error: '当前没有活跃角色' }, 404);
  }

  try {
    const parsed = BuySchema.parse(await c.req.json());
    const nodeId = resolveNodeId(c.req.param('nodeId'));
    const layer = parsed.layer || resolveLayer(c.req.query('layer'));

    if (parsed.items && parsed.items.length > 0) {
      const result = await batchBuyMarketItems({
        nodeId,
        layer,
        items: parsed.items,
        cultivatorId: cultivator.id,
        cultivatorRealm: cultivator.realm as RealmType,
      });
      return c.json(result);
    }

    if (!parsed.listingId) {
      return c.json({ error: '缺少 listingId' }, 400);
    }

    const result = await buyMarketItem({
      nodeId,
      layer,
      listingId: parsed.listingId,
      quantity: parsed.quantity,
      cultivatorId: cultivator.id,
      cultivatorRealm: cultivator.realm as RealmType,
    });

    return c.json(result);
  } catch (error) {
    if (error instanceof MarketServiceError) {
      return jsonWithStatus(c, { error: error.message }, error.status);
    }
    if (error instanceof z.ZodError) {
      return c.json({ error: error.issues[0]?.message || '参数错误' }, 400);
    }

    console.error('Market buy API error:', error);
    return c.json({ error: '购买失败' }, 500);
  }
});

router.post('/sell', requireActiveCultivator(), async (c) => {
  const cultivator = c.get('cultivator');
  if (!cultivator) {
    return c.json({ error: '当前没有活跃角色' }, 404);
  }

  try {
    const parsed = SellSchema.parse(await c.req.json());

    if (parsed.phase === 'preview') {
      const itemType = parsed.itemType || 'material';
      const itemIds = parsed.itemIds || parsed.materialIds || [];
      const result = await previewSell({ id: cultivator.id }, itemIds, itemType);
      return c.json(result);
    }

    const result = await confirmSell(cultivator.id, parsed.sessionId);
    return c.json(result);
  } catch (error) {
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

export default router;
