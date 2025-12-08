import type { Cultivator } from '@/types/cultivator';
import { calculateFinalAttributes } from '@/utils/cultivatorUtils';
import { redis } from './index';

const RANKING_LIST_KEY = 'golden_rank:list';
const CULTIVATOR_INFO_PREFIX = 'golden_rank:cultivator:';
const PROTECTION_PREFIX = 'golden_rank:protection:';
const DAILY_CHALLENGES_PREFIX = 'golden_rank:daily_challenges:';
const CHALLENGE_LOCK_PREFIX = 'golden_rank:challenge_lock:';

const MAX_RANKING_SIZE = 100;
const PROTECTION_DURATION = 7200; // 2小时，单位：秒
const LOCK_DURATION = 300; // 5分钟，单位：秒
const MAX_DAILY_CHALLENGES = 10;

export interface RankingItem {
  cultivatorId: string;
  rank: number;
  name: string;
  realm: string;
  realm_stage: string;
  combat_rating: number;
  faction?: string;
  spirit_root: string;
  user_id: string;
  isNewcomer: boolean; // 是否为新天骄（2小时内）
  updated_at: number;
}

export interface CultivatorRankInfo {
  rank: number | null; // null表示不在榜上
  isProtected: boolean;
  remainingChallenges: number;
}

/**
 * 计算战力评分
 */
function calcCombatRating(cultivator: Cultivator): number {
  if (!cultivator?.attributes) return 0;
  const { final } = calculateFinalAttributes(cultivator);
  const { vitality, spirit, wisdom, speed, willpower } = final;
  return Math.round((vitality + spirit + wisdom + speed + willpower) / 5);
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
 * 获取排行榜列表（前100名）
 */
export async function getRankingList(): Promise<RankingItem[]> {
  const client = redis;
  const members = await client.zRange(
    RANKING_LIST_KEY,
    0,
    MAX_RANKING_SIZE - 1,
    {
      REV: false, // 从低到高（排名1到100）
    },
  );

  const items: RankingItem[] = [];
  for (let i = 0; i < members.length; i++) {
    const cultivatorId = members[i];
    const rank = i + 1;
    const info = await getCultivatorRankInfo(cultivatorId);
    if (info) {
      const protectionKey = `${PROTECTION_PREFIX}${cultivatorId}`;
      const protectionTime = await client.get(protectionKey);
      const isNewcomer = protectionTime
        ? Date.now() - parseInt(protectionTime) < PROTECTION_DURATION * 1000
        : false;

      items.push({
        ...info,
        cultivatorId,
        rank,
        isNewcomer,
      });
    }
  }

  return items;
}

/**
 * 获取角色排名信息
 */
export async function getCultivatorRankInfo(
  cultivatorId: string,
): Promise<Omit<RankingItem, 'cultivatorId' | 'rank' | 'isNewcomer'> | null> {
  const client = redis;
  const infoKey = `${CULTIVATOR_INFO_PREFIX}${cultivatorId}`;
  const info = await client.hGetAll(infoKey);

  if (!info || Object.keys(info).length === 0) {
    return null;
  }

  return {
    name: info.name || '',
    realm: info.realm || '',
    realm_stage: info.realm_stage || '',
    combat_rating: parseInt(info.combat_rating || '0', 10),
    faction: info.faction || undefined,
    spirit_root: info.spirit_root || '无',
    user_id: info.user_id || '',
    updated_at: parseInt(info.updated_at || '0', 10),
  };
}

/**
 * 获取角色在排行榜中的排名
 */
export async function getCultivatorRank(
  cultivatorId: string,
): Promise<number | null> {
  const client = redis;
  const rank = await client.zRank(RANKING_LIST_KEY, cultivatorId);
  return rank !== null ? rank + 1 : null; // zRank返回0-based索引，需要+1
}

/**
 * 添加角色到排行榜
 */
export async function addToRanking(
  cultivatorId: string,
  cultivator: Cultivator,
  userId: string,
  targetRank?: number,
): Promise<void> {
  const client = redis;
  const combatRating = calcCombatRating(cultivator);

  // 保存角色详细信息
  const infoKey = `${CULTIVATOR_INFO_PREFIX}${cultivatorId}`;
  await client.hSet(infoKey, {
    name: cultivator.name,
    realm: cultivator.realm,
    realm_stage: cultivator.realm_stage,
    combat_rating: combatRating.toString(),
    faction: cultivator.origin || '',
    spirit_root: cultivator.spiritual_roots[0]?.element || '无',
    user_id: userId,
    updated_at: Date.now().toString(),
  });

  // 添加到排行榜（使用排名作为score）
  // 如果指定了排名，需要先调整后续排名，再插入
  if (targetRank) {
    await adjustRankingsAfterInsert(targetRank);
    await client.zAdd(RANKING_LIST_KEY, {
      score: targetRank,
      value: cultivatorId,
    });
  } else {
    const currentSize = await client.zCard(RANKING_LIST_KEY);
    const rank = currentSize + 1;
    await client.zAdd(RANKING_LIST_KEY, {
      score: rank,
      value: cultivatorId,
    });
  }

  // 设置新上榜保护（2小时）
  const protectionKey = `${PROTECTION_PREFIX}${cultivatorId}`;
  await client.setEx(protectionKey, PROTECTION_DURATION, Date.now().toString());

  // 限制排行榜大小（只保留前100名）
  await client.zRemRangeByRank(RANKING_LIST_KEY, MAX_RANKING_SIZE, -1);
}

/**
 * 调整插入后的排名（将targetRank及之后的排名+1）
 */
async function adjustRankingsAfterInsert(targetRank: number): Promise<void> {
  const client = redis;
  // 获取从targetRank开始的所有成员（0-based索引，所以是targetRank-1）
  const members = await client.zRange(RANKING_LIST_KEY, targetRank - 1, -1, {
    REV: false,
  });

  if (members.length === 0) {
    return; // 没有需要调整的成员
  }

  // 使用事务更新排名
  const multi = client.multi();
  for (let i = 0; i < members.length; i++) {
    const cultivatorId = members[i];
    const newRank = targetRank + i + 1; // 所有排名+1
    multi.zAdd(RANKING_LIST_KEY, {
      score: newRank,
      value: cultivatorId,
    });
  }
  await multi.exec();
}

/**
 * 更新排名（挑战成功）
 */
export async function updateRanking(
  challengerId: string,
  targetId: string,
): Promise<void> {
  const client = redis;

  // 获取被挑战者当前排名
  const targetRank = await client.zRank(RANKING_LIST_KEY, targetId);
  if (targetRank === null) {
    throw new Error('被挑战者不在排行榜上');
  }
  const targetRank1Based = targetRank + 1;

  // 获取挑战者当前排名（如果不在榜上则为null）
  const challengerRank = await client.zRank(RANKING_LIST_KEY, challengerId);

  // 使用事务确保原子性
  const multi = client.multi();

  if (challengerRank === null) {
    // 挑战者不在榜上，直接插入到被挑战者的位置
    multi.zAdd(RANKING_LIST_KEY, {
      score: targetRank1Based,
      value: challengerId,
    });
    // 将被挑战者及其下方所有角色排名+1
    const members = await client.zRange(
      RANKING_LIST_KEY,
      targetRank1Based,
      -1,
      {
        REV: false,
      },
    );
    for (let i = 0; i < members.length; i++) {
      const id = members[i];
      if (id !== challengerId) {
        multi.zAdd(RANKING_LIST_KEY, {
          score: targetRank1Based + i + 1,
          value: id,
        });
      }
    }
  } else {
    const challengerRank1Based = challengerRank + 1;
    // 挑战者在榜上，只能挑战排名更高的
    if (challengerRank1Based <= targetRank1Based) {
      throw new Error('只能挑战排名比自己高的角色');
    }

    // 将被挑战者及其下方所有角色排名+1
    const members = await client.zRange(RANKING_LIST_KEY, targetRank, -1, {
      REV: false,
    });
    for (let i = 0; i < members.length; i++) {
      const id = members[i];
      if (id === challengerId) continue; // 跳过挑战者自己
      const newRank = targetRank1Based + i + 1;
      multi.zAdd(RANKING_LIST_KEY, {
        score: newRank,
        value: id,
      });
    }

    // 将挑战者排名设为被挑战者的排名
    multi.zAdd(RANKING_LIST_KEY, {
      score: targetRank1Based,
      value: challengerId,
    });
  }

  // 更新挑战者的信息时间戳
  const challengerInfoKey = `${CULTIVATOR_INFO_PREFIX}${challengerId}`;
  multi.hSet(challengerInfoKey, 'updated_at', Date.now().toString());

  await multi.exec();

  // 限制排行榜大小
  await client.zRemRangeByRank(RANKING_LIST_KEY, MAX_RANKING_SIZE, -1);
}

/**
 * 检查并增加挑战次数
 * @returns 返回是否还有剩余挑战次数
 */
export async function checkDailyChallenges(
  cultivatorId: string,
): Promise<{ success: boolean; remaining: number }> {
  const client = redis;
  const today = getTodayString();
  const key = `${DAILY_CHALLENGES_PREFIX}${cultivatorId}:${today}`;

  const current = await client.get(key);
  const count = current ? parseInt(current, 10) : 0;

  if (count >= MAX_DAILY_CHALLENGES) {
    return { success: false, remaining: 0 };
  }

  // 增加挑战次数
  const newCount = count + 1;
  const ttl = getSecondsUntilMidnight();
  await client.setEx(key, ttl, newCount.toString());

  return { success: true, remaining: MAX_DAILY_CHALLENGES - newCount };
}

/**
 * 获取剩余挑战次数
 */
export async function getRemainingChallenges(
  cultivatorId: string,
): Promise<number> {
  const client = redis;
  const today = getTodayString();
  const key = `${DAILY_CHALLENGES_PREFIX}${cultivatorId}:${today}`;

  const current = await client.get(key);
  const count = current ? parseInt(current, 10) : 0;

  return Math.max(0, MAX_DAILY_CHALLENGES - count);
}

/**
 * 检查是否在保护期
 */
export async function isProtected(cultivatorId: string): Promise<boolean> {
  const client = redis;
  const protectionKey = `${PROTECTION_PREFIX}${cultivatorId}`;
  const protectionTime = await client.get(protectionKey);

  if (!protectionTime) {
    return false;
  }

  const timeDiff = Date.now() - parseInt(protectionTime);
  return timeDiff < PROTECTION_DURATION * 1000;
}

/**
 * 获取挑战锁
 * @returns 返回是否成功获取锁
 */
export async function acquireChallengeLock(
  cultivatorId: string,
): Promise<boolean> {
  const client = redis;
  const lockKey = `${CHALLENGE_LOCK_PREFIX}${cultivatorId}`;

  // 使用SET NX EX实现分布式锁
  const result = await client.set(lockKey, Date.now().toString(), {
    EX: LOCK_DURATION,
    NX: true, // 只在key不存在时设置
  });

  return result === 'OK';
}

/**
 * 释放挑战锁
 */
export async function releaseChallengeLock(
  cultivatorId: string,
): Promise<void> {
  const client = redis;
  const lockKey = `${CHALLENGE_LOCK_PREFIX}${cultivatorId}`;
  await client.del(lockKey);
}

/**
 * 检查是否被锁定
 */
export async function isLocked(cultivatorId: string): Promise<boolean> {
  const client = redis;
  const lockKey = `${CHALLENGE_LOCK_PREFIX}${cultivatorId}`;
  const exists = await client.exists(lockKey);
  return exists === 1;
}

/**
 * 从排行榜移除角色
 */
export async function removeFromRanking(cultivatorId: string): Promise<void> {
  const client = redis;
  await client.zRem(RANKING_LIST_KEY, cultivatorId);
  const infoKey = `${CULTIVATOR_INFO_PREFIX}${cultivatorId}`;
  await client.del(infoKey);
}

/**
 * 检查排行榜是否为空
 */
export async function isRankingEmpty(): Promise<boolean> {
  const client = redis;
  const count = await client.zCard(RANKING_LIST_KEY);
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
