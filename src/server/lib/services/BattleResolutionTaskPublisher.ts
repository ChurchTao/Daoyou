import { getJetStreamClient } from '@server/lib/nats';
import {
  BATTLE_RESOLUTION_STREAM,
  BATTLE_RESOLUTION_SUBJECT,
  type BattleResolutionTaskV1,
} from '@shared/contracts/battleResolutionTask';
import { JSONCodec } from 'nats';
import type { OnlineBattleStore } from './OnlineBattleStore';

const codec = JSONCodec<BattleResolutionTaskV1>();
const SCAN_BATCH_SIZE = 100;
const PUBLISH_CONCURRENCY = 4;
const RECONCILE_INTERVAL_MS = 1_000;
const RETRY_DELAY_MS = 500;

export async function publishPendingBattleResolutionTasks(
  store: Pick<
    OnlineBattleStore,
    | 'scanPendingResolutionTaskMatchIds'
    | 'getResolutionTaskDelivery'
    | 'markResolutionTaskPublished'
  >,
  cursor = '0',
): Promise<string> {
  const page = await store.scanPendingResolutionTaskMatchIds(
    cursor,
    SCAN_BATCH_SIZE,
  );
  const queue = [...new Set(page.matchIds)];
  const failures: unknown[] = [];
  const workers = Array.from(
    { length: Math.min(PUBLISH_CONCURRENCY, queue.length) },
    async () => {
      for (;;) {
        const matchId = queue.shift();
        if (!matchId) return;
        try {
          const delivery = await store.getResolutionTaskDelivery(matchId);
          if (!delivery) continue;
          const { task, publishAttempt } = delivery;
          const jetStream = await getJetStreamClient();
          await jetStream.publish(
            BATTLE_RESOLUTION_SUBJECT,
            codec.encode(task),
            {
              msgID: `${task.taskId}:publish:${publishAttempt}`,
              expect: { streamName: BATTLE_RESOLUTION_STREAM },
              timeout: 5_000,
            },
          );
          await store.markResolutionTaskPublished(
            matchId,
            task,
            publishAttempt,
          );
        } catch (error) {
          failures.push(error);
          console.warn('[battle-resolution] task publish failed', {
            matchId,
            error: error instanceof Error ? error.message : String(error),
          });
        }
      }
    },
  );
  await Promise.all(workers);
  if (failures.length > 0) {
    throw new AggregateError(
      failures,
      'One or more battle resolution tasks failed',
    );
  }
  return page.cursor;
}

export class BattleResolutionTaskScheduler {
  private cursor = '0';
  private drainPromise: Promise<void> | undefined;
  private retryTimer: NodeJS.Timeout | undefined;
  private reconcileTimer: NodeJS.Timeout | undefined;
  private rerunRequested = false;
  private stopped = false;

  constructor(private readonly store: OnlineBattleStore) {}

  start(): void {
    if (this.stopped || this.reconcileTimer) return;
    this.reconcileTimer = setInterval(() => this.wake(), RECONCILE_INTERVAL_MS);
    this.reconcileTimer.unref();
    this.wake();
  }

  wake(): void {
    if (this.stopped) return;
    if (this.retryTimer || this.drainPromise) {
      this.rerunRequested = true;
      return;
    }
    this.drainPromise = this.drain()
      .catch((error) => {
        console.warn('[battle-resolution] task drain failed', { error });
        this.scheduleRetry();
      })
      .finally(() => {
        this.drainPromise = undefined;
        if (this.rerunRequested && !this.retryTimer && !this.stopped) {
          this.rerunRequested = false;
          queueMicrotask(() => this.wake());
        }
      });
  }

  async stop(): Promise<void> {
    this.stopped = true;
    if (this.retryTimer) clearTimeout(this.retryTimer);
    if (this.reconcileTimer) clearInterval(this.reconcileTimer);
    await this.drainPromise;
  }

  private async drain(): Promise<void> {
    this.cursor = await publishPendingBattleResolutionTasks(
      this.store,
      this.cursor,
    );
    if (this.cursor !== '0') this.rerunRequested = true;
  }

  private scheduleRetry(): void {
    if (this.stopped || this.retryTimer) return;
    this.retryTimer = setTimeout(() => {
      this.retryTimer = undefined;
      this.wake();
    }, RETRY_DELAY_MS);
    this.retryTimer.unref();
  }
}
