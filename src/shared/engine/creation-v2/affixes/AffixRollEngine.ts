import { CREATION_ROLL_POLICY } from '../config/CreationBalance';
import { AffixCandidate, RolledAffix, EnergyBudget } from '../types';

/**
 * 造物词缀数值波动引擎。
 * 负责根据全局策略（CREATION_ROLL_POLICY）和当前投入的能量预算，
 * 为抽中的词缀计算最终的数值效率（rollEfficiency）和倍率（finalMultiplier）。
 */
export class AffixRollEngine {
  /**
   * 为抽中的词缀注入“灵魂”：计算数值波动与 Perfect 标记。
   * @param candidate 抽中的词缀候选项
   * @param budget 当前会话的能量预算，用于计算修正 (Bias)
   * @param rollScore 抽取阶段的权重得分
   */
  roll(
    candidate: AffixCandidate,
    budget: EnergyBudget,
    rollScore: number,
  ): RolledAffix {
    const {
      globalVarianceRange,
      perfectThreshold,
      energyBiasFactor,
      distribution,
    } = CREATION_ROLL_POLICY;

    // 1. 计算能量修正 (Energy Bias)
    // 投入的材料能量越高，随机的起始期望越高
    const bias = Math.min(0.12, budget.effectiveTotal * energyBiasFactor);

    // 2. 生成基础效率分 (0.0 - 1.0)
    let efficiency = 0;
    if (distribution === 'normal') {
      // 模拟正态分布：均值为 0.5 + bias，标准差为 0.16
      efficiency = this.nextNormal(0.5 + bias, 0.16);
    } else {
      efficiency = Math.random() + bias;
    }

    // 3. 截断并归一化到 0 - 1 之间
    const rollEfficiency = Math.max(0, Math.min(1, efficiency));

    // 4. 根据全局波动范围计算最终倍率
    const [min, max] = globalVarianceRange;
    const finalMultiplier = min + (max - min) * rollEfficiency;

    // 5. 判断是否触发 Perfect 标记（极品）
    const isPerfect = rollEfficiency >= perfectThreshold;

    return {
      ...candidate,
      rollScore,
      rollEfficiency,
      finalMultiplier,
      isPerfect,
    };
  }

  /**
   * Box-Muller 变换：生成指定均值和标准差的正态分布随机数
   */
  private nextNormal(mean: number, stdDev: number): number {
    const u = 1 - Math.random();
    const v = 1 - Math.random();
    const z = Math.sqrt(-2.0 * Math.log(u)) * Math.cos(2.0 * Math.PI * v);
    return z * stdDev + mean;
  }
}
