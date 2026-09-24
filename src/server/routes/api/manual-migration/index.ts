import {
  getValidatedJson,
  redisLockErrorResponse,
  requireActiveCultivatorRef,
  requireAdmin,
  validateJson,
} from '@server/lib/hono/middleware';
import type { AppEnv } from '@server/lib/hono/types';
import { InventoryError } from '@server/lib/services/InventoryService';
import { ExchangeManualSchema } from '@shared/contracts/manualMigration';
import { InventoryRuleError } from '@shared/inventory';
import { Hono } from 'hono';
import { z } from 'zod';
import {
  exchangeManualMigration,
  manualMigrationAvailability,
  readManualMigration,
  readManualMigrationAdmin,
} from './service';
function router() {
  const app = new Hono<AppEnv>();
  app.use('*', async (c, next) => {
    c.header('Cache-Control', 'no-store');
    await next();
  });
  app.onError((error, c) => {
    const lock = redisLockErrorResponse(error);
    if (lock) return lock;
    if (error instanceof z.ZodError)
      return c.json({ success: false, error: '兑换参数无效' }, 400);
    if (error instanceof InventoryError || error instanceof InventoryRuleError)
      return c.json({ success: false, error: error.message }, 409);
    console.error('[manual-migration]', error);
    return c.json(
      { success: false, error: '结果暂未确认，请刷新旧功法列表并核对背包' },
      500,
    );
  });
  return app;
}
export const manualMigrationRouter = router();
manualMigrationRouter.use('*', requireActiveCultivatorRef());
manualMigrationRouter.get('/availability', async (c) =>
  c.json({
    success: true,
    data: await manualMigrationAvailability(c.get('activeCultivatorRef')!),
  }),
);
manualMigrationRouter.get('/', async (c) =>
  c.json({
    success: true,
    data: await readManualMigration(c.get('activeCultivatorRef')!),
  }),
);
manualMigrationRouter.post(
  '/exchange',
  validateJson(ExchangeManualSchema),
  async (c) =>
    c.json({
      success: true,
      ...(await exchangeManualMigration(
        c.get('activeCultivatorRef')!,
        getValidatedJson(c),
      )),
    }),
);
export const manualMigrationAdminRouter = router();
manualMigrationAdminRouter.use('*', requireAdmin());
manualMigrationAdminRouter.get('/', async (c) =>
  c.json({ success: true, data: await readManualMigrationAdmin() }),
);
