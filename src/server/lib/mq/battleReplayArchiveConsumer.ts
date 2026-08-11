import { getJetStreamClient } from '@server/lib/nats';
import { archiveBattleReplay } from '@server/lib/repositories/battleReplayArchiveRepository';
import { ArenaRoomService } from '@server/lib/services/ArenaRoomService';
import { publishArenaRoomChanges } from '@server/lib/services/arenaRoomBroadcaster';
import {
  BATTLE_REPLAY_STREAM,
  BATTLE_REPLAY_SUBJECT,
  parseBattleReplayArchiveMessage,
  type BattleReplayArchiveMessageV1,
} from '@shared/contracts/battleReplay';
import { JSONCodec, type ConsumerMessages, type JsMsg } from 'nats';
import {
  BATTLE_REPLAY_ARCHIVE_CONSUMER,
  BATTLE_REPLAY_DEAD_LETTER_STREAM,
  BATTLE_REPLAY_DEAD_LETTER_SUBJECT,
  consumerRetryDelayMs,
} from './natsTopology';

const codec = JSONCodec();
let messages: ConsumerMessages | undefined;
let consumerTask: Promise<void> | undefined;
let stopping = false;
let healthy = false;
const activeHandlers = new Set<Promise<void>>();
let cancelRestartWait: (() => void) | undefined;

const RESTART_DELAYS_MS = [1_000, 5_000, 15_000, 60_000] as const;
const arenaRooms = new ArenaRoomService();

async function deadLetterInvalidMessage(message: JsMsg, error: unknown): Promise<void> {
  const jetStream = await getJetStreamClient();
  await jetStream.publish(
    BATTLE_REPLAY_DEAD_LETTER_SUBJECT,
    codec.encode({
      consumerName: BATTLE_REPLAY_ARCHIVE_CONSUMER.name,
      originalSubject: message.subject,
      streamSequence: message.info.streamSequence,
      failedAt: new Date().toISOString(),
      error: (error instanceof Error ? error.message : String(error)).slice(0, 2_000),
      payloadPrefix: message.string().slice(0, 512 * 1_024),
    }),
    {
      msgID: `invalid:${message.info.streamSequence}`,
      expect: { streamName: BATTLE_REPLAY_DEAD_LETTER_STREAM },
      timeout: 5_000,
    },
  );
}

async function processMessage(message: JsMsg): Promise<void> {
  let archiveMessage: BattleReplayArchiveMessageV1;
  try {
    if (message.subject !== BATTLE_REPLAY_SUBJECT) {
      throw new Error(`Unexpected battle replay subject: ${message.subject}`);
    }
    archiveMessage = parseBattleReplayArchiveMessage(message.json());
  } catch (error) {
    try {
      await deadLetterInvalidMessage(message, error);
      message.term();
    } catch (deadLetterError) {
      console.error('[battle-replay-archiver] invalid message dead-letter failed', {
        streamSequence: message.info.streamSequence,
        deadLetterError,
      });
      message.nak(60_000);
    }
    return;
  }
  try {
    await archiveBattleReplay(archiveMessage.replay);
    const arenaRoom = await arenaRooms.finishByBattleMatch(archiveMessage.replay.matchId);
    if (arenaRoom) {
      publishArenaRoomChanges(
        arenaRoom.teams.alpha.concat(arenaRoom.teams.beta).map((seat) => seat.userId),
        {
          roomId: arenaRoom.roomId,
          revision: arenaRoom.revision + 1,
          status: arenaRoom.status,
        },
      );
    }
    const acknowledged = await message.ackAck({ timeout: 5_000 });
    if (!acknowledged) throw new Error('Battle replay JetStream ACK was not confirmed');
  } catch (error) {
    console.error('[battle-replay-archiver] PostgreSQL archive failed; retrying', {
      streamSequence: message.info.streamSequence,
      deliveryCount: message.info.deliveryCount,
      error,
    });
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
        if (!stopping) throw new Error('Battle replay archive consumer stopped unexpectedly');
      } catch (error) {
        healthy = false;
        if (!started) {
          consumerTask = undefined;
          rejectInitialStart(error);
          return;
        }
        if (!stopping) {
          const delayMs = RESTART_DELAYS_MS[Math.min(restartAttempt, RESTART_DELAYS_MS.length - 1)]!;
          restartAttempt += 1;
          console.error('[battle-replay-archiver] consumer stopped; restarting', { delayMs, error });
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
