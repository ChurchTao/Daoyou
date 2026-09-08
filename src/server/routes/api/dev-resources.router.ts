import { redisLockErrorResponse } from '@server/lib/hono/middleware';
import { patchDevCultivator } from '@server/lib/services/DevCultivatorService';
import { grantDevResources } from '@server/lib/services/ForgingService';
import { InventoryError } from '@server/lib/services/InventoryService';
import { QiServiceError } from '@server/lib/services/QiService';
import { allowsLocalDevTools } from '@shared/config/deployment';
import { DevCultivatorPatchSchema } from '@shared/contracts/devTools';
import { DevGrantSchema } from '@shared/contracts/forging';
import { InventoryRuleError } from '@shared/inventory';
import { Hono } from 'hono';
import { z } from 'zod';
const router = new Hono();
// Deliberately unauthenticated: this route is absent outside explicit local deployment.
router.use('*', async (c, next) => {
  if (!allowsLocalDevTools(process.env.APP_ENV, process.env.NODE_ENV))
    return c.notFound();
  c.header('Cache-Control', 'no-store');
  await next();
});
router.post('/resources', async (c) => {
  try {
    return c.json({
      success: true,
      ...(await grantDevResources(DevGrantSchema.parse(await c.req.json()))),
    });
  } catch (error) {
    const lock = redisLockErrorResponse(error);
    if (lock) return lock;
    if (error instanceof z.ZodError)
      return c.json({ success: false, error: '发放参数无效' }, 400);
    if (
      error instanceof InventoryError ||
      error instanceof InventoryRuleError ||
      error instanceof QiServiceError
    )
      return c.json({ success: false, error: error.message }, 409);
    throw error;
  }
});
router.patch('/cultivators/:id', async (c) => {
  try {
    return c.json({
      success: true,
      ...(await patchDevCultivator(
        z.uuid().parse(c.req.param('id')),
        DevCultivatorPatchSchema.parse(await c.req.json()),
      )),
    });
  } catch (error) {
    const lock = redisLockErrorResponse(error);
    if (lock) return lock;
    if (error instanceof z.ZodError)
      return c.json({ success: false, error: '角色调整参数无效' }, 400);
    if (error instanceof InventoryError)
      return c.json({ success: false, error: error.message }, 409);
    throw error;
  }
});
export default router;
