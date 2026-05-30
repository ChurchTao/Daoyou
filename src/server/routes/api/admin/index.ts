import { requireAdmin } from '@server/lib/hono/middleware';
import type { AppEnv } from '@server/lib/hono/types';
import announcementRouter from '@server/routes/api/admin/announcement.router';
import broadcastRouter from '@server/routes/api/admin/broadcast.router';
import communityGroupRouter from '@server/routes/api/admin/community-qrcode.router';
import feedbackRouter from '@server/routes/api/admin/feedback.router';
import llmMetricsRouter from '@server/routes/api/admin/llm-metrics.router';
import rewardCatalogRouter from '@server/routes/api/admin/reward-catalog.router';
import redeemCodesRouter from '@server/routes/api/admin/redeem-codes.router';
import templatesRouter from '@server/routes/api/admin/templates.router';
import { Hono } from 'hono';

const router = new Hono<AppEnv>();

router.get('/session', requireAdmin(), (c) => {
  const user = c.get('user');
  return c.json({
    success: true,
    email: user?.email ?? '',
  });
});

router.route('/templates', templatesRouter);
router.route('/feedback', feedbackRouter);
router.route('/broadcast', broadcastRouter);
router.route('/announcement', announcementRouter);
router.route('/reward-catalog', rewardCatalogRouter);
router.route('/redeem-codes', redeemCodesRouter);
router.route('/community-group', communityGroupRouter);
router.route('/llm-metrics', llmMetricsRouter);

export default router;
