import type { ThrottlerStorage } from '@nestjs/throttler';
import { isRedisConfigured, redis } from './index.js';

// Count accepted requests in a fixed window starting with the first hit.
// Checking, incrementing and setting the expiry are a single Redis operation.
const INCREMENT_WINDOW = `
local hits = tonumber(redis.call('GET', KEYS[1])) or 0
if hits >= tonumber(ARGV[2]) then
  return {hits, redis.call('PTTL', KEYS[1]), 1}
end
hits = redis.call('INCR', KEYS[1])
if hits == 1 then
  redis.call('PEXPIRE', KEYS[1], ARGV[1])
end
return {hits, redis.call('PTTL', KEYS[1]), 0}
`;

export const redisThrottlerStorage: ThrottlerStorage = {
  async increment(key, ttl, limit) {
    if (isRedisConfigured()) {
      try {
        const [totalHits, remainingMs, blocked] = (await redis.eval(
          INCREMENT_WINDOW,
          1,
          `api:route-rate-limit:${key}`,
          ttl,
          limit,
        )) as [number, number, number];
        const timeToExpire = Math.max(0, Math.ceil(remainingMs / 1000));
        return {
          totalHits,
          timeToExpire,
          isBlocked: blocked === 1,
          timeToBlockExpire: blocked === 1 ? Math.max(1, timeToExpire) : 0,
        };
      } catch (error) {
        console.warn(
          '[route-rate-limit] Redis unavailable; allowing request',
          error,
        );
      }
    }
    return {
      totalHits: 0,
      timeToExpire: 0,
      isBlocked: false,
      timeToBlockExpire: 0,
    };
  },
};
