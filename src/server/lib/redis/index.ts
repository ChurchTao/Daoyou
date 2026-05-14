import Redis from 'ioredis';

let redisClient: Redis | null = null;

function getRedisClient(): Redis {
  const redisUrl = process.env.REDIS_URL;
  if (!redisUrl) {
    throw new Error('REDIS_URL is required before using Redis');
  }

  if (!redisClient) {
    redisClient = new Redis(redisUrl, {
      lazyConnect: true,
    });
    redisClient.on('error', (error) => {
      console.error('Redis error:', error);
    });
  }

  return redisClient;
}

const redis = new Proxy({} as Redis, {
  get(_target, prop) {
    const client = getRedisClient();
    const value = Reflect.get(client, prop);
    return typeof value === 'function' ? value.bind(client) : value;
  },
});

export { getLifespanLimiter, LifespanLimiter } from './lifespanLimiter';
export { redis };
