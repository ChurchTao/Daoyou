import type { EffectCalculator } from '../types';

/**
 * 抗性计算器
 * 负责计算状态的抵抗成功率
 */
export class ResistanceCalculator implements EffectCalculator {
  calculateResistance(
    attackerWillpower: number,
    defenderWillpower: number,
    statusPotency: number,
  ): number {
    // 基础命中率:基于potency,范围0.2-0.8
    const baseHit = Math.min(0.8, Math.max(0.2, statusPotency / 250));
    
    // 抵抗率:基于防御者意志力,最高0.7
    const resist = Math.min(0.7, defenderWillpower / 3000);
    
    // 最终抵抗概率 = 抵抗率 * (1 - 基础命中率)
    const resistChance = resist * (1 - baseHit);
    
    return Math.max(0, Math.min(1, resistChance));
  }
}

export const resistanceCalculator = new ResistanceCalculator();
