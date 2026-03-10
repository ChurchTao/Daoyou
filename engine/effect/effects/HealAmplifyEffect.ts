import { format } from 'd3-format';
import { BaseEffect } from '../BaseEffect';
import {
  EffectTrigger,
  type EffectContext,
  type HealAmplifyParams,
} from '../types';

/**
 * 治疗增幅效果
 * 增加或减少受到的治疗/施放的治疗效果
 *
 * 使用场景：
 * - 木属性法宝：增强受到的治疗
 * - debuff "创伤"：降低受到的治疗 -50%
 * - 神通增幅：增强自身治疗技能效果
 */
export class HealAmplifyEffect extends BaseEffect {
  readonly id = 'HealAmplify';
  readonly trigger = EffectTrigger.ON_HEAL;

  /** 治疗倍率加成 (可为负数) */
  private amplifyPercent: number;
  /** 是否影响施放的治疗 */
  private affectOutgoing: boolean;

  constructor(params: HealAmplifyParams) {
    super(params as unknown as Record<string, unknown>);
    this.amplifyPercent = params.amplifyPercent ?? 0;
    this.affectOutgoing = params.affectOutgoing ?? false;
  }

  /**
   * 检查是否触发
   */
  shouldTrigger(ctx: EffectContext): boolean {
    if (ctx.trigger !== EffectTrigger.ON_HEAL) return false;

    if (this.affectOutgoing) {
      // 影响施放的治疗：施法者是持有者
      return !this.ownerId || ctx.source?.id === this.ownerId;
    } else {
      // 影响受到的治疗：目标是持有者
      return !this.ownerId || ctx.target?.id === this.ownerId;
    }
  }

  /**
   * 应用效果
   * 修改治疗量
   */
  apply(ctx: EffectContext): void {
    const currentHeal = ctx.value ?? 0;
    if (currentHeal <= 0) return;

    // 获取基准治疗量
    const baseHeal = ctx.baseValue ?? currentHeal;

    // 计算加成：基于基准治疗量计算增量，然后加到当前值上
    const bonusHeal = baseHeal * this.amplifyPercent;
    ctx.value = Math.max(0, currentHeal + bonusHeal);

    // 记录元数据
    ctx.metadata = ctx.metadata ?? {};
    ctx.metadata.healAmplify =
      ((ctx.metadata.healAmplify as number) || 0) + this.amplifyPercent;
  }

  displayInfo() {
    const direction = this.affectOutgoing ? '施放的' : '受到的';
    const percent = format('.0%')(this.amplifyPercent);
    const effect =
      this.amplifyPercent >= 0 ? `提升 ${percent}` : `降低 ${percent}`;

    return {
      label: '治疗增幅',
      icon: this.amplifyPercent >= 0 ? '💚' : '💔',
      description: `${direction}治疗效果${effect}`,
    };
  }
}
