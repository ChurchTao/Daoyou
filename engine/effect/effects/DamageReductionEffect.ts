import { format } from 'd3-format';
import { BaseEffect } from '../BaseEffect';
import {
  EffectTrigger,
  isBattleEntity,
  type EffectContext,
  type DamageReductionParams as TypesDamageReductionParams,
} from '../types';

/**
 * 减伤效果
 * 在伤害计算时降低受到的伤害
 *
 * 计算顺序（固定减伤优先）：
 * 1. 先扣除固定减伤值
 * 2. 再应用百分比减伤
 *
 * 减伤来源：
 * - 基础减伤：无（依赖装备/功法/命格提供）
 * - 加成来源：装备/功法/命格通过 StatModifierEffect 修改 damageReduction 属性
 * - 上限：默认 75%
 */
export class DamageReductionEffect extends BaseEffect {
  readonly id = 'DamageReduction';
  readonly trigger = EffectTrigger.ON_BEFORE_DAMAGE;
  priority = 3000; // 在暴击之后、护盾之前

  /** 效果自身提供的固定减伤值 */
  private flatReduction: number;
  /** 效果自身提供的百分比减伤 */
  private percentReduction: number;
  /** 最大减伤上限 */
  private maxReduction: number;

  constructor(params: TypesDamageReductionParams = {}) {
    super(params as unknown as Record<string, unknown>);
    this.flatReduction = params.flatReduction ?? 0;
    this.percentReduction = params.percentReduction ?? 0;
    this.maxReduction = params.maxReduction ?? 0.75;
  }

  shouldTrigger(ctx: EffectContext): boolean {
    if (ctx.trigger !== EffectTrigger.ON_BEFORE_DAMAGE) return false;
    // 伤害前减伤应由被攻击者触发
    if (ctx.target && !isBattleEntity(ctx.target)) return false;
    if (this.ownerId && ctx.target?.id !== this.ownerId) return false;
    return true;
  }

  /**
   * 应用减伤效果
   * 减少 ctx.value（即入站伤害）
   * 计算顺序：固定减伤优先，然后百分比减伤
   */
  apply(ctx: EffectContext): void {
    if (!ctx.target) return;

    const incomingDamage = ctx.value ?? 0;
    if (incomingDamage <= 0) return;

    const ignoreDefense = Boolean(ctx.metadata?.ignoreDefense);
    if (ignoreDefense) return;

    // 1. 先应用固定减伤（效果自身 + 属性加成）
    const attrFlatReduction = ctx.target.getAttribute('flatDamageReduction');
    const totalFlatReduction = this.flatReduction + attrFlatReduction;

    let reducedDamage = Math.max(0, incomingDamage - totalFlatReduction);

    // 如果固定减伤已经把伤害扣完了，直接返回
    if (reducedDamage <= 0) {
      ctx.value = 0;
      ctx.metadata = ctx.metadata ?? {};
      ctx.metadata.damageReduction = incomingDamage;
      ctx.metadata.flatReduction = totalFlatReduction;
      ctx.metadata.reductionPercent = 0;
      return;
    }

    // 2. 再应用百分比减伤
    // 从属性获取百分比减伤加成
    const attrPercentReduction = ctx.target.getAttribute('damageReduction');

    // 总百分比减伤（应用上限）
    let totalPercentReduction = this.percentReduction + attrPercentReduction;
    totalPercentReduction = Math.min(totalPercentReduction, this.maxReduction);
    totalPercentReduction = Math.max(0, totalPercentReduction);

    // 计算百分比减伤后的伤害
    reducedDamage = reducedDamage * (1 - totalPercentReduction);
    reducedDamage = Math.max(0, reducedDamage);

    // 更新上下文
    ctx.value = reducedDamage;

    // 记录减伤信息
    ctx.metadata = ctx.metadata ?? {};
    ctx.metadata.damageReduction = incomingDamage - reducedDamage;
    ctx.metadata.flatReduction = totalFlatReduction;
    ctx.metadata.reductionPercent = totalPercentReduction;
  }

  displayInfo() {
    const flatReductionText = this.flatReduction
      ? `固定降低受到的伤害${format('.0f')(this.flatReduction)}`
      : '';
    const percentReductionText = this.percentReduction
      ? `降低受到的伤害${format('.0%')(this.percentReduction)}`
      : '';

    return {
      label: '减伤效果',
      icon: '🛡️',
      description: `${[flatReductionText, percentReductionText].filter(Boolean).join('、')}`,
    };
  }
}

// 保留旧接口兼容
export type DamageReductionParams = TypesDamageReductionParams;
