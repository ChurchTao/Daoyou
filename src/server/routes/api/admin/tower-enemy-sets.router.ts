import { requireAdmin } from '@server/lib/hono/middleware';
import type { AppEnv } from '@server/lib/hono/types';
import { Hono } from 'hono';

const router = new Hono<AppEnv>();
router.use('*', requireAdmin());
router.all('*', (c) =>
  c.json({ error: '幻境已改用 v6 配置模板，旧敌人生成管理已下线' }, 410),
);
export default router;
