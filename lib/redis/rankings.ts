import {
  CultivatorBasic,
  getCultivatorBasicsByIdsUnsafe,
} from '@/lib/services/cultivatorService';
import { redis } from './index';

const RANKING_LIST_KEY = 'golden_rank:list';
const PROTECTION_PREFIX = 'golden_rank:protection:';
const DAILY_CHALLENGES_PREFIX = 'golden_rank:daily_challenges:';
const CHALLENGE_LOCK_PREFIX = 'golden_rank:challenge_lock:';
const LEGACY_CULTIVATOR_INFO_PREFIX = 'golden_rank:cultivator:'; // 兼容老数据清理

const MAX_RANKING_SIZE = 100;
const PROTECTION_DURATION = 1800; // 30分钟，单位：秒
const LOCK_DURATION = 300; // 5分钟，单位：秒
const MAX_DAILY_CHALLENGES = 10;

export interface RankingItem extends CultivatorBasic {
  rank: number;
  faction?: string;
  is_new_comer: boolean; // 是否为新天骄（2小时内）
  updated_at: number;
}

export interface CultivatorRankInfo {
  rank: number | null; // null表示不在榜上
  isProtected: boolean;
  remainingChallenges: number;
}

/**
 * 获取当前日期字符串 (YYYY-MM-DD)
 */
function getTodayString(): string {
  const now = new Date();
  const year = now.getFullYear();
  const month = String(now.getMonth() + 1).padStart(2, '0');
  const day = String(now.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
}

/**
 * 获取排行榜顺序及保护信息
 */
async function getRankingOrder(): Promise<
  { cultivatorId: string; rank: number; isNewcomer: boolean }[]
> {
  const members = await redis.zrange(RANKING_LIST_KEY, 0, MAX_RANKING_SIZE - 1);

  const items: { cultivatorId: string; rank: number; isNewcomer: boolean }[] =
    [];
  for (let i = 0; i < members.length; i++) {
    const cultivatorId = members[i] as string;
    const rank = i + 1;
    const protectionKey = `${PROTECTION_PREFIX}${cultivatorId}`;
    const protectionTime = await redis.get(protectionKey);
    const isNewcomer = protectionTime
      ? Date.now() - parseInt(protectionTime as string, 10) <
        PROTECTION_DURATION * 1000
      : false;

    items.push({
      cultivatorId,
      rank,
      isNewcomer,
    });
  }

  return items;
}

/**
 * 获取排行榜列表（回表查询最新数据）
 */
export async function getRankingList(): Promise<RankingItem[]> {
  const order = await getRankingOrder();
  const ids = order.map((item) => item.cultivatorId);
  const cultivators = await getCultivatorBasicsByIdsUnsafe(ids);
  const map = new Map(cultivators.map((item) => [item.id, item]));

  const items: RankingItem[] = [];
  for (const entry of order) {
    const record = map.get(entry.cultivatorId);
    if (!record) continue;

    items.push({
      id: record.id,
      rank: entry.rank,
      name: record.name,
      title: record.title,
      age: record.age,
      lifespan: record.lifespan,
      realm: record.realm,
      realm_stage: record.realm_stage,
      origin: record.origin,
      is_new_comer: entry.isNewcomer,
      updated_at:
        record.updatedAt instanceof Date
          ? record.updatedAt.getTime()
          : Date.now(),
      gender: record.gender,
      personality: record.personality,
      background: record.background,
      updatedAt: record.updatedAt,
    });
  }

  return items;
}

/**
 * 获取角色在排行榜中的排名
 */
export async function getCultivatorRank(
  cultivatorId: string,
): Promise<number | null> {
  // Upstash Redis: zrank(key, member) 返回 number | null
  const rank = await redis.zrank(RANKING_LIST_KEY, cultivatorId);
  return rank !== null ? rank + 1 : null; // zrank返回0-based索引，需要+1
}

/**
 * 添加角色到排行榜
 */
export async function addToRanking(
  cultivatorId: string,
  _userId: string,
  targetRank?: number,
): Promise<void> {
  // 添加到排行榜（使用排名作为score）
  // 如果指定了排名，需要先调整后续排名，再插入
  if (targetRank) {
    await adjustRankingsAfterInsert(targetRank);
    // Upstash Redis: zadd(key, { score, member })
    await redis.zadd(RANKING_LIST_KEY, {
      score: targetRank,
      member: cultivatorId,
    });
  } else {
    const currentSize = await redis.zcard(RANKING_LIST_KEY);
    const rank = currentSize + 1;
    await redis.zadd(RANKING_LIST_KEY, {
      score: rank,
      member: cultivatorId,
    });
  }

  // 设置新上榜保护（2小时）
  const protectionKey = `${PROTECTION_PREFIX}${cultivatorId}`;
  // Upstash Redis: setex(key, seconds, value)
  await redis.setex(protectionKey, PROTECTION_DURATION, Date.now().toString());

  // 限制排行榜大小（只保留前100名）
  // Upstash Redis: zremrangebyrank(key, start, stop)
  await redis.zremrangebyrank(RANKING_LIST_KEY, MAX_RANKING_SIZE, -1);
}

/**
 * 调整插入后的排名（将targetRank及之后的排名+1）
 */
async function adjustRankingsAfterInsert(targetRank: number): Promise<void> {
  // 获取从targetRank开始的所有成员（0-based索引，所以是targetRank-1）
  const members = (await redis.zrange(
    RANKING_LIST_KEY,
    targetRank - 1,
    -1,
  )) as string[];

  if (members.length === 0) {
    return; // 没有需要调整的成员
  }

  // Upstash Redis 使用 pipeline 而不是 multi
  const pipeline = redis.pipeline();
  for (let i = 0; i < members.length; i++) {
    const cultivatorId = members[i];
    const newRank = targetRank + i + 1; // 所有排名+1
    pipeline.zadd(RANKING_LIST_KEY, {
      score: newRank,
      member: cultivatorId,
    });
  }
  await pipeline.exec();
}

/**
 * 更新排名（挑战成功）
 */
export async function updateRanking(
  challengerId: string,
  targetId: string,
): Promise<void> {
  // 获取被挑战者当前排名
  const targetRank = await redis.zrank(RANKING_LIST_KEY, targetId);
  if (targetRank === null) {
    throw new Error('被挑战者不在排行榜上');
  }
  const targetRank1Based = targetRank + 1;

  // 获取挑战者当前排名（如果不在榜上则为null）
  const challengerRank = await redis.zrank(RANKING_LIST_KEY, challengerId);

  // 使用 pipeline 确保原子性
  const pipeline = redis.pipeline();

  if (challengerRank === null) {
    // 挑战者不在榜上，直接插入到被挑战者的位置
    pipeline.zadd(RANKING_LIST_KEY, {
      score: targetRank1Based,
      member: challengerId,
    });
    // 将被挑战者及其下方所有角色排名+1
    const members = (await redis.zrange(
      RANKING_LIST_KEY,
      targetRank1Based,
      -1,
    )) as string[];
    for (let i = 0; i < members.length; i++) {
      const id = members[i];
      if (id !== challengerId) {
        pipeline.zadd(RANKING_LIST_KEY, {
          score: targetRank1Based + i + 1,
          member: id,
        });
      }
    }
  } else {
    const challengerRank1Based = challengerRank + 1;
    // 挑战者在榜上，只能挑战排名更高的
    if (challengerRank1Based <= targetRank1Based) {
      throw new Error('只能挑战排名比自己高的角色');
    }

    // 获取被挑战者位置开始的所有成员（需要下移）
    // 使用 targetRank（0-based）作为起始索引
    const members = (await redis.zrange(
      RANKING_LIST_KEY,
      targetRank,
      -1,
    )) as string[];

    // 将获取到的成员（除了挑战者）都下移一位
    // 关键：需要用单独的计数器追踪实际要分配的排名
    let rankOffset = 1; // 从被挑战者的下一名开始（因为挑战者会占据被挑战者的位置）
    for (let i = 0; i < members.length; i++) {
      const id = members[i];
      if (id === challengerId) continue; // 跳过挑战者自己

      // 分配新排名：被挑战者原排名 + 偏移量
      const newRank = targetRank1Based + rankOffset;
      pipeline.zadd(RANKING_LIST_KEY, {
        score: newRank,
        member: id,
      });
      rankOffset++; // 下一个成员的偏移量增加
    }

    // 将挑战者排名设为被挑战者的排名
    pipeline.zadd(RANKING_LIST_KEY, {
      score: targetRank1Based,
      member: challengerId,
    });
  }

  await pipeline.exec();

  // 限制排行榜大小
  await redis.zremrangebyrank(RANKING_LIST_KEY, MAX_RANKING_SIZE, -1);
}

/**
 * 检查挑战次数（不增加）
 * @returns 返回是否还有剩余挑战次数
 */
export async function checkDailyChallenges(
  cultivatorId: string,
): Promise<{ success: boolean; remaining: number }> {
  const today = getTodayString();
  const key = `${DAILY_CHALLENGES_PREFIX}${cultivatorId}:${today}`;

  const current = await redis.get(key);
  const count = current ? parseInt(current as string, 10) : 0;

  if (count >= MAX_DAILY_CHALLENGES) {
    return { success: false, remaining: 0 };
  }

  return { success: true, remaining: MAX_DAILY_CHALLENGES - count };
}

/**
 * 增加挑战次数（挑战成功后调用）
 */
export async function incrementDailyChallenges(
  cultivatorId: string,
): Promise<number> {
  const today = getTodayString();
  const key = `${DAILY_CHALLENGES_PREFIX}${cultivatorId}:${today}`;

  const current = await redis.get(key);
  const count = current ? parseInt(current as string, 10) : 0;

  // 增加挑战次数
  const newCount = count + 1;
  const ttl = getSecondsUntilMidnight();
  await redis.setex(key, ttl, newCount.toString());

  return MAX_DAILY_CHALLENGES - newCount;
}

/**
 * 获取剩余挑战次数
 */
export async function getRemainingChallenges(
  cultivatorId: string,
): Promise<number> {
  const today = getTodayString();
  const key = `${DAILY_CHALLENGES_PREFIX}${cultivatorId}:${today}`;

  const current = await redis.get(key);
  const count = current ? parseInt(current as string, 10) : 0;

  return Math.max(0, MAX_DAILY_CHALLENGES - count);
}

/**
 * 检查是否在保护期
 */
export async function isProtected(cultivatorId: string): Promise<boolean> {
  const protectionKey = `${PROTECTION_PREFIX}${cultivatorId}`;
  const protectionTime = await redis.get(protectionKey);

  if (!protectionTime) {
    return false;
  }

  const timeDiff = Date.now() - parseInt(protectionTime as string, 10);
  return timeDiff < PROTECTION_DURATION * 1000;
}

/**
 * 获取挑战锁
 * @returns 返回是否成功获取锁
 */
export async function acquireChallengeLock(
  cultivatorId: string,
): Promise<boolean> {
  const lockKey = `${CHALLENGE_LOCK_PREFIX}${cultivatorId}`;

  // 使用SET NX EX实现分布式锁
  // Upstash Redis: set(key, value, { ex?: number, nx?: boolean })
  // 返回 'OK' | null
  const result = await redis.set(lockKey, Date.now().toString(), {
    ex: LOCK_DURATION,
    nx: true, // 只在key不存在时设置
  });

  return result === 'OK';
}

/**
 * 释放挑战锁
 */
export async function releaseChallengeLock(
  cultivatorId: string,
): Promise<void> {
  const lockKey = `${CHALLENGE_LOCK_PREFIX}${cultivatorId}`;
  await redis.del(lockKey);
}

/**
 * 检查是否被锁定
 */
export async function isLocked(cultivatorId: string): Promise<boolean> {
  const lockKey = `${CHALLENGE_LOCK_PREFIX}${cultivatorId}`;
  // Upstash Redis: exists(key) 返回 number (0 或 1)
  const exists = await redis.exists(lockKey);
  return exists === 1;
}

/**
 * 从排行榜移除角色
 */
export async function removeFromRanking(cultivatorId: string): Promise<void> {
  await redis.zrem(RANKING_LIST_KEY, cultivatorId);
  // 兼容旧数据，清理遗留哈希
  const infoKey = `${LEGACY_CULTIVATOR_INFO_PREFIX}${cultivatorId}`;
  await redis.del(infoKey);
}

/**
 * 检查排行榜是否为空
 */
export async function isRankingEmpty(): Promise<boolean> {
  const count = await redis.zcard(RANKING_LIST_KEY);
  return count === 0;
}

/**
 * 获取距离午夜剩余的秒数（用于设置TTL）
 */
function getSecondsUntilMidnight(): number {
  const now = new Date();
  const midnight = new Date(now);
  midnight.setHours(24, 0, 0, 0);
  return Math.ceil((midnight.getTime() - now.getTime()) / 1000);
}
