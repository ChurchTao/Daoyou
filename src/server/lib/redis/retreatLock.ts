import type Redis from 'ioredis';
import { redis } from './index';

/**
 * 闭关并发锁，防止同一角色重复提交闭关/突破操作。
 */
export class RetreatLock {
  private redis: Redis;
  private readonly LOCK_TTL = 300;

  constructor() {
    this.redis = redis;
  }

  private getLockKey(cultivatorId: string): string {
    return `retreat:lock:${cultivatorId}`;
  }

  async acquire(
    cultivatorId: string,
    ttl: number = this.LOCK_TTL,
  ): Promise<boolean> {
    const key = this.getLockKey(cultivatorId);
    const result = await this.redis.set(key, '1', 'EX', ttl, 'NX');
    return result === 'OK';
  }

  async release(cultivatorId: string): Promise<void> {
    const key = this.getLockKey(cultivatorId);
    await this.redis.del(key);
  }

  async isLocked(cultivatorId: string): Promise<boolean> {
    const key = this.getLockKey(cultivatorId);
    const exists = await this.redis.exists(key);
    return exists > 0;
  }
}

let retreatLockInstance: RetreatLock | null = null;

export function getRetreatLock(): RetreatLock {
  if (!retreatLockInstance) {
    retreatLockInstance = new RetreatLock();
  }
  return retreatLockInstance;
}
