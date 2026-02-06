import type { ElementType } from '@/types/constants';
import { format } from 'd3-format';
import { BaseEffect } from '../BaseEffect';
import { EffectTrigger, type DamageParams, type EffectContext } from '../types';

/**
 * 伤害效果
 * 用于造成伤害（技能伤害、普攻等）
 */
export class DamageEffect extends BaseEffect {
  readonly id = 'Damage';
  readonly trigger = EffectTrigger.ON_SKILL_HIT;

  /** 伤害倍率 */
  private multiplier: number;
  /** 元素类型 */
  private element?: ElementType;
  /** 固定伤害加成 */
  private flatDamage: number;
  /** 是否可暴击 */
  private canCrit: boolean;
  /** 是否无视防御 */
  private ignoreDefense: boolean;
  /** 是否无视护盾 */
  private ignoreShield: boolean;
  /** 暴击率加成 (0-1)，叠加到基础暴击率上 */
  private critRateBonus?: number;
  /** 暴击伤害倍率 */
  private critDamageBonus?: number;

  constructor(params: DamageParams) {
    super(params as unknown as Record<string, unknown>);

    this.multiplier = params.multiplier ?? 1.0;
    this.element = params.element;
    this.flatDamage = params.flatDamage ?? 0;
    this.canCrit = params.canCrit ?? true;
    this.ignoreDefense = params.ignoreDefense ?? false;
    this.ignoreShield = params.ignoreShield ?? false;
    this.critRateBonus = params.critRateBonus ?? 0;
    this.critDamageBonus = params.critDamageBonus ?? 0;
  }

  /**
   * 应用伤害效果
   * 计算基础伤害并写入 ctx.value
   */
  apply(ctx: EffectContext): void {
    if (!ctx.source || !ctx.target) return;

    // 获取攻击者攻击力
    const sourceAtk = ctx.source.getAttribute('spirit');

    // 计算基础伤害
    const damage = sourceAtk * this.multiplier + this.flatDamage;

    // 写入上下文
    ctx.value = (ctx.value ?? 0) + damage;

    // 记录元数据
    ctx.metadata = ctx.metadata ?? {};
    ctx.metadata.element = this.element;
    ctx.metadata.canCrit = this.canCrit;
    ctx.metadata.ignoreDefense = this.ignoreDefense;
    ctx.metadata.ignoreShield = this.ignoreShield;
    ctx.metadata.critRateBonus = this.critRateBonus;
    ctx.metadata.critDamageMultiplier = this.critDamageBonus;
  }

  /**
   * 获取基础伤害（不触发上下文修改）
   */
  getBaseDamage(ctx: EffectContext): number {
    if (!ctx.source) return 0;
    const sourceAtk = ctx.source.getAttribute('spirit');
    return sourceAtk * this.multiplier + this.flatDamage;
  }

  displayInfo() {
    const elementText = this.element ? `${this.element}属性` : '';
    const multiplierText = `，伤害倍率：自身灵力*${format('.0%')(this.multiplier || 1)}`;
    const flatDamageText = this.flatDamage
      ? `，固定伤害：${this.flatDamage}点`
      : '';
    const critRateBonusText = this.critRateBonus
      ? `额外暴击率：${format('.0%')(this.critRateBonus)}`
      : '';
    const critDamageMultiplierText = this.critDamageBonus
      ? `额外暴击伤害：${format('.0%')(this.critDamageBonus)}`
      : '';
    const critRate = this.canCrit
      ? `${['「允许暴击」', critRateBonusText, critDamageMultiplierText].filter(Boolean).join('，')}`
      : '「不可暴击」';
    const ignoreDefenseText = this.ignoreDefense ? '「无视防御」' : '';
    const ignoreShieldText = this.ignoreShield ? '「无视护盾」' : '';
    return {
      label: '造成伤害',
      icon: '💥',
      description: `造成${elementText}伤害${[multiplierText, flatDamageText].filter(Boolean).join('+')}，${critRate}${ignoreDefenseText}${ignoreShieldText}`,
    };
  }
}
