import type { ElementType } from '@/types/constants';
import { BaseEffect } from '../BaseEffect';
import { EffectTrigger, type EffectContext, type ShieldParams } from '../types';

/**
 * 护盾效果
 * 在受到伤害前吸收一定量的伤害
 */
export class ShieldEffect extends BaseEffect {
  readonly id = 'Shield';
  readonly trigger = EffectTrigger.ON_BEFORE_DAMAGE;

  /** 护盾值 */
  private amount: number;
  /** 吸收元素类型 (可选，空则吸收所有) */
  private absorbElement?: ElementType;

  constructor(params: ShieldParams) {
    super(params as unknown as Record<string, unknown>);
    this.amount = params.amount ?? 0;
    this.absorbElement = params.absorbElement;
  }

  /**
   * 检查是否触发
   * 如果指定了吸收元素，只有匹配的元素伤害才触发
   */
  shouldTrigger(ctx: EffectContext): boolean {
    if (ctx.trigger !== EffectTrigger.ON_BEFORE_DAMAGE) return false;

    // 如果没有指定元素，吸收所有伤害
    if (!this.absorbElement) return true;

    // 检查伤害元素是否匹配
    const damageElement = ctx.metadata?.element as ElementType | undefined;
    return damageElement === this.absorbElement;
  }

  /**
   * 应用护盾效果
   * 减少 ctx.value（即入站伤害）
   */
  apply(ctx: EffectContext): void {
    const incomingDamage = ctx.value ?? 0;

    if (incomingDamage <= 0) return;

    // 获取当前护盾剩余值（从 metadata 读取，如果没有则使用初始值）
    let shieldRemaining =
      (ctx.metadata?.shieldRemaining as number) ?? this.amount;

    if (shieldRemaining <= 0) return;

    // 计算实际吸收量
    const absorbed = Math.min(shieldRemaining, incomingDamage);
    shieldRemaining -= absorbed;

    // 更新伤害值
    ctx.value = incomingDamage - absorbed;

    // 更新 metadata
    ctx.metadata = ctx.metadata ?? {};
    ctx.metadata.shieldAbsorbed =
      ((ctx.metadata.shieldAbsorbed as number) || 0) + absorbed;
    ctx.metadata.shieldRemaining = shieldRemaining;
  }
}
