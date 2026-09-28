import {
  getValidatedJson,
  requireActiveCultivatorRef,
  validateJson,
} from '@server/lib/hono/middleware';
import type { AppEnv } from '@server/lib/hono/types';
import {
  AutoStrategyError,
  readCombatAutoStrategy,
  resetCombatAutoStrategy,
  saveCombatAutoStrategy,
} from '@server/lib/services/combat-v6/CombatV6AutoStrategyService';
import { CombatV6BuildError } from '@server/lib/services/combat-v6/CombatV6BuildService';
import { AutoStrategySchema } from '@shared/combat-v6/auto-strategy';
import { Hono } from 'hono';
import { z } from 'zod';

const router = new Hono<AppEnv>();
const mutation = z.strictObject({
  pathId: z.string().min(1).max(160),
  strategy: AutoStrategySchema,
});
const reset = z.strictObject({ pathId: z.string().min(1).max(160) });
router.use('*', requireActiveCultivatorRef());
router.use('*', async (c, next) => {
  c.header('Cache-Control', 'no-store');
  await next();
});
router.onError((error, c) => {
  if (error instanceof AutoStrategyError || error instanceof CombatV6BuildError)
    return c.json({ success: false, error: error.message }, 409);
  if (error instanceof z.ZodError)
    return c.json({ success: false, error: '策略格式无效' }, 400);
  console.error('[combat-auto-strategy]', error);
  return c.json({ success: false, error: '策略操作失败，请稍后重试' }, 500);
});
router.get('/', async (c) =>
  c.json({
    success: true,
    data: await readCombatAutoStrategy(
      c.get('activeCultivatorRef')!.cultivatorId,
    ),
  }),
);
router.put('/', validateJson(mutation), async (c) => {
  const { pathId, strategy } = getValidatedJson<z.infer<typeof mutation>>(c);
  return c.json({
    success: true,
    data: await saveCombatAutoStrategy(
      c.get('activeCultivatorRef')!.cultivatorId,
      pathId,
      strategy,
    ),
  });
});
router.delete('/', validateJson(reset), async (c) => {
  const { pathId } = getValidatedJson<z.infer<typeof reset>>(c);
  return c.json({
    success: true,
    data: await resetCombatAutoStrategy(
      c.get('activeCultivatorRef')!.cultivatorId,
      pathId,
    ),
  });
});
export default router;
