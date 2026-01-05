import { BaseEffect } from '../BaseEffect';
import { EffectTrigger, type EffectContext } from '../types';

/**
 * 暴击效果参数
 */
export interface CriticalEffectParams {
  /** 暴击率加成 */
  critRateBonus?: number;
  /** 暴击伤害倍率 */
  critDamageMultiplier?: number;
}

/**
 * 暴击效果
 * 在伤害计算前判定暴击并修正伤害
 */
export class CriticalEffect extends BaseEffect {
  readonly id = 'Critical';
  readonly trigger = EffectTrigger.ON_BEFORE_DAMAGE;
  priority = 1000; // 在护盾之前计算

  /** 暴击率加成 */
  private critRateBonus: number;
  /** 暴击伤害倍率 */
  private critDamageMultiplier: number;

  constructor(params: CriticalEffectParams = {}) {
    super(params as unknown as Record<string, unknown>);
    this.critRateBonus = params.critRateBonus ?? 0;
    this.critDamageMultiplier = params.critDamageMultiplier ?? 1.5;
  }

  /**
   * 应用暴击效果
   * 给攻击者提供暴击率加成
   */
  apply(ctx: EffectContext): void {
    if (!ctx.source || !ctx.metadata) return;

    // 如果已经判定过暴击，不重复判定
    if (ctx.metadata.critProcessed) return;

    // 获取基础暴击率（从 wisdom 属性计算）
    const wisdom = ctx.source.getAttribute('wisdom');
    const baseCritRate = Math.min(wisdom / 500, 0.5); // 最高 50%

    // 加上效果提供的暴击率加成
    const totalCritRate = baseCritRate + this.critRateBonus;

    // 判定是否暴击
    const isCritical = Math.random() < totalCritRate;

    // 记录暴击结果
    ctx.metadata.isCritical = isCritical;
    ctx.metadata.critProcessed = true;

    // 如果暴击，增加伤害
    if (isCritical) {
      const currentDamage = ctx.value ?? 0;
      ctx.value = currentDamage * this.critDamageMultiplier;
      ctx.metadata.critDamageBonus =
        currentDamage * (this.critDamageMultiplier - 1);
    }
  }
}
