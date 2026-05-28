import broadcastRouter from '@server/routes/api/admin/broadcast.router';
import communityGroupRouter from '@server/routes/api/admin/community-qrcode.router';
import feedbackRouter from '@server/routes/api/admin/feedback.router';
import redeemCodesRouter from '@server/routes/api/admin/redeem-codes.router';
import templatesRouter from '@server/routes/api/admin/templates.router';
import { requireAdmin } from '@server/lib/hono/middleware';
import type { AppEnv } from '@server/lib/hono/types';
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
router.route('/redeem-codes', redeemCodesRouter);
router.route('/community-group', communityGroupRouter);

export default router;
