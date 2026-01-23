import { REALM_YIELD_RATES, RealmType } from '@/types/constants';
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
   * @returns ResourceOperation[] 奖励列表
   */
  static calculateYield(
    realm: RealmType,
    hoursElapsed: number,
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

    // 2. 修为奖励（新增）
    // 每小时获得修为 = 境界基数 * 0.1 * 小时数
    const expGain = Math.floor(baseRate * 0.1 * hoursElapsed);
    if (expGain > 0) {
      operations.push({
        type: 'cultivation_exp',
        value: expGain,
      });
    }

    // 3. 感悟值奖励（新增）
    // 每小时有概率获得感悟值
    const insightChance = 0.1 * hoursElapsed; // 每小时10%概率
    if (Math.random() < insightChance) {
      const insightGain = Math.floor(1 + Math.random() * 5); // 1-5点
      operations.push({
        type: 'comprehension_insight',
        value: insightGain,
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
