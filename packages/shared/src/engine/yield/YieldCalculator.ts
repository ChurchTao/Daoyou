import { calculateOfflineExp } from '@daoyou/shared/engine/cultivation/ExpBudgetCalculator';
import type { ResourceOperation } from '@daoyou/shared/engine/resource/types';
import {
  REALM_YIELD_RATES,
  type Quality,
  type RealmStage,
  type RealmType,
} from '@daoyou/shared/types/constants';

export const YIELD_MATERIAL_QUALITY_CHANCE_BY_REALM: Record<
  RealmType,
  Record<Quality, number>
> = {
  炼气: {
    凡品: 0.45,
    灵品: 0.3,
    玄品: 0.18,
    真品: 0.06,
    地品: 0.01,
    天品: 0,
    仙品: 0,
    神品: 0,
  },
  筑基: {
    凡品: 0.35,
    灵品: 0.3,
    玄品: 0.2,
    真品: 0.1,
    地品: 0.05,
    天品: 0,
    仙品: 0,
    神品: 0,
  },
  金丹: {
    凡品: 0.25,
    灵品: 0.28,
    玄品: 0.22,
    真品: 0.14,
    地品: 0.09,
    天品: 0.02,
    仙品: 0,
    神品: 0,
  },
  元婴: {
    凡品: 0.18,
    灵品: 0.24,
    玄品: 0.23,
    真品: 0.16,
    地品: 0.12,
    天品: 0.06,
    仙品: 0.01,
    神品: 0,
  },
  化神: {
    凡品: 0.12,
    灵品: 0.2,
    玄品: 0.23,
    真品: 0.18,
    地品: 0.14,
    天品: 0.09,
    仙品: 0.03,
    神品: 0.01,
  },
  炼虚: {
    凡品: 0.08,
    灵品: 0.16,
    玄品: 0.22,
    真品: 0.18,
    地品: 0.16,
    天品: 0.12,
    仙品: 0.06,
    神品: 0.02,
  },
  合体: {
    凡品: 0.05,
    灵品: 0.12,
    玄品: 0.2,
    真品: 0.18,
    地品: 0.18,
    天品: 0.15,
    仙品: 0.09,
    神品: 0.03,
  },
  大乘: {
    凡品: 0.03,
    灵品: 0.09,
    玄品: 0.16,
    真品: 0.18,
    地品: 0.2,
    天品: 0.18,
    仙品: 0.12,
    神品: 0.04,
  },
  渡劫: {
    凡品: 0.02,
    灵品: 0.06,
    玄品: 0.12,
    真品: 0.16,
    地品: 0.2,
    天品: 0.22,
    仙品: 0.16,
    神品: 0.06,
  },
};

/**
 * 历练收益计算器
 *
 * 根据角色境界和历练时长计算奖励
 */
export class YieldCalculator {
  static getMaterialQualityChanceMap(realm: RealmType): Record<Quality, number> {
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
