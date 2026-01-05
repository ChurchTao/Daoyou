import { BaseEffect } from '../BaseEffect';
import { EffectTrigger, type EffectContext, type HealParams } from '../types';

/**
 * 治疗效果
 * 用于恢复生命值
 */
export class HealEffect extends BaseEffect {
  readonly id = 'Heal';
  readonly trigger = EffectTrigger.ON_HEAL;

  /** 治疗倍率 */
  private multiplier: number;
  /** 固定治疗量 */
  private flatHeal: number;
  /** 目标自身还是他人 */
  private targetSelf: boolean;

  constructor(params: HealParams) {
    super(params as unknown as Record<string, unknown>);

    this.multiplier = params.multiplier ?? 1.0;
    this.flatHeal = params.flatHeal ?? 0;
    this.targetSelf = params.targetSelf ?? true;
  }

  shouldTrigger(ctx: EffectContext): boolean {
    return ctx.trigger === EffectTrigger.ON_SKILL_HIT;
  }

  /**
   * 应用治疗效果
   */
  apply(ctx: EffectContext): void {
    if (!ctx.source) return;

    // 确定治疗目标
    const healTarget = this.targetSelf ? ctx.source : ctx.target;
    if (!healTarget) return;

    // 获取施法者的灵力属性
    const sourceSpirit = ctx.source.getAttribute('spirit');

    // 计算治疗量
    const heal = sourceSpirit * this.multiplier + this.flatHeal;

    // 写入上下文
    ctx.value = (ctx.value ?? 0) + heal;

    // 记录元数据
    ctx.metadata = ctx.metadata ?? {};
    ctx.metadata.targetSelf = this.targetSelf;
  }
}
