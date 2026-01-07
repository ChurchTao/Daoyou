import { isBattleEntity } from '../types';
import { BaseEffect } from '../BaseEffect';
import {
  EffectTrigger,
  type EffectContext,
  type TrueDamageParams,
} from '../types';

/**
 * 真实伤害效果
 * 无视护盾和减伤的固定伤害
 *
 * 使用场景：
 * - 高阶攻击技能："诛仙剑气"
 * - 武器词条："雷霆震怒" - 暴击追加真实伤害
 */
export class TrueDamageEffect extends BaseEffect {
  readonly id = 'TrueDamage';
  readonly trigger = EffectTrigger.ON_SKILL_HIT;

  /** 基础伤害 */
  private baseDamage: number;
  /** 无视护盾 */
  private ignoreShield: boolean;
  /** 无视减伤 */
  private ignoreReduction: boolean;

  constructor(params: TrueDamageParams) {
    super(params as unknown as Record<string, unknown>);
    this.baseDamage = params.baseDamage ?? 0;
    this.ignoreShield = params.ignoreShield ?? true;
    this.ignoreReduction = params.ignoreReduction ?? true;
  }

  /**
   * 检查是否触发
   */
  shouldTrigger(ctx: EffectContext): boolean {
    if (ctx.trigger !== EffectTrigger.ON_SKILL_HIT) return false;

    // 攻击者是持有者
    return !this.ownerId || ctx.source?.id === this.ownerId;
  }

  /**
   * 应用效果
   * 直接对目标造成真实伤害
   */
  apply(ctx: EffectContext): void {
    if (!ctx.target || !ctx.source || this.baseDamage <= 0) return;

    // 检查是否为 BattleEntity
    if (!isBattleEntity(ctx.target)) {
      console.warn('[TrueDamageEffect] target is not a BattleEntity');
      return;
    }

    // 应用真实伤害（直接扣除生命值，不经过护盾和减伤）
    const actualDamage = ctx.target.applyDamage(this.baseDamage);

    if (actualDamage > 0) {
      const flags: string[] = [];
      if (this.ignoreShield) flags.push('无视护盾');
      if (this.ignoreReduction) flags.push('无视减伤');

      const flagText = flags.length > 0 ? `（${flags.join('、')}）` : '';

      ctx.logCollector?.addLog(
        `${ctx.source.name} 对 ${ctx.target.name} 造成 ${actualDamage} 点真实伤害${flagText}`,
      );
    }
  }

  displayInfo() {
    const flags: string[] = [];
    if (this.ignoreShield) flags.push('无视护盾');
    if (this.ignoreReduction) flags.push('无视减伤');

    const flagText = flags.length > 0 ? `（${flags.join('、')}）` : '';

    return {
      label: '真实伤害',
      icon: '⚡',
      description: `造成 ${this.baseDamage} 点真实伤害${flagText}`,
    };
  }
}
