import { requireAdmin } from '@server/lib/hono/middleware';
import type { AppEnv } from '@server/lib/hono/types';
import {
  getRewardCatalog,
  upsertRewardCatalog,
} from '@server/lib/repositories/rewardCatalogRepository';
import { RewardCatalogSchema } from '@shared/lib/rewardCatalog';
import { Hono } from 'hono';
import { z } from 'zod';

const PatchBodySchema = z.object({
  catalog: RewardCatalogSchema,
});

const router = new Hono<AppEnv>();

router.get('/', requireAdmin(), async (c) => {
  const catalog = await getRewardCatalog();

  return c.json({
    catalog,
  });
});

router.patch('/', requireAdmin(), async (c) => {
  const user = c.get('user');
  if (!user) {
    return c.json({ error: '未授权访问' }, 401);
  }

  const body = await c.req.json().catch(() => null);
  const parsed = PatchBodySchema.safeParse(body);

  if (!parsed.success) {
    return c.json({ error: '参数错误', details: parsed.error.flatten() }, 400);
  }

  await upsertRewardCatalog({
    catalog: parsed.data.catalog,
    updatedBy: user.id,
  });

  return c.json({
    ok: true,
    catalog: parsed.data.catalog,
  });
});

export default router;
