import { BaseEffect } from '../BaseEffect';
import {
  EffectTrigger,
  type BreakthroughChanceBonusParams,
  type EffectContext,
} from '../types';

/**
 * 突破成功率加成效果
 * 持久化 Buff 效果，在突破判定时触发，增加突破成功率
 */
export class BreakthroughChanceBonusEffect extends BaseEffect {
  readonly id = 'BreakthroughChanceBonus';
  readonly trigger = EffectTrigger.ON_BREAKTHROUGH_CHECK;

  /** 突破成功率加成 */
  private bonusPercent: number;
  /** 最大加成上限 */
  private maxBonus: number;

  constructor(params: BreakthroughChanceBonusParams) {
    super(params as unknown as Record<string, unknown>);
    this.bonusPercent = params.bonusPercent;
    this.maxBonus = params.maxBonus ?? 1.0; // 默认最高 100%
  }

  /**
   * 只在 ON_BREAKTHROUGH_CHECK 触发
   */
  shouldTrigger(ctx: EffectContext): boolean {
    return ctx.trigger === EffectTrigger.ON_BREAKTHROUGH_CHECK;
  }

  /**
   * 应用突破成功率加成
   * 从 ctx.value 获取基础成功率，计算加成后存回
   */
  apply(ctx: EffectContext): void {
    if (ctx.value === undefined) return;

    const baseChance = ctx.value;
    const appliedBonus = Math.min(this.bonusPercent, this.maxBonus);
    const finalChance = Math.min(baseChance + appliedBonus, 1.0);

    // 将加成后的值存回 ctx.value
    ctx.value = finalChance;

    // 记录日志
    const bonusPercent = Math.round(appliedBonus * 100);
    if (finalChance > baseChance) {
      ctx.logCollector?.addLog(
        `突破成功率 +${bonusPercent}%（${(baseChance * 100).toFixed(1)}% → ${(finalChance * 100).toFixed(1)}%）`,
      );
    }
  }

  displayInfo() {
    const bonusPercent = Math.round(this.bonusPercent * 100);
    return {
      label: '突破成功率加成',
      icon: '⚡',
      description: `突破时成功率 +${bonusPercent}%`,
    };
  }
}
