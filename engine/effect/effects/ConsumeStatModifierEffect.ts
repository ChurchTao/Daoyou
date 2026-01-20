import { Attributes } from '@/types/cultivator';
import { BaseEffect } from '../BaseEffect';
import {
  EffectTrigger,
  type EffectContext,
} from '../types';

/**
 * 消耗品属性修正参数
 */
export interface ConsumeStatModifierParams {
  /** 要修改的属性名 */
  stat: keyof Attributes;
  /** 修正值 (固定值时为具体数值，百分比时为小数如0.1表示10%) */
  value: number;
  /** 修正类型 */
  modType: 'fixed' | 'percent';
}

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
  private modType: 'fixed' | 'percent';
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
    if (this.modType === 'fixed') {
      newValue = currentValue + this.value;
    } else {
      newValue = Math.round(currentValue * (1 + this.value));
    }

    // 更新内存中的属性
    target.setAttribute(this.stat, newValue);

    // 记录日志
    const addOrMinus = this.value > 0 ? '增加' : '减少';
    const value = Math.abs(this.value);
    const stateText = this.renderState(this.stat);
    const unit = this.modType === 'percent' ? '%' : '点';

    ctx.logCollector?.addLog(
      `${target.name} 的${stateText}${addOrMinus} ${value}${unit}`,
    );
  }

  displayInfo() {
    const addOrMinus = this.value > 0 ? '增加' : '减少';
    const value = Math.abs(this.value);
    const stateText = this.renderState(this.stat);

    return {
      label: '永久属性修正',
      icon: '',
      description: `使用后${addOrMinus}${stateText}${value}${this.modType === 'percent' ? '%' : '点'}`,
    };
  }

  private renderState(state: keyof Attributes): string {
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
      default:
        return state;
    }
  }
}
