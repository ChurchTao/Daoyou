import {
  CRITICAL_MULTIPLIER,
  MAX_CRIT_RATE,
  MIN_CRIT_RATE,
  type CriticalContext,
} from '../types';

/**
 * 暴击计算器
 */
export class CriticalCalculator {
  /**
   * 计算暴击率
   * 公式：(悟性 - 40) / 200 + Buff 加成
   */
  calculateCriticalRate(context: CriticalContext): number {
    const { attributes, critRateBonus = 0 } = context;

    // 基础暴击率
    let critRate = (attributes.wisdom - 40) / 200;

    // Buff 修正
    critRate += critRateBonus;

    // 限制范围
    return Math.min(Math.max(critRate, MIN_CRIT_RATE), MAX_CRIT_RATE);
  }

  /**
   * 判断是否暴击
   */
  rollCritical(context: CriticalContext): boolean {
    const critRate = this.calculateCriticalRate(context);
    return Math.random() < critRate;
  }

  /**
   * 获取暴击倍率
   */
  getCriticalMultiplier(): number {
    return CRITICAL_MULTIPLIER;
  }
}

export const criticalCalculator = new CriticalCalculator();
