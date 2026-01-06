import { BaseEffect } from '../BaseEffect';
import {
  EffectTrigger,
  type CriticalParams,
  type EffectContext,
} from '../types';

/**
 * 暴击效果
 * 在伤害计算前判定暴击并修正伤害
 *
 * 暴击率计算：
 * - 基础暴击率：5%
 * - 加成来源：装备/功法/命格通过 StatModifierEffect 修改 critRate 属性
 * - 上限：100%
 *
 * 暴击伤害计算：
 * - 基础暴击伤害倍率：1.5x
 * - 加成来源：装备/功法/命格通过 StatModifierEffect 修改 critDamage 属性
 */
export class CriticalEffect extends BaseEffect {
  readonly id = 'Critical';
  readonly trigger = EffectTrigger.ON_BEFORE_DAMAGE;
  priority = 1000; // 在护盾之前计算

  constructor(params: CriticalParams = {}) {
    super(params as unknown as Record<string, unknown>);
  }

  /**
   * 应用暴击效果
   * 读取实体属性计算暴击率和暴击伤害
   */
  apply(ctx: EffectContext): void {
    if (!ctx.source || !ctx.metadata) return;

    // 如果已经判定过暴击，不重复判定
    if (ctx.metadata.critProcessed) return;

    // 基础暴击率 5%
    const baseCritRate = 0.05;

    // 从实体属性获取暴击率加成（装备/功法/命格通过 StatModifierEffect 提供）
    const attrCritRate = ctx.source.getAttribute('critRate') ?? 0;

    // 效果自身提供的暴击率加成（如暴击 Buff）
    const effectCritRate = Number(ctx.metadata?.critRateBonus || 0);

    // 总暴击率（上限 100%）
    const totalCritRate = Math.min(
      1.0,
      baseCritRate + attrCritRate + effectCritRate,
    );

    const canCrit = Boolean(ctx.metadata?.canCrit || true);

    // 判定是否暴击
    const isCritical = canCrit && Math.random() < totalCritRate;

    // 记录暴击结果
    ctx.metadata.isCritical = isCritical;
    ctx.metadata.critProcessed = true;
    ctx.metadata.critRate = totalCritRate;

    // 如果暴击，增加伤害
    if (isCritical) {
      // 基础暴击伤害倍率 1.5x
      const baseCritDamage = 1.5;

      // 从实体属性获取暴击伤害加成
      const attrCritDamage = ctx.source.getAttribute('critDamage');

      // 效果自身提供的暴击伤害加成
      const effectCritDamage = Number(ctx.metadata?.critDamageBonus || 0);

      // 总暴击伤害倍率
      const totalCritDamage =
        baseCritDamage + attrCritDamage + effectCritDamage;

      const currentDamage = ctx.value ?? 0;
      ctx.value = currentDamage * totalCritDamage;
      ctx.metadata.critDamageMultiplier = totalCritDamage;
      ctx.metadata.critDamageBonus = currentDamage * (totalCritDamage - 1);
    }
  }

  displayInfo() {
    return {
      label: '暴击',
      icon: '💥',
      description: '允许暴击',
    };
  }
}

// 保留旧接口兼容
export type CriticalEffectParams = CriticalParams;
