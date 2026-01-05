import { BaseEffect } from '../BaseEffect';
import {
  EffectTrigger,
  type EffectContext,
  type ReflectDamageParams,
} from '../types';

/**
 * 反伤效果
 * 在受到伤害后，将一定比例的伤害反弹给攻击者
 */
export class ReflectDamageEffect extends BaseEffect {
  readonly id = 'ReflectDamage';
  readonly trigger = EffectTrigger.ON_AFTER_DAMAGE;

  /** 反伤比例 (0-1) */
  private reflectPercent: number;

  constructor(params: ReflectDamageParams) {
    super(params as unknown as Record<string, unknown>);
    this.reflectPercent = params.reflectPercent ?? 0.2;
  }

  /**
   * 应用反伤效果
   * 注意：在 ON_AFTER_DAMAGE 时机，ctx.source 是攻击者，ctx.target 是受击者（反伤甲持有者）
   */
  apply(ctx: EffectContext): void {
    // 从 metadata 获取本次造成的最终伤害
    const damageTaken = (ctx.metadata?.finalDamage as number) || 0;

    if (damageTaken <= 0) return;

    // 计算反伤值
    const reflectDamage = Math.floor(damageTaken * this.reflectPercent);

    if (reflectDamage <= 0) return;

    // 将反伤信息记录到 metadata，供战斗引擎处理
    ctx.metadata = ctx.metadata ?? {};
    ctx.metadata.reflectDamage =
      ((ctx.metadata.reflectDamage as number) || 0) + reflectDamage;
    ctx.metadata.reflectTarget = ctx.source.id; // 反伤目标是攻击者

    // 同时累加到 ctx.value 供统一处理
    ctx.value = (ctx.value ?? 0) + reflectDamage;
  }
}
