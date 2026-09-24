import { requireAdmin } from '@server/lib/hono/middleware';
import type { AppEnv } from '@server/lib/hono/types';
import accountsRouter from '@server/routes/api/admin/accounts.router';
import announcementRouter from '@server/routes/api/admin/announcement.router';
import communityGroupRouter from '@server/routes/api/admin/community-qrcode.router';
import feedbackRouter from '@server/routes/api/admin/feedback.router';
import itemLibraryRouter from '@server/routes/api/admin/item-library.router';
import llmMetricsRouter from '@server/routes/api/admin/llm-metrics.router';
import onlineUsersRouter from '@server/routes/api/admin/online-users.router';
import redeemCodesRouter from '@server/routes/api/admin/redeem-codes.router';
import reputationShopRouter from '@server/routes/api/admin/reputation-shop.router';
import sectShopRouter from '@server/routes/api/admin/sect-shop.router';
import sponsorshipRouter from '@server/routes/api/admin/sponsorship.router';
import systemMailsRouter from '@server/routes/api/admin/system-mails.router';
import towerEnemySetsRouter from '@server/routes/api/admin/tower-enemy-sets.router';
import { Hono } from 'hono';
import { manualMigrationAdminRouter } from '../manual-migration';
import rewardItemsRouter from './reward-items.router';
import sectMigrationRouter from './sect-migration';

const router = new Hono<AppEnv>();

router.get('/session', requireAdmin(), (c) => {
  const user = c.get('user');
  return c.json({
    success: true,
    userId: user?.id ?? '',
    email: user?.email ?? '',
  });
});

router.route('/accounts', accountsRouter);
router.route('/feedback', feedbackRouter);
router.route('/system-mails', systemMailsRouter);
router.route('/announcement', announcementRouter);
router.route('/item-library', itemLibraryRouter);
router.route('/reward-items', rewardItemsRouter);
router.route('/redeem-codes', redeemCodesRouter);
router.route('/reputation-shop', reputationShopRouter);
router.route('/sect-shop', sectShopRouter);
router.route('/sect-migration', sectMigrationRouter);
router.route('/manual-migration', manualMigrationAdminRouter);
router.route('/sponsorship', sponsorshipRouter);
router.route('/community-group', communityGroupRouter);
router.route('/llm-metrics', llmMetricsRouter);
router.route('/online-users', onlineUsersRouter);
router.route('/tower-enemy-sets', towerEnemySetsRouter);

export default router;
