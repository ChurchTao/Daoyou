import { requireAdmin } from '@server/lib/hono/middleware';
import { jsonWithStatus } from '@server/lib/hono/response';
import type { AppEnv } from '@server/lib/hono/types';
import {
  archiveSectShopItem,
  createSectShopItem,
  listSectShopItems,
  SectShopError,
  updateSectShopItem,
} from '@server/lib/services/SectShopService';
import {
  SectShopItemMutationSchema,
  SectShopListQuerySchema,
} from '@shared/contracts/sectShop';
import { Hono } from 'hono';

const router = new Hono<AppEnv>();

router.get('/', requireAdmin(), async (c) => {
  const parsed = SectShopListQuerySchema.safeParse({
    status: c.req.query('status') || undefined,
  });
  if (!parsed.success) {
    return c.json({ error: '参数错误', details: parsed.error.flatten() }, 400);
  }
  return c.json({
    items: await listSectShopItems({ status: parsed.data.status }),
  });
});

router.post('/', requireAdmin(), async (c) => {
  const user = c.get('user');
  if (!user) return c.json({ error: '未授权访问' }, 401);
  const parsed = SectShopItemMutationSchema.safeParse(
    await c.req.json().catch(() => null),
  );
  if (!parsed.success) {
    return c.json({ error: '参数错误', details: parsed.error.flatten() }, 400);
  }
  try {
    return c.json({
      success: true,
      item: await createSectShopItem({
        input: parsed.data,
        userId: user.id,
      }),
    });
  } catch (error) {
    if (error instanceof SectShopError) {
      return jsonWithStatus(c, { error: error.message }, error.status);
    }
    return c.json(
      { error: error instanceof Error ? error.message : '创建商品失败' },
      400,
    );
  }
});

router.put('/:id', requireAdmin(), async (c) => {
  const user = c.get('user');
  if (!user) return c.json({ error: '未授权访问' }, 401);
  const parsed = SectShopItemMutationSchema.safeParse(
    await c.req.json().catch(() => null),
  );
  if (!parsed.success) {
    return c.json({ error: '参数错误', details: parsed.error.flatten() }, 400);
  }
  try {
    const item = await updateSectShopItem({
      id: c.req.param('id'),
      input: parsed.data,
      userId: user.id,
    });
    if (!item) return c.json({ error: '商品不存在' }, 404);
    return c.json({ success: true, item });
  } catch (error) {
    if (error instanceof SectShopError) {
      return jsonWithStatus(c, { error: error.message }, error.status);
    }
    return c.json(
      { error: error instanceof Error ? error.message : '更新商品失败' },
      400,
    );
  }
});

router.post('/:id/archive', requireAdmin(), async (c) => {
  const user = c.get('user');
  if (!user) return c.json({ error: '未授权访问' }, 401);
  const item = await archiveSectShopItem({
    id: c.req.param('id'),
    userId: user.id,
  });
  if (!item) return c.json({ error: '商品不存在' }, 404);
  return c.json({ success: true, item });
});

export default router;
