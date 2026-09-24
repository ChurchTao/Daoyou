import {
  getValidatedJson,
  redisLockErrorResponse,
  requireActiveCultivatorRef,
  validateJson,
} from '@server/lib/hono/middleware';
import type { AppEnv } from '@server/lib/hono/types';
import { InventoryError } from '@server/lib/services/InventoryService';
import { ExchangeArtifactSchema } from '@shared/contracts/artifactMigration';
import { InventoryRuleError } from '@shared/inventory';
import { Hono } from 'hono';
import { z } from 'zod';
import {
  artifactMigrationAvailability,
  exchangeArtifactMigration,
  readArtifactMigration,
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
    console.error('[artifact-migration]', error);
    return c.json(
      { success: false, error: '结果暂未确认，请刷新旧法宝列表并核对背包' },
      500,
    );
  });
  return app;
}
export const artifactMigrationRouter = router();
artifactMigrationRouter.use('*', requireActiveCultivatorRef());
artifactMigrationRouter.get('/availability', async (c) =>
  c.json({
    success: true,
    data: await artifactMigrationAvailability(c.get('activeCultivatorRef')!),
  }),
);
artifactMigrationRouter.get('/', async (c) =>
  c.json({
    success: true,
    data: await readArtifactMigration(c.get('activeCultivatorRef')!),
  }),
);
artifactMigrationRouter.post(
  '/exchange',
  validateJson(ExchangeArtifactSchema),
  async (c) =>
    c.json({
      success: true,
      ...(await exchangeArtifactMigration(
        c.get('activeCultivatorRef')!,
        getValidatedJson(c),
      )),
    }),
);
