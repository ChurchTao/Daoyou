import { format } from 'd3-format';
import type { ElementType } from '@/types/constants';
import { BaseEffect } from '../BaseEffect';
import {
  EffectTrigger,
  isBattleEntity,
  type CounterAttackParams,
  type EffectContext,
} from '../types';

/**
 * 反击效果
 * 被攻击时有几率反击
 *
 * 使用场景：
 * - 护甲词条："以彼之道" - 被命中时反击
 * - 功法被动：近战反击
 */
export class CounterAttackEffect extends BaseEffect {
  readonly id = 'CounterAttack';
  readonly trigger = EffectTrigger.ON_BEING_HIT;

  /** 触发几率 */
  private chance: number;
  /** 伤害倍率 */
  private damageMultiplier: number;
  /** 元素类型 */
  private element?: ElementType | 'INHERIT';

  constructor(params: CounterAttackParams) {
    super(params as unknown as Record<string, unknown>);
    this.chance = params.chance ?? 0.1;
    this.damageMultiplier = params.damageMultiplier ?? 0.5;
    this.element = params.element;
  }

  /**
   * 检查是否触发
   */
  shouldTrigger(ctx: EffectContext): boolean {
    if (ctx.trigger !== EffectTrigger.ON_BEING_HIT) return false;

    // 被攻击者是持有者
    if (this.ownerId && ctx.target?.id !== this.ownerId) return false;

    // 概率判定
    return Math.random() < this.chance;
  }

  /**
   * 应用效果
   * 直接对攻击者造成反击伤害
   */
  apply(ctx: EffectContext): void {
    if (!ctx.source || !ctx.target) return;

    const damageTaken = ctx.value ?? 0;
    if (damageTaken <= 0) return;

    // 检查攻击者是否为 BattleEntity
    if (!isBattleEntity(ctx.source)) {
      console.warn(
        '[CounterAttackEffect] source (attacker) is not a BattleEntity',
      );
      return;
    }

    // 计算反击伤害
    const counterDamage = Math.floor(damageTaken * this.damageMultiplier);

    // 直接对攻击者造成反击伤害
    const actualDamage = ctx.source.applyDamage(counterDamage);

    if (actualDamage > 0) {
      // 确定元素文本
      let elementText = '';
      if (this.element === 'INHERIT') {
        const inheritedElement = ctx.metadata?.element as
          | ElementType
          | undefined;
        if (inheritedElement) {
          elementText = `（${inheritedElement}属性）`;
        }
      } else if (this.element) {
        elementText = `（${this.element}属性）`;
      }

      ctx.logCollector?.addLog(
        `${ctx.target.name} 反击了${elementText}，造成 ${actualDamage} 点伤害！`,
      );
    }
  }

  displayInfo() {
    const chancePercent = format('.0%')(this.chance);
    const damagePercent = format('.0%')(this.damageMultiplier);

    return {
      label: '反击',
      icon: '🔄',
      description: `被攻击时有 ${chancePercent} 几率反击，造成受到伤害的 ${damagePercent}`,
    };
  }
}
