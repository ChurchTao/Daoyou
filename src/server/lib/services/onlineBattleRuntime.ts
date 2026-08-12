import { BattleReplayArchiveScheduler } from './BattleReplayArchivePublisher';
import { BattleResolutionTaskScheduler } from './BattleResolutionTaskPublisher';
import { BattleTerminalOutboxScheduler } from './BattleTerminalOutboxPublisher';
import { reconcileBattleTerminalCleanup } from './BattleTerminalReconciler';
import { closeOnlineBattleBroadcaster } from './onlineBattleBroadcaster';
import { OnlineBattleCoordinator } from './OnlineBattleCoordinator';
import {
  createOnlineBattleIndexReconcileCursor,
  reconcileOnlineBattleIndexes,
} from './OnlineBattleIndexReconciler';
import { observeOnlineBattleMetric } from './OnlineBattleMetrics';

const SCHEDULER_INTERVAL_MS = 250;
const RESOLVING_RECOVERY_INTERVAL_MS = 1_000;
const INDEX_RECONCILE_INTERVAL_MS = 5_000;
const BATCH_SIZE = 100;

let coordinator: OnlineBattleCoordinator | null = null;
let archiveScheduler: BattleReplayArchiveScheduler | null = null;
let terminalOutboxScheduler: BattleTerminalOutboxScheduler | null = null;
let resolutionTaskScheduler: BattleResolutionTaskScheduler | null = null;
let scheduler: ReturnType<typeof setInterval> | null = null;
let schedulerRunning = false;
let resolvingCursor = '0';
let nextResolvingRecoveryAt = 0;
let nextSchedulerExpectedAt = 0;
let terminalCleanupCursor = '0';
let nextTerminalReconcileAt = 0;
let indexReconcileCursor = createOnlineBattleIndexReconcileCursor();
let nextIndexReconcileAt = 0;

export function getOnlineBattleCoordinator(): OnlineBattleCoordinator {
  coordinator ??= new OnlineBattleCoordinator();
  return coordinator;
}

export async function startOnlineBattleRuntime(): Promise<void> {
  const current = getOnlineBattleCoordinator();
  await current.store.connect();
  archiveScheduler = new BattleReplayArchiveScheduler(current.store);
  current.store.setArchivePendingListener(() => archiveScheduler?.wake());
  archiveScheduler.start();
  terminalOutboxScheduler = new BattleTerminalOutboxScheduler(current.store);
  current.store.setTerminalOutboxPendingListener(() =>
    terminalOutboxScheduler?.wake(),
  );
  terminalOutboxScheduler.start();
  resolutionTaskScheduler = new BattleResolutionTaskScheduler(current.store);
  current.store.setResolutionTaskPendingListener(() =>
    resolutionTaskScheduler?.wake(),
  );
  resolutionTaskScheduler.start();
  nextSchedulerExpectedAt = Date.now() + SCHEDULER_INTERVAL_MS;
  scheduler = setInterval(() => void runScheduler(), SCHEDULER_INTERVAL_MS);
  scheduler.unref();
  await runScheduler();
}

export async function stopOnlineBattleRuntime(): Promise<void> {
  if (scheduler) clearInterval(scheduler);
  scheduler = null;
  await archiveScheduler?.stop();
  archiveScheduler = null;
  await terminalOutboxScheduler?.stop();
  terminalOutboxScheduler = null;
  await resolutionTaskScheduler?.stop();
  resolutionTaskScheduler = null;
  coordinator?.close();
  coordinator = null;
  await closeOnlineBattleBroadcaster();
}

async function runScheduler(): Promise<void> {
  if (schedulerRunning || !coordinator) return;
  schedulerRunning = true;
  try {
    const now = Date.now();
    if (nextSchedulerExpectedAt > 0) {
      observeOnlineBattleMetric(
        'scheduler_lag_ms',
        Math.max(0, now - nextSchedulerExpectedAt),
      );
    }
    nextSchedulerExpectedAt = now + SCHEDULER_INTERVAL_MS;
    if (now >= nextIndexReconcileAt) {
      indexReconcileCursor = await reconcileOnlineBattleIndexes(
        coordinator.store,
        indexReconcileCursor,
        BATCH_SIZE,
      );
      nextIndexReconcileAt = now + INDEX_RECONCILE_INTERVAL_MS;
    }
    const [expired, waiting] = await Promise.all([
      coordinator.store.claimExpiredMatchIds(now, BATCH_SIZE),
      coordinator.store.claimExpiredWaitingMatchIds(now, BATCH_SIZE),
    ]);
    await Promise.allSettled(
      expired.map(async (matchId) => {
        await coordinator!.resolveDeadline(matchId);
        await coordinator!.store.reconcileMatchIndexes(matchId);
      }),
    );
    await Promise.allSettled(
      waiting.map(async (matchId) => {
        await coordinator!.expireWaiting(matchId, now);
        await coordinator!.store.reconcileMatchIndexes(matchId);
      }),
    );
    if (now >= nextResolvingRecoveryAt) {
      const page = await coordinator.store.scanResolvingMatchIds(
        resolvingCursor,
        BATCH_SIZE,
      );
      resolvingCursor = page.cursor;
      nextResolvingRecoveryAt = now + RESOLVING_RECOVERY_INTERVAL_MS;
      await Promise.allSettled(
        page.matchIds.map((matchId) =>
          coordinator!.scheduleResolution(matchId),
        ),
      );
    }
    if (now >= nextTerminalReconcileAt) {
      terminalCleanupCursor = await reconcileBattleTerminalCleanup(
        coordinator.store,
        terminalCleanupCursor,
      );
      nextTerminalReconcileAt = now + 10_000;
    }
  } catch (error) {
    console.warn('[online-battle] scheduler scan failed', {
      error: error instanceof Error ? error.message : String(error),
    });
  } finally {
    schedulerRunning = false;
  }
}
