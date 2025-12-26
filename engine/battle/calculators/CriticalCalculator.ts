import type { Attributes } from '@/types/cultivator';
import {
  CRITICAL_MULTIPLIER,
  MAX_CRIT_RATE,
  MIN_CRIT_RATE,
  type CriticalContext,
} from '../types';

/**
 * 暴击计算器
 * 负责计算暴击概率和暴击伤害
 */
export class CriticalCalculator {
  /**
   * 计算暴击率
   * 
   * 公式：
   * 基础暴击率 = (悟性 - 40) / 200
   * 状态修正：
   * - 锋锐状态：+ 0.15
   * - 暴击压制：- 0.15
   * 限制范围：min(max(暴击率, 0.05), 0.6)
   * 
   * @param context 暴击计算上下文
   * @returns 暴击率（0-1之间）
   */
  calculateCriticalRate(context: CriticalContext): number {
    const { attributes, hasCritRateUp, hasCritRateDown } = context;

    // 基础暴击率
    let critRate = (attributes.wisdom - 40) / 200;

    // 状态修正
    if (hasCritRateUp) {
      critRate += 0.15;
    }
    if (hasCritRateDown) {
      critRate -= 0.15;
    }

    // 限制范围
    return Math.min(Math.max(critRate, MIN_CRIT_RATE), MAX_CRIT_RATE);
  }

  /**
   * 计算暴击率（简化版本，直接传入属性）
   * 
   * @param attributes 属性
   * @param hasCritRateUp 是否有锋锐状态
   * @param hasCritRateDown 是否有暴击压制状态
   * @returns 暴击率
   */
  getCritRate(
    attributes: Attributes,
    hasCritRateUp: boolean = false,
    hasCritRateDown: boolean = false,
  ): number {
    return this.calculateCriticalRate({
      attributes,
      hasCritRateUp,
      hasCritRateDown,
    });
  }

  /**
   * 判断是否触发暴击
   * 
   * @param context 暴击计算上下文
   * @returns 是否暴击
   */
  rollCritical(context: CriticalContext): boolean {
    const critRate = this.calculateCriticalRate(context);
    return Math.random() < critRate;
  }

  /**
   * 获取暴击倍率
   * 
   * @returns 暴击倍率（1.8）
   */
  getCriticalMultiplier(): number {
    return CRITICAL_MULTIPLIER;
  }

  /**
   * 应用暴击倍率到伤害
   * 
   * @param damage 原始伤害
   * @param isCritical 是否暴击
   * @returns 应用暴击后的伤害
   */
  applyCritical(damage: number, isCritical: boolean): number {
    return isCritical ? damage * CRITICAL_MULTIPLIER : damage;
  }
}

// 导出单例
export const criticalCalculator = new CriticalCalculator();
