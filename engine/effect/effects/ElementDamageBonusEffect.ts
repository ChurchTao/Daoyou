import { BaseEffect } from '../BaseEffect';
import {
  EffectTrigger,
  type EffectContext,
  type ElementDamageBonusParams,
} from '../types';

/**
 * 元素伤害加成效果
 * 在技能命中时，对特定元素的伤害进行加成
 *
 * 使用场景：
 * - 火属性法宝词条："烈阳灼魂" - 火系伤害增加
 * - 功法被动："炎帝焚天诀" - 火系伤害增幅
 */
export class ElementDamageBonusEffect extends BaseEffect {
  readonly id = 'ElementDamageBonus';
  readonly trigger = EffectTrigger.ON_BEFORE_DAMAGE;

  /** 目标元素 */
  private element: string;
  /** 伤害加成 */
  private damageBonus: number;

  constructor(params: ElementDamageBonusParams) {
    super(params as unknown as Record<string, unknown>);
    this.element = params.element;
    this.damageBonus = params.damageBonus ?? 0;
  }

  /**
   * 检查是否触发
   * 1. 触发时机必须是 ON_BEFORE_DAMAGE
   * 2. 攻击者必须是效果持有者
   * 3. 伤害元素必须匹配
   */
  shouldTrigger(ctx: EffectContext): boolean {
    if (ctx.trigger !== EffectTrigger.ON_BEFORE_DAMAGE) return false;

    // 只有攻击者是持有者时才生效
    if (this.ownerId && ctx.source?.id !== this.ownerId) return false;

    // 检查伤害元素是否匹配
    const damageElement = ctx.metadata?.element as string | undefined;
    if (!damageElement) return false;

    // INHERIT 表示匹配任意元素
    if (this.element === 'INHERIT') return true;

    return damageElement === this.element;
  }

  /**
   * 应用效果
   * 增幅伤害值
   */
  apply(ctx: EffectContext): void {
    const baseDamage = ctx.value ?? 0;
    if (baseDamage <= 0) return;

    // 计算增幅后的伤害
    const bonusDamage = baseDamage * this.damageBonus;
    ctx.value = baseDamage + bonusDamage;

    // 记录日志
    ctx.metadata = ctx.metadata ?? {};
    ctx.metadata.elementDamageBonus =
      ((ctx.metadata.elementDamageBonus as number) || 0) + bonusDamage;
  }

  displayInfo() {
    const elementName = this.element === 'INHERIT' ? '同属性' : this.element;
    const bonusPercent = Math.round(this.damageBonus * 100);

    return {
      label: '元素亲和',
      icon: '🔥',
      description: `${elementName}伤害提升 ${bonusPercent}%`,
    };
  }
}
