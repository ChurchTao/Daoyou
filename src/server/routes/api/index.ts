import adminRouter from '@server/routes/api/admin';
import auctionRouter from '@server/routes/api/auction.router';
import battleRecordsRouter from '@server/routes/api/battle-records.router';
import betBattlesRouter from '@server/routes/api/bet-battles.router';
import communityRouter from '@server/routes/api/community.router';
import craftRouter from '@server/routes/api/craft.router';
import cultivatorRouter from '@server/routes/api/cultivator.router';
import cultivatorsRouter from '@server/routes/api/cultivators.router';
import divineFortuneRouter from '@server/routes/api/divine-fortune.router';
import dungeonRouter from '@server/routes/api/dungeon.router';
import enemiesRouter from '@server/routes/api/enemies.router';
import fateReshapeRouter from '@server/routes/api/fate-reshape.router';
import feedbackRouter from '@server/routes/api/feedback.router';
import generateCharacterRouter from '@server/routes/api/generate-character.router';
import generateFatesRouter from '@server/routes/api/generate-fates.router';
import manualDrawRouter from '@server/routes/api/manual-draw.router';
import marketRouter from '@server/routes/api/market.router';
import productsRouter from '@server/routes/api/products.router';
import rankingsRouter from '@server/routes/api/rankings.router';
import saveCharacterRouter from '@server/routes/api/save-character.router';
import worldChatRouter from '@server/routes/api/world-chat.router';
import type { AppEnv } from '@server/lib/hono/types';
import playerRouter from '@server/routes/player.router';
import { Hono } from 'hono';

const apiRouter = new Hono<AppEnv>();

apiRouter.get('/health-check', (c) =>
  c.json({
    success: true,
    message: 'OK',
  }),
);

apiRouter.route('/player', playerRouter);
apiRouter.route('/admin', adminRouter);
apiRouter.route('/auction', auctionRouter);
apiRouter.route('/battle-records', battleRecordsRouter);
apiRouter.route('/bet-battles', betBattlesRouter);
apiRouter.route('/community', communityRouter);
apiRouter.route('/craft', craftRouter);
apiRouter.route('/cultivator', cultivatorRouter);
apiRouter.route('/cultivators', cultivatorsRouter);
apiRouter.route('/divine-fortune', divineFortuneRouter);
apiRouter.route('/dungeon', dungeonRouter);
apiRouter.route('/enemies', enemiesRouter);
apiRouter.route('/fate-reshape', fateReshapeRouter);
apiRouter.route('/feedback', feedbackRouter);
apiRouter.route('/generate-character', generateCharacterRouter);
apiRouter.route('/generate-fates', generateFatesRouter);
apiRouter.route('/manual-draw', manualDrawRouter);
apiRouter.route('/market', marketRouter);
apiRouter.route('/rankings', rankingsRouter);
apiRouter.route('/save-character', saveCharacterRouter);
apiRouter.route('/v2/products', productsRouter);
apiRouter.route('/world-chat', worldChatRouter);

export default apiRouter;
