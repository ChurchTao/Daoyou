import type { ElementType } from '@/types/constants';
import { BaseEffect } from '../BaseEffect';
import {
  EffectTrigger,
  type DotDamageParams,
  type EffectContext,
} from '../types';

/**
 * DOT (Damage Over Time) 伤害效果
 * 用于持续伤害（灼烧、中毒、流血等）
 */
export class DotDamageEffect extends BaseEffect {
  readonly id = 'DotDamage';
  readonly trigger = EffectTrigger.ON_TURN_START;

  /** 基础伤害 */
  private baseDamage: number;
  /** 元素类型 */
  private element?: ElementType;
  /** 是否基于施法者属性 */
  private usesCasterStats: boolean;

  constructor(params: DotDamageParams) {
    super(params as unknown as Record<string, unknown>);

    this.baseDamage = params.baseDamage;
    this.element = params.element;
    this.usesCasterStats = params.usesCasterStats ?? false;
  }

  shouldTrigger(ctx: EffectContext): boolean {
    return ctx.trigger === EffectTrigger.ON_TURN_START;
  }

  /**
   * 应用 DOT 伤害
   */
  apply(ctx: EffectContext): void {
    let damage = this.baseDamage;

    // 如果使用施法者属性加成
    if (this.usesCasterStats && ctx.metadata?.casterSnapshot) {
      const casterSnapshot = ctx.metadata.casterSnapshot as {
        attributes: { spirit: number };
        elementMultipliers?: Record<string, number>;
      };

      // 基于施法者灵力的加成
      const spiritBonus = casterSnapshot.attributes.spirit * 0.1;
      damage += spiritBonus;

      // 元素亲和加成
      if (this.element && casterSnapshot.elementMultipliers) {
        const elementMultiplier =
          casterSnapshot.elementMultipliers[this.element] ?? 1.0;
        damage *= elementMultiplier;
      }
    }

    // 【关键修复】根据 buff 层数叠加伤害
    const buffStacks = (ctx.metadata?.buffStacks as number) ?? 1;
    damage *= buffStacks;

    // 写入上下文
    ctx.value = (ctx.value ?? 0) + damage;

    // 记录元数据
    ctx.metadata = ctx.metadata ?? {};
    ctx.metadata.dotElement = this.element;
    ctx.metadata.dotStacks = buffStacks;
  }

  displayInfo() {
    return {
      label: '造成持续伤害',
      icon: '🔥',
      description: `造成持续伤害，伤害${this.baseDamage}+灵力*10%`,
    };
  }
}
