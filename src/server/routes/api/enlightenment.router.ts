import {
  getValidatedJson,
  redisLockErrorResponse,
  requireActiveCultivatorRef,
  validateJson,
} from '@server/lib/hono/middleware';
import type { AppEnv } from '@server/lib/hono/types';
import { PlayerCommandIdempotencyError } from '@server/lib/services/CommandExecutors';
import {
  enlightenManual,
  readEnlightenment,
} from '@server/lib/services/EnlightenmentService';
import { InventoryError } from '@server/lib/services/InventoryService';
import { QiServiceError } from '@server/lib/services/QiService';
import { EnlightenmentRequestSchema } from '@shared/contracts/enlightenment';
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
    return c.json({ success: false, error: '典籍参数无效' }, 400);
  if (
    error instanceof InventoryError ||
    error instanceof InventoryRuleError ||
    error instanceof QiServiceError ||
    error instanceof PlayerCommandIdempotencyError
  )
    return c.json(
      { success: false, code: 'ENLIGHTENMENT_REJECTED', error: error.message },
      409,
    );
  console.error('[enlightenment] request failed', error);
  return c.json(
    { success: false, error: '参悟结果暂未确认，请重试核对本次结果' },
    500,
  );
});
router.get('/', async (c) =>
  c.json({
    success: true,
    data: await readEnlightenment(c.get('activeCultivatorRef')!),
  }),
);
router.post('/', validateJson(EnlightenmentRequestSchema), async (c) =>
  c.json({
    success: true,
    ...(await enlightenManual(
      c.get('activeCultivatorRef')!,
      getValidatedJson(c),
    )),
  }),
);
export default router;
