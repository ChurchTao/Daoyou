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
    // 从 ctx.value 获取本次造成的最终伤害
    const damageTaken = ctx.value ?? 0;

    if (damageTaken <= 0) return;

    // 【修复】检查持有者：只有被攻击者（target）是持有者时才触发
    if (this.ownerId && ctx.target?.id !== this.ownerId) {
      return;
    }

    // 计算反伤值
    const reflectDamage = Math.floor(damageTaken * this.reflectPercent);

    if (reflectDamage <= 0) return;

    // 检查攻击者是否为 BattleEntity
    if (!ctx.source || !isBattleEntity(ctx.source)) {
      console.warn(
        '[ReflectDamageEffect] source (attacker) is not a BattleEntity',
      );
      return;
    }

    // 直接对政击者造成反伤
    const actualDamage = ctx.source.applyDamage(reflectDamage);

    if (actualDamage > 0 && ctx.target) {
      // 【修复】日志应该是：被攻击者反弹伤害，攻击者受到伤害
      ctx.logCollector?.addLog(
        `${ctx.target.name} 的反伤效果触发，${ctx.source.name} 受到 ${actualDamage} 点反弹伤害！`,
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
