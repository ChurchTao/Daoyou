import type { ElementType } from '@/types/constants';
import { BaseEffect } from '../BaseEffect';
import {
  EffectTrigger,
  isBattleEntity,
  type BonusDamageParams,
  type EffectContext,
} from '../types';

/**
 * 额外伤害效果
 * 用于在造成伤害后附加额外伤害（如暴风斩）
 * 与 Damage 不同，本效果在 ON_AFTER_DAMAGE 触发，直接造成伤害而非写入 ctx.value
 */
export class BonusDamageEffect extends BaseEffect {
  readonly id = 'BonusDamage';
  readonly trigger = EffectTrigger.ON_AFTER_DAMAGE;

  /** 伤害倍率 */
  private multiplier: number;
  /** 元素类型 ('INHERIT' = 继承技能元素) */
  private element?: ElementType | 'INHERIT';
  /** 是否可暴击 */
  private canCrit: boolean;

  constructor(params: BonusDamageParams) {
    super(params as unknown as Record<string, unknown>);

    this.multiplier = params.multiplier ?? 1.0;
    this.element = params.element;
    this.canCrit = params.canCrit ?? false;
  }

  shouldTrigger(ctx: EffectContext): boolean {
    if (ctx.trigger !== EffectTrigger.ON_AFTER_DAMAGE) return false;
    // 只有持有者是造成伤害的一方时才触发
    if (this.ownerId && ctx.source?.id !== this.ownerId) return false;
    return true;
  }

  /**
   * 应用额外伤害效果
   * 在造成伤害后直接对目标造成额外伤害
   */
  apply(ctx: EffectContext): void {
    const { source, target, logCollector } = ctx;

    if (!source || !target) return;

    // 确认目标是战斗实体（可以接受伤害）
    if (!isBattleEntity(target)) return;

    // 获取攻击力
    const sourceAtk = source.getAttribute('spirit');

    // 解析元素类型
    let element: ElementType | undefined;
    if (this.element === 'INHERIT') {
      // 从元数据中继承元素（由技能设置）
      element = ctx.metadata?.element as ElementType | undefined;
    } else if (this.element) {
      element = this.element as ElementType;
    }

    // 计算基础伤害
    let damage = sourceAtk * this.multiplier;

    // 如果有元素亲和加成
    if (element) {
      const elementMastery = source.getAttribute(`${element}_MASTERY`);
      if (elementMastery > 0) {
        damage *= 1 + elementMastery / 100;
      }
    }

    // 计算暴击
    let isCrit = false;
    if (this.canCrit) {
      const baseCritRate = source.getAttribute('critRate');
      const critThreshold =
        baseCritRate + ((ctx.metadata?.critRateBonus as number) ?? 0);

      if (Math.random() < critThreshold) {
        isCrit = true;
        const baseCritDmg = source.getAttribute('critDamage');
        const critBonus = (ctx.metadata?.critDamageMultiplier as number) ?? 0;
        damage *= baseCritDmg + critBonus;
      }
    }

    // 对目标造成伤害
    const actualDamage = target.applyDamage(damage);

    // 记录日志
    const elementText = element ? `[${element}]` : '';
    const critText = isCrit ? '[暴击]' : '';
    const log = `${source.name}的额外伤害造成${elementText}${actualDamage}点伤害${critText}`;
    logCollector?.addLog(log);
  }

  displayInfo() {
    const elementText =
      this.element && this.element !== 'INHERIT'
        ? `${this.element}属性`
        : '继承技能元素';
    const canCritText = this.canCrit ? '可暴击' : '不可暴击';
    return {
      label: '额外伤害',
      icon: '💥',
      description: `造成伤害后附加额外伤害（${elementText}，${canCritText}）`,
    };
  }
}
