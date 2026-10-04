import { getJetStreamClient } from '@server/lib/nats/index.js';
import { type DomainEventType } from '@daoyou/game-domain/events';
import { parseDomainEventEnvelope } from '@server/lib/mq/domainEventSchema.js';
import { DOMAIN_EVENT_STREAM, type DomainEventEnvelope } from '@daoyou/contracts/events';
import { JSONCodec, type ConsumerMessages, type JsMsg } from 'nats';
import {
  consumerRetryDelayMs,
  DEAD_LETTER_STREAM,
  DEAD_LETTER_SUBJECT_PREFIX,
} from './natsTopology.js';

const MAX_PROCESSING_ATTEMPTS = 10;
const WORKING_INTERVAL_MS = 30_000;
const CONSUMER_RESTART_DELAYS_MS = [1_000, 2_000, 5_000, 10_000, 30_000] as const;
const codec = JSONCodec();
const activeHandlers = new Set<Promise<void>>();

type DomainEventConsumerRegistration = {
  consumerName: string;
  concurrency: number;
  acceptedTypes: readonly DomainEventType[];
  handle(event: DomainEventEnvelope): Promise<void>;
};

type DomainEventConsumerRunner = {
  registration: DomainEventConsumerRegistration;
  messages?: ConsumerMessages;
  task: Promise<void>;
  stopping: boolean;
  healthy: boolean;
  cancelRestartWait?: () => void;
};

const consumerRunners = new Map<string, DomainEventConsumerRunner>();

function restartDelayMs(attempt: number): number {
  return CONSUMER_RESTART_DELAYS_MS[
    Math.min(attempt, CONSUMER_RESTART_DELAYS_MS.length - 1)
  ]!;
}

function waitForRestart(
  runner: DomainEventConsumerRunner,
  delayMs: number,
): Promise<void> {
  return new Promise((resolve) => {
    const finish = () => {
      clearTimeout(timer);
      runner.cancelRestartWait = undefined;
      resolve();
    };
    const timer = setTimeout(finish, delayMs);
    timer.unref();
    runner.cancelRestartWait = finish;
  });
}

async function publishDeadLetter(
  registration: DomainEventConsumerRegistration,
  message: JsMsg,
  error: unknown,
): Promise<void> {
  const jetStream = await getJetStreamClient();
  const subject = `${DEAD_LETTER_SUBJECT_PREFIX}.${registration.consumerName}`;
  const errorMessage = error instanceof Error ? error.message : String(error);
  await jetStream.publish(
    subject,
    codec.encode({
      consumerName: registration.consumerName,
      originalSubject: message.subject,
      streamSequence: message.info.streamSequence,
      deliveryCount: message.info.deliveryCount,
      failedAt: new Date().toISOString(),
      error: errorMessage.slice(0, 2_000),
      payload: message.string(),
    }),
    {
      msgID: `${registration.consumerName}:${message.info.streamSequence}`,
      expect: { streamName: DEAD_LETTER_STREAM },
      timeout: 5_000,
    },
  );
}

async function processMessage(
  registration: DomainEventConsumerRegistration,
  message: JsMsg,
): Promise<void> {
  const workingTimer = setInterval(() => {
    try {
      message.working();
    } catch (error) {
      console.warn('[domain-event-consumer] working heartbeat failed', {
        consumerName: registration.consumerName,
        streamSequence: message.info.streamSequence,
        error,
      });
    }
  }, WORKING_INTERVAL_MS);
  workingTimer.unref();
  try {
    const event = parseDomainEventEnvelope(message.json());
    if (event.subject !== message.subject) {
      throw new Error(
        `领域事件 subject 与 NATS subject 不一致: ${event.subject} != ${message.subject}`,
      );
    }
    if (!registration.acceptedTypes.includes(event.type)) {
      throw new Error(
        `消费者 ${registration.consumerName} 不接受事件 ${event.type}`,
      );
    }

    await registration.handle(event);
    const acknowledged = await message.ackAck({ timeout: 5_000 });
    if (!acknowledged) throw new Error('JetStream 双向 ACK 未确认');
  } catch (error) {
    console.error('[domain-event-consumer] processing failed', {
      consumerName: registration.consumerName,
      subject: message.subject,
      deliveryCount: message.info.deliveryCount,
      streamSequence: message.info.streamSequence,
      error,
    });
    if (message.info.deliveryCount >= MAX_PROCESSING_ATTEMPTS) {
      try {
        await publishDeadLetter(registration, message, error);
        message.term();
      } catch (deadLetterError) {
        console.error('[domain-event-consumer] dead-letter publish failed', {
          consumerName: registration.consumerName,
          streamSequence: message.info.streamSequence,
          deadLetterError,
        });
        message.nak(60_000);
      }
      return;
    }
    message.nak(consumerRetryDelayMs(message.info.deliveryCount));
  } finally {
    clearInterval(workingTimer);
  }
}

export async function startDomainEventConsumer(
  registration: DomainEventConsumerRegistration,
): Promise<void> {
  if (consumerRunners.has(registration.consumerName)) return;

  let resolveInitialStart!: () => void;
  let rejectInitialStart!: (error: unknown) => void;
  const initialStart = new Promise<void>((resolve, reject) => {
    resolveInitialStart = resolve;
    rejectInitialStart = reject;
  });
  const runner: DomainEventConsumerRunner = {
    registration,
    task: Promise.resolve(),
    stopping: false,
    healthy: false,
  };
  consumerRunners.set(registration.consumerName, runner);
  runner.task = superviseDomainEventConsumer(
    runner,
    resolveInitialStart,
    rejectInitialStart,
  );

  await initialStart;

  console.info('[domain-event-consumer] started', {
    consumerName: registration.consumerName,
    concurrency: registration.concurrency,
  });
}

async function superviseDomainEventConsumer(
  runner: DomainEventConsumerRunner,
  resolveInitialStart: () => void,
  rejectInitialStart: (error: unknown) => void,
): Promise<void> {
  let started = false;
  let restartAttempt = 0;

  while (!runner.stopping) {
    const consumerHandlers = new Set<Promise<void>>();
    try {
      const jetStream = await getJetStreamClient();
      const consumer = await jetStream.consumers.get(
        DOMAIN_EVENT_STREAM,
        runner.registration.consumerName,
      );
      const messages = await consumer.consume({
        max_messages: runner.registration.concurrency,
      });
      runner.messages = messages;
      runner.healthy = true;
      restartAttempt = 0;
      if (!started) {
        started = true;
        resolveInitialStart();
      } else {
        console.info('[domain-event-consumer] restarted', {
          consumerName: runner.registration.consumerName,
        });
      }

      for await (const message of messages) {
        const handler = processMessage(runner.registration, message).finally(
          () => {
            activeHandlers.delete(handler);
            consumerHandlers.delete(handler);
          },
        );
        activeHandlers.add(handler);
        consumerHandlers.add(handler);
        if (consumerHandlers.size >= runner.registration.concurrency) {
          await Promise.race(consumerHandlers);
        }
      }
      if (!runner.stopping) {
        throw new Error('领域事件 consumer loop 意外结束');
      }
    } catch (error) {
      runner.healthy = false;
      if (!started) {
        consumerRunners.delete(runner.registration.consumerName);
        rejectInitialStart(error);
        return;
      }
      if (!runner.stopping) {
        const delayMs = restartDelayMs(restartAttempt);
        restartAttempt += 1;
        console.error('[domain-event-consumer] consumer loop stopped', {
          consumerName: runner.registration.consumerName,
          restartDelayMs: delayMs,
          error,
        });
        await waitForRestart(runner, delayMs);
      }
    } finally {
      runner.healthy = false;
      runner.messages = undefined;
      await Promise.allSettled([...consumerHandlers]);
    }
  }
}

export function areDomainEventConsumersHealthy(): boolean {
  return (
    consumerRunners.size > 0 &&
    [...consumerRunners.values()].every(
      (runner) => !runner.stopping && runner.healthy,
    )
  );
}

export async function stopDomainEventConsumers(): Promise<void> {
  const runners = [...consumerRunners.values()];
  for (const runner of runners) {
    runner.stopping = true;
    runner.healthy = false;
    runner.cancelRestartWait?.();
  }
  await Promise.allSettled(
    runners.map((runner) => runner.messages?.close()),
  );
  await Promise.allSettled(runners.map((runner) => runner.task));
  await Promise.allSettled([...activeHandlers]);
  consumerRunners.clear();
  activeHandlers.clear();
}
