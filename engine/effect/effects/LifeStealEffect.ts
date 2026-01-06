import { BaseEffect } from '../BaseEffect';
import {
  EffectTrigger,
  type EffectContext,
  type LifeStealParams,
} from '../types';

/**
 * 吸血效果
 * 在造成伤害后，按比例恢复施法者的生命值
 */
export class LifeStealEffect extends BaseEffect {
  readonly id = 'LifeSteal';
  readonly trigger = EffectTrigger.ON_AFTER_DAMAGE;

  /** 吸血比例 (0-1) */
  private stealPercent: number;

  constructor(params: LifeStealParams) {
    super(params as unknown as Record<string, unknown>);
    this.stealPercent = params.stealPercent ?? 0.1;
  }

  /**
   * 应用吸血效果
   * 在 ON_AFTER_DAMAGE 时机，ctx.source 是攻击者（吸血方），ctx.metadata.finalDamage 是造成的伤害
   */
  apply(ctx: EffectContext): void {
    // 从 metadata 获取本次造成的最终伤害
    const damageDealt = (ctx.metadata?.finalDamage as number) || 0;

    if (damageDealt <= 0) return;

    // 计算吸血量
    const healAmount = Math.floor(damageDealt * this.stealPercent);

    if (healAmount <= 0) return;

    // 将吸血信息记录到 metadata，供战斗引擎处理
    ctx.metadata = ctx.metadata ?? {};
    ctx.metadata.lifeSteal =
      ((ctx.metadata.lifeSteal as number) || 0) + healAmount;
    ctx.metadata.lifeStealTarget = ctx.source.id; // 吸血目标是攻击者自己

    // 同时累加到 ctx.value 供统一处理
    ctx.value = (ctx.value ?? 0) + healAmount;
  }

  displayInfo() {
    return {
      label: '吸血效果',
      icon: '',
      description: `神通命中后，吸取气血，比例为造成伤害的${this.stealPercent * 100}%`,
    };
  }
}
