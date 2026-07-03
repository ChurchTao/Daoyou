import { requireAdmin } from '@server/lib/hono/middleware';
import type { AppEnv } from '@server/lib/hono/types';
import { getOnlineUsersSnapshot } from '@server/lib/services/onlinePresenceService';
import { Hono } from 'hono';

const router = new Hono<AppEnv>();

router.get('/', requireAdmin(), async (c) => {
  const snapshot = await getOnlineUsersSnapshot();

  return c.json({
    success: true,
    data: snapshot,
  });
});

export default router;
