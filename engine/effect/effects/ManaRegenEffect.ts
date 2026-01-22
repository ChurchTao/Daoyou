import { format } from 'd3-format';
import { BaseEffect } from '../BaseEffect';
import {
  EffectTrigger,
  isBattleEntity,
  type EffectContext,
  type ManaRegenParams,
} from '../types';

/**
 * 法力回复效果
 * 回复角色法力值
 *
 * 使用场景：
 * - 饰品词条："灵枢引力" - 每回合回复法力
 * - 丹药："回蓝丹" - 立即恢复法力
 * - 功法："玄天心法" - 每回合法力回复
 */
export class ManaRegenEffect extends BaseEffect {
  readonly id = 'ManaRegen';
  readonly trigger = EffectTrigger.ON_TURN_END;

  /** 固定回复量 */
  private amount: number;
  /** 按最大法力百分比回复 */
  private percentOfMax: number;

  constructor(params: ManaRegenParams) {
    super(params as unknown as Record<string, unknown>);
    this.amount = params.amount ?? 0;
    this.percentOfMax = params.percentOfMax ?? 0;
  }

  /**
   * 检查是否触发
   */
  shouldTrigger(ctx: EffectContext): boolean {
    // 只有当前回合的单位是持有者时才触发
    return !this.ownerId || ctx.source?.id === this.ownerId;
  }

  /**
   * 应用效果
   * 回复法力
   */
  apply(ctx: EffectContext): void {
    if (!ctx.source) return;

    // 检查是否为 BattleEntity
    if (!isBattleEntity(ctx.source)) {
      console.warn('[ManaRegenEffect] source is not a BattleEntity');
      return;
    }

    const maxMp = ctx.source.getMaxMp();

    // 计算回复量
    let regenAmount = this.amount;
    if (this.percentOfMax > 0 && maxMp > 0) {
      regenAmount += maxMp * this.percentOfMax;
    }

    regenAmount = Math.floor(regenAmount);

    if (regenAmount <= 0) return;

    // 应用回复
    const actualRegen = ctx.source.restoreMp(regenAmount);

    if (actualRegen > 0) {
      // 【优化】简化日志，由 BattleEngine 添加总结
      ctx.logCollector?.addLog(
        `${ctx.source.name} 回复了 ${actualRegen} 点法力`,
      );
    }
  }

  displayInfo() {
    const parts: string[] = [];
    if (this.amount > 0) {
      parts.push(`${this.amount}点`);
    }
    if (this.percentOfMax > 0) {
      parts.push(`${format('.0%')(this.percentOfMax)}最大法力`);
    }

    return {
      label: '法力回复',
      icon: '🔮',
      description: `每回合回复${parts.join(' + ')}`,
    };
  }
}
