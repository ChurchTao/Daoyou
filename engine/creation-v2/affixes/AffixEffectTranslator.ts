import {
  ApplyBuffParams,
  AttributeType,
  BuffType,
  EffectConfig,
  ModifierType,
  StackRule,
} from '../contracts/battle';
import { QUALITY_ORDER, Quality } from '@/types/constants';
import { buildStatBuffId } from '../services/SlugService';
import {
  AffixDefinition,
  AffixEffectTemplate,
  AffixScalableValue,
  ScalableParam,
  ScalableValueV2,
  SCALE_MODE,
} from './types';

// 属性永久 buff 名称展示
const ATTR_BUFF_NAMES: Partial<Record<AttributeType, string>> = {
  [AttributeType.SPIRIT]: '灵力提振',
  [AttributeType.VITALITY]: '体魄强化',
  [AttributeType.SPEED]: '身法敏锐',
  [AttributeType.WILLPOWER]: '神识坚壁',
  [AttributeType.WISDOM]: '悟性增益',
  [AttributeType.ATK]: '物攻增幅',
  [AttributeType.DEF]: '物防增幅',
  [AttributeType.MAGIC_ATK]: '法攻增幅',
  [AttributeType.MAGIC_DEF]: '法防增幅',
  [AttributeType.CRIT_RATE]: '暴击敏锐',
  [AttributeType.CRIT_DAMAGE_MULT]: '暴击深化',
  [AttributeType.EVASION_RATE]: '身法轻灵',
  [AttributeType.HEAL_AMPLIFY]: '治愈增幅',
  [AttributeType.MAGIC_PENETRATION]: '法穿之锋',
};

/**
 * 词缀效果翻译器
 *
 * 将 AffixEffectTemplate（品质缩放参数）解析为 battle-v5 可直接消费的 EffectConfig
 * 这是造物域与战斗域之间的唯一数值换算边界
 */
export class AffixEffectTranslator {
  /**
   * 翻译词缀定义 + 品质 → 具体 EffectConfig
   */
  translate(def: AffixDefinition, quality: Quality): EffectConfig {
    return this.resolveTemplate(def.effectTemplate, QUALITY_ORDER[quality]);
  }

  private resolveTemplate(template: AffixEffectTemplate, qualityOrder: number): EffectConfig {
    switch (template.type) {
      case 'damage':
        return {
          type: 'damage',
          params: { value: this.resolveScalableValue(template.params.value, qualityOrder) },
        };

      case 'heal':
        return {
          type: 'heal',
          params: { value: this.resolveScalableValue(template.params.value, qualityOrder) },
        };

      case 'shield':
        return {
          type: 'shield',
          params: { value: this.resolveScalableValue(template.params.value, qualityOrder) },
        };

      case 'mana_burn':
        return {
          type: 'mana_burn',
          params: { value: this.resolveScalableValue(template.params.value, qualityOrder) },
        };

      case 'apply_buff': {
        const params: ApplyBuffParams = {
          buffConfig: template.params.buffConfig,
        };
        if (template.params.chance !== undefined) {
          params.chance = this.resolveParam(template.params.chance, qualityOrder);
        }
        return {
          type: 'apply_buff',
          params,
        };
      }

      case 'attribute_stat_buff': {
        const { attrType, modType, value, duration, stackRule } = template.params;
        const resolvedValue = this.resolveParam(value, qualityOrder);
        // MULTIPLY modType: value 为乘数（e.g. 0.12 表示 ×1.12 需在战斗层做 base+value 解释，
        // 或直接作为倍数传入；具体行为取决于 battle-v5 AttributeSet.getFinalValue 的 MULTIPLY 阶段）
        return {
          type: 'apply_buff',
          params: {
            buffConfig: {
              id: buildStatBuffId(attrType, modType),
              name:
                ATTR_BUFF_NAMES[attrType as AttributeType] ?? `${attrType}强化`,
              type: BuffType.BUFF,
              duration: duration ?? -1,
              stackRule: stackRule ?? StackRule.IGNORE,
              modifiers: [
                {
                  attrType: attrType as AttributeType,
                  type: modType as ModifierType,
                  value: resolvedValue,
                },
              ],
            },
          },
        };
      }

      case 'percent_damage_modifier': {
        return {
          type: 'percent_damage_modifier',
          params: {
            mode: template.params.mode,
            value: this.resolveParam(template.params.value, qualityOrder),
            ...(template.params.cap !== undefined
              ? { cap: template.params.cap }
              : {}),
          },
        };
      }

      case 'death_prevent':
        return {
          type: 'death_prevent',
          params: template.params,
        };

      case 'buff_immunity':
        return {
          type: 'buff_immunity',
          params: template.params,
        };

      case 'damage_immunity':
        return {
          type: 'damage_immunity',
          params: template.params,
        };

      case 'dispel':
        return {
          type: 'dispel',
          params: { ...template.params },
        };

      default: {
        const _exhaustive: never = template;
        throw new Error(`AffixEffectTranslator: 未支持的效果类型: ${(_exhaustive as AffixEffectTemplate).type}`);
      }
    }
  }

  private resolveScalableValue(
    sv: AffixScalableValue,
    qualityOrder: number,
  ): { base?: number; attribute?: AttributeType; coefficient?: number } {
    return {
      base: this.resolveParam(sv.base, qualityOrder),
      ...(sv.attribute !== undefined ? { attribute: sv.attribute } : {}),
      ...(sv.coefficient !== undefined ? { coefficient: sv.coefficient } : {}),
    };
  }

  resolveParam(param: ScalableParam, qualityOrder: number): number {
    if (typeof param === 'number') return param;
    const sv = param as ScalableValueV2;
    return sv.scale === SCALE_MODE.NONE ? sv.base : sv.base + qualityOrder * sv.coefficient;
  }
}
