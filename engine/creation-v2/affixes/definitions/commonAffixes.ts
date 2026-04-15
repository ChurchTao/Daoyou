import {
  CreationTags,
  ELEMENT_TO_RUNTIME_ABILITY_TAG,
  GameplayTags,
} from '@/engine/shared/tag-domain';
import { DamageChannel } from '@/engine/shared/tag-domain/gameplayTags';
import { ElementType } from '@/types/constants';
import { CREATION_LISTENER_PRIORITIES } from '../../config/CreationBalance';
import { ELEMENT_TO_MATERIAL_TAG } from '../../config/CreationMappings';
import { AttributeType, ModifierType } from '../../contracts/battle';
import { EXCLUSIVE_GROUP } from '../exclusiveGroups';
import { AffixDefinition, matchAll, PercentModifierMode } from '../types';

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

const buildElementPercentDamageModifierAffixes = (
  element: ElementType,
  mode: PercentModifierMode,
): AffixDefinition => ({
  id: `common-suffix-damage-${ELEMENT_TO_MATERIAL_TAG[element]}-reduce`,
  displayName: `${element}伤${mode === 'increase' ? '增幅' : '减伤'}`,
  displayDescription:
    mode === 'increase'
      ? `增加造成的${element}系伤害`
      : `减少受到的${element}系伤害`,
  category: 'suffix',
  match: matchAll([
    mode === 'increase'
      ? CreationTags.MATERIAL.SEMANTIC_BLADE
      : CreationTags.MATERIAL.SEMANTIC_GUARD,
    ELEMENT_TO_MATERIAL_TAG[element],
  ]),
  weight: 48,
  energyCost: 9,
  applicableTo: ['artifact', 'gongfa'],
  effectTemplate: {
    type: 'percent_damage_modifier',
    conditions: [
      {
        type: 'ability_has_tag',
        params: { tag: ELEMENT_TO_RUNTIME_ABILITY_TAG[element] },
      },
    ],
    params: {
      mode: 'reduce',
      value: { base: 0.05, scale: 'quality', coefficient: 0.02 },
      cap: 0.4,
    },
  },
  listenerSpec: {
    eventType: GameplayTags.EVENT.DAMAGE_REQUEST,
    scope: GameplayTags.SCOPE.OWNER_AS_TARGET,
    priority: CREATION_LISTENER_PRIORITIES.damageRequest,
  },
});

const buildDamageChannelPercentDamageModifierAffixes = (
  channel: DamageChannel,
  mode: PercentModifierMode,
): AffixDefinition => {
  const channelNameMap: Record<DamageChannel, string> = {
    [GameplayTags.ABILITY.CHANNEL.MAGIC]: '法术',
    [GameplayTags.ABILITY.CHANNEL.PHYSICAL]: '物理',
    [GameplayTags.ABILITY.CHANNEL.TRUE]: '真实',
  };
  const matchTagMap: Record<DamageChannel, string> = {
    [GameplayTags.ABILITY.CHANNEL.MAGIC]: CreationTags.MATERIAL.SEMANTIC_SPIRIT,
    [GameplayTags.ABILITY.CHANNEL.PHYSICAL]: CreationTags.MATERIAL.TYPE_ORE,
    [GameplayTags.ABILITY.CHANNEL.TRUE]: CreationTags.MATERIAL.SEMANTIC_SPACE,
  };
  const channelName = channelNameMap[channel];
  const channelNameEn = channel.split('.').slice(-1)[0].toLowerCase();

  return {
    id: `common-suffix-damage-${channelNameEn}-reduce`,
    displayName: `${channelName}伤${mode === 'increase' ? '增幅' : '减伤'}`,
    displayDescription:
      mode === 'increase'
        ? `增加造成的${channelName}系伤害`
        : `减少受到的${channelName}系伤害`,
    category: 'suffix',
    match: matchAll([
      mode === 'increase'
        ? CreationTags.MATERIAL.SEMANTIC_BLADE
        : CreationTags.MATERIAL.SEMANTIC_GUARD,
      matchTagMap[channel],
    ]),
    weight: 42,
    energyCost: 9,
    applicableTo: ['artifact', 'gongfa'],
    effectTemplate: {
      type: 'percent_damage_modifier',
      conditions: [
        {
          type: 'ability_has_tag',
          params: { tag: channel },
        },
      ],
      params: {
        mode: 'reduce',
        value: { base: 0.03, scale: 'quality', coefficient: 0.015 },
        cap: 0.4,
      },
    },
    listenerSpec: {
      eventType: GameplayTags.EVENT.DAMAGE_REQUEST,
      scope: GameplayTags.SCOPE.OWNER_AS_TARGET,
      priority: CREATION_LISTENER_PRIORITIES.damageRequest,
    },
  };
};

/**
 * 元素伤害增幅、减伤等百分比修改词缀的公共定义
 * 通过 params.mode 区分增幅和减伤，params.value 支持品质缩放
 * 适用于多个产物类型的元素伤害修改词缀，避免重复定义
 * 例如：火焰增幅、冰霜增幅、火焰减伤、冰霜减伤等都可以使用这个通用定义
 */
export const COMMON_ELEMENT_PERCENT_DAMAGE_MODIFIER_AFFIX: AffixDefinition[] = [
  buildElementPercentDamageModifierAffixes('金', 'increase'),
  buildElementPercentDamageModifierAffixes('木', 'increase'),
  buildElementPercentDamageModifierAffixes('水', 'increase'),
  buildElementPercentDamageModifierAffixes('火', 'increase'),
  buildElementPercentDamageModifierAffixes('土', 'increase'),
  buildElementPercentDamageModifierAffixes('风', 'increase'),
  buildElementPercentDamageModifierAffixes('雷', 'increase'),
  buildElementPercentDamageModifierAffixes('冰', 'increase'),
  buildElementPercentDamageModifierAffixes('金', 'reduce'),
  buildElementPercentDamageModifierAffixes('木', 'reduce'),
  buildElementPercentDamageModifierAffixes('水', 'reduce'),
  buildElementPercentDamageModifierAffixes('火', 'reduce'),
  buildElementPercentDamageModifierAffixes('土', 'reduce'),
  buildElementPercentDamageModifierAffixes('风', 'reduce'),
  buildElementPercentDamageModifierAffixes('雷', 'reduce'),
  buildElementPercentDamageModifierAffixes('冰', 'reduce'),
  buildDamageChannelPercentDamageModifierAffixes(
    GameplayTags.ABILITY.CHANNEL.MAGIC,
    'increase',
  ),
  buildDamageChannelPercentDamageModifierAffixes(
    GameplayTags.ABILITY.CHANNEL.PHYSICAL,
    'increase',
  ),
  buildDamageChannelPercentDamageModifierAffixes(
    GameplayTags.ABILITY.CHANNEL.MAGIC,
    'reduce',
  ),
  buildDamageChannelPercentDamageModifierAffixes(
    GameplayTags.ABILITY.CHANNEL.PHYSICAL,
    'reduce',
  ),
];
