import {
  getValidatedJson,
  redisLockErrorResponse,
  requireActiveCultivatorRef,
  validateJson,
} from '@server/lib/hono/middleware';
import type { AppEnv } from '@server/lib/hono/types';
import { PlayerCommandIdempotencyError } from '@server/lib/services/CommandExecutors';
import {
  mutateInscriptions,
  readInscriptions,
} from '@server/lib/services/InscriptionService';
import { InventoryError } from '@server/lib/services/InventoryService';
import {
  QiInsufficientError,
  QiServiceError,
} from '@server/lib/services/QiService';
import { InscriptionRequestSchema } from '@shared/contracts/inscriptions';
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
    return c.json(
      { success: false, code: 'INSCRIPTION_REJECTED', error: '阵纹参数无效' },
      400,
    );
  if (
    error instanceof InventoryError ||
    error instanceof InventoryRuleError ||
    error instanceof QiServiceError ||
    error instanceof QiInsufficientError ||
    error instanceof PlayerCommandIdempotencyError
  )
    return c.json(
      { success: false, code: 'INSCRIPTION_REJECTED', error: error.message },
      409,
    );
  console.error('[inscriptions] request failed', error);
  return c.json({ success: false, error: '本次结果暂未确认，请重试核对' }, 500);
});
router.get('/', async (c) =>
  c.json({
    success: true,
    data: await readInscriptions(c.get('activeCultivatorRef')!),
  }),
);
router.post('/', validateJson(InscriptionRequestSchema), async (c) =>
  c.json({
    success: true,
    ...(await mutateInscriptions(
      c.get('activeCultivatorRef')!,
      getValidatedJson(c),
    )),
  }),
);
export default router;
