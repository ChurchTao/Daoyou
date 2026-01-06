import { BaseEffect } from '../BaseEffect';
import { EffectTrigger, type EffectContext } from '../types';

/**
 * 命中修正效果参数
 */
export interface ModifyHitRateParams {
  /** 命中率修正值（正数增加命中，负数增加闪避） */
  hitRateBonus: number;
  /** 是否作用于目标（true: 增加闪避，false: 增加命中） */
  affectsTarget?: boolean;
}

/**
 * 命中修正效果
 * 用于修改命中率/闪避率
 */
export class ModifyHitRateEffect extends BaseEffect {
  readonly id = 'ModifyHitRate';
  readonly trigger = EffectTrigger.ON_CALC_HIT_RATE;

  /** 命中率修正值 */
  private hitRateBonus: number;
  /** 是否作用于目标 */
  private affectsTarget: boolean;

  constructor(params: ModifyHitRateParams) {
    super(params as unknown as Record<string, unknown>);
    this.hitRateBonus = params.hitRateBonus ?? 0;
    this.affectsTarget = params.affectsTarget ?? false;
  }

  /**
   * 应用命中修正
   * ctx.value 是当前命中率，修改后返回新的命中率
   */
  apply(ctx: EffectContext): void {
    const currentHitRate = ctx.value ?? 1.0;

    // 如果是目标方的效果（如闪避 Buff），减少命中率
    // 如果是攻击方的效果（如命中 Buff），增加命中率
    if (this.affectsTarget) {
      // 目标方的闪避效果，负数减少攻击方命中率
      ctx.value = currentHitRate - Math.abs(this.hitRateBonus);
    } else {
      // 攻击方的命中效果，正数增加命中率
      ctx.value = currentHitRate + this.hitRateBonus;
    }

    // 确保命中率在合理范围
    ctx.value = Math.max(0, ctx.value);
  }

  displayInfo() {
    return {
      label: '命中修正',
      icon: '',
      description: `${this.affectsTarget ? '增加闪避' : '增加命中'}${this.hitRateBonus * 100}%`,
    };
  }
}
