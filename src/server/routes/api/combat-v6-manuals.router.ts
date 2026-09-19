import {
  getValidatedJson,
  redisLockErrorResponse,
  requireActiveCultivatorRef,
  validateJson,
} from '@server/lib/hono/middleware';
import type { AppEnv } from '@server/lib/hono/types';
import { InventoryError } from '@server/lib/services/InventoryService';
import {
  mutateManuals,
  readManuals,
} from '@server/lib/services/combat-v6/CombatV6ManualService';
import { ManualActionSchema } from '@shared/contracts/combatV6Manuals';
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
    return c.json({ success: false, error: '请求参数无效' }, 400);
  if (error instanceof InventoryError)
    return c.json({ success: false, error: error.message }, 409);
  console.error('[manuals] request failed', error);
  return c.json(
    { success: false, error: '请求未完成，请刷新核对道印与玉简' },
    500,
  );
});
router.get('/', async (c) =>
  c.json({
    success: true,
    data: await readManuals(c.get('activeCultivatorRef')!.cultivatorId),
  }),
);
router.post('/', validateJson(ManualActionSchema), async (c) =>
  c.json({
    success: true,
    ...(await mutateManuals(
      c.get('activeCultivatorRef')!.cultivatorId,
      getValidatedJson(c),
    )),
  }),
);
export default router;
