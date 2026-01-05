import { BaseEffect } from '../BaseEffect';
import { EffectTrigger, type EffectContext } from '../types';

/**
 * 减伤效果参数
 */
export interface DamageReductionParams {
  /** 固定减伤值 */
  flatReduction?: number;
  /** 百分比减伤 (0-1) */
  percentReduction?: number;
  /** 最大减伤上限 (0-1)，默认 0.75 */
  maxReduction?: number;
}

/**
 * 减伤效果
 * 在伤害计算时降低受到的伤害
 */
export class DamageReductionEffect extends BaseEffect {
  readonly id = 'DamageReduction';
  readonly trigger = EffectTrigger.ON_BEFORE_DAMAGE;
  priority = 3000; // 在暴击之后、护盾之前

  /** 固定减伤值 */
  private flatReduction: number;
  /** 百分比减伤 */
  private percentReduction: number;
  /** 最大减伤上限 */
  private maxReduction: number;

  constructor(params: DamageReductionParams = {}) {
    super(params as unknown as Record<string, unknown>);
    this.flatReduction = params.flatReduction ?? 0;
    this.percentReduction = params.percentReduction ?? 0;
    this.maxReduction = params.maxReduction ?? 0.75;
  }

  /**
   * 应用减伤效果
   * 减少 ctx.value（即入站伤害）
   */
  apply(ctx: EffectContext): void {
    if (!ctx.target) return;

    const incomingDamage = ctx.value ?? 0;
    if (incomingDamage <= 0) return;

    // 获取目标的体魄属性计算基础减伤
    const vitality = ctx.target.getAttribute('vitality');
    const baseReduction = vitality / 400; // 400 体魄 = 100% 减伤

    // 总减伤 = 基础减伤 + 效果减伤
    let totalReduction = baseReduction + this.percentReduction;

    // 应用减伤上限
    totalReduction = Math.min(totalReduction, this.maxReduction);

    // 计算减伤后的伤害
    let reducedDamage = incomingDamage * (1 - totalReduction);

    // 应用固定减伤
    reducedDamage = Math.max(0, reducedDamage - this.flatReduction);

    // 更新上下文
    ctx.value = reducedDamage;

    // 记录减伤信息
    ctx.metadata = ctx.metadata ?? {};
    ctx.metadata.damageReduction = incomingDamage - reducedDamage;
    ctx.metadata.reductionPercent = totalReduction;
  }
}
