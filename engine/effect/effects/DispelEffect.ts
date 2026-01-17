import { BaseEffect } from '../BaseEffect';
import {
  EffectTrigger,
  isBattleEntity,
  type DispelParams,
  type EffectContext,
} from '../types';

/**
 * 驱散效果
 * 移除目标的增益或减益状态
 *
 * 使用场景：
 * - 治疗技能："妙手回春" - 治疗并驱散负面状态
 * - 辅助技能：专门的驱散术
 * - 攻击技能：攻击并驱散目标增益
 */
export class DispelEffect extends BaseEffect {
  readonly id = 'Dispel';
  readonly trigger = EffectTrigger.ON_SKILL_HIT;

  /** 驱散数量 */
  private dispelCount: number;
  /** 驱散类型 */
  private dispelType: 'buff' | 'debuff' | 'all';
  /** 目标自身 */
  private targetSelf: boolean;
  /** 优先驱散的标签 */
  private priorityTags: string[];

  constructor(params: DispelParams) {
    super(params as unknown as Record<string, unknown>);
    this.dispelCount = params.dispelCount ?? 1;
    this.dispelType = params.dispelType ?? 'debuff';
    this.targetSelf = params.targetSelf ?? false;
    this.priorityTags = params.priorityTags ?? [];
  }

  /**
   * 检查是否触发
   */
  shouldTrigger(ctx: EffectContext): boolean {
    if (ctx.trigger !== EffectTrigger.ON_SKILL_HIT) return false;

    // 施法者是持有者
    return !this.ownerId || ctx.source?.id === this.ownerId;
  }

  /**
   * 应用效果
   * 直接调用 dispelBuffs 驱散 Buff
   */
  apply(ctx: EffectContext): void {
    if (!ctx.source) return;

    // 确定驱散目标
    const dispelTarget = this.targetSelf ? ctx.source : ctx.target;
    if (!dispelTarget) return;

    // 检查目标是否为 BattleEntity
    if (!isBattleEntity(dispelTarget)) {
      console.warn('[DispelEffect] target is not a BattleEntity');
      return;
    }

    // 直接调用 dispelBuffs
    const dispelledIds = dispelTarget.dispelBuffs(
      this.dispelCount,
      this.dispelType,
      this.priorityTags,
    );

    if (dispelledIds.length === 0) return;

    // 构建日志
    const typeText =
      this.dispelType === 'buff'
        ? '增益'
        : this.dispelType === 'debuff'
          ? '减益'
          : '状态';

    // 记录日志
    ctx.logCollector?.addLog(
      `${dispelTarget.name} 被驱散了 ${dispelledIds.length} 个${typeText}`,
    );
  }

  displayInfo() {
    const typeText =
      this.dispelType === 'buff'
        ? '增益'
        : this.dispelType === 'debuff'
          ? '减益'
          : '状态';
    const targetText = this.targetSelf ? '自身' : '目标';

    return {
      label: '驱散',
      icon: '🌀',
      description: `驱散${targetText}${this.dispelCount}个${typeText}`,
    };
  }
}
