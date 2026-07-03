import { getRedisClient } from '@server/lib/redis';

type RedisMessageHandler = (message: string) => void;

type ChannelSubscription = {
  client: ReturnType<typeof getRedisClient>;
  handlers: Set<RedisMessageHandler>;
  ready: Promise<void>;
  onMessage: (channel: string, message: string) => void;
};

const subscriptions = new Map<string, ChannelSubscription>();

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
  };

  client.on('message', subscription.onMessage);
  client.on('error', (error) => {
    console.warn('[redis-pubsub] subscriber error', { channel, error });
  });

  subscription.ready = client
    .subscribe(channel)
    .then(() => undefined)
    .catch((error) => {
      subscriptions.delete(channel);
      client.off('message', subscription.onMessage);
      client.disconnect(false);
      throw error;
    });

  subscriptions.set(channel, subscription);
  return subscription;
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
    current.client.off('message', current.onMessage);
    current.client.unsubscribe(channel).catch(() => undefined);
    current.client.disconnect(false);
  };
}
