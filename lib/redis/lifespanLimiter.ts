import type { Redis } from '@upstash/redis';
import { redis } from './index';

/**
 * 寿元消耗限制器
 * 用于控制每个角色每日寿元消耗上限和闭关并发控制
 */
export class LifespanLimiter {
  private redis: Redis;
  private readonly DAILY_LIMIT = 200; // 每日寿元消耗上限
  private readonly LOCK_TTL = 300; // 锁过期时间（秒），防止死锁

  constructor() {
    this.redis = redis;
  }

  /**
   * 获取角色今日已消耗的寿元
   */
  private getDailyKey(cultivatorId: string): string {
    const today = new Date().toISOString().split('T')[0]; // YYYY-MM-DD
    return `lifespan:daily:${cultivatorId}:${today}`;
  }

  /**
   * 获取角色闭关锁的 key
   */
  private getLockKey(cultivatorId: string): string {
    return `retreat:lock:${cultivatorId}`;
  }

  /**
   * 检查并消耗寿元
   * @param cultivatorId 角色ID
   * @param years 需要消耗的年数
   * @returns { allowed: boolean, remaining: number, consumed: number }
   */
  async checkAndConsumeLifespan(
    cultivatorId: string,
    years: number,
  ): Promise<{
    allowed: boolean;
    remaining: number;
    consumed: number;
    message?: string;
  }> {
    const key = this.getDailyKey(cultivatorId);
    const consumed = await this.redis.get<string>(key);
    const currentConsumed = consumed ? parseInt(consumed, 10) : 0;
    const newTotal = currentConsumed + years;

    if (newTotal > this.DAILY_LIMIT) {
      return {
        allowed: false,
        remaining: this.DAILY_LIMIT - currentConsumed,
        consumed: currentConsumed,
        message: `今日寿元消耗已达上限，剩余可用：${this.DAILY_LIMIT - currentConsumed}年`,
      };
    }

    // 消耗寿元并设置过期时间（到明天凌晨）
    const tomorrow = new Date();
    tomorrow.setHours(24, 0, 0, 0);
    const ttl = Math.floor((tomorrow.getTime() - Date.now()) / 1000);

    await this.redis.set(key, newTotal.toString(), { ex: ttl });

    return {
      allowed: true,
      remaining: this.DAILY_LIMIT - newTotal,
      consumed: newTotal,
    };
  }

  /**
   * 获取当前已消耗的寿元
   */
  async getConsumedLifespan(cultivatorId: string): Promise<number> {
    const key = this.getDailyKey(cultivatorId);
    const consumed = await this.redis.get<string>(key);
    return consumed ? parseInt(consumed, 10) : 0;
  }

  /**
   * 获取剩余可用寿元
   */
  async getRemainingLifespan(cultivatorId: string): Promise<number> {
    const consumed = await this.getConsumedLifespan(cultivatorId);
    return this.DAILY_LIMIT - consumed;
  }

  /**
   * 尝试获取闭关锁
   * @param cultivatorId 角色ID
   * @param ttl 锁的过期时间（秒），默认300秒
   * @returns 是否成功获取锁
   */
  async acquireRetreatLock(
    cultivatorId: string,
    ttl: number = this.LOCK_TTL,
  ): Promise<boolean> {
    const key = this.getLockKey(cultivatorId);
    const result = await this.redis.set(key, '1', { ex: ttl, nx: true });
    return result === 'OK';
  }

  /**
   * 释放闭关锁
   */
  async releaseRetreatLock(cultivatorId: string): Promise<void> {
    const key = this.getLockKey(cultivatorId);
    await this.redis.del(key);
  }

  /**
   * 检查是否持有闭关锁
   */
  async isRetreatLocked(cultivatorId: string): Promise<boolean> {
    const key = this.getLockKey(cultivatorId);
    const exists = await this.redis.exists(key);
    return exists === 1;
  }

  /**
   * 安全执行闭关操作（自动加锁解锁）
   * @param cultivatorId 角色ID
   * @param years 消耗年数
   * @param operation 闭关操作函数
   */
  async withRetreatLock<T>(
    cultivatorId: string,
    years: number,
    operation: () => Promise<T>,
  ): Promise<T> {
    // 1. 检查并获取锁
    const lockAcquired = await this.acquireRetreatLock(cultivatorId);
    if (!lockAcquired) {
      throw new Error('角色正在闭关中，请稍后再试');
    }

    try {
      // 2. 检查并消耗寿元
      const lifespanCheck = await this.checkAndConsumeLifespan(
        cultivatorId,
        years,
      );
      if (!lifespanCheck.allowed) {
        throw new Error(
          lifespanCheck.message ||
            `今日寿元消耗已达上限，剩余：${lifespanCheck.remaining}年`,
        );
      }

      // 3. 执行闭关操作
      const result = await operation();

      return result;
    } catch (error) {
      // 如果是寿元检查失败，需要回滚寿元消耗
      // 注意：这里简化处理，实际可能需要更复杂的回滚逻辑
      throw error;
    } finally {
      // 4. 释放锁
      await this.releaseRetreatLock(cultivatorId);
    }
  }

  /**
   * 回滚寿元消耗（用于操作失败时）
   */
  async rollbackLifespan(cultivatorId: string, years: number): Promise<void> {
    const key = this.getDailyKey(cultivatorId);
    const consumed = await this.redis.get<string>(key);
    if (consumed) {
      const currentConsumed = parseInt(consumed, 10);
      const newConsumed = Math.max(0, currentConsumed - years);

      const tomorrow = new Date();
      tomorrow.setHours(24, 0, 0, 0);
      const ttl = Math.floor((tomorrow.getTime() - Date.now()) / 1000);

      await this.redis.set(key, newConsumed.toString(), { ex: ttl });
    }
  }
}

// 单例实例
let limiterInstance: LifespanLimiter | null = null;

/**
 * 获取寿元限制器实例
 */
export function getLifespanLimiter(): LifespanLimiter {
  if (!limiterInstance) {
    limiterInstance = new LifespanLimiter();
  }
  return limiterInstance;
}
