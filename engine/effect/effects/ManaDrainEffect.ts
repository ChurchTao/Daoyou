import { isBattleEntity } from '../types';
import { BaseEffect } from '../BaseEffect';
import {
  EffectTrigger,
  type EffectContext,
  type ManaDrainParams,
} from '../types';

/**
 * 法力吸取效果
 * 吸取目标法力并恢复给自身
 *
 * 使用场景：
 * - 控制技能："封魂禁言" - 沉默并吸取法力
 * - 武器词条：攻击吸取敌方法力
 */
export class ManaDrainEffect extends BaseEffect {
  readonly id = 'ManaDrain';
  readonly trigger = EffectTrigger.ON_SKILL_HIT;

  /** 吸取百分比 */
  private drainPercent: number;
  /** 固定吸取量 */
  private drainAmount: number;
  /** 是否恢复给自身 */
  private restoreToSelf: boolean;

  constructor(params: ManaDrainParams) {
    super(params as unknown as Record<string, unknown>);
    this.drainPercent = params.drainPercent ?? 0;
    this.drainAmount = params.drainAmount ?? 0;
    this.restoreToSelf = params.restoreToSelf ?? true;
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
   * 吸取法力
   */
  apply(ctx: EffectContext): void {
    if (!ctx.source || !ctx.target) return;

    // 检查是否为 BattleEntity
    if (!isBattleEntity(ctx.target)) {
      console.warn('[ManaDrainEffect] target is not a BattleEntity');
      return;
    }

    const targetMp = ctx.target.getCurrentMp();

    // 计算吸取量
    let drainTotal = this.drainAmount;
    if (this.drainPercent > 0 && targetMp > 0) {
      drainTotal += Math.floor(targetMp * this.drainPercent);
    }

    // 不能吸取超过目标当前法力
    drainTotal = Math.min(drainTotal, targetMp);

    if (drainTotal <= 0) return;

    // 扣除目标法力
    const actualDrained = ctx.target.drainMp(drainTotal);

    // 恢复给自身
    if (this.restoreToSelf && isBattleEntity(ctx.source)) {
      const actualRestored = ctx.source.restoreMp(actualDrained);
      if (actualRestored > 0) {
        ctx.logCollector?.addLog(`${ctx.source.name} 回复了 ${actualRestored} 点法力`);
      }
    }

    // 记录吸取日志
    ctx.logCollector?.addLog(`${ctx.target.name} 被吸取了 ${actualDrained} 点法力`);
  }

  displayInfo() {
    const parts: string[] = [];
    if (this.drainAmount > 0) {
      parts.push(`${this.drainAmount}点`);
    }
    if (this.drainPercent > 0) {
      parts.push(`${Math.round(this.drainPercent * 100)}%当前法力`);
    }

    return {
      label: '法力吸取',
      icon: '💫',
      description: `吸取目标${parts.join(' + ')}法力${this.restoreToSelf ? '并恢复自身' : ''}`,
    };
  }
}
