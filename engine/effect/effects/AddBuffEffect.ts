import { BaseEffect } from '../BaseEffect';
import {
  EffectTrigger,
  type AddBuffParams,
  type EffectContext,
} from '../types';

/**
 * 施加 Buff 效果
 * 用于在命中时给目标施加状态
 */
export class AddBuffEffect extends BaseEffect {
  readonly id = 'AddBuff';
  readonly trigger = EffectTrigger.ON_SKILL_HIT;

  /** Buff 配置 ID */
  private buffId: string;
  /** 触发概率 (0-1) */
  private chance: number;
  /** 持续回合数覆盖 */
  private durationOverride?: number;
  /** 初始层数 */
  private initialStacks: number;
  /** 目标自身还是敌人 */
  private targetSelf: boolean;

  constructor(params: AddBuffParams) {
    super(params as unknown as Record<string, unknown>);

    this.buffId = params.buffId;
    this.chance = params.chance ?? 1.0;
    this.durationOverride = params.durationOverride;
    this.initialStacks = params.initialStacks ?? 1;
    this.targetSelf = params.targetSelf ?? false;
  }

  /**
   * 应用 Buff 效果
   */
  apply(ctx: EffectContext): void {
    if (!ctx.source) return;

    // 概率判定
    if (Math.random() > this.chance) {
      return;
    }

    // 确定目标
    const buffTarget = this.targetSelf ? ctx.source : ctx.target;
    if (!buffTarget) return;

    // 记录要施加的 Buff 信息到 metadata
    // 实际施加逻辑由 BuffManager 处理
    ctx.metadata = ctx.metadata ?? {};
    ctx.metadata.buffsToApply = ctx.metadata.buffsToApply ?? [];
    (
      ctx.metadata.buffsToApply as Array<{
        buffId: string;
        targetId: string;
        casterId: string;
        durationOverride?: number;
        initialStacks: number;
      }>
    ).push({
      buffId: this.buffId,
      targetId: buffTarget.id,
      casterId: ctx.source.id,
      durationOverride: this.durationOverride,
      initialStacks: this.initialStacks,
    });
  }
}
