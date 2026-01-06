/**
 * 效果数值化器
 *
 * 将词条模板中的 ScalableValue 转换为具体数值
 * 根据境界、品质、悟性等因素计算最终数值
 */

import {
  EffectType,
  type EffectConfig,
  type EffectTrigger,
} from '@/engine/effect/types';
import type { Quality, RealmType, SkillGrade } from '@/types/constants';
import { QUALITY_MULTIPLIER } from './creationConfig';
import type {
  AffixParamsTemplate,
  AffixWeight,
  MaterializationContext,
  ScalableValue,
} from './types';

// ============================================================
// 境界数值倍率
// ============================================================

const REALM_MULTIPLIERS: Record<RealmType, number> = {
  炼气: 1.0,
  筑基: 2.0,
  金丹: 4.0,
  元婴: 8.0,
  化神: 16.0,
  炼虚: 32.0,
  合体: 64.0,
  大乘: 128.0,
  渡劫: 256.0,
};

// ============================================================
// 品质数值倍率
// ============================================================

const QUALITY_VALUE_MULTIPLIERS: Record<Quality, number> = {
  凡品: 0.5,
  灵品: 0.7,
  玄品: 1.0,
  真品: 1.3,
  地品: 1.7,
  天品: 2.2,
  仙品: 3.0,
  神品: 4.0,
};

// ============================================================
// 技能品阶数值倍率
// ============================================================

const SKILL_GRADE_MULTIPLIERS: Record<SkillGrade, number> = {
  黄阶下品: 0.5,
  黄阶中品: 0.65,
  黄阶上品: 0.8,
  玄阶下品: 1.0,
  玄阶中品: 1.2,
  玄阶上品: 1.4,
  地阶下品: 1.7,
  地阶中品: 2.0,
  地阶上品: 2.4,
  天阶下品: 3.0,
  天阶中品: 3.8,
  天阶上品: 5.0,
};

// ============================================================
// 效果数值化器
// ============================================================

export class EffectMaterializer {
  /**
   * 将词条模板数值化
   * @param affix 词条配置
   * @param context 数值化上下文
   * @returns 完整的效果配置
   */
  static materialize(
    affix: AffixWeight,
    context: MaterializationContext,
  ): EffectConfig {
    // 1. 处理参数模板，将 ScalableValue 转换为具体数值
    const params = this.materializeParams(affix.paramsTemplate, context);

    // 2. 处理元素继承
    if (params.element === 'INHERIT' && context.element) {
      params.element = context.element;
    }

    // 3. 构建效果配置
    return {
      type: affix.effectType,
      trigger: affix.trigger as EffectTrigger | undefined,
      params,
    };
  }

  /**
   * 批量数值化
   */
  static materializeAll(
    affixes: AffixWeight[],
    context: MaterializationContext,
  ): EffectConfig[] {
    return affixes.map((affix) => this.materialize(affix, context));
  }

  /**
   * 将参数模板中的 ScalableValue 转换为具体数值
   */
  private static materializeParams(
    template: AffixParamsTemplate,
    context: MaterializationContext,
  ): Record<string, unknown> {
    const result: Record<string, unknown> = {};

    for (const [key, value] of Object.entries(template)) {
      if (value === undefined || value === null) {
        continue;
      }

      if (this.isScalableValue(value)) {
        // 处理可缩放值
        result[key] = this.calculateScaledValue(value, context);
      } else if (typeof value === 'object' && !Array.isArray(value)) {
        // 递归处理嵌套对象
        result[key] = this.materializeParams(
          value as AffixParamsTemplate,
          context,
        );
      } else {
        // 直接复制固定值
        result[key] = value;
      }
    }

    return result;
  }

  /**
   * 检查值是否为 ScalableValue
   */
  private static isScalableValue(value: unknown): value is ScalableValue {
    return (
      typeof value === 'object' &&
      value !== null &&
      'base' in value &&
      'scale' in value
    );
  }

  /**
   * 计算缩放后的数值
   */
  private static calculateScaledValue(
    scalable: ScalableValue,
    context: MaterializationContext,
  ): number {
    const { base, scale, coefficient = 1 } = scalable;

    let multiplier = 1;

    switch (scale) {
      case 'realm':
        multiplier = REALM_MULTIPLIERS[context.realm] ?? 1;
        break;
      case 'quality':
        multiplier = QUALITY_VALUE_MULTIPLIERS[context.quality] ?? 1;
        break;
      case 'wisdom':
        // 悟性缩放：悟性 0-500 映射到 0.5-2.0
        const wisdom = context.wisdom ?? 100;
        multiplier = 0.5 + (Math.min(500, wisdom) / 500) * 1.5;
        break;
      case 'none':
      default:
        multiplier = 1;
    }

    // 应用境界配置的额外调整
    const qualityMultiplier = QUALITY_MULTIPLIER[context.quality];

    // 对于境界缩放，额外考虑品质的影响
    if (scale === 'realm' && qualityMultiplier) {
      const qualityFactor =
        qualityMultiplier.min +
        Math.random() * (qualityMultiplier.max - qualityMultiplier.min);
      multiplier *= qualityFactor;
    }

    // 技能品阶缩放（如果有）
    if (context.skillGrade && scale === 'wisdom') {
      const gradeMultiplier =
        SKILL_GRADE_MULTIPLIERS[context.skillGrade as SkillGrade] ?? 1;
      multiplier *= gradeMultiplier;
    }

    const finalValue = base * multiplier * coefficient;

    // 根据数值类型决定是否取整
    // 小于 1 的值（百分比）保留小数，大于 1 的值（固定值）取整
    if (Math.abs(base) < 1) {
      return Math.round(finalValue * 1000) / 1000; // 保留3位小数
    } else {
      return Math.floor(finalValue);
    }
  }

  /**
   * 快速创建属性修正效果
   * 用于不需要走词条池的简单场景
   */
  static createStatModifier(
    stat: string,
    value: number,
    isPercent: boolean = false,
    context: MaterializationContext,
  ): EffectConfig {
    const realmMultiplier = REALM_MULTIPLIERS[context.realm] ?? 1;
    const qualityMultiplier = QUALITY_VALUE_MULTIPLIERS[context.quality] ?? 1;

    const scaledValue = isPercent
      ? value * qualityMultiplier * 0.3
      : Math.floor(value * realmMultiplier * qualityMultiplier);

    return {
      type: EffectType.StatModifier,
      trigger: 'ON_STAT_CALC',
      params: {
        stat,
        modType: isPercent ? 2 : 1, // PERCENT = 2, FIXED = 1
        value: scaledValue,
      },
    };
  }
}
