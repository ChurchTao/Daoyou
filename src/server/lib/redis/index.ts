import Redis from 'ioredis';

const REDIS_CONNECT_TIMEOUT_MS = 4_000;
const REDIS_COMMAND_TIMEOUT_MS = 4_000;
const REDIS_SOCKET_TIMEOUT_MS = 30_000;
const REDIS_KEEP_ALIVE_MS = 10_000;
const REDIS_MAX_RETRY_DELAY_MS = 2_000;
const REDIS_RESET_ERROR_MESSAGES = [
  'Command timed out',
  'Socket timeout',
  'Connection is closed.',
  'read ECONNRESET',
  'ETIMEDOUT',
  'EPIPE',
] as const;

let redisClient: Redis | null = null;

function isRedisConfigured(): boolean {
  return Boolean(process.env.REDIS_URL);
}

function clearRedisClientIfCurrent(client: Redis): void {
  if (redisClient === client) {
    redisClient = null;
  }
}

function resetRedisClient(client: Redis, reason: string): void {
  if (redisClient !== client) {
    return;
  }

  console.warn('[redis] resetting client', { reason });
  redisClient = null;
  client.disconnect(false);
}

function shouldResetRedisClient(error: unknown): boolean {
  if (!(error instanceof Error)) {
    return false;
  }

  return REDIS_RESET_ERROR_MESSAGES.some((message) =>
    error.message.includes(message),
  );
}

function createRedisClient(redisUrl: string): Redis {
  const client = new Redis(redisUrl, {
    lazyConnect: true,
    connectTimeout: REDIS_CONNECT_TIMEOUT_MS,
    commandTimeout: REDIS_COMMAND_TIMEOUT_MS,
    socketTimeout: REDIS_SOCKET_TIMEOUT_MS,
    keepAlive: REDIS_KEEP_ALIVE_MS,
    maxRetriesPerRequest: 1,
    retryStrategy(times) {
      return Math.min(times * 200, REDIS_MAX_RETRY_DELAY_MS);
    },
    reconnectOnError(error) {
      return error.message.includes('READONLY') ? 2 : false;
    },
  });

  client.on('connect', () => {
    console.info('[redis] connected');
  });
  client.on('ready', () => {
    console.info('[redis] ready');
  });
  client.on('close', () => {
    console.warn('[redis] connection closed');
  });
  client.on('reconnecting', (delay: number) => {
    console.warn('[redis] reconnecting', { delay });
  });
  client.on('end', () => {
    console.error('[redis] reconnect attempts stopped');
    clearRedisClientIfCurrent(client);
  });
  client.on('error', (error) => {
    console.error('[redis] error', error);
  });

  return client;
}

function getRedisClient(): Redis {
  const redisUrl = process.env.REDIS_URL;
  if (!redisUrl) {
    throw new Error('REDIS_URL is required before using Redis');
  }

  if (!redisClient) {
    redisClient = createRedisClient(redisUrl);
  }

  return redisClient;
}

export async function getRedisHealthStatus(): Promise<
  'disabled' | 'up' | 'down'
> {
  if (!isRedisConfigured()) {
    return 'disabled';
  }

  try {
    await redis.ping();
    return 'up';
  } catch {
    return 'down';
  }
}

const redis = new Proxy({} as Redis, {
  get(_target, prop) {
    const client = getRedisClient();
    const value = Reflect.get(client, prop);
    if (typeof value !== 'function') {
      return value;
    }

    return (...args: unknown[]) => {
      const result = value.apply(client, args);
      if (!result || typeof result.then !== 'function') {
        return result;
      }

      return result.catch((error: unknown) => {
        if (shouldResetRedisClient(error)) {
          resetRedisClient(client, `${String(prop)} failed: ${(error as Error).message}`);
        }

        throw error;
      });
    };
  },
});

export { getLifespanLimiter, LifespanLimiter } from './lifespanLimiter';
export { getRedisClient, redis };
