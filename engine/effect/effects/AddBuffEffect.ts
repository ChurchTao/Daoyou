import { buffRegistry } from '@/engine/buff';
import { BuffStackType, BuffTag } from '@/engine/buff/types';
import { getEffectDisplayInfo } from '@/lib/utils/effectDisplay';
import { BaseEffect } from '../BaseEffect';
import {
  EffectTrigger,
  type AddBuffParams,
  type EffectContext,
} from '../types';

/**
 * Buff 应用结果
 */
export interface BuffApplicationResult {
  buffId: string;
  targetId: string;
  casterId: string;
  durationOverride?: number;
  initialStacks: number;
  applied: boolean;
  resisted: boolean;
  buffName?: string;
  duration?: number;
}

/**
 * 施加 Buff 效果
 * 用于在命中时给目标施加状态
 */
export class AddBuffEffect extends BaseEffect {
  readonly id = 'AddBuff';
  readonly trigger = EffectTrigger.ON_SKILL_HIT;

  /** Buff 配置 ID */
  private buffId: string;
  /** 基础命中率 (0-1)，默认 1.0 */
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

    // 确定目标
    const buffTarget = this.targetSelf ? ctx.source : ctx.target;
    if (!buffTarget) return;

    // 获取 Buff 配置
    const buffConfig = buffRegistry.get(this.buffId);

    // 创建结果对象
    const result: BuffApplicationResult = {
      buffId: this.buffId,
      targetId: buffTarget.id,
      casterId: ctx.source.id,
      durationOverride: this.durationOverride,
      initialStacks: this.initialStacks,
      applied: false,
      resisted: false,
      buffName: buffConfig?.name,
      duration: this.durationOverride ?? buffConfig?.duration,
    };

    // 1. 基础概率判定
    if (Math.random() > this.chance) {
      result.resisted = true;
      this.recordResult(ctx, result);
      return;
    }

    // 2. 控制效果抵抗判定（非自身目标时）
    const isControlBuff = buffConfig?.tags?.includes(BuffTag.CONTROL);
    if (isControlBuff && !this.targetSelf && ctx.target) {
      const resisted = this.checkResistance(ctx);
      if (resisted) {
        result.resisted = true;
        this.recordResult(ctx, result);
        return;
      }
    }

    // 3. 成功施加
    result.applied = true;
    this.recordResult(ctx, result);
  }

  /**
   * 检查控制效果抵抗
   * 基于施法者灵力和目标神识的差值计算
   */
  private checkResistance(ctx: EffectContext): boolean {
    const casterSpirit = ctx.source?.getAttribute('spirit') ?? 0;
    const targetWillpower = ctx.target?.getAttribute('willpower') ?? 0;

    // 基础命中率 = 效果配置的 chance（已在上面判定）
    // 抵抗率 = 神识优势
    // 神识每高于施法者灵力 10 点，增加 5% 抵抗率
    // 最高抵抗率 40%
    const willpowerAdvantage = targetWillpower - casterSpirit;
    const resistRate = Math.min(
      0.4,
      Math.max(0, (willpowerAdvantage / 10) * 0.05),
    );

    return Math.random() < resistRate;
  }

  /**
   * 记录结果到 metadata
   */
  private recordResult(
    ctx: EffectContext,
    result: BuffApplicationResult,
  ): void {
    ctx.metadata = ctx.metadata ?? {};
    ctx.metadata.buffsToApply = ctx.metadata.buffsToApply ?? [];
    (ctx.metadata.buffsToApply as BuffApplicationResult[]).push(result);
  }

  displayInfo() {
    const buffConfig = buffRegistry.get(this.buffId);
    /** 最大叠加层数 */
    const stackText =
      buffConfig?.stackType == BuffStackType.STACK
        ? `，初始叠加层数 ${this.initialStacks}层，最大叠加层数 ${buffConfig.maxStacks}层`
        : '';
    /** 叠加策略 */
    const stackTypeText =
      buffConfig?.stackType == BuffStackType.STACK
        ? '可叠加' + stackText
        : buffConfig?.stackType == BuffStackType.REFRESH
          ? '不可叠加'
          : '每次施加为独立状态';
    /** 默认持续回合数 */
    const durationText = `，持续${this.durationOverride ?? buffConfig?.duration}回合`;

    /** Buff 携带的效果列表 */
    const effectText = buffConfig?.effects?.length
      ? `，效果为：${buffConfig.effects
          .map((e) => getEffectDisplayInfo(e)?.description ?? '')
          .filter(Boolean)
          .join('、')}`
      : '';

    return {
      label: '附加状态',
      icon: buffConfig?.icon,
      description: `${!this.targetSelf ? '技能命中目标时，' : '为自身'}施加${buffConfig?.name}状态，${stackTypeText}${durationText}${effectText}`,
    };
  }
}
