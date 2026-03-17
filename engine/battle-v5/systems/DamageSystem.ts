import { Unit } from '../units/Unit';
import { AttributeType } from '../core/types';

export interface DamageCalculationParams {
  baseDamage: number;
  damageType: 'physical' | 'magic';
  element?: string;
  ignoreCrit?: boolean;
  ignoreDodge?: boolean;
}

export interface DamageResult {
  finalDamage: number;
  isCritical: boolean;
  isDodged: boolean;
  breakdown: {
    baseDamage: number;
    critMultiplier: number;
    damageReduction: number;
    randomFactor: number;
  };
}

/**
 * 伤害系统
 * 处理完整的伤害计算管道
 */
export class DamageSystem {
  /**
   * 计算伤害
   * 流程: 基础伤害 → 暴击 → 闪避 → 减伤 → 随机浮动 → 最终伤害
   */
  static calculateDamage(
    attacker: Unit,
    target: Unit,
    params: DamageCalculationParams,
  ): DamageResult {
    const breakdown = {
      baseDamage: params.baseDamage,
      critMultiplier: 1,
      damageReduction: 0,
      randomFactor: 1,
    };

    let damage = params.baseDamage;

    // 1. 暴击判定
    const isCritical = !params.ignoreCrit && this.rollCrit(attacker);
    if (isCritical) {
      breakdown.critMultiplier = 1.5;
      damage *= breakdown.critMultiplier;
    }

    // 2. 闪避判定
    const isDodged = !params.ignoreDodge && this.rollDodge(target);
    if (isDodged) {
      return {
        finalDamage: 0,
        isCritical,
        isDodged: true,
        breakdown,
      };
    }

    // 3. 伤害减免（基础版，基于体魄）
    const reduction = this.calculateDamageReduction(target);
    breakdown.damageReduction = reduction;
    damage *= (1 - reduction);

    // 4. 随机浮动 (0.9 ~ 1.1)
    const randomFactor = 0.9 + Math.random() * 0.2;
    breakdown.randomFactor = randomFactor;
    damage *= randomFactor;

    // 5. 最小伤害保证
    const finalDamage = Math.max(1, Math.floor(damage));

    return {
      finalDamage,
      isCritical,
      isDodged: false,
      breakdown,
    };
  }

  /**
   * 暴击判定
   */
  private static rollCrit(attacker: Unit): boolean {
    const critRate = attacker.attributes.getCritRate();
    return Math.random() < critRate;
  }

  /**
   * 闪避判定
   */
  private static rollDodge(target: Unit): boolean {
    const evasionRate = target.attributes.getEvasionRate();
    return Math.random() < evasionRate;
  }

  /**
   * 计算伤害减免
   */
  private static calculateDamageReduction(target: Unit): number {
    // 基础减免：每点体魄提供 0.1% 减免，上限 75%
    const physique = target.attributes.getValue(AttributeType.PHYSIQUE);
    const reduction = Math.min(0.75, physique * 0.001);
    return reduction;
  }
}
