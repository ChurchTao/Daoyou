import { getJetStreamClient } from '@server/lib/nats';
import {
  parseBackgroundCommandEnvelope,
  type BackgroundCommandEnvelope,
  type BackgroundCommandType,
} from '@shared/contracts/backgroundCommands';
import { JSONCodec, type ConsumerMessages, type JsMsg } from 'nats';
import {
  runAuctionExpireJob,
  runBetBattleExpireJob,
  runExpiredDataCleanupJob,
  runMarketRefreshCronJob,
  runMaterialLibraryDailyGenerationJob,
  runRankRewardsJob,
  runResourceReplayCleanupJob,
  runSponsorshipAdminDigestJob,
  runSponsorshipCleanupJob,
  runSponsorshipReconcileJob,
  runTowerEnemySetRefreshJob,
} from '../jobs/internalCron';
import {
  BACKGROUND_COMMAND_CONSUMER,
  COMMAND_DEAD_LETTER_STREAM,
  COMMAND_DEAD_LETTER_SUBJECT_PREFIX,
  consumerRetryDelayMs,
} from './natsTopology';

const MAX_PROCESSING_ATTEMPTS = 10;
const WORKING_INTERVAL_MS = 30_000;
const CONSUMER_RESTART_DELAYS_MS = [
  1_000, 2_000, 5_000, 10_000, 30_000,
] as const;
const codec = JSONCodec();
let runningMessages: ConsumerMessages | undefined;
let consumerTask: Promise<void> | undefined;
let stopping = false;
let healthy = false;
let cancelRestartWait: (() => void) | undefined;
const activeHandlers = new Set<Promise<void>>();

const handlers = {
  'auction.expire': () => runAuctionExpireJob(),
  'bet-battle.expire': () => runBetBattleExpireJob(),
  'ranking.rewards.distribute': (command) =>
    runRankRewardsJob(new Date(command.requestedAt)),
  'market.refresh': () => runMarketRefreshCronJob(),
  'tower.enemy-sets.refresh': () => runTowerEnemySetRefreshJob(),
  'resource-replay.cleanup': () => runResourceReplayCleanupJob(),
  'expired-data.cleanup': () => runExpiredDataCleanupJob(),
  'material-library.generate': (command) =>
    runMaterialLibraryDailyGenerationJob(new Date(command.requestedAt)),
  'sponsorship.reconcile': () => runSponsorshipReconcileJob(false),
  'sponsorship.deep-reconcile': () => runSponsorshipReconcileJob(true),
  'sponsorship.cleanup': () => runSponsorshipCleanupJob(),
  'sponsorship.admin-digest': () => runSponsorshipAdminDigestJob(),
} satisfies Record<
  BackgroundCommandType,
  (command: BackgroundCommandEnvelope) => Promise<unknown>
>;

async function publishDeadLetter(
  message: JsMsg,
  command: BackgroundCommandEnvelope | null,
  error: unknown,
): Promise<void> {
  const jetStream = await getJetStreamClient();
  await jetStream.publish(
    `${COMMAND_DEAD_LETTER_SUBJECT_PREFIX}.${BACKGROUND_COMMAND_CONSUMER.name}`,
    codec.encode({
      consumerName: BACKGROUND_COMMAND_CONSUMER.name,
      command,
      originalSubject: message.subject,
      streamSequence: message.info.streamSequence,
      deliveryCount: message.info.deliveryCount,
      failedAt: new Date().toISOString(),
      error: (error instanceof Error ? error.message : String(error)).slice(
        0,
        2_000,
      ),
      payload: message.string(),
    }),
    {
      msgID: `${BACKGROUND_COMMAND_CONSUMER.name}:${message.info.streamSequence}`,
      expect: { streamName: COMMAND_DEAD_LETTER_STREAM },
      timeout: 5_000,
    },
  );
}

async function processMessage(message: JsMsg): Promise<void> {
  let command: BackgroundCommandEnvelope | null = null;
  const workingTimer = setInterval(() => {
    try {
      message.working();
    } catch (error) {
      console.warn('[background-command-consumer] working heartbeat failed', {
        streamSequence: message.info.streamSequence,
        error,
      });
    }
  }, WORKING_INTERVAL_MS);
  workingTimer.unref();
  try {
    command = parseBackgroundCommandEnvelope(message.json());
    if (command.subject !== message.subject) {
      throw new Error(
        `后台命令 subject 不一致: ${command.subject} != ${message.subject}`,
      );
    }
    await handlers[command.type](command);
    const acknowledged = await message.ackAck({ timeout: 5_000 });
    if (!acknowledged) throw new Error('后台命令 JetStream 双向 ACK 未确认');
  } catch (error) {
    console.error('[background-command-consumer] processing failed', {
      commandType: command?.type,
      subject: message.subject,
      deliveryCount: message.info.deliveryCount,
      streamSequence: message.info.streamSequence,
      error,
    });
    if (message.info.deliveryCount >= MAX_PROCESSING_ATTEMPTS) {
      try {
        await publishDeadLetter(message, command, error);
        message.term();
      } catch (deadLetterError) {
        console.error('[background-command-consumer] dead-letter failed', {
          streamSequence: message.info.streamSequence,
          deadLetterError,
        });
        message.nak(60_000);
      }
    } else {
      message.nak(consumerRetryDelayMs(message.info.deliveryCount));
    }
  } finally {
    clearInterval(workingTimer);
  }
}

export async function startBackgroundCommandConsumer(): Promise<void> {
  if (consumerTask) return;
  stopping = false;

  let resolveInitialStart!: () => void;
  let rejectInitialStart!: (error: unknown) => void;
  const initialStart = new Promise<void>((resolve, reject) => {
    resolveInitialStart = resolve;
    rejectInitialStart = reject;
  });
  consumerTask = superviseBackgroundCommandConsumer(
    resolveInitialStart,
    rejectInitialStart,
  );
  await initialStart;

  console.info('[background-command-consumer] started', {
    consumerName: BACKGROUND_COMMAND_CONSUMER.name,
    concurrency: BACKGROUND_COMMAND_CONSUMER.concurrency,
  });
}

async function superviseBackgroundCommandConsumer(
  resolveInitialStart: () => void,
  rejectInitialStart: (error: unknown) => void,
): Promise<void> {
  let started = false;
  let restartAttempt = 0;

  while (!stopping) {
    const handlers = new Set<Promise<void>>();
    try {
      const jetStream = await getJetStreamClient();
      const consumer = await jetStream.consumers.get(
        BACKGROUND_COMMAND_CONSUMER.stream,
        BACKGROUND_COMMAND_CONSUMER.name,
      );
      const messages = await consumer.consume({
        max_messages: BACKGROUND_COMMAND_CONSUMER.concurrency,
      });
      runningMessages = messages;
      healthy = true;
      restartAttempt = 0;
      if (!started) {
        started = true;
        resolveInitialStart();
      } else {
        console.info('[background-command-consumer] restarted', {
          consumerName: BACKGROUND_COMMAND_CONSUMER.name,
        });
      }

      for await (const message of messages) {
        const handler = processMessage(message).finally(() => {
          handlers.delete(handler);
          activeHandlers.delete(handler);
        });
        handlers.add(handler);
        activeHandlers.add(handler);
        if (handlers.size >= BACKGROUND_COMMAND_CONSUMER.concurrency) {
          await Promise.race(handlers);
        }
      }
      if (!stopping) {
        throw new Error('后台 Command consumer loop 意外结束');
      }
    } catch (error) {
      healthy = false;
      if (!started) {
        consumerTask = undefined;
        rejectInitialStart(error);
        return;
      }
      if (!stopping) {
        const delayMs =
          CONSUMER_RESTART_DELAYS_MS[
            Math.min(restartAttempt, CONSUMER_RESTART_DELAYS_MS.length - 1)
          ]!;
        restartAttempt += 1;
        console.error('[background-command-consumer] loop stopped', {
          restartDelayMs: delayMs,
          error,
        });
        await new Promise<void>((resolve) => {
          const finish = () => {
            clearTimeout(timer);
            cancelRestartWait = undefined;
            resolve();
          };
          const timer = setTimeout(finish, delayMs);
          timer.unref();
          cancelRestartWait = finish;
        });
      }
    } finally {
      healthy = false;
      runningMessages = undefined;
      await Promise.allSettled([...handlers]);
    }
  }
}

export function isBackgroundCommandConsumerHealthy(): boolean {
  return Boolean(consumerTask && !stopping && healthy);
}

export async function stopBackgroundCommandConsumer(): Promise<void> {
  stopping = true;
  healthy = false;
  cancelRestartWait?.();
  const messages = runningMessages;
  runningMessages = undefined;
  await messages?.close();
  await consumerTask;
  consumerTask = undefined;
  await Promise.allSettled([...activeHandlers]);
  activeHandlers.clear();
}
