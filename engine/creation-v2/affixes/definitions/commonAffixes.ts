import { CreationTags } from '@/engine/shared/tag-domain';
import { ELEMENT_TO_MATERIAL_TAG } from '../../config/CreationMappings';
import { AttributeType, ModifierType } from '../../contracts/battle';
import { EXCLUSIVE_GROUP } from '../exclusiveGroups';
import { AffixDefinition, matchAll } from '../types';

/**
 * 一些通用的 prefix / suffix 词缀定义，适用于多个产物类型
 * 例如一些基础属性词缀（体魄强化、灵力强化等）可以同时出现在战器、护甲和饰品上
 * 这些词缀通常匹配较宽泛的标签，且不依赖特定产物类型的标签
 * 通过放在 commonAffixes 中，可以避免在多个产物定义中重复定义相似的词缀
 * 也方便后续统一调整这些通用词缀的参数（如权重、能量消耗等）
 */
export const COMMON_PREFIX_AFFIX: AffixDefinition[] = [
  // ===== 基础五维属性强化 =====
  {
    id: 'common-prefix-vitality',
    displayName: '体魄强化',
    displayDescription: '永久提升体魄，打持久战更稳',
    category: 'prefix',
    match: matchAll([
      CreationTags.MATERIAL.TYPE_ORE,
      CreationTags.MATERIAL.SEMANTIC_GUARD,
    ]),
    weight: 95,
    energyCost: 8,
    applicableTo: ['artifact', 'gongfa'],
    applicableArtifactSlots: ['armor', 'accessory'],
    effectTemplate: {
      type: 'attribute_modifier',
      params: {
        attrType: AttributeType.VITALITY,
        modType: ModifierType.FIXED,
        value: { base: 4, scale: 'quality', coefficient: 2 },
      },
    },
  },
  {
    id: 'common-prefix-spirit',
    displayName: '灵力强化',
    displayDescription: '永久提升灵力，提高法术相关收益',
    category: 'prefix',
    match: matchAll([
      CreationTags.MATERIAL.SEMANTIC_SPIRIT,
      CreationTags.MATERIAL.TYPE_MONSTER,
    ]),
    weight: 90,
    energyCost: 8,
    applicableTo: ['artifact', 'gongfa'],
    effectTemplate: {
      type: 'attribute_modifier',
      params: {
        attrType: AttributeType.SPIRIT,
        modType: ModifierType.FIXED,
        value: { base: 4, scale: 'quality', coefficient: 2 },
      },
    },
  },
  {
    id: 'common-prefix-willpower-boost',
    displayName: '神识强化',
    displayDescription: '永久提升神识，抵抗控制',
    category: 'prefix',
    match: matchAll([
      CreationTags.MATERIAL.SEMANTIC_MANUAL,
      CreationTags.MATERIAL.TYPE_MANUAL,
    ]),
    weight: 52,
    energyCost: 6,
    applicableTo: ['artifact', 'gongfa'],
    applicableArtifactSlots: ['weapon', 'accessory'],
    effectTemplate: {
      type: 'attribute_modifier',
      params: {
        attrType: AttributeType.WILLPOWER,
        modType: ModifierType.FIXED,
        value: { base: 2, scale: 'quality', coefficient: 1 },
      },
    },
  },
  {
    id: 'common-prefix-wisdom-insight',
    displayName: '悟性强化',
    displayDescription: '永久提升悟性，加快修为',
    category: 'prefix',
    match: matchAll([
      CreationTags.MATERIAL.SEMANTIC_SPIRIT,
      CreationTags.MATERIAL.SEMANTIC_MANUAL,
    ]),
    weight: 50,
    energyCost: 6,
    applicableTo: ['artifact', 'gongfa'],
    applicableArtifactSlots: ['accessory'],
    effectTemplate: {
      type: 'attribute_modifier',
      params: {
        attrType: AttributeType.WISDOM,
        modType: ModifierType.FIXED,
        value: { base: 2, scale: 'quality', coefficient: 1 },
      },
    },
  },
  {
    id: 'common-prefix-speed',
    displayName: '身法强化',
    displayDescription: '永久提升身法，先手更容易',
    category: 'prefix',
    match: matchAll([
      CreationTags.MATERIAL.SEMANTIC_WIND,
      ELEMENT_TO_MATERIAL_TAG['风'],
    ]),
    exclusiveGroup: EXCLUSIVE_GROUP.ARTIFACT.PREFIX_MOBILITY,
    weight: 80,
    energyCost: 6,
    applicableTo: ['artifact', 'gongfa'],
    effectTemplate: {
      type: 'attribute_modifier',
      params: {
        attrType: AttributeType.SPEED,
        modType: ModifierType.FIXED,
        value: { base: 2, scale: 'quality', coefficient: 1 },
      },
    },
  },

  // ===== 派生属性强化 =====
  {
    id: 'common-prefix-attack',
    displayName: '物攻强化',
    displayDescription: '永久提升物理攻击力，剑修常用',
    category: 'prefix',
    match: matchAll([
      CreationTags.MATERIAL.SEMANTIC_BLADE,
      CreationTags.MATERIAL.TYPE_ORE,
    ]),
    weight: 82,
    energyCost: 8,
    applicableTo: ['artifact', 'gongfa'],
    applicableArtifactSlots: ['weapon', 'accessory'],
    effectTemplate: {
      type: 'attribute_modifier',
      params: {
        attrType: AttributeType.ATK,
        modType: ModifierType.FIXED,
        value: { base: 4, scale: 'quality', coefficient: 2 },
      },
    },
  },
  {
    id: 'common-prefix-magic-attack',
    displayName: '法攻强化',
    displayDescription: '永久提升法术攻击力，术法流核心之一',
    category: 'prefix',
    match: matchAll([
      CreationTags.MATERIAL.SEMANTIC_SPIRIT,
      CreationTags.MATERIAL.SEMANTIC_BURST,
    ]),
    weight: 80,
    energyCost: 8,
    applicableTo: ['artifact', 'gongfa'],
    applicableArtifactSlots: ['weapon', 'accessory'],
    effectTemplate: {
      type: 'attribute_modifier',
      params: {
        attrType: AttributeType.MAGIC_ATK,
        modType: ModifierType.FIXED,
        value: { base: 4, scale: 'quality', coefficient: 2 },
      },
    },
  },
  {
    id: 'common-prefix-physical-defense',
    displayName: '物防强化',
    displayDescription: '永久提升物理防御',
    category: 'prefix',
    match: matchAll([
      CreationTags.MATERIAL.SEMANTIC_GUARD,
      CreationTags.MATERIAL.TYPE_ORE,
    ]),
    weight: 58,
    energyCost: 6,
    applicableTo: ['artifact', 'gongfa'],
    applicableArtifactSlots: ['armor', 'accessory'],
    effectTemplate: {
      type: 'attribute_modifier',
      params: {
        attrType: AttributeType.DEF,
        modType: ModifierType.FIXED,
        value: { base: 3, scale: 'quality', coefficient: 1.5 },
      },
    },
  },
  {
    id: 'common-prefix-magic-defense',
    displayName: '法防强化',
    displayDescription: '永久提升法术防御',
    category: 'prefix',
    match: matchAll([
      CreationTags.MATERIAL.SEMANTIC_SPIRIT,
      CreationTags.MATERIAL.TYPE_HERB,
    ]),
    weight: 56,
    energyCost: 6,
    applicableTo: ['artifact', 'gongfa'],
    applicableArtifactSlots: ['armor', 'accessory'],
    effectTemplate: {
      type: 'attribute_modifier',
      params: {
        attrType: AttributeType.MAGIC_DEF,
        modType: ModifierType.FIXED,
        value: { base: 3, scale: 'quality', coefficient: 1.5 },
      },
    },
  },
  {
    id: 'common-prefix-crit-rate',
    displayName: '暴击率强化',
    displayDescription: '永久提升暴击率',
    category: 'prefix',
    match: matchAll([
      CreationTags.MATERIAL.SEMANTIC_BLADE,
      CreationTags.MATERIAL.TYPE_MONSTER,
    ]),
    exclusiveGroup: EXCLUSIVE_GROUP.ARTIFACT.PREFIX_CRIT_RATE,
    weight: 90,
    energyCost: 6,
    applicableTo: ['artifact', 'gongfa'],
    applicableArtifactSlots: ['weapon', 'accessory'],
    effectTemplate: {
      type: 'attribute_modifier',
      params: {
        attrType: AttributeType.CRIT_RATE,
        modType: ModifierType.FIXED,
        value: { base: 0.03, scale: 'quality', coefficient: 0.01 },
      },
    },
  },
  {
    id: 'common-prefix-crit-damage',
    displayName: '暴伤强化',
    displayDescription: '永久提升暴击伤害倍数',
    category: 'prefix',
    match: matchAll([
      CreationTags.MATERIAL.SEMANTIC_BURST,
      CreationTags.MATERIAL.TYPE_ORE,
    ]),
    exclusiveGroup: EXCLUSIVE_GROUP.ARTIFACT.PREFIX_CRIT_DMG,
    weight: 68,
    energyCost: 7,
    applicableTo: ['artifact', 'gongfa'],
    applicableArtifactSlots: ['weapon', 'accessory'],
    effectTemplate: {
      type: 'attribute_modifier',
      params: {
        attrType: AttributeType.CRIT_DAMAGE_MULT,
        modType: ModifierType.FIXED,
        value: { base: 0.1, scale: 'quality', coefficient: 0.02 },
      },
    },
  },
  {
    id: 'common-prefix-evasion',
    displayName: '闪避强化',
    displayDescription: '永久提升闪避率',
    category: 'prefix',
    match: matchAll([
      CreationTags.MATERIAL.SEMANTIC_WIND,
      CreationTags.MATERIAL.SEMANTIC_BLADE,
    ]),
    exclusiveGroup: EXCLUSIVE_GROUP.ARTIFACT.PREFIX_MOBILITY,
    weight: 75,
    energyCost: 6,
    applicableTo: ['artifact', 'gongfa'],
    applicableArtifactSlots: ['armor', 'accessory'],
    effectTemplate: {
      type: 'attribute_modifier',
      params: {
        attrType: AttributeType.EVASION_RATE,
        modType: ModifierType.FIXED,
        value: { base: 0.03, scale: 'quality', coefficient: 0.01 },
      },
    },
  },
  {
    id: 'common-prefix-magic-penetration',
    displayName: '法穿锐锋',
    displayDescription: '永久提升法术穿透',
    category: 'prefix',
    match: matchAll([
      CreationTags.MATERIAL.SEMANTIC_SPIRIT,
      CreationTags.MATERIAL.SEMANTIC_BURST,
    ]),
    weight: 70,
    energyCost: 7,
    applicableTo: ['artifact', 'gongfa'],
    applicableArtifactSlots: ['weapon', 'accessory'],
    effectTemplate: {
      type: 'attribute_modifier',
      params: {
        attrType: AttributeType.MAGIC_PENETRATION,
        modType: ModifierType.FIXED,
        value: { base: 0.05, scale: 'quality', coefficient: 0.015 },
      },
    },
  },
  {
    id: 'common-prefix-armor-penetration',
    displayName: '破甲锐锋',
    displayDescription: '永久提升物理穿透',
    category: 'prefix',
    match: matchAll([
      CreationTags.MATERIAL.SEMANTIC_BLADE,
      CreationTags.MATERIAL.SEMANTIC_BURST,
    ]),
    weight: 69,
    energyCost: 7,
    applicableTo: ['artifact', 'gongfa'],
    applicableArtifactSlots: ['weapon', 'accessory'],
    effectTemplate: {
      type: 'attribute_modifier',
      params: {
        attrType: AttributeType.ARMOR_PENETRATION,
        modType: ModifierType.FIXED,
        value: { base: 0.05, scale: 'quality', coefficient: 0.015 },
      },
    },
  },
  {
    id: 'common-prefix-accuracy',
    displayName: '精准强化',
    displayDescription: '永久提升精准，降低被闪避风险',
    category: 'prefix',
    match: matchAll([
      CreationTags.MATERIAL.SEMANTIC_BLADE,
      CreationTags.MATERIAL.SEMANTIC_WIND,
    ]),
    weight: 72,
    energyCost: 6,
    applicableTo: ['artifact', 'gongfa'],
    applicableArtifactSlots: ['weapon', 'accessory'],
    effectTemplate: {
      type: 'attribute_modifier',
      params: {
        attrType: AttributeType.ACCURACY,
        modType: ModifierType.FIXED,
        value: { base: 0.045, scale: 'quality', coefficient: 0.012 },
      },
    },
  },
  {
    id: 'common-prefix-control-hit',
    displayName: '效果命中强化',
    displayDescription: '永久提升控制命中，控制更稳定',
    category: 'prefix',
    match: matchAll([
      CreationTags.MATERIAL.SEMANTIC_MANUAL,
      CreationTags.MATERIAL.SEMANTIC_SPIRIT,
    ]),
    weight: 64,
    energyCost: 7,
    applicableTo: ['artifact', 'gongfa'],
    applicableArtifactSlots: ['weapon', 'accessory'],
    effectTemplate: {
      type: 'attribute_modifier',
      params: {
        attrType: AttributeType.CONTROL_HIT,
        modType: ModifierType.FIXED,
        value: { base: 0.04, scale: 'quality', coefficient: 0.01 },
      },
    },
  },
  {
    id: 'common-prefix-control-resistance',
    displayName: '效果抵抗强化',
    displayDescription: '永久提升控制抗性，减少被控风险',
    category: 'prefix',
    match: matchAll([
      CreationTags.MATERIAL.SEMANTIC_GUARD,
      CreationTags.MATERIAL.SEMANTIC_SPIRIT,
    ]),
    weight: 62,
    energyCost: 7,
    applicableTo: ['artifact', 'gongfa'],
    applicableArtifactSlots: ['armor', 'accessory'],
    effectTemplate: {
      type: 'attribute_modifier',
      params: {
        attrType: AttributeType.CONTROL_RESISTANCE,
        modType: ModifierType.FIXED,
        value: { base: 0.04, scale: 'quality', coefficient: 0.01 },
      },
    },
  },
  {
    id: 'common-prefix-crit-resist',
    displayName: '抗暴强化',
    displayDescription: '永久提升暴击韧性，降低被暴击概率',
    category: 'prefix',
    match: matchAll([
      CreationTags.MATERIAL.SEMANTIC_GUARD,
      CreationTags.MATERIAL.SEMANTIC_WATER,
    ]),
    weight: 61,
    energyCost: 7,
    applicableTo: ['artifact', 'gongfa'],
    applicableArtifactSlots: ['armor', 'accessory'],
    effectTemplate: {
      type: 'attribute_modifier',
      params: {
        attrType: AttributeType.CRIT_RESIST,
        modType: ModifierType.FIXED,
        value: { base: 0.045, scale: 'quality', coefficient: 0.01 },
      },
    },
  },
  {
    id: 'common-prefix-crit-damage-reduction',
    displayName: '暴伤减免强化',
    displayDescription: '永久提升暴击减伤，降低暴击爆发伤害',
    category: 'prefix',
    match: matchAll([
      CreationTags.MATERIAL.SEMANTIC_GUARD,
      CreationTags.MATERIAL.SEMANTIC_SUSTAIN,
    ]),
    weight: 60,
    energyCost: 7,
    applicableTo: ['artifact', 'gongfa'],
    applicableArtifactSlots: ['armor', 'accessory'],
    effectTemplate: {
      type: 'attribute_modifier',
      params: {
        attrType: AttributeType.CRIT_DAMAGE_REDUCTION,
        modType: ModifierType.FIXED,
        value: { base: 0.07, scale: 'quality', coefficient: 0.015 },
      },
    },
  },
  {
    id: 'common-prefix-heal-amplify',
    displayName: '治疗强化',
    displayDescription: '永久提升治疗效果倍数',
    category: 'prefix',
    match: matchAll([
      CreationTags.MATERIAL.SEMANTIC_SUSTAIN,
      CreationTags.MATERIAL.SEMANTIC_SPIRIT,
    ]),
    weight: 65,
    energyCost: 7,
    applicableTo: ['artifact', 'gongfa'],
    effectTemplate: {
      type: 'attribute_modifier',
      params: {
        attrType: AttributeType.HEAL_AMPLIFY,
        modType: ModifierType.FIXED,
        value: { base: 0.08, scale: 'quality', coefficient: 0.015 },
      },
    },
  },
];
