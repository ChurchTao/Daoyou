import { Attributes } from '@/types/cultivator';
import { BaseEffect } from '../BaseEffect';
import {
  EffectTrigger,
  StatModifierType,
  type EffectContext,
  type StatModifierParams,
} from '../types';

/**
 * 属性修正效果
 * 用于修改实体的属性值（攻击力、防御力等）
 */
export class StatModifierEffect extends BaseEffect {
  readonly id = 'StatModifier';
  readonly trigger = EffectTrigger.ON_STAT_CALC;

  /** 要修改的属性名 */
  private stat: string;
  /** 修正类型 */
  private modType: StatModifierType;
  /** 修正值或公式 */
  private value: number;

  constructor(params: StatModifierParams) {
    super(params as unknown as Record<string, unknown>);

    this.stat = params.stat;
    this.modType = params.modType;
    this.value = params.value;

    // 根据 modType 自动设置优先级
    // 确保计算顺序: BASE -> FIXED -> PERCENT -> FINAL
    this.priority = this.modType * 1000;
  }

  /**
   * 只在计算目标属性时触发
   */
  shouldTrigger(ctx: EffectContext): boolean {
    return (
      ctx.metadata?.statName === this.stat &&
      ctx.trigger === EffectTrigger.ON_STAT_CALC
    );
  }

  /**
   * 应用属性修正
   */
  apply(ctx: EffectContext): void {
    // 计算实际修正值
    const addValue = this.value;

    // 根据修正类型应用不同的计算逻辑
    switch (this.modType) {
      case StatModifierType.BASE:
      case StatModifierType.FIXED:
      case StatModifierType.FINAL:
        // 加算
        ctx.value = (ctx.value ?? 0) + addValue;
        break;
      case StatModifierType.PERCENT:
        // 乘算
        ctx.value = (ctx.value ?? 0) * (1 + addValue);
        break;
    }
  }

  displayInfo() {
    const addOrMinus = this.value > 0 ? '增加' : '减少';
    const value = Math.abs(this.value);
    const stateText = this.renderState(this.stat as keyof Attributes);

    return {
      label: '基础属性修正',
      icon: '',
      description: `${addOrMinus}${stateText}${value}${this.modType == StatModifierType.PERCENT ? '%' : ''}`,
    };
  }

  private renderState(state: keyof Attributes) {
    switch (state) {
      case 'vitality':
        return '体魄';
      case 'spirit':
        return '灵力';
      case 'wisdom':
        return '悟性';
      case 'speed':
        return '速度';
      case 'willpower':
        return '神识';
      case 'critRate':
        return '暴击率';
      case 'critDamage':
        return '暴击伤害';
      case 'damageReduction':
        return '伤害减免';
      case 'flatDamageReduction':
        return '固定减伤';
      case 'hitRate':
        return '命中率';
      case 'dodgeRate':
        return '闪避率';
      default:
        return state;
    }
  }
}
