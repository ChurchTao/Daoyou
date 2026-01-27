import { calculateCultivationExp } from '@/utils/cultivationUtils';
import { REALM_YIELD_RATES, RealmType } from '@/types/constants';
import type { Cultivator } from '@/types/cultivator';
import type { ResourceOperation } from '@/engine/resource/types';

/**
 * 历练收益计算器
 *
 * 根据角色境界和历练时长计算奖励
 */
export class YieldCalculator {
  /**
   * 计算历练奖励列表
   * @param realm 角色境界
   * @param hoursElapsed 历练小时数
   * @param cultivator 完整角色信息（可选，用于精确计算修为）
   * @returns ResourceOperation[] 奖励列表
   */
  static calculateYield(
    realm: RealmType,
    hoursElapsed: number,
    cultivator?: Cultivator,
  ): ResourceOperation[] {
    const operations: ResourceOperation[] = [];

    // 1. 灵石奖励（保留原有逻辑）
    const baseRate = REALM_YIELD_RATES[realm] || 10;
    const randomMultiplier = 0.8 + Math.random() * 1.2;
    const spiritStones = Math.floor(baseRate * hoursElapsed * randomMultiplier);
    operations.push({
      type: 'spirit_stones',
      value: spiritStones,
    });

    // 2. 修为奖励（重构：复用闭关系统）
    if (cultivator) {
      // 复用 calculateCultivationExp，1小时=闭关1年
      const expResult = calculateCultivationExp(cultivator, hoursElapsed);
      if (expResult.exp_gained > 0) {
        operations.push({
          type: 'cultivation_exp',
          value: expResult.exp_gained,
        });
      }

      // 感悟值：1小时随机1-2点
      const insightGain = Math.floor(1 + Math.random() * 2) * hoursElapsed;
      if (insightGain > 0) {
        operations.push({
          type: 'comprehension_insight',
          value: insightGain,
        });
      }

      // 顿悟额外感悟值（闭关系统可能触发顿悟）
      if (expResult.insight_gained > 0) {
        operations.push({
          type: 'comprehension_insight',
          value: expResult.insight_gained,
        });
      }
    } else {
      // 降级处理（兼容性，如果未传cultivator）
      const expGain = Math.floor(baseRate * 0.1 * hoursElapsed);
      if (expGain > 0) {
        operations.push({
          type: 'cultivation_exp',
          value: expGain,
        });
      }

      // 感悟值：每小时10%概率获得1-5点
      const insightChance = 0.1 * hoursElapsed;
      if (Math.random() < insightChance) {
        const insightGain = Math.floor(1 + Math.random() * 5);
        operations.push({
          type: 'comprehension_insight',
          value: insightGain,
        });
      }
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
