import { getRedisClient } from '@server/lib/redis';

type RedisMessageHandler = (message: string) => void;
type RedisReconnectTimer = ReturnType<typeof setTimeout>;

type ChannelSubscription = {
  client: ReturnType<typeof getRedisClient>;
  handlers: Set<RedisMessageHandler>;
  ready: Promise<void>;
  onMessage: (channel: string, message: string) => void;
  reconnectAttempts: number;
  reconnectTimer: RedisReconnectTimer | null;
  closed: boolean;
};

const subscriptions = new Map<string, ChannelSubscription>();
const REDIS_RECONNECT_DELAYS_MS = [1_000, 2_000, 5_000, 10_000, 30_000] as const;

function isRedisConfigured(): boolean {
  return Boolean(process.env.REDIS_URL);
}

function createSubscription(channel: string): ChannelSubscription {
  const client = getRedisClient().duplicate();
  const subscription: ChannelSubscription = {
    client,
    handlers: new Set(),
    ready: Promise.resolve(),
    onMessage(receivedChannel, message) {
      if (receivedChannel !== channel) {
        return;
      }

      for (const handler of subscription.handlers) {
        handler(message);
      }
    },
    reconnectAttempts: 0,
    reconnectTimer: null,
    closed: false,
  };

  client.on('message', subscription.onMessage);
  client.on('error', (error) => {
    console.warn('[redis-pubsub] subscriber error', { channel, error });
  });

  subscription.ready = client
    .subscribe(channel)
    .then(() => {
      subscription.reconnectAttempts = 0;
    })
    .catch((error) => {
      if (subscription.closed) {
        return;
      }
      client.off('message', subscription.onMessage);
      client.disconnect(false);
      scheduleReconnect(channel, subscription);
      throw error;
    });

  subscriptions.set(channel, subscription);
  return subscription;
}

function scheduleReconnect(channel: string, subscription: ChannelSubscription) {
  if (
    subscription.closed ||
    subscription.handlers.size === 0 ||
    subscription.reconnectTimer
  ) {
    return;
  }

  const delay =
    REDIS_RECONNECT_DELAYS_MS[
      Math.min(subscription.reconnectAttempts, REDIS_RECONNECT_DELAYS_MS.length - 1)
    ];
  subscription.reconnectAttempts += 1;
  subscription.reconnectTimer = setTimeout(() => {
    subscription.reconnectTimer = null;
    if (subscription.closed || subscription.handlers.size === 0) {
      return;
    }

    const next = createSubscription(channel);
    for (const handler of subscription.handlers) {
      next.handlers.add(handler);
    }
  }, delay);
}

export async function publishRedisMessage(
  channel: string,
  message: string,
): Promise<void> {
  if (!isRedisConfigured()) {
    return;
  }

  try {
    await getRedisClient().publish(channel, message);
  } catch (error) {
    console.warn('[redis-pubsub] publish failed', { channel, error });
  }
}

export function subscribeRedisChannel(
  channel: string,
  handler: RedisMessageHandler,
): () => void {
  if (!isRedisConfigured()) {
    return () => {};
  }

  let subscription = subscriptions.get(channel);
  if (!subscription) {
    try {
      subscription = createSubscription(channel);
    } catch (error) {
      console.warn('[redis-pubsub] subscribe failed', { channel, error });
      return () => {};
    }
  }

  subscription.handlers.add(handler);
  subscription.ready.catch((error) => {
    console.warn('[redis-pubsub] subscribe failed', { channel, error });
  });

  return () => {
    const current = subscriptions.get(channel);
    if (!current) {
      return;
    }

    current.handlers.delete(handler);
    if (current.handlers.size > 0) {
      return;
    }

    subscriptions.delete(channel);
    current.closed = true;
    if (current.reconnectTimer) {
      clearTimeout(current.reconnectTimer);
    }
    current.client.off('message', current.onMessage);
    current.client.unsubscribe(channel).catch(() => undefined);
    current.client.disconnect(false);
  };
}
