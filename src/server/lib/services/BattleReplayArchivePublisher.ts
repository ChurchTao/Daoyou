import { getJetStreamClient } from '@server/lib/nats';
import {
  BATTLE_REPLAY_STREAM,
  BATTLE_REPLAY_SUBJECT,
  type BattleReplayArchiveJobV2,
} from '@shared/contracts/battleReplay';
import { JSONCodec } from 'nats';
import { releaseArenaRoomForBattle } from './BattleArenaRoomFinalizer';
import {
  clearBattleReplayArchiveTracking,
  getBattleReplayArchivePayload,
} from './BattleReplayRedisStore';
import type { RedisBattleBoardgameStorage } from './BattleBoardgameStorage';

const codec = JSONCodec<BattleReplayArchiveJobV2>();
const ARCHIVE_SCAN_BATCH_SIZE = 100;
const ARCHIVE_PUBLISH_CONCURRENCY = 4;
const ARCHIVE_RECONCILE_INTERVAL_MS = 15_000;
const ARCHIVE_RETRY_DELAY_MS = 5_000;

export async function publishPendingBattleReplays(
  storage: RedisBattleBoardgameStorage,
  matchIds: readonly string[],
): Promise<number> {
  const uniqueMatchIds = [...new Set(matchIds)];
  if (uniqueMatchIds.length === 0) return 0;
  let published = 0;
  const failures: unknown[] = [];
  let nextIndex = 0;
  const workers = Array.from(
    { length: Math.min(ARCHIVE_PUBLISH_CONCURRENCY, uniqueMatchIds.length) },
    async () => {
      while (nextIndex < uniqueMatchIds.length) {
        const matchId = uniqueMatchIds[nextIndex++];
        if (!matchId) continue;
        try {
          if (await publishBattleReplay(storage, matchId)) published += 1;
        } catch (error) {
          failures.push(error);
          console.warn('[battle-server] replay archive item publish failed', {
            matchId,
            error: error instanceof Error ? error.message : String(error),
          });
        }
      }
    },
  );
  await Promise.all(workers);
  if (failures.length > 0) {
    throw new AggregateError(failures, 'One or more battle replay archive jobs failed');
  }
  return published;
}

async function publishBattleReplay(
  storage: RedisBattleBoardgameStorage,
  matchId: string,
): Promise<boolean> {
  const payload = await getBattleReplayArchivePayload(matchId);
  if (!payload) {
    await clearBattleReplayArchiveTracking(matchId);
    return false;
  }
  if (payload.archiveStatus !== 'pending' && payload.archiveStatus !== 'published') {
    await clearBattleReplayArchiveTracking(matchId);
    return false;
  }
  if (payload.archiveStatus === 'pending') {
    // Room cleanup must not depend on NATS or PostgreSQL availability.
    await releaseArenaRoomForBattle(matchId);
  }
  const job: BattleReplayArchiveJobV2 = {
    version: 'battle_replay_archive_job_v2',
    subject: BATTLE_REPLAY_SUBJECT,
    matchId,
    attempt: payload.publishAttempt + 1,
    byteLength: payload.byteLength,
    checksum: payload.checksum,
  };
  const jetStream = await getJetStreamClient();
  await jetStream.publish(BATTLE_REPLAY_SUBJECT, codec.encode(job), {
    msgID: `${job.matchId}:archive:${job.attempt}`,
    expect: { streamName: BATTLE_REPLAY_STREAM },
    timeout: 5_000,
  });
  await storage.markArchivePublished(job.matchId, job.attempt);
  return true;
}

export class BattleReplayArchiveScheduler {
  private drainPromise: Promise<void> | undefined;
  private rerunRequested = false;
  private stopped = false;
  private pendingCursor = '0';
  private retryTimer: NodeJS.Timeout | undefined;
  private reconcileTimer: NodeJS.Timeout | undefined;

  constructor(private readonly storage: RedisBattleBoardgameStorage) {}

  start(): void {
    if (this.stopped || this.reconcileTimer) return;
    this.reconcileTimer = setInterval(
      () => this.wake(),
      ARCHIVE_RECONCILE_INTERVAL_MS,
    );
    this.reconcileTimer.unref();
    this.wake();
  }

  wake(): void {
    if (this.stopped) return;
    if (this.retryTimer) {
      this.rerunRequested = true;
      return;
    }
    if (this.drainPromise) {
      this.rerunRequested = true;
      return;
    }
    this.drainPromise = this.drain()
      .catch((error) => {
        console.warn('[battle-server] replay archive publish failed', {
          error: error instanceof Error ? error.message : String(error),
        });
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
    this.rerunRequested = false;
    if (this.retryTimer) clearTimeout(this.retryTimer);
    if (this.reconcileTimer) clearInterval(this.reconcileTimer);
    this.retryTimer = undefined;
    this.reconcileTimer = undefined;
    await this.drainPromise;
  }

  private async drain(): Promise<void> {
    const [pendingPage, unconfirmedMatchIds] = await Promise.all([
      this.storage.scanPendingArchiveMatchIds(
        this.pendingCursor,
        ARCHIVE_SCAN_BATCH_SIZE,
      ),
      this.storage.listUnconfirmedArchiveMatchIds(
        Date.now(),
        ARCHIVE_SCAN_BATCH_SIZE,
      ),
    ]);
    await publishPendingBattleReplays(this.storage, [
      ...pendingPage.matchIds,
      ...unconfirmedMatchIds,
    ]);
    this.pendingCursor = pendingPage.cursor;
    if (this.pendingCursor !== '0') this.rerunRequested = true;
  }

  private scheduleRetry(): void {
    if (this.stopped || this.retryTimer) return;
    this.retryTimer = setTimeout(() => {
      this.retryTimer = undefined;
      this.rerunRequested = false;
      this.wake();
    }, ARCHIVE_RETRY_DELAY_MS);
    this.retryTimer.unref();
  }
}
