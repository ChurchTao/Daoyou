import type { Attributes } from '@/types/cultivator';
import type { SkillType } from '@/types/constants';
import { MAX_EVASION_RATE, type EvasionContext } from '../types';

/**
 * 闪避计算器
 * 负责计算闪避概率
 */
export class EvasionCalculator {
  /**
   * 计算闪避率
   * 
   * 公式：
   * 基础闪避率 = min(0.3, (速度 + 速度增益) / 350)
   * 
   * 特殊情况：
   * - 眩晕/定身状态：闪避率 = 0
   * - 治疗/增益技能：不触发闪避
   * 
   * @param context 闪避计算上下文
   * @returns 闪避率（0-1之间）
   */
  calculateEvasionChance(context: EvasionContext): number {
    const { attributes, hasSpeedUp, isStunned, isRooted } = context;

    // 眩晕或定身状态下无法闪避
    if (isStunned || isRooted) {
      return 0;
    }

    // 计算速度加成
    const speedBonus = hasSpeedUp ? 20 : 0;
    const totalSpeed = attributes.speed + speedBonus;

    // 计算闪避率，限制最大为30%
    const evasionRate = Math.min(MAX_EVASION_RATE, totalSpeed / 350);

    return evasionRate;
  }

  /**
   * 计算闪避率（简化版本）
   * 
   * @param attributes 属性
   * @param hasSpeedUp 是否有疾行状态
   * @param isStunned 是否眩晕
   * @param isRooted 是否定身
   * @returns 闪避率
   */
  getEvasionRate(
    attributes: Attributes,
    hasSpeedUp: boolean = false,
    isStunned: boolean = false,
    isRooted: boolean = false,
  ): number {
    return this.calculateEvasionChance({
      attributes,
      hasSpeedUp,
      isStunned,
      isRooted,
    });
  }

  /**
   * 判断是否触发闪避
   * 
   * @param context 闪避计算上下文
   * @returns 是否闪避成功
   */
  rollEvasion(context: EvasionContext): boolean {
    const evasionRate = this.calculateEvasionChance(context);
    return Math.random() < evasionRate;
  }

  /**
   * 判断技能是否可被闪避
   * 治疗和增益技能不能被闪避
   * 
   * @param skillType 技能类型
   * @returns 是否可闪避
   */
  canEvade(skillType: SkillType): boolean {
    return skillType !== 'heal' && skillType !== 'buff';
  }

  /**
   * 检查是否应该进行闪避判定
   * 
   * @param skillType 技能类型
   * @param context 闪避上下文
   * @returns 是否应该进行闪避判定
   */
  shouldCheckEvasion(skillType: SkillType, context: EvasionContext): boolean {
    // 技能不可闪避
    if (!this.canEvade(skillType)) {
      return false;
    }

    // 眩晕或定身状态无法闪避
    if (context.isStunned || context.isRooted) {
      return false;
    }

    return true;
  }
}

// 导出单例
export const evasionCalculator = new EvasionCalculator();
