import { requireAdmin } from '@server/lib/hono/middleware';
import type { AppEnv } from '@server/lib/hono/types';
import {
  AdminBattleSimulatorError,
  adminBattleSimulatorService,
} from '@server/lib/services/AdminBattleSimulatorService';
import {
  AdminBattleDuelRequestSchema,
  AdminBattleMonteCarloRequestSchema,
} from '@shared/contracts/adminBattleSimulator';
import { Hono, type Context } from 'hono';

const router = new Hono<AppEnv>();

function errorResponse(c: Context<AppEnv>, error: unknown) {
  if (error instanceof AdminBattleSimulatorError) {
    const status = error.status === 404 ? 404 : error.status === 500 ? 500 : 400;
    return c.json({ success: false, error: error.message }, status);
  }

  const message = error instanceof Error ? error.message : '对战模拟失败';
  return c.json({ success: false, error: message }, 500);
}

router.post('/duel', requireAdmin(), async (c) => {
  const body = await c.req.json().catch(() => null);
  const parsed = AdminBattleDuelRequestSchema.safeParse(body);
  if (!parsed.success) {
    return c.json(
      { success: false, error: '参数错误', details: parsed.error.flatten() },
      400,
    );
  }

  try {
    const data = await adminBattleSimulatorService.duel(parsed.data);
    return c.json({ success: true, data });
  } catch (error) {
    return errorResponse(c, error);
  }
});

router.post('/monte-carlo', requireAdmin(), async (c) => {
  const body = await c.req.json().catch(() => null);
  const parsed = AdminBattleMonteCarloRequestSchema.safeParse(body);
  if (!parsed.success) {
    return c.json(
      { success: false, error: '参数错误', details: parsed.error.flatten() },
      400,
    );
  }

  try {
    const data = await adminBattleSimulatorService.monteCarlo(parsed.data);
    return c.json({ success: true, data });
  } catch (error) {
    return errorResponse(c, error);
  }
});

export default router;
