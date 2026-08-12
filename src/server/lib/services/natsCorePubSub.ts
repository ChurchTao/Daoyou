import { getNatsConnection } from '@server/lib/nats';
import { StringCodec, type Subscription } from 'nats';

type NatsMessageHandler = (message: string) => void;

type SharedSubscription = {
  handlers: Set<NatsMessageHandler>;
  subscription?: Subscription;
  closed: boolean;
  healthy: boolean;
  task: Promise<void>;
  cancelRestartWait?: () => void;
  ready: Promise<void>;
  resolveReady: () => void;
  readyResolved: boolean;
};

const codec = StringCodec();
const subscriptions = new Map<string, SharedSubscription>();
const SUBSCRIPTION_RESTART_DELAYS_MS = [
  1_000, 2_000, 5_000, 10_000, 30_000,
] as const;

function createSharedSubscription(subject: string): SharedSubscription {
  let resolveReady!: () => void;
  const ready = new Promise<void>((resolve) => {
    resolveReady = resolve;
  });
  const shared: SharedSubscription = {
    handlers: new Set(),
    closed: false,
    healthy: false,
    task: Promise.resolve(),
    ready,
    resolveReady,
    readyResolved: false,
  };
  shared.task = superviseSubscription(subject, shared);
  subscriptions.set(subject, shared);
  return shared;
}

async function superviseSubscription(
  subject: string,
  shared: SharedSubscription,
): Promise<void> {
  let restartAttempt = 0;
  while (!shared.closed) {
    try {
      const connection = await getNatsConnection();
      if (shared.closed) return;
      const subscription = connection.subscribe(subject);
      shared.subscription = subscription;
      await connection.flush();
      shared.healthy = true;
      shared.readyResolved = true;
      shared.resolveReady();
      restartAttempt = 0;
      for await (const message of subscription) {
        const decoded = codec.decode(message.data);
        for (const handler of shared.handlers) {
          try {
            handler(decoded);
          } catch (error) {
            console.warn('[nats-core] subscription handler failed', {
              subject,
              error,
            });
          }
        }
      }
      if (!shared.closed) throw new Error('NATS Core subscription 意外结束');
    } catch (error) {
      shared.healthy = false;
      resetReadyWaiter(shared);
      if (!shared.closed) {
        const delayMs =
          SUBSCRIPTION_RESTART_DELAYS_MS[
            Math.min(restartAttempt, SUBSCRIPTION_RESTART_DELAYS_MS.length - 1)
          ]!;
        restartAttempt += 1;
        console.warn('[nats-core] subscription stopped', {
          subject,
          restartDelayMs: delayMs,
          error,
        });
        await waitForRestart(shared, delayMs);
      }
    } finally {
      shared.healthy = false;
      shared.subscription = undefined;
    }
  }
}

function waitForRestart(
  shared: SharedSubscription,
  delayMs: number,
): Promise<void> {
  return new Promise((resolve) => {
    const finish = () => {
      clearTimeout(timer);
      shared.cancelRestartWait = undefined;
      resolve();
    };
    const timer = setTimeout(finish, delayMs);
    timer.unref();
    shared.cancelRestartWait = finish;
  });
}

export function encodeNatsSubjectToken(value: string): string {
  return Buffer.from(value, 'utf8').toString('base64url');
}

export async function publishNatsCoreMessage(
  subject: string,
  message: string,
): Promise<void> {
  try {
    const connection = await getNatsConnection();
    connection.publish(subject, codec.encode(message));
  } catch (error) {
    console.warn('[nats-core] publish failed', { subject, error });
  }
}

export function subscribeNatsCoreSubject(
  subject: string,
  handler: NatsMessageHandler,
): () => void {
  const shared =
    subscriptions.get(subject) ?? createSharedSubscription(subject);
  shared.handlers.add(handler);

  return () => {
    const current = subscriptions.get(subject);
    if (!current) return;
    current.handlers.delete(handler);
    if (current.handlers.size > 0) return;
    subscriptions.delete(subject);
    current.closed = true;
    current.healthy = false;
    current.cancelRestartWait?.();
    current.subscription?.unsubscribe();
  };
}

export async function waitForNatsCoreSubjectReady(
  subject: string,
): Promise<void> {
  const shared =
    subscriptions.get(subject) ?? createSharedSubscription(subject);
  if (!shared.healthy) await shared.ready;
  const connection = await getNatsConnection();
  await connection.flush();
}

export function areNatsCoreSubscriptionsHealthy(): boolean {
  return [...subscriptions.values()].every(
    (subscription) => subscription.closed || subscription.healthy,
  );
}

export async function stopNatsCoreSubscriptions(): Promise<void> {
  const active = [...subscriptions.values()];
  subscriptions.clear();
  for (const shared of active) {
    shared.closed = true;
    shared.healthy = false;
    shared.cancelRestartWait?.();
    shared.subscription?.unsubscribe();
  }
  await Promise.allSettled(active.map((shared) => shared.task));
}

function resetReadyWaiter(shared: SharedSubscription): void {
  if (shared.closed || !shared.readyResolved) return;
  shared.readyResolved = false;
  shared.ready = new Promise<void>((resolve) => {
    shared.resolveReady = resolve;
  });
}
