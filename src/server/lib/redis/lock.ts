import {
  createLock,
  LockAcquisitionError,
  LockExtendError,
  LockReleaseError,
  type Config,
  type Lock,
} from '@microfleet/ioredis-lock';
import { redis } from '@server/lib/redis';

export { LockAcquisitionError, LockExtendError, LockReleaseError };

const DEFAULT_LOCK_TIMEOUT_MS = 10_000;
const DEFAULT_LOCK_DELAY_MS = 50;

export const redisLockKeys = {
  cultivatorCreation: (userId: string) =>
    `lock:user:cultivator-creation:${userId}`,
  cultivatorMutation: (cultivatorId: string) =>
    `lock:cultivator:mutation:${cultivatorId}`,
  auctionListing: (listingId: string) => `lock:auction:listing:${listingId}`,
  betBattle: (battleId: string) => `lock:bet-battle:${battleId}`,
  battleMatch: (matchId: string) => `lock:battle-match:${matchId}`,
  cron: (jobName: string) => `lock:cron:${jobName}`,
  marketGeneration: (nodeId: string, layer: number | string, cycle: string) =>
    `lock:market:generation:${nodeId}:${layer}:${cycle}`,
  blackMarketSession: (sessionId: string) =>
    `lock:black-market:session:${sessionId}`,
  dungeonCommand: (cultivatorId: string) =>
    `lock:dungeon:command:${cultivatorId}`,
  sponsorshipOrder: (orderId: string) => `lock:sponsorship:order:${orderId}`,
  sponsorshipCultivator: (cultivatorId: string) =>
    `lock:sponsorship:cultivator:${cultivatorId}`,
} as const;

export class RedisLeaseLostError extends Error {
  readonly code = 'REDIS_LEASE_LOST';
  readonly status = 503;

  constructor(
    public readonly keys: string[],
    options?: { cause?: unknown },
  ) {
    super('分布式锁租约已失效，请重试');
    if (options && 'cause' in options) {
      (this as Error & { cause?: unknown }).cause = options.cause;
    }
    this.name = 'RedisLeaseLostError';
  }
}

export function isRedisLockContention(
  error: unknown,
): error is LockAcquisitionError {
  return (
    error instanceof LockAcquisitionError &&
    error.message.startsWith('Could not acquire lock on "')
  );
}

export type RedisLeaseContext = {
  assertHeld(): void;
};

export type WithRedisLockOptions = {
  key?: string;
  keys?: string[];
  timeoutMs?: number;
  retries?: number;
  delayMs?: number;
  context: string;
};

export function createRedisLock(options?: Partial<Config>): Lock {
  return createLock(redis, {
    timeout: options?.timeout ?? DEFAULT_LOCK_TIMEOUT_MS,
    retries: options?.retries ?? 0,
    delay: options?.delay ?? DEFAULT_LOCK_DELAY_MS,
    jitter: options?.jitter ?? 1.2,
  });
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

export async function withRedisLock<T>(
  options: WithRedisLockOptions,
  task: (lease: RedisLeaseContext) => Promise<T>,
): Promise<T> {
  const keys = normalizeLockKeys(options);
  const timeoutMs = options.timeoutMs ?? DEFAULT_LOCK_TIMEOUT_MS;
  if (!Number.isSafeInteger(timeoutMs) || timeoutMs < 3) {
    throw new Error('timeoutMs 必须是至少 3 毫秒的安全整数');
  }
  // 续租频率是锁实现细节，调用方只负责声明租约超时时间。
  const renewEveryMs = Math.floor(timeoutMs / 3);

  const acquired: Array<{ key: string; lock: Lock }> = [];
  let leaseLostError: RedisLeaseLostError | null = null;
  let expiresAt = Date.now() + timeoutMs;
  let stopped = false;
  let renewalTimer: ReturnType<typeof setTimeout> | undefined;
  let renewalInFlight: Promise<void> | undefined;

  const markLeaseLost = (cause: unknown) => {
    if (leaseLostError) return;
    leaseLostError = new RedisLeaseLostError(keys, { cause });
    console.error('[redis-lock] lease lost', {
      context: options.context,
      keys,
      heldMs: Date.now() - (expiresAt - timeoutMs),
      error: cause,
    });
  };

  const assertHeld = () => {
    if (!leaseLostError && Date.now() >= expiresAt) {
      markLeaseLost(new LockExtendError('Lock lease expired locally'));
    }
    if (leaseLostError) throw leaseLostError;
  };

  const renew = async () => {
    try {
      for (const entry of acquired) {
        await entry.lock.extend(timeoutMs);
      }
      expiresAt = Date.now() + timeoutMs;
    } catch (error) {
      markLeaseLost(error);
    }
  };

  const scheduleRenewal = () => {
    if (stopped || leaseLostError) return;
    renewalTimer = setTimeout(() => {
      renewalInFlight = renew().finally(() => {
        renewalInFlight = undefined;
        scheduleRenewal();
      });
    }, renewEveryMs);
  };

  try {
    for (const key of keys) {
      const lock = createRedisLock({
        timeout: timeoutMs,
        retries: options.retries ?? 0,
        delay: options.delayMs ?? DEFAULT_LOCK_DELAY_MS,
      });
      await lock.acquire(key);
      acquired.push({ key, lock });
    }

    scheduleRenewal();

    const lease: RedisLeaseContext = {
      assertHeld,
    };
    const result = await task(lease);
    lease.assertHeld();
    return result;
  } finally {
    stopped = true;
    if (renewalTimer) clearTimeout(renewalTimer);
    await renewalInFlight;

    for (const entry of acquired.reverse()) {
      await releaseRedisLock(entry.lock, `${options.context}:${entry.key}`);
    }
  }
}

function normalizeLockKeys(options: WithRedisLockOptions): string[] {
  const keys = [...(options.keys ?? []), ...(options.key ? [options.key] : [])]
    .map((key) => key.trim())
    .filter(Boolean);
  const normalized = [...new Set(keys)].sort();
  if (normalized.length === 0) {
    throw new Error('withRedisLock 至少需要一个锁 key');
  }
  return normalized;
}
