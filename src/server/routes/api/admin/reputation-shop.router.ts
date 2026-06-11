import { requireAdmin } from '@server/lib/hono/middleware';
import { jsonWithStatus } from '@server/lib/hono/response';
import type { AppEnv } from '@server/lib/hono/types';
import {
  archiveReputationShopItem,
  createReputationShopItem,
  listReputationShopItems,
  ReputationShopError,
  updateReputationShopItem,
} from '@server/lib/services/ReputationShopService';
import {
  ReputationShopItemMutationSchema,
  ReputationShopListQuerySchema,
} from '@shared/contracts/reputationShop';
import { Hono } from 'hono';

const router = new Hono<AppEnv>();

function isUniqueViolation(error: unknown): boolean {
  if (!error || typeof error !== 'object') return false;
  return (error as { code?: string }).code === '23505';
}

router.get('/', requireAdmin(), async (c) => {
  const parsed = ReputationShopListQuerySchema.safeParse({
    status: c.req.query('status') || undefined,
  });

  if (!parsed.success) {
    return c.json({ error: '参数错误', details: parsed.error.flatten() }, 400);
  }

  const items = await listReputationShopItems({
    status: parsed.data.status,
  });
  return c.json({ items });
});

router.post('/', requireAdmin(), async (c) => {
  const user = c.get('user');
  if (!user) {
    return c.json({ error: '未授权访问' }, 401);
  }

  const body = await c.req.json().catch(() => null);
  const parsed = ReputationShopItemMutationSchema.safeParse(body);
  if (!parsed.success) {
    return c.json({ error: '参数错误', details: parsed.error.flatten() }, 400);
  }

  try {
    const item = await createReputationShopItem({
      input: parsed.data,
      userId: user.id,
    });
    return c.json({ success: true, item });
  } catch (error) {
    if (error instanceof ReputationShopError) {
      return jsonWithStatus(c, { error: error.message }, error.status);
    }
    if (isUniqueViolation(error)) {
      return c.json({ error: '该道具已在声望商店中' }, 409);
    }
    return c.json(
      { error: error instanceof Error ? error.message : '创建商品失败' },
      400,
    );
  }
});

router.put('/:id', requireAdmin(), async (c) => {
  const user = c.get('user');
  if (!user) {
    return c.json({ error: '未授权访问' }, 401);
  }

  const body = await c.req.json().catch(() => null);
  const parsed = ReputationShopItemMutationSchema.safeParse(body);
  if (!parsed.success) {
    return c.json({ error: '参数错误', details: parsed.error.flatten() }, 400);
  }

  try {
    const item = await updateReputationShopItem({
      id: c.req.param('id'),
      input: parsed.data,
      userId: user.id,
    });
    if (!item) {
      return c.json({ error: '商品不存在' }, 404);
    }
    return c.json({ success: true, item });
  } catch (error) {
    if (error instanceof ReputationShopError) {
      return jsonWithStatus(c, { error: error.message }, error.status);
    }
    if (isUniqueViolation(error)) {
      return c.json({ error: '该道具已在声望商店中' }, 409);
    }
    return c.json(
      { error: error instanceof Error ? error.message : '更新商品失败' },
      400,
    );
  }
});

router.post('/:id/archive', requireAdmin(), async (c) => {
  const user = c.get('user');
  if (!user) {
    return c.json({ error: '未授权访问' }, 401);
  }

  const item = await archiveReputationShopItem({
    id: c.req.param('id'),
    userId: user.id,
  });
  if (!item) {
    return c.json({ error: '商品不存在' }, 404);
  }

  return c.json({ success: true, item });
});

export default router;
