import type { ElementType } from '@/types/constants';
import { BaseEffect } from '../BaseEffect';
import { EffectTrigger, type EffectContext, type ShieldParams } from '../types';

/**
 * 护盾效果
 * 在受到伤害前吸收一定量的伤害
 * 注意：只对护盾持有者（ownerId）生效
 */
export class ShieldEffect extends BaseEffect {
  readonly id = 'Shield';
  readonly trigger = EffectTrigger.ON_BEFORE_DAMAGE;

  /** 初始护盾值 */
  private readonly initialAmount: number;
  /** 当前剩余护盾值（持久化） */
  private shieldRemaining: number;
  /** 吸收元素类型 (可选，空则吸收所有) */
  private absorbElement?: ElementType;

  constructor(params: ShieldParams) {
    super(params as unknown as Record<string, unknown>);
    this.initialAmount = params.amount ?? 0;
    this.shieldRemaining = this.initialAmount;
    this.absorbElement = params.absorbElement;
  }

  /**
   * 检查是否触发
   * 1. 触发时机必须是 ON_BEFORE_DAMAGE
   * 2. 受伤者（ctx.target）必须是护盾持有者（ownerId）
   * 3. 如果指定了吸收元素，只有匹配的元素伤害才触发
   * 4. 护盾值必须大于 0
   */
  shouldTrigger(ctx: EffectContext): boolean {
    if (ctx.trigger !== EffectTrigger.ON_BEFORE_DAMAGE) return false;

    // 【关键修复】只有当受伤者是护盾持有者时才生效
    // ctx.target 是受到伤害的实体
    if (!this.ownerId || ctx.target?.id !== this.ownerId) {
      return false;
    }

    // 护盾已耗尽
    if (this.shieldRemaining <= 0) return false;

    // 如果没有指定元素，吸收所有伤害
    if (!this.absorbElement) return true;

    // 检查伤害元素是否匹配
    const damageElement = ctx.metadata?.element as ElementType | undefined;
    return damageElement === this.absorbElement;
  }

  /**
   * 应用护盾效果
   * 减少 ctx.value（即入站伤害）并消耗护盾值
   */
  apply(ctx: EffectContext): void {
    const incomingDamage = ctx.value ?? 0;

    if (incomingDamage <= 0) return;
    if (this.shieldRemaining <= 0) return;

    // 计算实际吸收量
    const absorbed = Math.min(this.shieldRemaining, incomingDamage);

    // 【关键修复】更新类实例的护盾剩余值（持久化）
    this.shieldRemaining -= absorbed;

    // 更新伤害值
    ctx.value = incomingDamage - absorbed;

    // 更新 metadata（用于日志显示和后续处理）
    ctx.metadata = ctx.metadata ?? {};
    ctx.metadata.shieldAbsorbed =
      ((ctx.metadata.shieldAbsorbed as number) || 0) + absorbed;
    ctx.metadata.shieldRemaining = this.shieldRemaining;

    // 【新增】护盾耗尽时，标记需要移除的 buff
    if (this.shieldRemaining <= 0 && this.parentBuffId && this.ownerId) {
      ctx.metadata.shieldDepleted = true;
      // 记录需要移除的 buff 信息（可能有多个护盾效果同时耗尽）
      const buffsToRemove =
        (ctx.metadata.buffsToRemove as Array<{
          buffId: string;
          ownerId: string;
          reason: string;
        }>) ?? [];
      buffsToRemove.push({
        buffId: this.parentBuffId,
        ownerId: this.ownerId,
        reason: '护盾耗尽',
      });
      ctx.metadata.buffsToRemove = buffsToRemove;
    }
  }

  /**
   * 获取当前护盾剩余值（供外部查询）
   */
  getShieldRemaining(): number {
    return this.shieldRemaining;
  }

  displayInfo() {
    const elementType = this.absorbElement || '所有';

    return {
      label: '护盾',
      icon: '🛡️',
      description: `形成一个吸收${elementType}属性伤害的护盾，护盾值${this.initialAmount}点`,
    };
  }
}
