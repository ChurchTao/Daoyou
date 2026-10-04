import { YIELD_MATERIAL_QUALITY_CHANCE_BY_REALM } from '@daoyou/game-content/rewards/yield';
import { calculateOfflineExp } from '../cultivation/exp-gain-strategies/index.js';

import type { ResourceOperation } from '@daoyou/game-domain/resources';

import { REALM_YIELD_RATES } from '@daoyou/game-content/economy';

import { type Quality } from '@daoyou/constants/qualities';

import { type RealmStage, type RealmType } from '@daoyou/constants/realms';

/**
 * 历练收益计算器
 *
 * 根据角色境界和历练时长计算奖励
 */
export class YieldCalculator {
  static getMaterialQualityChanceMap(
    realm: RealmType,
  ): Record<Quality, number> {
    return YIELD_MATERIAL_QUALITY_CHANCE_BY_REALM[realm];
  }

  static calculateCultivatorYield(
    input: {
      realm: RealmType;
      realmStage: RealmStage;
      hoursElapsed: number;
    },
    rng: () => number = Math.random,
  ): ResourceOperation[] {
    const { realm, realmStage, hoursElapsed } = input;
    const operations: ResourceOperation[] = [];

    const baseRate = REALM_YIELD_RATES[realm] || 10;
    const randomMultiplier = 0.8 + rng() * 1.2;
    const spiritStones = Math.floor(baseRate * hoursElapsed * randomMultiplier);
    operations.push({
      type: 'spirit_stones',
      value: spiritStones,
    });

    const offlineExp = calculateOfflineExp(
      realm,
      realmStage,
      hoursElapsed,
      rng,
    );
    if (offlineExp > 0) {
      operations.push({
        type: 'cultivation_exp',
        value: offlineExp,
      });
    }

    const insightGain = Math.floor(Math.floor(1 + rng() * 2) * hoursElapsed);
    if (insightGain > 0) {
      operations.push({
        type: 'comprehension_insight',
        value: insightGain,
      });
    }

    return operations;
  }

  static calculateRealmYield(
    realm: RealmType,
    hoursElapsed: number,
    rng: () => number = Math.random,
  ): ResourceOperation[] {
    const baseRate = REALM_YIELD_RATES[realm] || 10;
    const operations: ResourceOperation[] = [
      {
        type: 'spirit_stones',
        value: Math.floor(baseRate * hoursElapsed * (0.8 + rng() * 1.2)),
      },
    ];
    const expGain = Math.floor(baseRate * 0.1 * hoursElapsed);
    if (expGain > 0) {
      operations.push({ type: 'cultivation_exp', value: expGain });
    }
    if (rng() < 0.1 * hoursElapsed) {
      operations.push({
        type: 'comprehension_insight',
        value: Math.floor(1 + rng() * 5),
      });
    }
    return operations;
  }

  /**
   * 计算材料掉落数量
   * @param hoursElapsed 历练小时数
   * @returns 材料数量
   */
  static calculateMaterialCount(hoursElapsed: number): number {
    return Math.floor(hoursElapsed / 3);
  }
}
