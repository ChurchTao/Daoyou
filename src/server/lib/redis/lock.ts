import {
  createLock,
  LockAcquisitionError,
  LockReleaseError,
  type Config,
  type Lock,
} from '@microfleet/ioredis-lock';
import { redis } from '@server/lib/redis';

export { LockAcquisitionError, LockReleaseError };

export function createRedisLock(options?: Partial<Config>): Lock {
  return createLock(redis, options);
}

export async function releaseRedisLock(
  lock: Lock | null,
  context: string,
): Promise<void> {
  if (!lock) return;

  try {
    await lock.release();
  } catch (error) {
    console.warn('[redis-lock] failed to release lock', { context, error });
  }
}
