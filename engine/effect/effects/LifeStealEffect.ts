import { isBattleEntity } from '../types';
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
   * 在 ON_AFTER_DAMAGE 时机，ctx.value 是造成的伤害值
   */
  apply(ctx: EffectContext): void {
    // 从 ctx.value 获取本次造成的最终伤害
    const damageDealt = ctx.value ?? 0;

    if (damageDealt <= 0) return;

    // 计算吸血量
    const healAmount = Math.floor(damageDealt * this.stealPercent);

    if (healAmount <= 0) return;

    // 检查是否为 BattleEntity
    if (!isBattleEntity(ctx.source)) {
      console.warn('[LifeStealEffect] source is not a BattleEntity');
      return;
    }

    // 直接应用治疗
    const actualHeal = ctx.source.applyHealing(healAmount);

    if (actualHeal > 0) {
      ctx.logCollector?.addLog(`${ctx.source.name} 吸取了 ${actualHeal} 点气血`);
    }
  }

  displayInfo() {
    return {
      label: '吸血效果',
      icon: '',
      description: `神通命中后，吸取气血，比例为造成伤害的${this.stealPercent * 100}%`,
    };
  }
}
