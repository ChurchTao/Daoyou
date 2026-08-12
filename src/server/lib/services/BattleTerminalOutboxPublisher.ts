import { getJetStreamClient } from '@server/lib/nats';
import {
  BATTLE_TERMINAL_STREAM,
  BATTLE_TERMINAL_SUBJECT,
  type BattleTerminalOutboxV1,
} from '@shared/contracts/battleTerminal';
import { JSONCodec } from 'nats';
import type { OnlineBattleStore } from './OnlineBattleStore';

const codec = JSONCodec<BattleTerminalOutboxV1>();
const SCAN_BATCH_SIZE = 100;
const PUBLISH_CONCURRENCY = 4;
const RECONCILE_INTERVAL_MS = 10_000;
const RETRY_DELAY_MS = 1_000;

export async function publishPendingBattleTerminalEvents(
  store: Pick<
    OnlineBattleStore,
    | 'scanPendingTerminalOutboxMatchIds'
    | 'getTerminalOutbox'
    | 'markTerminalOutboxPublished'
  >,
  cursor = '0',
): Promise<string> {
  const page = await store.scanPendingTerminalOutboxMatchIds(
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
          const outbox = await store.getTerminalOutbox(matchId);
          if (!outbox) continue;
          const jetStream = await getJetStreamClient();
          await jetStream.publish(
            BATTLE_TERMINAL_SUBJECT,
            codec.encode(outbox),
            {
              msgID: outbox.event.eventId,
              expect: { streamName: BATTLE_TERMINAL_STREAM },
              timeout: 5_000,
            },
          );
          await store.markTerminalOutboxPublished(matchId);
        } catch (error) {
          failures.push(error);
          console.warn('[battle-terminal] outbox publish failed', {
            matchId,
            error: error instanceof Error ? error.message : String(error),
          });
        }
      }
    },
  );
  await Promise.all(workers);
  if (failures.length > 0) {
    throw new AggregateError(failures, 'One or more battle terminal events failed');
  }
  return page.cursor;
}

export class BattleTerminalOutboxScheduler {
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
        console.warn('[battle-terminal] outbox drain failed', { error });
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
    this.cursor = await publishPendingBattleTerminalEvents(
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
