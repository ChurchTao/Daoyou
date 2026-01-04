import type { ElementType } from '@/types/constants';
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

  constructor(params: DamageParams) {
    super(params as unknown as Record<string, unknown>);

    this.multiplier = params.multiplier ?? 1.0;
    this.element = params.element;
    this.flatDamage = params.flatDamage ?? 0;
    this.canCrit = params.canCrit ?? true;
    this.ignoreDefense = params.ignoreDefense ?? false;
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
    let damage = sourceAtk * this.multiplier + this.flatDamage;

    // 如果有元素亲和加成
    if (this.element) {
      const elementMastery = ctx.source.getAttribute(`${this.element}_MASTERY`);
      if (elementMastery > 0) {
        damage *= 1 + elementMastery / 100;
      }
    }

    // 写入上下文
    ctx.value = (ctx.value ?? 0) + damage;

    // 记录元数据
    ctx.metadata = ctx.metadata ?? {};
    ctx.metadata.element = this.element;
    ctx.metadata.canCrit = this.canCrit;
    ctx.metadata.ignoreDefense = this.ignoreDefense;
  }

  /**
   * 获取基础伤害（不触发上下文修改）
   */
  getBaseDamage(ctx: EffectContext): number {
    if (!ctx.source) return 0;
    const sourceAtk = ctx.source.getAttribute('spirit');
    return sourceAtk * this.multiplier + this.flatDamage;
  }
}
