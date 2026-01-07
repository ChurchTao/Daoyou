/**
 * Buff 数值化器
 *
 * 将 BuffTemplate 中的 BuffScalableValue 转换为具体数值，
 * 生成可直接使用的 BuffConfig
 */

import { EffectType, type EffectConfig } from '@/engine/effect/types';
import type { Quality, RealmType, SkillGrade } from '@/types/constants';
import type {
  BuffConfig,
  BuffEffectTemplate,
  BuffMaterializationContext,
  BuffParamsOverride,
  BuffScalableValue,
  BuffTemplate,
} from './types';

// ============================================================
// 缩放倍率配置
// ============================================================

/** 境界数值倍率 */
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

/** 品质数值倍率 */
const QUALITY_MULTIPLIERS: Record<Quality, number> = {
  凡品: 0.5,
  灵品: 0.7,
  玄品: 1.0,
  真品: 1.3,
  地品: 1.7,
  天品: 2.2,
  仙品: 3.0,
  神品: 4.0,
};

/** 技能品阶数值倍率 */
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

/** 属性缩放基准值 (用于将属性值转换为倍率) */
const ATTRIBUTE_BASE = 100;

// ============================================================
// Buff 数值化器
// ============================================================

export class BuffMaterializer {
  /**
   * 将 Buff 模板数值化为 BuffConfig
   * @param template Buff 模板
   * @param context 数值化上下文
   * @param paramsOverride 参数覆盖 (可选)
   * @returns 数值化后的 BuffConfig
   */
  static materialize(
    template: BuffTemplate,
    context: BuffMaterializationContext,
    paramsOverride?: BuffParamsOverride,
  ): BuffConfig {
    // 1. 数值化每个效果模板
    const effects = template.effectTemplates.map((effectTemplate, index) => {
      return this.materializeEffect(
        effectTemplate,
        context,
        paramsOverride?.[index],
      );
    });

    // 2. 生成描述 (替换占位符)
    const description = this.generateDescription(
      template.descriptionTemplate,
      effects,
      context,
    );

    // 3. 返回完整的 BuffConfig
    return {
      id: template.id,
      name: template.name,
      description,
      maxStacks: template.maxStacks,
      duration: template.duration,
      stackType: template.stackType,
      conflictsWith: template.conflictsWith,
      effects,
      tags: template.tags,
      icon: template.icon,
    };
  }

  /**
   * 数值化单个效果模板
   */
  private static materializeEffect(
    template: BuffEffectTemplate,
    context: BuffMaterializationContext,
    override?: Record<string, number | BuffScalableValue>,
  ): EffectConfig {
    // 合并覆盖参数
    const mergedParams = override
      ? this.mergeParams(template.paramsTemplate, override)
      : template.paramsTemplate;

    // 数值化参数
    const params = this.materializeParams(mergedParams, context);

    return {
      type: template.type as EffectType,
      trigger: template.trigger,
      params,
    };
  }

  /**
   * 合并参数覆盖
   */
  private static mergeParams(
    baseParams: Record<string, unknown>,
    override: Record<string, number | BuffScalableValue>,
  ): Record<string, unknown> {
    return {
      ...baseParams,
      ...override,
    };
  }

  /**
   * 数值化参数，将 BuffScalableValue 转换为具体数值
   */
  private static materializeParams(
    params: Record<string, unknown>,
    context: BuffMaterializationContext,
  ): Record<string, unknown> {
    const result: Record<string, unknown> = {};

    for (const [key, value] of Object.entries(params)) {
      if (value === undefined || value === null) {
        continue;
      }

      if (this.isScalableValue(value)) {
        // 处理可缩放值
        result[key] = this.calculateScaledValue(value, context);
      } else if (typeof value === 'object' && !Array.isArray(value)) {
        // 递归处理嵌套对象
        result[key] = this.materializeParams(
          value as Record<string, unknown>,
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
   * 检查值是否为 BuffScalableValue
   */
  private static isScalableValue(value: unknown): value is BuffScalableValue {
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
    scalable: BuffScalableValue,
    context: BuffMaterializationContext,
  ): number {
    const { base, scale, coefficient = 1 } = scalable;

    let multiplier = 1;

    switch (scale) {
      case 'caster_spirit':
        // 基于施法者灵力: 灵力 / 100 作为倍率
        multiplier = (context.casterSpirit ?? ATTRIBUTE_BASE) / ATTRIBUTE_BASE;
        break;

      case 'caster_wisdom':
        // 基于施法者悟性
        multiplier = (context.casterWisdom ?? ATTRIBUTE_BASE) / ATTRIBUTE_BASE;
        break;

      case 'caster_willpower':
        // 基于施法者神识
        multiplier =
          (context.casterWillpower ?? ATTRIBUTE_BASE) / ATTRIBUTE_BASE;
        break;

      case 'caster_vitality':
        // 基于施法者体魄
        multiplier =
          (context.casterVitality ?? ATTRIBUTE_BASE) / ATTRIBUTE_BASE;
        break;

      case 'realm':
        // 基于施法者境界
        multiplier = REALM_MULTIPLIERS[context.casterRealm ?? '炼气'];
        break;

      case 'quality':
        // 基于物品/技能品质
        multiplier = QUALITY_MULTIPLIERS[context.quality ?? '凡品'];
        break;

      case 'stacks':
        // 基于当前层数
        multiplier = context.stacks ?? 1;
        break;

      case 'none':
      default:
        multiplier = 1;
    }

    const finalValue = base * multiplier * coefficient;

    // 根据数值类型决定是否取整
    // 绝对值小于 1 的（百分比）保留小数，否则取整
    if (Math.abs(base) < 1) {
      return Math.round(finalValue * 1000) / 1000; // 保留3位小数
    } else {
      return Math.floor(finalValue);
    }
  }

  /**
   * 生成描述，替换占位符
   *
   * 占位符约定：
   * - {damage}: 伤害数值 (从 baseDamage 参数获取)
   * - {heal}: 治疗数值 (从 flatHeal 参数获取)
   * - {shield}: 护盾数值 (从 amount 参数获取)
   * - {value}: 通用数值 (从 value 参数获取)
   * - {percent}: 百分比数值 (从 percentValue 参数获取，自动格式化为 XX%)
   * - {stacks}: 层数 (从 context.stacks 获取)
   *
   * 【重要】如果需要在描述中显示百分比，Buff 模板的 effect 参数必须命名为 `percentValue`
   */
  private static generateDescription(
    template: string | undefined,
    effects: EffectConfig[],
    context: BuffMaterializationContext,
  ): string {
    if (!template) return '';

    let description = template;

    // 遍历效果，提取数值并替换占位符
    for (const effect of effects) {
      const params = effect.params as Record<string, unknown>;

      // 替换 {damage} 占位符
      if (params.baseDamage !== undefined) {
        description = description.replace(
          '{damage}',
          String(params.baseDamage),
        );
      }

      // 替换 {heal} 占位符
      if (params.flatHeal !== undefined) {
        description = description.replace('{heal}', String(params.flatHeal));
      }

      // 替换 {shield} 占位符
      if (params.amount !== undefined) {
        description = description.replace('{shield}', String(params.amount));
      }

      // 替换 {value} 占位符 (通用数值)
      if (params.value !== undefined && typeof params.value === 'number') {
        description = description.replace('{value}', String(params.value));
      }

      // 【重要】替换 {percent} 占位符 - 统一使用 percentValue 参数
      // 如果 Buff 模板需要显示百分比，必须在 paramsTemplate 中使用 percentValue 作为参数名
      if (
        params.percentValue !== undefined &&
        typeof params.percentValue === 'number'
      ) {
        const percentText = Math.round(Math.abs(params.percentValue) * 100);
        description = description.replace(/\{percent\}/g, `${percentText}%`);
      }
    }

    // 替换 {stacks} 占位符
    if (context.stacks !== undefined) {
      description = description.replace('{stacks}', String(context.stacks));
    }

    return description;
  }

  /**
   * 从施法者实体构建数值化上下文
   * 用于 AddBuffEffect 等场景
   */
  static buildContextFromCaster(
    caster: {
      getAttribute: (key: string) => number;
    },
    additionalContext?: Partial<BuffMaterializationContext>,
  ): BuffMaterializationContext {
    return {
      casterSpirit: caster.getAttribute('spirit'),
      casterWisdom: caster.getAttribute('wisdom'),
      casterWillpower: caster.getAttribute('willpower'),
      casterVitality: caster.getAttribute('vitality'),
      ...additionalContext,
    };
  }
}
