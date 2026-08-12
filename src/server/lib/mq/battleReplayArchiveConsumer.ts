import { getJetStreamClient } from '@server/lib/nats';
import { archiveBattleReplay } from '@server/lib/repositories/battleReplayArchiveRepository';
import {
  clearBattleReplayArchiveTracking,
  getBattleReplayArchivePointer,
  markBattleReplayArchived,
} from '@server/lib/services/BattleReplayRedisStore';
import { OnlineBattleStore } from '@server/lib/services/OnlineBattleStore';
import {
  BATTLE_REPLAY_STREAM,
  BATTLE_REPLAY_SUBJECT,
  parseBattleReplayArchiveJob,
  type BattleReplayArchiveJobV3,
} from '@shared/contracts/battleReplay';
import { type ConsumerMessages, type JsMsg } from 'nats';
import {
  BATTLE_REPLAY_ARCHIVE_CONSUMER,
  consumerRetryDelayMs,
} from './natsTopology';

let messages: ConsumerMessages | undefined;
let consumerTask: Promise<void> | undefined;
let stopping = false;
let healthy = false;
const activeHandlers = new Set<Promise<void>>();
let cancelRestartWait: (() => void) | undefined;

const RESTART_DELAYS_MS = [1_000, 5_000, 15_000, 60_000] as const;
const store = new OnlineBattleStore();

async function processMessage(message: JsMsg): Promise<void> {
  let archiveJob: BattleReplayArchiveJobV3;
  try {
    if (message.subject !== BATTLE_REPLAY_SUBJECT) {
      throw new Error(`Unexpected battle replay subject: ${message.subject}`);
    }
    archiveJob = parseBattleReplayArchiveJob(message.json());
  } catch (error) {
    console.warn('[battle-replay-archiver] discarded invalid archive job', {
      streamSequence: message.info.streamSequence,
      error: error instanceof Error ? error.message : String(error),
    });
    message.term();
    return;
  }
  try {
    const pointer = await getBattleReplayArchivePointer(archiveJob.matchId);
    if (
      !pointer ||
      pointer.archiveStatus === 'archived' ||
      pointer.expectedStorageRevision !== archiveJob.expectedStorageRevision
    ) {
      const acknowledged = await message.ackAck({ timeout: 5_000 });
      if (!acknowledged)
        throw new Error('Stale replay archive ACK was not confirmed');
      return;
    }
    const replay = await store.buildReplayArchive(
      archiveJob.matchId,
      archiveJob.expectedStorageRevision,
    );
    if (!replay) {
      console.error(
        '[battle-replay-archiver] discarded unrecoverable replay source',
        { matchId: archiveJob.matchId },
      );
      await clearBattleReplayArchiveTracking(archiveJob.matchId);
      await store.retire(archiveJob.matchId);
      message.term();
      return;
    }
    await archiveBattleReplay(replay);
    const confirmed = await markBattleReplayArchived(
      replay.matchId,
      archiveJob.expectedStorageRevision,
    );
    if (!confirmed) {
      console.warn(
        '[battle-replay-archiver] Redis archive confirmation was unavailable',
        {
          matchId: replay.matchId,
        },
      );
    }
    const acknowledged = await message.ackAck({ timeout: 5_000 });
    if (!acknowledged)
      throw new Error('Battle replay JetStream ACK was not confirmed');
  } catch (error) {
    console.error(
      '[battle-replay-archiver] PostgreSQL archive failed; retrying',
      {
        streamSequence: message.info.streamSequence,
        deliveryCount: message.info.deliveryCount,
        error,
      },
    );
    message.nak(consumerRetryDelayMs(message.info.deliveryCount));
  }
}

export async function startBattleReplayArchiveConsumer(): Promise<void> {
  if (consumerTask) return;
  stopping = false;
  let resolveInitialStart!: () => void;
  let rejectInitialStart!: (error: unknown) => void;
  const initialStart = new Promise<void>((resolve, reject) => {
    resolveInitialStart = resolve;
    rejectInitialStart = reject;
  });
  consumerTask = (async () => {
    let started = false;
    let restartAttempt = 0;
    while (!stopping) {
      const handlers = new Set<Promise<void>>();
      try {
        const jetStream = await getJetStreamClient();
        const consumer = await jetStream.consumers.get(
          BATTLE_REPLAY_STREAM,
          BATTLE_REPLAY_ARCHIVE_CONSUMER.name,
        );
        messages = await consumer.consume({
          max_messages: BATTLE_REPLAY_ARCHIVE_CONSUMER.concurrency,
        });
        healthy = true;
        restartAttempt = 0;
        if (!started) {
          started = true;
          resolveInitialStart();
        } else {
          console.info('[battle-replay-archiver] restarted');
        }
        for await (const message of messages!) {
          const handler = processMessage(message).finally(() => {
            activeHandlers.delete(handler);
            handlers.delete(handler);
          });
          activeHandlers.add(handler);
          handlers.add(handler);
          if (handlers.size >= BATTLE_REPLAY_ARCHIVE_CONSUMER.concurrency) {
            await Promise.race(handlers);
          }
        }
        if (!stopping)
          throw new Error(
            'Battle replay archive consumer stopped unexpectedly',
          );
      } catch (error) {
        healthy = false;
        if (!started) {
          consumerTask = undefined;
          rejectInitialStart(error);
          return;
        }
        if (!stopping) {
          const delayMs =
            RESTART_DELAYS_MS[
              Math.min(restartAttempt, RESTART_DELAYS_MS.length - 1)
            ]!;
          restartAttempt += 1;
          console.error(
            '[battle-replay-archiver] consumer stopped; restarting',
            { delayMs, error },
          );
          await new Promise<void>((resolve) => {
            const timer = setTimeout(() => {
              cancelRestartWait = undefined;
              resolve();
            }, delayMs);
            timer.unref();
            cancelRestartWait = () => {
              clearTimeout(timer);
              cancelRestartWait = undefined;
              resolve();
            };
          });
        }
      } finally {
        healthy = false;
        messages = undefined;
        await Promise.allSettled([...handlers]);
      }
    }
  })();
  await initialStart;
  console.info('[battle-replay-archiver] started', {
    consumerName: BATTLE_REPLAY_ARCHIVE_CONSUMER.name,
  });
}

export async function stopBattleReplayArchiveConsumer(): Promise<void> {
  stopping = true;
  cancelRestartWait?.();
  messages?.stop();
  await consumerTask;
  consumerTask = undefined;
  await Promise.allSettled([...activeHandlers]);
  activeHandlers.clear();
}

export function isBattleReplayArchiveConsumerHealthy(): boolean {
  return healthy && !stopping;
}
