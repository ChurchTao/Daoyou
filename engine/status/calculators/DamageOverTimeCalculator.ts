import type {
  CalculationContext,
  EffectCalculator,
  StatusInstance,
} from '../types';

/**
 * 持续伤害计算器
 * 负责计算DOT状态每回合造成的伤害
 * 复用battleEngine中的calculateDotDamage逻辑
 */
export class DamageOverTimeCalculator implements EffectCalculator {
  calculateDamageOverTime(
    status: StatusInstance,
    context: CalculationContext,
  ): number {
    // 处理DOT类型状态
    if (
      status.statusKey === 'burn' ||
      status.statusKey === 'bleed' ||
      status.statusKey === 'poison'
    ) {
      return this.calculateStandardDot(status, context);
    }

    // 处理环境状态 - toxic_air
    if (status.statusKey === 'toxic_air') {
      return this.calculateToxicAirDamage(status, context);
    }

    return 0;
  }

  /**
   * 计算标准DOT伤害
   */
  private calculateStandardDot(
    status: StatusInstance,
    context: CalculationContext,
  ): number {
    const targetFinal = context.target.baseAttributes;
    const baseHp = 80 + targetFinal.vitality;
    const potency = status.potency ?? 60;

    // 从 source 获取施放者属性
    const sourceSpirit =
      status.source.casterSnapshot?.attributes.spirit ?? targetFinal.spirit;
    const element =
      status.element ??
      (status.statusKey === 'burn'
        ? '火'
        : status.statusKey === 'poison'
          ? '木'
          : '金');
    const elementBonus =
      status.source.casterSnapshot?.elementMultipliers?.[element] ?? 1.0;

    // 不同DOT类型的系数
    let ratio = 0.05;
    if (status.statusKey === 'burn') ratio = 0.07;
    else if (status.statusKey === 'bleed') ratio = 0.06;

    let damage =
      baseHp * ratio +
      potency * (status.statusKey === 'poison' ? 0.25 : 0.2) +
      sourceSpirit * 0.15;

    damage *= elementBonus;

    // TODO: 应用减伤,需要从 context 获取减伤信息
    // 暂时不考虑减伤,等集成到战斗引擎时再处理

    return Math.max(1, Math.floor(damage));
  }

  /**
   * 计算 toxic_air 环境状态的每回合伤害
   * 每回合损失 maxHp 的2%
   */
  private calculateToxicAirDamage(
    status: StatusInstance,
    context: CalculationContext,
  ): number {
    const maxHp = context.target.maxHp;
    const potency = status.potency ?? 2; // 默认 2%
    const damage = maxHp * (potency / 100);
    return Math.max(1, Math.floor(damage));
  }
}

export const damageOverTimeCalculator = new DamageOverTimeCalculator();
