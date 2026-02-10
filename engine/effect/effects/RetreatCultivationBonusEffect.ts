import { BaseEffect } from '../BaseEffect';
import {
  EffectTrigger,
  type EffectContext,
  type RetreatCultivationBonusParams,
} from '../types';

/**
 * 闭关修为加成效果
 * 持久化 Buff 效果，在闭关时触发，增加修为获取效率
 */
export class RetreatCultivationBonusEffect extends BaseEffect {
  readonly id = 'RetreatCultivationBonus';
  readonly trigger = EffectTrigger.ON_RETREAT;

  /** 修为收益加成百分比 */
  private bonusPercent: number;

  constructor(params: RetreatCultivationBonusParams) {
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
   * 应用修为加成
   * 从 ctx.value 获取基础修为收益，计算加成后存回
   */
  apply(ctx: EffectContext): void {
    if (ctx.value === undefined) return;

    const baseGain = ctx.value;
    const bonus = baseGain * this.bonusPercent;
    const finalGain = baseGain + bonus;

    // 将加成后的值存回 ctx.value
    ctx.value = finalGain;

    // 记录日志
    const bonusPercent = Math.round(this.bonusPercent * 100);
    ctx.logCollector?.addLog(
      `闭关修为收益 +${bonusPercent}%（${baseGain} → ${finalGain}）`,
    );
  }

  displayInfo() {
    const bonusPercent = Math.round(this.bonusPercent * 100);
    return {
      label: '闭关修为加成',
      icon: '📚',
      description: `闭关时修为获取效率 +${bonusPercent}%`,
    };
  }
}
