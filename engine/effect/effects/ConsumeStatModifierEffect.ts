import { Attributes } from '@/types/cultivator';
import { getAttributeInfo, getAttributeLabel } from '@/types/dictionaries';
import { BaseEffect } from '../BaseEffect';
import {
  EffectTrigger,
  StatModifierType,
  type ConsumeStatModifierParams,
  type EffectContext,
} from '../types';

/**
 * 消耗品属性修正效果
 * 用于消耗品触发的永久属性修正（如丹药提升体魄/灵力等）
 * 与 StatModifier 的区别：
 * - 持久化到数据库，不通过 BuffManager
 * - 直接修改角色属性（vitality, spirit, wisdom, speed, willpower）
 */
export class ConsumeStatModifierEffect extends BaseEffect {
  readonly id = 'ConsumeStatModifier';
  readonly trigger = EffectTrigger.ON_CONSUME;

  /** 要修改的属性名 */
  private stat: keyof Attributes;
  /** 修正类型 */
  private modType: StatModifierType;
  /** 修正值 */
  private value: number;

  constructor(params: ConsumeStatModifierParams) {
    super(params as unknown as Record<string, unknown>);

    this.stat = params.stat;
    this.modType = params.modType;
    this.value = params.value;
  }

  /**
   * 只在 ON_CONSUME 触发
   */
  shouldTrigger(ctx: EffectContext): boolean {
    return ctx.trigger === EffectTrigger.ON_CONSUME;
  }

  /**
   * 应用永久属性修正
   */
  apply(ctx: EffectContext): void {
    const target = ctx.target;
    if (!target) return;

    const currentValue = target.getAttribute(this.stat);

    let newValue: number;
    if (this.modType === StatModifierType.FIXED) {
      newValue = currentValue + this.value;
    } else {
      newValue = Math.round(currentValue * (1 + this.value));
    }

    // 更新内存中的属性
    target.setAttribute(this.stat, newValue);

    // 记录日志
    const addOrMinus = this.value > 0 ? '增加' : '减少';
    const value = Math.abs(this.value);
    const stateText = getAttributeLabel(this.stat);
    const unit = this.modType === StatModifierType.PERCENT ? '%' : '点';

    ctx.logCollector?.addLog(
      `${target.name} 的${stateText}${addOrMinus} ${value}${unit}`,
    );
  }

  displayInfo() {
    const addOrMinus = this.value > 0 ? '增加' : '减少';
    const value = Math.abs(this.value);
    const info = getAttributeInfo(this.stat);
    const stateText = info.label;

    return {
      label: '永久属性修正',
      icon: info.icon,
      description: `使用后${addOrMinus}${stateText}${value}${this.modType === StatModifierType.PERCENT ? '%' : '点'}`,
    };
  }
}
