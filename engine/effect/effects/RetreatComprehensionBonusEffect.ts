import { BaseEffect } from '../BaseEffect';
import {
  type RetreatComprehensionBonusParams,
  EffectTrigger,
  type EffectContext,
} from '../types';

/**
 * 闭关感悟加成效果
 * 持久化 Buff 效果，在闭关时触发，增加感悟获取效率
 */
export class RetreatComprehensionBonusEffect extends BaseEffect {
  readonly id = 'RetreatComprehensionBonus';
  readonly trigger = EffectTrigger.ON_RETREAT;

  /** 感悟收益加成百分比 */
  private bonusPercent: number;

  constructor(params: RetreatComprehensionBonusParams) {
    super(params as unknown as Record<string, unknown>);
    this.bonusPercent = params.bonusPercent;
  }

  /**
   * 只在 ON_RETREAT 触发
   */
  shouldTrigger(ctx: EffectContext): boolean {
    return ctx.trigger === EffectTrigger.ON_RETREAT;
  }

  /**
   * 应用感悟加成
   * 从 ctx.metadata.baseComprehensionGain 获取基础感悟收益，计算加成后存回
   */
  apply(ctx: EffectContext): void {
    const baseGain = ctx.metadata?.baseComprehensionGain as number | undefined;
    if (baseGain === undefined) return;

    const bonus = baseGain * this.bonusPercent;
    const finalGain = baseGain + bonus;

    // 将加成后的值存回 metadata
    if (!ctx.metadata) {
      ctx.metadata = {};
    }
    ctx.metadata.finalComprehensionGain = finalGain;

    // 记录日志
    const bonusPercent = Math.round(this.bonusPercent * 100);
    ctx.logCollector?.addLog(
      `闭关感悟收益 +${bonusPercent}%（${baseGain} → ${finalGain}）`,
    );
  }

  displayInfo() {
    const bonusPercent = Math.round(this.bonusPercent * 100);
    return {
      label: '闭关感悟加成',
      icon: '🧘',
      description: `闭关时感悟获取效率 +${bonusPercent}%`,
    };
  }
}
