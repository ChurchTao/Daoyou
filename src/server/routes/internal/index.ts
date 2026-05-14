import type { AppEnv } from '@server/lib/hono/types';
import cronRouter from '@server/routes/internal/cron.router';
import { Hono } from 'hono';

const internalRouter = new Hono<AppEnv>();

internalRouter.route('/cron', cronRouter);

export default internalRouter;
