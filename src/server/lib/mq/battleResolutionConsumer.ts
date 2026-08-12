import { getJetStreamClient } from '@server/lib/nats';
import { getOnlineBattleCoordinator } from '@server/lib/services/onlineBattleRuntime';
import type { OnlineBattleCoordinator } from '@server/lib/services/OnlineBattleCoordinator';
import {
  BATTLE_RESOLUTION_STREAM,
  BATTLE_RESOLUTION_SUBJECT,
  BattleResolutionTaskSchema,
  type BattleResolutionTaskV1,
} from '@shared/contracts/battleResolutionTask';
import { type ConsumerMessages, type JsMsg } from 'nats';
import {
  BATTLE_RESOLUTION_CONSUMER,
  consumerRetryDelayMs,
} from './natsTopology';

const RESTART_DELAYS_MS = [1_000, 5_000, 15_000, 60_000] as const;

let messages: ConsumerMessages | undefined;
let consumerTask: Promise<void> | undefined;
let stopping = false;
let healthy = false;
let coordinator: OnlineBattleCoordinator | undefined;
const activeHandlers = new Set<Promise<void>>();
let cancelRestartWait: (() => void) | undefined;

async function processMessage(message: JsMsg): Promise<void> {
  let task: BattleResolutionTaskV1;
  try {
    if (message.subject !== BATTLE_RESOLUTION_SUBJECT) {
      throw new Error(`Unexpected battle resolution subject: ${message.subject}`);
    }
    task = BattleResolutionTaskSchema.parse(message.json());
  } catch (error) {
    console.warn('[battle-resolution-worker] discarded invalid task', {
      streamSequence: message.info.streamSequence,
      error: error instanceof Error ? error.message : String(error),
    });
    message.term();
    return;
  }

  try {
    const current = await coordinator!.store.get(task.matchId).catch(() => null);
    if (!matchesTask(current, task)) {
      await acknowledge(message);
      return;
    }
    const changed = await coordinator!.resumeResolution(task.matchId, task);
    if (!changed) {
      const latest = await coordinator!.store.get(task.matchId).catch(() => null);
      if (matchesTask(latest, task)) {
        message.nak(consumerRetryDelayMs(message.info.deliveryCount));
        return;
      }
    }
    await acknowledge(message);
  } catch (error) {
    console.error('[battle-resolution-worker] resolution failed; retrying', {
      matchId: task.matchId,
      taskId: task.taskId,
      streamSequence: message.info.streamSequence,
      deliveryCount: message.info.deliveryCount,
      error,
    });
    message.nak(consumerRetryDelayMs(message.info.deliveryCount));
  }
}

export async function startBattleResolutionConsumer(
  inputCoordinator = getOnlineBattleCoordinator(),
): Promise<void> {
  if (consumerTask) return;
  stopping = false;
  coordinator = inputCoordinator;
  await coordinator.store.connect();
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
          BATTLE_RESOLUTION_STREAM,
          BATTLE_RESOLUTION_CONSUMER.name,
        );
        messages = await consumer.consume({
          max_messages: BATTLE_RESOLUTION_CONSUMER.concurrency,
        });
        healthy = true;
        restartAttempt = 0;
        if (!started) {
          started = true;
          resolveInitialStart();
        } else {
          console.info('[battle-resolution-worker] restarted');
        }
        for await (const message of messages) {
          const handler = processMessage(message).finally(() => {
            activeHandlers.delete(handler);
            handlers.delete(handler);
          });
          activeHandlers.add(handler);
          handlers.add(handler);
          if (handlers.size >= BATTLE_RESOLUTION_CONSUMER.concurrency) {
            await Promise.race(handlers);
          }
        }
        if (!stopping) throw new Error('Battle resolution consumer stopped unexpectedly');
      } catch (error) {
        healthy = false;
        if (!started) {
          consumerTask = undefined;
          rejectInitialStart(error);
          return;
        }
        if (!stopping) {
          const delayMs = RESTART_DELAYS_MS[
            Math.min(restartAttempt, RESTART_DELAYS_MS.length - 1)
          ]!;
          restartAttempt += 1;
          console.error('[battle-resolution-worker] consumer stopped; restarting', {
            delayMs,
            error,
          });
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
  console.info('[battle-resolution-worker] started', {
    consumerName: BATTLE_RESOLUTION_CONSUMER.name,
  });
}

export async function stopBattleResolutionConsumer(): Promise<void> {
  stopping = true;
  cancelRestartWait?.();
  messages?.stop();
  await consumerTask;
  consumerTask = undefined;
  await Promise.allSettled([...activeHandlers]);
  activeHandlers.clear();
  coordinator = undefined;
}

export function isBattleResolutionConsumerHealthy(): boolean {
  return healthy && !stopping;
}

function matchesTask(
  runtime: Awaited<ReturnType<OnlineBattleCoordinator['store']['get']>> | null,
  task: BattleResolutionTaskV1,
): boolean {
  return runtime?.match.status === 'resolving' &&
    runtime.match.resolving?.commandSet.commandSetId === task.commandSetId &&
    runtime.storageRevision === task.expectedStorageRevision &&
    runtime.match.revision === task.expectedMatchRevision;
}

async function acknowledge(message: JsMsg): Promise<void> {
  const acknowledged = await message.ackAck({ timeout: 5_000 });
  if (!acknowledged) throw new Error('Battle resolution JetStream ACK was not confirmed');
}
