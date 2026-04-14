/*
 * affixes/types.ts: 词缀（Affix）相关类型定义与常量。
 * 包含可缩放参数、词缀模板、监听器规格与 AffixDefinition 等。
 */
import { EquipmentSlot, Quality } from '@/types/constants';
import {
  AttributeType,
  BuffConfig,
  BuffImmunityParams,
  ConditionConfig,
  DamageImmunityParams,
  DeathPreventParams,
  ListenerContextMapping,
  ListenerGuardConfig,
  ListenerScope,
  ModifierType,
  StackRule,
} from '../contracts/battle';
import type { CreationTagSignalSource } from '../types';
import { AffixCategory, CreationProductType } from '../types';
import type { ExclusiveGroup } from './exclusiveGroups';

// ===== 品质缩放值 =====

/** ScalableValueV2 的 scale 字段取值 */
export const SCALE_MODE = {
  QUALITY: 'quality',
  NONE: 'none',
} as const;
export type ScaleMode = (typeof SCALE_MODE)[keyof typeof SCALE_MODE];

/** percent_damage_modifier 的 mode 字段取值 */
export const PERCENT_MODIFIER_MODE = {
  INCREASE: 'increase',
  REDUCE: 'reduce',
} as const;
export type PercentModifierMode =
  (typeof PERCENT_MODIFIER_MODE)[keyof typeof PERCENT_MODIFIER_MODE];

/**
 * V2 品质缩放值：resolved = base + qualityOrder * coefficient
 */
export interface ScalableValueV2 {
  base: number;
  scale: ScaleMode;
  coefficient: number;
}

/**
 * 词缀中的数值参数，允许直接给数字或使用品质缩放
 */
export type ScalableParam = number | ScalableValueV2;

// ===== 词缀效果模板 =====

/**
 * 映射到 battle-v5 ScalableValue 的词缀值
 * base 可进行品质缩放；attribute + coefficient 为战斗内属性缩放（固定不缩放）
 */
export interface AffixScalableValue {
  base: ScalableParam;
  attribute?: AttributeType;
  coefficient?: number;
}

/**
 * 通用条件配置：透传到 battle-v5 EffectConfig.conditions
 */
export interface AffixEffectTemplateBase {
  conditions?: ConditionConfig[];
}

export interface AffixAttributeModifierTemplate {
  attrType: AttributeType;
  modType: ModifierType;
  value: ScalableParam;
}

/**
 * 词缀效果模板（镜像 battle-v5 EffectConfig，但数值允许 ScalableParam）
 *
 * - damage / heal / shield / mana_burn：params.value 是 AffixScalableValue
 * - apply_buff：直接存储 BuffConfig（值不缩放，用于复杂 buff 模板）
 * - attribute_modifier：静态属性修改器，投影为 AbilityConfig.modifiers
 * - attribute_stat_buff：属性 buff，由翻译器包装为 apply_buff + BuffConfig.modifiers（可用于临时效果）
 * - percent_damage_modifier / dispel：简单参数
 */
export type AffixEffectTemplate = AffixEffectTemplateBase &
  (
    | { type: 'damage'; params: { value: AffixScalableValue } }
    | {
        type: 'heal';
        params: { value: AffixScalableValue; target?: 'hp' | 'mp' };
      }
    | { type: 'shield'; params: { value: AffixScalableValue } }
    | { type: 'mana_burn'; params: { value: AffixScalableValue } }
    | {
        type: 'resource_drain';
        params: {
          sourceType: 'hp' | 'mp';
          targetType: 'hp' | 'mp';
          ratio: ScalableParam;
        };
      }
    | { type: 'magic_shield'; params: { absorbRatio?: ScalableParam } }
    | { type: 'reflect'; params: { ratio: ScalableParam } }
    | {
        type: 'cooldown_modify';
        params: { cdModifyValue: ScalableParam; tags?: string[] };
      }
    | {
        type: 'tag_trigger';
        params: {
          triggerTag: string;
          damageRatio?: ScalableParam;
          removeOnTrigger?: boolean;
        };
      }
    | {
        type: 'apply_buff';
        params: { buffConfig: BuffConfig; chance?: ScalableParam };
      }
    | {
        /**
         * 静态属性修改器（专为 gongfa / artifact 的常驻词缀设计）
         * 由 ProjectionRules 投影为 AbilityConfig.modifiers
         */
        type: 'attribute_modifier';
        params:
          | {
              modifiers: AffixAttributeModifierTemplate[];
            }
          | {
              attrType: AttributeType;
              modType: ModifierType;
              value: ScalableParam;
            };
      }
    | {
        /**
         * 属性强化 buff（用于可持续时间/可堆叠的 buff 语义）
         * 翻译器会生成 apply_buff + stackRule=IGNORE + duration=-1 + modifiers[{ attrType, modType, value }]
         */
        type: 'attribute_stat_buff';
        params: {
          attrType: AttributeType;
          modType: ModifierType;
          value: ScalableParam;
          duration?: number;
          stackRule?: StackRule;
        };
      }
    | {
        type: 'percent_damage_modifier';
        params: {
          mode: PercentModifierMode;
          value: ScalableParam;
          cap?: number;
        };
      }
    | { type: 'death_prevent'; params: DeathPreventParams }
    | { type: 'buff_immunity'; params: BuffImmunityParams }
    | { type: 'damage_immunity'; params: DamageImmunityParams }
    | { type: 'dispel'; params: { targetTag?: string; maxCount?: number } }
    | {
        /**
         * 随机属性修改器（仅用于 artifact/gongfa 被动词缀）
         * 在造物时从 pool 中随机抽取 pickCount 条属性，解析为 AbilityConfig.modifiers。
         * 每条池目指定独立的 attrType、modType 与 value 公式，允许携带不同量级的数值。
         * 由 ProjectionRules 投影，不经过 AffixEffectTranslator。
         */
        type: 'random_attribute_modifier';
        params: {
          pool: AffixAttributeModifierTemplate[];
          pickCount: number;
        };
      }
  );

// ===== 词缀监听器规格 =====

/**
 * 为被动技能效果指定 listener 包装方式
 * 被动能力（artifact / gongfa）中的词缀效果须包装在 listener 中
 */
export interface AffixListenerSpec {
  eventType: string;
  scope: ListenerScope;
  priority: number;
  mapping?: ListenerContextMapping;
  guard?: ListenerGuardConfig;
}

export interface AffixTagMatchGroup {
  all?: string[];
  any?: string[];
  none?: string[];
}

export interface AffixTagMatcher extends AffixTagMatchGroup {
  sources?: Partial<Record<CreationTagSignalSource, AffixTagMatchGroup>>;
}

export function matchAll(tags: string[]): AffixTagMatcher {
  return tags.length > 0 ? { all: tags } : {};
}

export function matchAny(tags: string[]): AffixTagMatcher {
  return tags.length > 0 ? { any: tags } : {};
}

export function matchNone(tags: string[]): AffixTagMatcher {
  return tags.length > 0 ? { none: tags } : {};
}

export function flattenAffixMatcherTags(match: AffixTagMatcher): string[] {
  const tags = new Set<string>();

  const collectPositiveTags = (group?: AffixTagMatchGroup) => {
    group?.all?.forEach((tag) => tags.add(tag));
    group?.any?.forEach((tag) => tags.add(tag));
  };

  collectPositiveTags(match);
  Object.values(match.sources ?? {}).forEach((group) =>
    collectPositiveTags(group),
  );

  return Array.from(tags);
}

export function collectAffixMatcherReferencedTags(
  match: AffixTagMatcher,
): string[] {
  const tags = new Set<string>();

  const collectAllTags = (group?: AffixTagMatchGroup) => {
    group?.all?.forEach((tag) => tags.add(tag));
    group?.any?.forEach((tag) => tags.add(tag));
    group?.none?.forEach((tag) => tags.add(tag));
  };

  collectAllTags(match);
  Object.values(match.sources ?? {}).forEach((group) => collectAllTags(group));

  return Array.from(tags);
}

// ===== 词缀定义 =====

export interface AffixDefinition {
  id: string;
  displayName: string;
  displayDescription: string;
  /** 词缀类型，对应配方解锁阈值 */
  category: AffixCategory;
  /**
   * 结构化静态匹配语义：由 affix 自身声明入池所需的材料/意图标签条件。
   */
  match: AffixTagMatcher;
  /** 同一 exclusiveGroup 只会抽中一个词缀 */
  exclusiveGroup?: ExclusiveGroup;
  /** 加权抽签权重（越大越容易被抽中） */
  weight: number;
  /** 选中此词缀消耗的能量 */
  energyCost: number;
  /** 进入候选池所需的最低材料品质 */
  minQuality?: Quality;
  /** 允许进入候选池的最高材料品质（超出此品质的材料不能秗到此词缀） */
  maxQuality?: Quality;
  /** 法宝专用：限定可进入候选池的装备槽位 */
  applicableArtifactSlots?: EquipmentSlot[];
  /** 词缀效果模板（含品质缩放参数） */
  effectTemplate: AffixEffectTemplate;
  /** 被动能力词缀的监听器规格（artifact/gongfa 词缀必填） */
  listenerSpec?: AffixListenerSpec;
  /** 适用产物类型 */
  applicableTo: CreationProductType[];
  /**
   * 作者侧显式声明的最终运行时能力标签。
   * 这些标签会在 creation-v2 组合阶段直接从抽中的 affix 合并到产物的 abilityTags。
   */
  grantedAbilityTags?: string[];
}
