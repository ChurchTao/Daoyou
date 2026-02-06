import { format } from 'd3-format';
import { BaseEffect } from '../BaseEffect';
import {
  EffectTrigger,
  isBattleEntity,
  type EffectContext,
  type ReflectDamageParams,
} from '../types';

/**
 * 反伤效果
 * 在受到伤害后，将一定比例的伤害反弹给攻击者
 * 触发时机：ON_BEING_HIT（从被攻击者角度）
 */
export class ReflectDamageEffect extends BaseEffect {
  readonly id = 'ReflectDamage';
  readonly trigger = EffectTrigger.ON_BEING_HIT;

  /** 反伤比例 (0-1) */
  private reflectPercent: number;

  constructor(params: ReflectDamageParams) {
    super(params as unknown as Record<string, unknown>);
    this.reflectPercent = params.reflectPercent ?? 0.2;
  }

  shouldTrigger(ctx: EffectContext): boolean {
    if (ctx.trigger !== EffectTrigger.ON_BEING_HIT) return false;
    if (!isBattleEntity(ctx.source)) return false;
    // 如果有持有者ID，则检查是否匹配
    if (this.ownerId && ctx.source?.id !== this.ownerId) return false;
    return true;
  }

  /**
   * 应用反伤效果
   * 注意：在 ON_BEING_HIT 时机，ctx.source 是被攻击者（反伤甲持有者），ctx.target 是攻击者
   */
  apply(ctx: EffectContext): void {
    // 从 ctx.value 获取本次受到的伤害
    const damageTaken = ctx.value ?? 0;

    if (damageTaken <= 0) return;

    // 计算反伤值
    const reflectDamage = Math.floor(damageTaken * this.reflectPercent);

    if (reflectDamage <= 0) return;

    // 检查攻击者是否为 BattleEntity
    if (!ctx.target || !isBattleEntity(ctx.target)) {
      console.warn(
        '[ReflectDamageEffect] target (attacker) is not a BattleEntity',
      );
      return;
    }

    // 直接对攻击者造成反伤
    const actualDamage = ctx.target.applyDamage(reflectDamage);

    if (actualDamage > 0 && ctx.source) {
      // 日志：被攻击者反弹伤害，攻击者受到伤害
      ctx.logCollector?.addLog(
        `${ctx.source.name} 的反伤效果触发，${ctx.target.name} 受到 ${actualDamage} 点反弹伤害！`,
      );
    }
  }

  displayInfo() {
    return {
      label: '反伤',
      icon: '💥',
      description: `在受到伤害后，反弹${format('.0%')(this.reflectPercent)}的伤害给攻击者`,
    };
  }
}
