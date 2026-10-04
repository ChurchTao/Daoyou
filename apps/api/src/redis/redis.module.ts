import { Module } from '@nestjs/common';
import { redis } from '@server/lib/redis/index.js';
import { withRedisLock } from '@server/lib/redis/lock.js';

export const REDIS_CLIENT = Symbol('REDIS_CLIENT');
export const REDIS_LOCK = Symbol('REDIS_LOCK');

/** Nest consumers reuse the existing lazy client and lease implementation. */
@Module({
  providers: [
    { provide: REDIS_CLIENT, useValue: redis },
    { provide: REDIS_LOCK, useValue: withRedisLock },
  ],
  exports: [REDIS_CLIENT, REDIS_LOCK],
})
export class RedisModule {}
