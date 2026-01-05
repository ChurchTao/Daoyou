import { MAX_EVASION_RATE, type EvasionContext } from '../types';

/**
 * 闪避计算器
 */
export class EvasionCalculator {
  /**
   * 计算闪避率
   * 公式：min(0.3, (速度 + speedBonus) / 350)
   */
  calculateEvasionChance(context: EvasionContext): number {
    const { attributes, cannotDodge = false } = context;

    // 无法闪避
    if (cannotDodge) {
      return 0;
    }

    const totalSpeed = attributes.speed;
    return Math.min(MAX_EVASION_RATE, totalSpeed / 350);
  }

  /**
   * 判断是否闪避
   */
  rollEvasion(context: EvasionContext): boolean {
    const evasionRate = this.calculateEvasionChance(context);
    return Math.random() < evasionRate;
  }
}

export const evasionCalculator = new EvasionCalculator();
