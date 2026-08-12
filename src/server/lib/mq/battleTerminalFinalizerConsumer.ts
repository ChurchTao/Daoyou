import { getJetStreamClient } from '@server/lib/nats';
import { finalizeBattleTerminalState } from '@server/lib/services/BattleTerminalFinalizer';
import { OnlineBattleStore } from '@server/lib/services/OnlineBattleStore';
import { observeOnlineBattleMetric } from '@server/lib/services/OnlineBattleMetrics';
import {
  BATTLE_TERMINAL_STREAM,
  BATTLE_TERMINAL_SUBJECT,
  BattleTerminalOutboxSchema,
  type BattleTerminalOutboxV1,
} from '@shared/contracts/battleTerminal';
import { type ConsumerMessages, type JsMsg } from 'nats';
import {
  BATTLE_TERMINAL_FINALIZER_CONSUMER,
  consumerRetryDelayMs,
} from './natsTopology';

const store = new OnlineBattleStore();
const RESTART_DELAYS_MS = [1_000, 5_000, 15_000, 60_000] as const;

let messages: ConsumerMessages | undefined;
let consumerTask: Promise<void> | undefined;
let stopping = false;
let healthy = false;
const activeHandlers = new Set<Promise<void>>();
let cancelRestartWait: (() => void) | undefined;

async function processMessage(message: JsMsg): Promise<void> {
  let outbox: BattleTerminalOutboxV1;
  try {
    if (message.subject !== BATTLE_TERMINAL_SUBJECT) {
      throw new Error(`Unexpected battle terminal subject: ${message.subject}`);
    }
    outbox = BattleTerminalOutboxSchema.parse(message.json());
  } catch (error) {
    console.warn('[battle-terminal-finalizer] discarded invalid message', {
      streamSequence: message.info.streamSequence,
      error: error instanceof Error ? error.message : String(error),
    });
    message.term();
    return;
  }

  try {
    observeOnlineBattleMetric(
      'nats_event_lag_ms',
      Math.max(0, Date.now() - outbox.event.terminalAt),
    );
    await finalizeBattleTerminalState(store, outbox);
    observeOnlineBattleMetric('terminal_cleanup_completed_total');
    const acknowledged = await message.ackAck({ timeout: 5_000 });
    if (!acknowledged) {
      throw new Error('Battle terminal JetStream ACK was not confirmed');
    }
  } catch (error) {
    observeOnlineBattleMetric('terminal_cleanup_failed_total');
    console.error('[battle-terminal-finalizer] cleanup failed; retrying', {
      matchId: outbox.event.matchId,
      streamSequence: message.info.streamSequence,
      deliveryCount: message.info.deliveryCount,
      error,
    });
    message.nak(consumerRetryDelayMs(message.info.deliveryCount));
  }
}

export async function startBattleTerminalFinalizerConsumer(): Promise<void> {
  if (consumerTask) return;
  stopping = false;
  await store.connect();
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
          BATTLE_TERMINAL_STREAM,
          BATTLE_TERMINAL_FINALIZER_CONSUMER.name,
        );
        messages = await consumer.consume({
          max_messages: BATTLE_TERMINAL_FINALIZER_CONSUMER.concurrency,
        });
        healthy = true;
        restartAttempt = 0;
        if (!started) {
          started = true;
          resolveInitialStart();
        } else {
          console.info('[battle-terminal-finalizer] restarted');
        }
        for await (const message of messages) {
          const handler = processMessage(message).finally(() => {
            activeHandlers.delete(handler);
            handlers.delete(handler);
          });
          activeHandlers.add(handler);
          handlers.add(handler);
          if (
            handlers.size >= BATTLE_TERMINAL_FINALIZER_CONSUMER.concurrency
          ) {
            await Promise.race(handlers);
          }
        }
        if (!stopping) {
          throw new Error('Battle terminal finalizer stopped unexpectedly');
        }
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
          console.error(
            '[battle-terminal-finalizer] consumer stopped; restarting',
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
  console.info('[battle-terminal-finalizer] started', {
    consumerName: BATTLE_TERMINAL_FINALIZER_CONSUMER.name,
  });
}

export async function stopBattleTerminalFinalizerConsumer(): Promise<void> {
  stopping = true;
  cancelRestartWait?.();
  messages?.stop();
  await consumerTask;
  consumerTask = undefined;
  await Promise.allSettled([...activeHandlers]);
  activeHandlers.clear();
}

export function isBattleTerminalFinalizerConsumerHealthy(): boolean {
  return healthy && !stopping;
}
