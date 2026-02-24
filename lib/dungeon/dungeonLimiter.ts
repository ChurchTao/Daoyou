/**
 * 副本每日次数限制器
 *
 * 使用 Redis 存储每日计数，key 格式：dungeon:daily:{cultivatorId}:{YYYY-MM-DD}
 * 过期时间设为 24 小时，确保次日自动重置
 */

import { redis } from '../redis';

const DAILY_DUNGEON_LIMIT = 2;
const KEY_TTL_SECONDS = 86400; // 24 小时
const RESET_TIMEZONE = 'Asia/Shanghai';

function getDateInResetTimezone(now: Date = new Date()): string {
  return new Intl.DateTimeFormat('en-CA', {
    timeZone: RESET_TIMEZONE,
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  }).format(now);
}

/**
 * 生成每日限制的 Redis key
 */
function getDailyLimitKey(cultivatorId: string): string {
  const today = getDateInResetTimezone(); // YYYY-MM-DD
  return `dungeon:daily:${cultivatorId}:${today}`;
}

/**
 * 检查是否允许开始副本
 */
export async function checkDungeonLimit(
  cultivatorId: string,
): Promise<{ allowed: boolean; remaining: number; used: number }> {
  const key = getDailyLimitKey(cultivatorId);
  const countStr = await redis.get(key);
  const parsed = countStr ? parseInt(String(countStr), 10) : 0;
  const used = Number.isFinite(parsed) && parsed > 0 ? parsed : 0;
  const remaining = Math.max(0, DAILY_DUNGEON_LIMIT - used);

  return {
    allowed: used < DAILY_DUNGEON_LIMIT,
    remaining,
    used,
  };
}

/**
 * 消耗一次副本次数
 */
export async function consumeDungeonLimit(cultivatorId: string): Promise<void> {
  const key = getDailyLimitKey(cultivatorId);
  const used = await redis.incr(key);
  if (used === 1) {
    await redis.expire(key, KEY_TTL_SECONDS);
  }

  if (used > DAILY_DUNGEON_LIMIT) {
    // 防并发超扣：超过上限时回滚并抛错
    await redis.decr(key);
    throw new Error('今日探索次数已用尽（每日限 2 次）');
  }
}

/**
 * 获取每日限制配置
 */
export function getDungeonLimitConfig() {
  return {
    dailyLimit: DAILY_DUNGEON_LIMIT,
  };
}
