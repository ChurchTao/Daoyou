import { BaseEffect } from '../BaseEffect';
import {
  EffectTrigger,
  type ConsumeGainLifespanParams,
  type EffectContext,
} from '../types';

/**
 * 消耗品增加寿元效果
 * 服用丹药后增加寿元，数值已在创建时通过 ScalableValue 预计算
 */
export class ConsumeGainLifespanEffect extends BaseEffect {
  readonly id = 'ConsumeGainLifespan';
  readonly trigger = EffectTrigger.ON_CONSUME;

  /** 预计算好的寿元值（年） */
  private readonly value: number;

  constructor(params: ConsumeGainLifespanParams) {
    super(params as unknown as Record<string, unknown>);
    this.value = params.value;
  }

  /**
   * 只在 ON_CONSUME 触发
   */
  shouldTrigger(ctx: EffectContext): boolean {
    return ctx.trigger === EffectTrigger.ON_CONSUME;
  }

  /**
   * 应用寿元增益
   */
  apply(ctx: EffectContext): void {
    const target = ctx.target;
    if (!target) return;

    // 将值存储到 metadata 中供 repository 使用
    if (!ctx.metadata) {
      ctx.metadata = {};
    }
    (ctx.metadata as Record<string, unknown>).pendingLifespan = this.value;

    // 记录日志
    ctx.logCollector?.addLog(`${target.name} 的寿元增加了 ${this.value} 年`);
  }

  displayInfo() {
    return {
      label: '增加寿元',
      icon: '⏳',
      description: `使用后增加 ${this.value} 年寿元`,
    };
  }
}
