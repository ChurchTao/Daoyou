/**
 * 副本结算奖励：灵石、修为和感悟。物品奖励由当前背包发放，不在这里生成。
 */

import type { ResourceOperation } from '@daoyou/game-domain/resources';
import { YieldCalculator } from '@daoyou/game-rules/yield';
import { calculateDungeonExp } from '@daoyou/game-rules/cultivation';
import { type DungeonDifficultyTier } from '@daoyou/game-domain/dungeon';
import { getDungeonRewardBonus } from '@daoyou/game-rules/world/dungeon';
import type { RealmStage, RealmType } from '@daoyou/constants/realms';
import type { PlayerInfo } from '@server/dungeon/application/flow/types.js';
import {
  REALM_REWARD_CONFIG,
  TIER_MULTIPLIER,
} from '@server/dungeon/application/flow/reward/rewardConfig.js';
import type { ValueRange } from '@server/dungeon/application/flow/reward/types.js';

/**
 * 奖励工厂 - 将 AI 蓝图转化为实际物品
 */
export class RewardFactory {
  /**
   * 根据评级生成基础奖励（灵石、修为、感悟值）
   *
   * S: 大量灵石+修为+感悟
   * A: 中等灵石+修为
   * B: 少量灵石+修为
   * C: 少量灵石
   * D: 少量灵石
   *
   * @param mapRealm 地图境界门槛
   * @param tier 副本评级 (S/A/B/C/D)
   * @param dangerScore 危险系数 (0-100)
   * @param playerInfo 玩家信息
   * @returns 基础奖励操作数组
   */
  static generateBaseRewards(
    mapRealm: RealmType,
    tier: string,
    dangerScore: number,
    playerInfo: PlayerInfo,
    difficultyTier?: DungeonDifficultyTier,
  ): ResourceOperation[] {
    const config = REALM_REWARD_CONFIG[mapRealm] || REALM_REWARD_CONFIG['筑基'];
    const dangerBonus = this.getDangerBonus(dangerScore);
    const rewardBonus = getDungeonRewardBonus(difficultyTier);
    const rewards: ResourceOperation[] = [];

    // 1. 灵石奖励 (基于挂机收益)
    const rewardHours = this.rollRewardHoursByTier(tier);
    const yieldOps = YieldCalculator.calculateRealmYield(mapRealm, rewardHours);
    const spiritStones =
      yieldOps.find((op) => op.type === 'spirit_stones')?.value ?? 0;
    if (spiritStones > 0) {
      rewards.push({
        type: 'spirit_stones',
        value: Math.floor(
          spiritStones * (1 + dangerBonus * 0.35) * rewardBonus,
        ),
      });
    }

    // 2. 修为奖励（使用统筹计算器 dungeon 场景）
    const realmStr = playerInfo.realm.split(' ')[0] as RealmType;
    const stageStr = (playerInfo.realm.split(' ')[1] || '初期') as RealmStage;
    const cultivationExp = calculateDungeonExp(
      realmStr,
      stageStr,
      tier,
      dangerBonus,
    );

    if (cultivationExp > 0) {
      rewards.push({
        type: 'cultivation_exp',
        value: Math.floor(cultivationExp * rewardBonus),
      });
    }

    // 3. 感悟奖励 (A 级少量产出，S 级完整产出)
    if (tier === 'S' || tier === 'A') {
      const multiplier = TIER_MULTIPLIER[tier] || TIER_MULTIPLIER['C'];
      const insightValue = this.randomInRange(
        config.comprehension_insight,
        tier === 'A'
          ? { min: multiplier.min * 0.5, max: multiplier.max * 0.65 }
          : multiplier,
        dangerBonus,
      );
      rewards.push({
        type: 'comprehension_insight',
        value: Math.max(
          1,
          Math.floor(insightValue * rewardBonus),
        ),
      });
    }

    return rewards;
  }

  /**
   * 评级映射的“等效挂机时长”
   *
   * D/C/B/A/S -> 3/4-5/6-7/8-10/11-12 小时
   */
  private static rollRewardHoursByTier(tier: string): number {
    const hourRangeByTier: Record<string, { min: number; max: number }> = {
      D: { min: 3, max: 3 },
      C: { min: 4, max: 5 },
      B: { min: 6, max: 7 },
      A: { min: 8, max: 10 },
      S: { min: 11, max: 12 },
    };

    const range = hourRangeByTier[tier] || hourRangeByTier.C;
    return Math.floor(range.min + Math.random() * (range.max - range.min + 1));
  }

  /** 危险分数加成 (0-100 -> 0-0.5) */
  private static getDangerBonus(dangerScore: number): number {
    return dangerScore / 200;
  }

  /**
   * 在范围内根据倍率和危险分数随机取值
   */
  private static randomInRange(
    range: ValueRange,
    multiplier: ValueRange,
    dangerBonus: number,
  ): number {
    const span = range.max - range.min;
    const effectiveMin = range.min + span * multiplier.min;
    const effectiveMax = range.min + span * multiplier.max;
    const base = effectiveMin + Math.random() * (effectiveMax - effectiveMin);
    return Math.floor(base * (1 + dangerBonus));
  }
}
