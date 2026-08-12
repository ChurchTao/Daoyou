import { requireAdmin } from '@server/lib/hono/middleware';
import type { AppEnv } from '@server/lib/hono/types';
import {
  getOnlineBattleMetricsSnapshot,
  recordOnlineBattleOperatorAction,
} from '@server/lib/services/OnlineBattleMetrics';
import { getOnlineBattleCoordinator } from '@server/lib/services/onlineBattleRuntime';
import { Hono, type Context } from 'hono';
import { z } from 'zod';

const MatchIdSchema = z.string().min(1).max(120).regex(/^[A-Za-z0-9_-]+$/);
const router = new Hono<AppEnv>();

router.get('/metrics', requireAdmin(), (c) => c.json({
  success: true,
  data: getOnlineBattleMetricsSnapshot(),
}));

router.get('/:matchId', requireAdmin(), async (c) => {
  const matchId = MatchIdSchema.parse(c.req.param('matchId'));
  const diagnostic = await getOnlineBattleCoordinator().runtimeDiagnostic(matchId);
  return c.json({ success: true, data: diagnostic });
});

router.post('/:matchId/retry-resolution', requireAdmin(), async (c) => {
  const matchId = MatchIdSchema.parse(c.req.param('matchId'));
  const coordinator = getOnlineBattleCoordinator();
  const before = await coordinator.runtimeDiagnostic(matchId);
  const changed = await coordinator.retryResolution(matchId);
  recordOperatorAction(c, {
    action: 'retry_resolution',
    matchId,
    changed,
    fingerprint:
      before.resolving?.failureFingerprint ??
      before.resolutionRetry?.lastFailureFingerprint,
    attempt: before.resolutionRetry?.attempt,
  });
  return c.json({
    success: changed,
    changed,
    data: await coordinator.runtimeDiagnostic(matchId),
  }, changed ? 200 : 409);
});

router.post('/:matchId/technical-abort', requireAdmin(), async (c) => {
  const matchId = MatchIdSchema.parse(c.req.param('matchId'));
  const coordinator = getOnlineBattleCoordinator();
  const before = await coordinator.runtimeDiagnostic(matchId);
  const changed = await coordinator.technicalAbort(matchId);
  recordOperatorAction(c, {
    action: 'technical_abort',
    matchId,
    changed,
    fingerprint:
      before.resolving?.failureFingerprint ??
      before.resolutionRetry?.lastFailureFingerprint,
    attempt: before.resolutionRetry?.attempt,
  });
  return c.json({
    success: changed,
    changed,
    data: await coordinator.runtimeDiagnostic(matchId),
  }, changed ? 200 : 409);
});

export default router;

function recordOperatorAction(
  c: Context<AppEnv>,
  input: {
    readonly action: 'retry_resolution' | 'technical_abort';
    readonly matchId: string;
    readonly changed: boolean;
    readonly fingerprint?: string;
    readonly attempt?: number;
  },
): void {
  const user = c.get('user');
  const event = {
    ...input,
    operatorId: user?.id ?? 'unknown',
    recordedAt: Date.now(),
  };
  recordOnlineBattleOperatorAction(event);
  console.info('[online-battle] admin operation', event);
}
