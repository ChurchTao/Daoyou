import { requireAdmin } from '@server/lib/hono/middleware';
import type { AppEnv } from '@server/lib/hono/types';
import { getLlmMetricsSnapshot } from '@server/lib/llm/metricsStore';
import { Hono } from 'hono';

const router = new Hono<AppEnv>();

router.get('/', requireAdmin(), async (c) => {
  const limit = Number.parseInt(c.req.query('limit') ?? '300', 10);
  const sceneId = c.req.query('sceneId')?.trim() || undefined;

  const snapshot = await getLlmMetricsSnapshot({
    limit: Number.isFinite(limit) ? limit : 300,
    sceneId,
  });

  return c.json({
    success: true,
    data: snapshot,
  });
});

export default router;
