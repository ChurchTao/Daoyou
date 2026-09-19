import {
  getValidatedJson,
  getValidatedQuery,
  redisLockErrorResponse,
  requireActiveCultivatorRef,
  validateJson,
  validateQuery,
} from '@server/lib/hono/middleware';
import type { AppEnv } from '@server/lib/hono/types';
import {
  forgeEquipment,
  readForge,
  readVault,
  withdrawMaterial,
} from '@server/lib/services/ForgingService';
import { InventoryError } from '@server/lib/services/InventoryService';
import { QiServiceError } from '@server/lib/services/QiService';
import {
  ForgeRequestSchema,
  VaultQuerySchema,
  WithdrawMaterialSchema,
} from '@shared/contracts/forging';
import { InventoryRuleError } from '@shared/inventory';
import { Hono } from 'hono';
import { z } from 'zod';

const router = new Hono<AppEnv>();
router.use('*', requireActiveCultivatorRef());
router.use('*', async (c, next) => {
  c.header('Cache-Control', 'no-store');
  await next();
});
router.onError((error, c) => {
  const lock = redisLockErrorResponse(error);
  if (lock) return lock;
  if (error instanceof z.ZodError)
    return c.json({ success: false, error: '请求参数或材料数据无效' }, 400);
  if (
    error instanceof InventoryError ||
    error instanceof InventoryRuleError ||
    error instanceof QiServiceError
  )
    return c.json({ success: false, error: error.message }, 409);
  console.error('[forging] request failed', error);
  return c.json(
    { success: false, error: '请求未完成，请核对物品状态后重试' },
    500,
  );
});
router.get('/', async (c) =>
  c.json({
    success: true,
    data: await readForge(c.get('activeCultivatorRef')!.cultivatorId),
  }),
);
router.post('/', validateJson(ForgeRequestSchema), async (c) =>
  c.json({
    success: true,
    ...(await forgeEquipment(
      c.get('activeCultivatorRef')!.cultivatorId,
      getValidatedJson(c),
    )),
  }),
);
router.get('/vault', validateQuery(VaultQuerySchema), async (c) =>
  c.json({
    success: true,
    data: await readVault(
      c.get('activeCultivatorRef')!.cultivatorId,
      getValidatedQuery(c),
    ),
  }),
);
router.post(
  '/vault/withdraw',
  validateJson(WithdrawMaterialSchema),
  async (c) =>
    c.json({
      success: true,
      ...(await withdrawMaterial(
        c.get('activeCultivatorRef')!.cultivatorId,
        getValidatedJson(c),
      )),
    }),
);
export default router;
