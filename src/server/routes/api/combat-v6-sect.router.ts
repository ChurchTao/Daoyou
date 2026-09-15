import {
  getValidatedJson,
  redisLockErrorResponse,
  requireActiveCultivatorRef,
  validateJson,
} from '@server/lib/hono/middleware';
import type { AppEnv } from '@server/lib/hono/types';
import { InventoryError } from '@server/lib/services/InventoryService';
import { CombatV6BuildError } from '@server/lib/services/combat-v6/CombatV6BuildService';
import {
  mutateSectV6,
  readSectV6,
} from '@server/lib/services/combat-v6/CombatV6SectService';
import { SectV6ActionSchema } from '@shared/contracts/combatV6Sect';
import { SectV6RuleError } from '@shared/engine/combat-v6/sect-progression';
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
    return c.json({ success: false, error: '参数无效' }, 400);
  if (
    error instanceof InventoryError ||
    error instanceof SectV6RuleError ||
    error instanceof CombatV6BuildError
  )
    return c.json({ success: false, error: error.message }, 409);
  console.error('[sect-v6]', error);
  return c.json(
    { success: false, error: '请求未完成，请刷新核对传承与资源' },
    500,
  );
});
router.get('/', async (c) =>
  c.json({
    success: true,
    data: await readSectV6(c.get('activeCultivatorRef')!.cultivatorId),
  }),
);
router.post('/', validateJson(SectV6ActionSchema), async (c) =>
  c.json({
    success: true,
    ...(await mutateSectV6(
      c.get('activeCultivatorRef')!.cultivatorId,
      getValidatedJson(c),
    )),
  }),
);
export default router;
