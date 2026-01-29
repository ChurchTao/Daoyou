import { BaseEffect } from '../BaseEffect';
import {
  type ConsumeGainComprehensionParams,
  EffectTrigger,
  type EffectContext,
} from '../types';

/**
 * 消耗品获得感悟效果
 * 服用丹药后获得道心感悟，数值已在创建时通过 ScalableValue 预计算
 */
export class ConsumeGainComprehensionEffect extends BaseEffect {
  readonly id = 'ConsumeGainComprehension';
  readonly trigger = EffectTrigger.ON_CONSUME;

  /** 预计算好的感悟值 */
  private readonly value: number;

  constructor(params: ConsumeGainComprehensionParams) {
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
   * 应用感悟增益
   */
  apply(ctx: EffectContext): void {
    const target = ctx.target;
    if (!target) return;

    // 将值存储到 metadata 中供 repository 使用
    if (!ctx.metadata) {
      ctx.metadata = {};
    }
    (ctx.metadata as Record<string, unknown>).pendingComprehension = this.value;

    // 记录日志
    ctx.logCollector?.addLog(`${target.name} 获得 ${this.value} 点道心感悟`);
  }

  displayInfo() {
    return {
      label: '获得感悟',
      icon: '💡',
      description: `使用后获得 ${this.value} 点道心感悟`,
    };
  }
}
