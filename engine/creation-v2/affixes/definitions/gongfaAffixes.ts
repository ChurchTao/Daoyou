/*
 * gongfaAffixes: 功法词缀定义集合（大幅扩展）。
 * 功法词缀特点：
 * - 通常用于被动属性能力或战斗中触发的持续效果
 * - 包含战斗中长期增幅、触发链、以及修为相关机制
 * - 映射为AbilityConfig.modifiers或listeners
 */
import { CREATION_LISTENER_PRIORITIES } from '../../config/CreationBalance';
import { ELEMENT_TO_MATERIAL_TAG } from '../../config/CreationMappings';
import {
  CreationTags,
  ELEMENT_TO_RUNTIME_ABILITY_TAG,
  GameplayTags,
} from '@/engine/shared/tag-domain';
import { AttributeType, ModifierType, BuffType, StackRule } from '../../contracts/battle';
import { AffixDefinition, matchAll } from '../types';

function resolvePassiveGrantedAbilityTags(
  def: AffixDefinition,
): string[] | undefined {
  switch (def.effectTemplate.type) {
    case 'damage': {
      const attribute = def.effectTemplate.params.value.attribute;
      if (attribute === AttributeType.ATK) {
        return [
          GameplayTags.ABILITY.FUNCTION.DAMAGE,
          GameplayTags.ABILITY.CHANNEL.PHYSICAL,
        ];
      }

      if (
        attribute === AttributeType.MAGIC_ATK ||
        attribute === AttributeType.SPIRIT
      ) {
        return [
          GameplayTags.ABILITY.FUNCTION.DAMAGE,
          GameplayTags.ABILITY.CHANNEL.MAGIC,
        ];
      }

      return [GameplayTags.ABILITY.FUNCTION.DAMAGE];
    }

    case 'heal':
      return [GameplayTags.ABILITY.FUNCTION.HEAL];

    case 'apply_buff':
      return def.effectTemplate.params.buffConfig.type === BuffType.CONTROL
        ? [GameplayTags.ABILITY.FUNCTION.CONTROL]
        : undefined;

    case 'resource_drain':
      return def.effectTemplate.params.targetType === 'mp'
        ? [GameplayTags.TRAIT.MANA_THIEF]
        : [GameplayTags.TRAIT.LIFESTEAL];

    case 'mana_burn':
      return [GameplayTags.TRAIT.MANA_THIEF];

    case 'shield':
      return [GameplayTags.TRAIT.SHIELD_MASTER];

    case 'reflect':
      return [GameplayTags.TRAIT.REFLECT];

    default:
      return undefined;
  }
}

function attachGongfaGrantedAbilityTags(
  defs: AffixDefinition[],
): AffixDefinition[] {
  return defs.map((def) => ({
    ...def,
    ...(resolvePassiveGrantedAbilityTags(def)
      ? { grantedAbilityTags: resolvePassiveGrantedAbilityTags(def) }
      : {}),
  }));
}

const POSITIVE_BUFF_TAGS = [GameplayTags.BUFF.TYPE.BUFF];
const GENERIC_BUFF_STATUS_TAGS = [GameplayTags.STATUS.CATEGORY.BUFF];
const MYTHIC_BUFF_STATUS_TAGS = [GameplayTags.STATUS.CATEGORY.MYTHIC];

const GONGFA_PRIMARY_STAT_TIER_AFFIXES: AffixDefinition[] = [
  {
    id: 'gongfa-core-wisdom-t2',
    displayName: '玄悟明台',
    displayDescription: '玄品功法核心，悟性显著提升以强化法门理解',
    category: 'core',
    match: matchAll([
      CreationTags.MATERIAL.SEMANTIC_SPIRIT,
      CreationTags.MATERIAL.SEMANTIC_MANUAL,
      CreationTags.MATERIAL.TYPE_MANUAL,
    ]),
    exclusiveGroup: 'gongfa-core-stat',
    weight: 46,
    energyCost: 10,
    minQuality: '玄品',
    applicableTo: ['gongfa'],
    effectTemplate: {
      type: 'attribute_modifier',
      params: {
        attrType: AttributeType.WISDOM,
        modType: ModifierType.FIXED,
        value: { base: 7, scale: 'quality', coefficient: 3 },
      },
    },
  },
  {
    id: 'gongfa-core-wisdom-t3',
    displayName: '天心悟道',
    displayDescription: '真品功法核心，悟性进入高阶通明境界',
    category: 'core',
    match: matchAll([
      CreationTags.MATERIAL.SEMANTIC_SPIRIT,
      CreationTags.MATERIAL.SEMANTIC_MANUAL,
      CreationTags.MATERIAL.TYPE_SPECIAL,
    ]),
    exclusiveGroup: 'gongfa-core-stat',
    weight: 18,
    energyCost: 12,
    minQuality: '真品',
    applicableTo: ['gongfa'],
    effectTemplate: {
      type: 'attribute_modifier',
      params: {
        attrType: AttributeType.WISDOM,
        modType: ModifierType.FIXED,
        value: { base: 12, scale: 'quality', coefficient: 5 },
      },
    },
  },
  {
    id: 'gongfa-core-wisdom-t4',
    displayName: '大衍通明',
    displayDescription: '地品功法核心，悟性足以明显抬升技能质量天花板',
    category: 'core',
    match: matchAll([
      CreationTags.MATERIAL.SEMANTIC_SPIRIT,
      CreationTags.MATERIAL.SEMANTIC_MANUAL,
      CreationTags.MATERIAL.TYPE_SPECIAL,
    ]),
    exclusiveGroup: 'gongfa-core-stat',
    weight: 6,
    energyCost: 14,
    minQuality: '地品',
    applicableTo: ['gongfa'],
    effectTemplate: {
      type: 'attribute_modifier',
      params: {
        attrType: AttributeType.WISDOM,
        modType: ModifierType.FIXED,
        value: { base: 20, scale: 'quality', coefficient: 8 },
      },
    },
  },
  {
    id: 'gongfa-core-willpower-t2',
    displayName: '玄心镇岳',
    displayDescription: '玄品功法核心，意志力显著提升以稳定对抗节奏',
    category: 'core',
    match: matchAll([
      CreationTags.MATERIAL.SEMANTIC_MANUAL,
      CreationTags.MATERIAL.TYPE_MANUAL,
      CreationTags.MATERIAL.SEMANTIC_GUARD,
    ]),
    exclusiveGroup: 'gongfa-core-stat',
    weight: 44,
    energyCost: 10,
    minQuality: '玄品',
    applicableTo: ['gongfa'],
    effectTemplate: {
      type: 'attribute_modifier',
      params: {
        attrType: AttributeType.WILLPOWER,
        modType: ModifierType.FIXED,
        value: { base: 7, scale: 'quality', coefficient: 3 },
      },
    },
  },
  {
    id: 'gongfa-core-willpower-t3',
    displayName: '天命不屈',
    displayDescription: '真品功法核心，意志强度进入高阶压制区间',
    category: 'core',
    match: matchAll([
      CreationTags.MATERIAL.SEMANTIC_MANUAL,
      CreationTags.MATERIAL.SEMANTIC_GUARD,
      CreationTags.MATERIAL.TYPE_SPECIAL,
    ]),
    exclusiveGroup: 'gongfa-core-stat',
    weight: 17,
    energyCost: 12,
    minQuality: '真品',
    applicableTo: ['gongfa'],
    effectTemplate: {
      type: 'attribute_modifier',
      params: {
        attrType: AttributeType.WILLPOWER,
        modType: ModifierType.FIXED,
        value: { base: 12, scale: 'quality', coefficient: 5 },
      },
    },
  },
  {
    id: 'gongfa-core-willpower-t4',
    displayName: '万劫不移',
    displayDescription: '地品功法核心，意志属性形成显著韧性质变',
    category: 'core',
    match: matchAll([
      CreationTags.MATERIAL.SEMANTIC_MANUAL,
      CreationTags.MATERIAL.SEMANTIC_GUARD,
      CreationTags.MATERIAL.TYPE_SPECIAL,
    ]),
    exclusiveGroup: 'gongfa-core-stat',
    weight: 6,
    energyCost: 14,
    minQuality: '地品',
    applicableTo: ['gongfa'],
    effectTemplate: {
      type: 'attribute_modifier',
      params: {
        attrType: AttributeType.WILLPOWER,
        modType: ModifierType.FIXED,
        value: { base: 20, scale: 'quality', coefficient: 8 },
      },
    },
  },
  {
    id: 'gongfa-core-speed-mastery-t2',
    displayName: '御风踏影',
    displayDescription: '玄品功法核心，身法提升进入可感知机动档位',
    category: 'core',
    match: matchAll([
      CreationTags.MATERIAL.SEMANTIC_WIND,
      CreationTags.MATERIAL.SEMANTIC_BLADE,
      CreationTags.MATERIAL.TYPE_MONSTER,
    ]),
    exclusiveGroup: 'gongfa-core-stat',
    weight: 42,
    energyCost: 10,
    minQuality: '玄品',
    applicableTo: ['gongfa'],
    effectTemplate: {
      type: 'attribute_modifier',
      params: {
        attrType: AttributeType.SPEED,
        modType: ModifierType.FIXED,
        value: { base: 5, scale: 'quality', coefficient: 2 },
      },
    },
  },
  {
    id: 'gongfa-core-speed-mastery-t3',
    displayName: '天行无迹',
    displayDescription: '真品功法核心，身法提升足以明显改变出手节奏',
    category: 'core',
    match: matchAll([
      CreationTags.MATERIAL.SEMANTIC_WIND,
      CreationTags.MATERIAL.SEMANTIC_BLADE,
      CreationTags.MATERIAL.TYPE_SPECIAL,
    ]),
    exclusiveGroup: 'gongfa-core-stat',
    weight: 16,
    energyCost: 12,
    minQuality: '真品',
    applicableTo: ['gongfa'],
    effectTemplate: {
      type: 'attribute_modifier',
      params: {
        attrType: AttributeType.SPEED,
        modType: ModifierType.FIXED,
        value: { base: 8, scale: 'quality', coefficient: 3 },
      },
    },
  },
  {
    id: 'gongfa-core-speed-mastery-t4',
    displayName: '遁空绝尘',
    displayDescription: '地品功法核心，身法属性形成明显先手与节奏优势',
    category: 'core',
    match: matchAll([
      CreationTags.MATERIAL.SEMANTIC_WIND,
      CreationTags.MATERIAL.SEMANTIC_BLADE,
      CreationTags.MATERIAL.TYPE_SPECIAL,
    ]),
    exclusiveGroup: 'gongfa-core-stat',
    weight: 5,
    energyCost: 14,
    minQuality: '地品',
    applicableTo: ['gongfa'],
    effectTemplate: {
      type: 'attribute_modifier',
      params: {
        attrType: AttributeType.SPEED,
        modType: ModifierType.FIXED,
        value: { base: 13, scale: 'quality', coefficient: 5 },
      },
    },
  },
];

const GONGFA_ELEMENT_SPECIALIZATION_CONFIGS = [
  {
    id: 'gongfa-prefix-metal-specialization',
    displayName: '庚金锐意',
    displayDescription: '金系技能造成的伤害提升',
    element: '金' as const,
    semanticTag: CreationTags.MATERIAL.SEMANTIC_METAL,
    weight: 45,
  },
  {
    id: 'gongfa-prefix-wood-specialization',
    displayName: '青木生衍',
    displayDescription: '木系技能造成的伤害提升',
    element: '木' as const,
    semanticTag: CreationTags.MATERIAL.SEMANTIC_WOOD,
    weight: 45,
  },
  {
    id: 'gongfa-prefix-water-specialization',
    displayName: '玄水归流',
    displayDescription: '水系技能造成的伤害提升',
    element: '水' as const,
    semanticTag: CreationTags.MATERIAL.SEMANTIC_WATER,
    weight: 46,
  },
  {
    id: 'gongfa-prefix-fire-specialization',
    displayName: '赤炎焚脉',
    displayDescription: '火系技能造成的伤害提升',
    element: '火' as const,
    semanticTag: CreationTags.MATERIAL.SEMANTIC_FLAME,
    weight: 48,
  },
  {
    id: 'gongfa-prefix-earth-specialization',
    displayName: '厚土镇元',
    displayDescription: '土系技能造成的伤害提升',
    element: '土' as const,
    semanticTag: CreationTags.MATERIAL.SEMANTIC_EARTH,
    weight: 44,
  },
  {
    id: 'gongfa-prefix-wind-specialization',
    displayName: '岚息游龙',
    displayDescription: '风系技能造成的伤害提升',
    element: '风' as const,
    semanticTag: CreationTags.MATERIAL.SEMANTIC_WIND,
    weight: 47,
  },
  {
    id: 'gongfa-prefix-thunder-specialization',
    displayName: '惊霆裂脉',
    displayDescription: '雷系技能造成的伤害提升',
    element: '雷' as const,
    semanticTag: CreationTags.MATERIAL.SEMANTIC_THUNDER,
    weight: 47,
  },
  {
    id: 'gongfa-prefix-ice-specialization',
    displayName: '玄霜凝意',
    displayDescription: '冰系技能造成的伤害提升',
    element: '冰' as const,
    semanticTag: CreationTags.MATERIAL.SEMANTIC_FREEZE,
    weight: 46,
  },
] as const;

const GONGFA_ELEMENT_SPECIALIZATION_AFFIXES: AffixDefinition[] =
  GONGFA_ELEMENT_SPECIALIZATION_CONFIGS.map((config) => ({
    id: config.id,
    displayName: config.displayName,
    displayDescription: config.displayDescription,
    category: 'prefix',
    match: matchAll([
      config.semanticTag,
      ELEMENT_TO_MATERIAL_TAG[config.element],
      CreationTags.MATERIAL.SEMANTIC_SPIRIT,
    ]),
    weight: config.weight,
    energyCost: 7,
    applicableTo: ['gongfa'],
    effectTemplate: {
      type: 'percent_damage_modifier',
      conditions: [
        {
          type: 'ability_has_tag',
          params: { tag: ELEMENT_TO_RUNTIME_ABILITY_TAG[config.element] },
        },
      ],
      params: {
        mode: 'increase',
        value: { base: 0.1, scale: 'quality', coefficient: 0.02 },
        cap: 0.55,
      },
    },
    listenerSpec: {
      eventType: GameplayTags.EVENT.DAMAGE_REQUEST,
      scope: GameplayTags.SCOPE.OWNER_AS_CASTER,
      priority: CREATION_LISTENER_PRIORITIES.damageRequest,
    },
  }));

export const GONGFA_AFFIXES: AffixDefinition[] = attachGongfaGrantedAbilityTags([
  // ========================
  // ===== CORE 词缀 (5 种)
  // ========================
  {
    id: 'gongfa-core-spirit',
    displayName: '灵脉运转',
    displayDescription: '战斗中永久提升灵力属性',
    category: 'core',
    match: matchAll([CreationTags.MATERIAL.SEMANTIC_SPIRIT, CreationTags.MATERIAL.TYPE_HERB]),
    exclusiveGroup: 'gongfa-core-stat',
    weight: 100,
    energyCost: 8,
    applicableTo: ['gongfa'],
    effectTemplate: {
      type: 'attribute_modifier',
      params: {
        attrType: AttributeType.SPIRIT,
        modType: ModifierType.FIXED,
        value: { base: 5, scale: 'quality', coefficient: 2 },
      },
    },
  },
  {
    id: 'gongfa-core-vitality',
    displayName: '金刚体魄',
    displayDescription: '战斗中永久提升体魄属性',
    category: 'core',
    match: matchAll([CreationTags.MATERIAL.TYPE_ORE, CreationTags.MATERIAL.TYPE_HERB]),
    exclusiveGroup: 'gongfa-core-stat',
    weight: 95,
    energyCost: 8,
    applicableTo: ['gongfa'],
    effectTemplate: {
      type: 'attribute_modifier',
      params: {
        attrType: AttributeType.VITALITY,
        modType: ModifierType.FIXED,
        value: { base: 5, scale: 'quality', coefficient: 2 },
      },
    },
  },
  {
    id: 'gongfa-core-wisdom',
    displayName: '悟道明心',
    displayDescription: '战斗中永久提升悟性属性',
    category: 'core',
    match: matchAll([
      CreationTags.MATERIAL.SEMANTIC_SPIRIT,
      CreationTags.MATERIAL.SEMANTIC_MANUAL,
      CreationTags.MATERIAL.TYPE_MANUAL,
    ]),
    exclusiveGroup: 'gongfa-core-stat',
    weight: 88,
    energyCost: 8,
    applicableTo: ['gongfa'],
    effectTemplate: {
      type: 'attribute_modifier',
      params: {
        attrType: AttributeType.WISDOM,
        modType: ModifierType.FIXED,
        value: { base: 4, scale: 'quality', coefficient: 2 },
      },
    },
  },
  {
    id: 'gongfa-core-willpower',
    displayName: '心志如磐',
    displayDescription: '战斗中永久提升意志力属性',
    category: 'core',
    match: matchAll([CreationTags.MATERIAL.SEMANTIC_MANUAL, CreationTags.MATERIAL.TYPE_MANUAL]),
    exclusiveGroup: 'gongfa-core-stat',
    weight: 80,
    energyCost: 8,
    applicableTo: ['gongfa'],
    effectTemplate: {
      type: 'attribute_modifier',
      params: {
        attrType: AttributeType.WILLPOWER,
        modType: ModifierType.FIXED,
        value: { base: 4, scale: 'quality', coefficient: 2 },
      },
    },
  },
  {
    id: 'gongfa-core-speed-mastery',
    displayName: '身法精进',
    displayDescription: '战斗中永久提升身法',
    category: 'core',
    match: matchAll([CreationTags.MATERIAL.SEMANTIC_WIND, CreationTags.MATERIAL.SEMANTIC_BLADE]),
    exclusiveGroup: 'gongfa-core-stat',
    weight: 55,
    energyCost: 8,
    applicableTo: ['gongfa'],
    effectTemplate: {
      type: 'attribute_modifier',
      params: {
        attrType: AttributeType.SPEED,
        modType: ModifierType.FIXED,
        value: { base: 3, scale: 'quality', coefficient: 1.5 },
      },
    },
  },

  // ========================
  // ===== PREFIX 词缀 (11 种)
  // ========================
  {
    id: 'gongfa-prefix-crit-damage',
    displayName: '破虚一剑',
    displayDescription: '战斗中永久提升暴击伤害倍率',
    category: 'prefix',
    match: matchAll([CreationTags.MATERIAL.SEMANTIC_BLADE, CreationTags.MATERIAL.TYPE_MONSTER]),
    exclusiveGroup: 'gongfa-prefix-crit-dmg-tier',
    weight: 85,
    energyCost: 6,
    applicableTo: ['gongfa'],
    effectTemplate: {
      type: 'attribute_modifier',
      params: {
        attrType: AttributeType.CRIT_DAMAGE_MULT,
        modType: ModifierType.FIXED,
        value: { base: 0.06, scale: 'quality', coefficient: 0.02 },
      },
    },
  },
  {
    id: 'gongfa-prefix-heal-amplify',
    displayName: '生生不息',
    displayDescription: '战斗中永久提升治疗增强',
    category: 'prefix',
    match: matchAll([CreationTags.MATERIAL.SEMANTIC_SUSTAIN, CreationTags.MATERIAL.TYPE_HERB]),
    exclusiveGroup: 'gongfa-prefix-heal-tier',
    weight: 80,
    energyCost: 6,
    applicableTo: ['gongfa'],
    effectTemplate: {
      type: 'attribute_modifier',
      params: {
        attrType: AttributeType.HEAL_AMPLIFY,
        modType: ModifierType.FIXED,
        value: { base: 0.06, scale: 'quality', coefficient: 0.02 },
      },
    },
  },
  {
    id: 'gongfa-prefix-reflect-skin',
    displayName: '金蝉反震',
    displayDescription: '受创后小幅反震伤害',
    category: 'prefix',
    match: matchAll([CreationTags.MATERIAL.SEMANTIC_GUARD, CreationTags.MATERIAL.TYPE_ORE]),
    weight: 68,
    energyCost: 7,
    applicableTo: ['gongfa'],
    effectTemplate: {
      type: 'reflect',
      params: {
        ratio: { base: 0.08, scale: 'quality', coefficient: 0.02 },
      },
    },
    listenerSpec: {
      eventType: GameplayTags.EVENT.DAMAGE_TAKEN,
      scope: GameplayTags.SCOPE.OWNER_AS_TARGET,
      priority: CREATION_LISTENER_PRIORITIES.damageTaken,
      guard: {
        skipReflectSource: true,
      },
    },
  },
  {
    id: 'gongfa-prefix-magic-shield',
    displayName: '灵府护幕',
    displayDescription: '受击时以灵力抵消部分伤害',
    category: 'prefix',
    match: matchAll([CreationTags.MATERIAL.SEMANTIC_SPIRIT, CreationTags.MATERIAL.TYPE_MANUAL]),
    weight: 65,
    energyCost: 7,
    applicableTo: ['gongfa'],
    effectTemplate: {
      type: 'magic_shield',
      params: {
        absorbRatio: { base: 0.72, scale: 'quality', coefficient: 0.03 },
      },
    },
    listenerSpec: {
      eventType: GameplayTags.EVENT.DAMAGE,
      scope: GameplayTags.SCOPE.OWNER_AS_TARGET,
      priority: CREATION_LISTENER_PRIORITIES.damageApplyImmunity,
    },
  },
  {
    id: 'gongfa-prefix-evasion-master',
    displayName: '鬼魅身法',
    displayDescription: '战斗中永久提升闪避率',
    category: 'prefix',
    match: matchAll([CreationTags.MATERIAL.SEMANTIC_WIND, CreationTags.MATERIAL.SEMANTIC_BLADE]),
    weight: 62,
    energyCost: 6,
    applicableTo: ['gongfa'],
    effectTemplate: {
      type: 'attribute_modifier',
      params: {
        attrType: AttributeType.EVASION_RATE,
        modType: ModifierType.FIXED,
        value: { base: 0.04, scale: 'quality', coefficient: 0.012 },
      },
    },
  },
  {
    id: 'gongfa-prefix-mag-pene-enhance',
    displayName: '法穿神通',
    displayDescription: '战斗中永久提升法术穿透',
    category: 'prefix',
    match: matchAll([CreationTags.MATERIAL.SEMANTIC_SPIRIT, CreationTags.MATERIAL.SEMANTIC_BURST]),
    weight: 58,
    energyCost: 7,
    applicableTo: ['gongfa'],
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
    id: 'gongfa-prefix-buff-sustain',
    displayName: '状态持延',
    displayDescription: '己方buff持续时间延长',
    category: 'prefix',
    match: matchAll([CreationTags.MATERIAL.SEMANTIC_SUSTAIN, CreationTags.MATERIAL.SEMANTIC_MANUAL]),
    weight: 50,
    energyCost: 8,
    applicableTo: ['gongfa'],
    effectTemplate: {
      type: 'apply_buff',
      params: {
        buffConfig: {
          id: 'craft-buff-extend',
          name: '状态延续',
          type: BuffType.BUFF,
          duration: -1,
          stackRule: StackRule.IGNORE,
          tags: POSITIVE_BUFF_TAGS,
          statusTags: GENERIC_BUFF_STATUS_TAGS,
          listeners: [
            {
              eventType: GameplayTags.EVENT.BUFF_ADD,
              scope: GameplayTags.SCOPE.OWNER_AS_TARGET,
              priority: CREATION_LISTENER_PRIORITIES.buffIntercept,
              effects: [
                {
                  type: 'buff_duration_modify',
                  params: {
                    rounds: 1,
                    tags: [GameplayTags.BUFF.TYPE.BUFF],
                  },
                },
              ],
            },
          ],
        },
        chance: 1,
      },
    },
    listenerSpec: {
      eventType: GameplayTags.EVENT.ROUND_PRE,
      scope: GameplayTags.SCOPE.GLOBAL,
      priority: CREATION_LISTENER_PRIORITIES.roundPre,
      mapping: {
        caster: 'owner',
        target: 'owner',
      },
    },
  },
  {
    id: 'gongfa-prefix-cold-resistance',
    displayName: '冰心诀',
    displayDescription: '减少冰系技能造成的伤害',
    category: 'prefix',
    match: matchAll([CreationTags.MATERIAL.SEMANTIC_FREEZE, ELEMENT_TO_MATERIAL_TAG['冰']]),
    weight: 48,
    energyCost: 7,
    applicableTo: ['gongfa'],
    effectTemplate: {
      type: 'percent_damage_modifier',
      conditions: [
        {
          type: 'ability_has_tag',
          params: { tag: ELEMENT_TO_RUNTIME_ABILITY_TAG['冰'] },
        },
      ],
      params: {
        mode: 'reduce',
        value: { base: 0.12, scale: 'quality', coefficient: 0.025 },
        cap: 0.45,
      },
    },
    listenerSpec: {
      eventType: GameplayTags.EVENT.DAMAGE_REQUEST,
      scope: GameplayTags.SCOPE.OWNER_AS_TARGET,
      priority: CREATION_LISTENER_PRIORITIES.damageRequest,
    },
  },
  {
    id: 'gongfa-prefix-fire-resistance',
    displayName: '炎阳决',
    displayDescription: '减少火系技能造成的伤害',
    category: 'prefix',
    match: matchAll([CreationTags.MATERIAL.SEMANTIC_FLAME, ELEMENT_TO_MATERIAL_TAG['火']]),
    weight: 46,
    energyCost: 7,
    applicableTo: ['gongfa'],
    effectTemplate: {
      type: 'percent_damage_modifier',
      conditions: [
        {
          type: 'ability_has_tag',
          params: { tag: ELEMENT_TO_RUNTIME_ABILITY_TAG['火'] },
        },
      ],
      params: {
        mode: 'reduce',
        value: { base: 0.12, scale: 'quality', coefficient: 0.025 },
        cap: 0.45,
      },
    },
    listenerSpec: {
      eventType: GameplayTags.EVENT.DAMAGE_REQUEST,
      scope: GameplayTags.SCOPE.OWNER_AS_TARGET,
      priority: CREATION_LISTENER_PRIORITIES.damageRequest,
    },
  },
  {
    id: 'gongfa-prefix-thunder-resistance',
    displayName: '雷心闭合',
    displayDescription: '减少雷系技能造成的伤害',
    category: 'prefix',
    match: matchAll([CreationTags.MATERIAL.SEMANTIC_THUNDER, ELEMENT_TO_MATERIAL_TAG['雷']]),
    weight: 44,
    energyCost: 7,
    applicableTo: ['gongfa'],
    effectTemplate: {
      type: 'percent_damage_modifier',
      conditions: [
        {
          type: 'ability_has_tag',
          params: { tag: ELEMENT_TO_RUNTIME_ABILITY_TAG['雷'] },
        },
      ],
      params: {
        mode: 'reduce',
        value: { base: 0.12, scale: 'quality', coefficient: 0.025 },
        cap: 0.45,
      },
    },
    listenerSpec: {
      eventType: GameplayTags.EVENT.DAMAGE_REQUEST,
      scope: GameplayTags.SCOPE.OWNER_AS_TARGET,
      priority: CREATION_LISTENER_PRIORITIES.damageRequest,
    },
  },
  ...GONGFA_ELEMENT_SPECIALIZATION_AFFIXES,
  {
    id: 'gongfa-prefix-chill-breaker',
    displayName: '寒痕破诀',
    displayDescription: '仅在目标冰缓时触发法伤增幅',
    category: 'prefix',
    match: matchAll([
      CreationTags.MATERIAL.SEMANTIC_FREEZE,
      CreationTags.MATERIAL.SEMANTIC_BURST,
    ]),
    weight: 40,
    energyCost: 8,
    applicableTo: ['gongfa'],
    effectTemplate: {
      type: 'percent_damage_modifier',
      conditions: [
        { type: 'has_tag', params: { tag: GameplayTags.STATUS.STATE.CHILLED } },
      ],
      params: {
        mode: 'increase',
        value: { base: 0.14, scale: 'quality', coefficient: 0.03 },
        cap: 0.75,
      },
    },
    listenerSpec: {
      eventType: GameplayTags.EVENT.DAMAGE_REQUEST,
      scope: GameplayTags.SCOPE.OWNER_AS_CASTER,
      priority: CREATION_LISTENER_PRIORITIES.damageRequest,
    },
  },

  // ========================
  // ===== SUFFIX 词缀 (11 种)
  // ========================
  {
    id: 'gongfa-suffix-round-heal',
    displayName: '吐纳归元',
    displayDescription: '每回合开始时恢复气血',
    category: 'suffix',
    match: matchAll([
      CreationTags.MATERIAL.SEMANTIC_SPIRIT,
      CreationTags.MATERIAL.TYPE_HERB,
      CreationTags.MATERIAL.SEMANTIC_MANUAL,
    ]),
    exclusiveGroup: 'gongfa-suffix-round-heal-tier',
    weight: 80,
    energyCost: 8,
    applicableTo: ['gongfa'],
    effectTemplate: {
      type: 'heal',
      params: {
        value: {
          base: { base: 10, scale: 'quality', coefficient: 4 },
          attribute: AttributeType.SPIRIT,
          coefficient: 0.2,
        },
      },
    },
    listenerSpec: {
      eventType: GameplayTags.EVENT.ROUND_PRE,
      scope: GameplayTags.SCOPE.GLOBAL,
      priority: CREATION_LISTENER_PRIORITIES.roundPre,
      mapping: {
        caster: 'owner',
        target: 'owner',
      },
    },
  },
  {
    id: 'gongfa-suffix-mp-siphon',
    displayName: '归元汲气',
    displayDescription: '造成伤害后恢复灵力',
    category: 'suffix',
    match: matchAll([CreationTags.MATERIAL.SEMANTIC_SPIRIT, CreationTags.MATERIAL.SEMANTIC_BURST]),
    weight: 75,
    energyCost: 9,
    applicableTo: ['gongfa'],
    effectTemplate: {
      type: 'resource_drain',
      params: {
        sourceType: 'hp',
        targetType: 'mp',
        ratio: { base: 0.12, scale: 'quality', coefficient: 0.03 },
      },
    },
    listenerSpec: {
      eventType: GameplayTags.EVENT.DAMAGE_TAKEN,
      scope: GameplayTags.SCOPE.OWNER_AS_CASTER,
      priority: CREATION_LISTENER_PRIORITIES.damageTaken,
    },
  },
  {
    id: 'gongfa-suffix-self-haste',
    displayName: '周天回转',
    displayDescription: '施法后缩短自身其余技能冷却',
    category: 'suffix',
    match: matchAll([CreationTags.MATERIAL.SEMANTIC_MANUAL, CreationTags.MATERIAL.SEMANTIC_WIND]),
    weight: 70,
    energyCost: 9,
    applicableTo: ['gongfa'],
    effectTemplate: {
      type: 'cooldown_modify',
      params: {
        cdModifyValue: { base: -1, scale: 'quality', coefficient: -0.2 },
      },
    },
    listenerSpec: {
      eventType: GameplayTags.EVENT.SKILL_CAST,
      scope: GameplayTags.SCOPE.OWNER_AS_CASTER,
      priority: CREATION_LISTENER_PRIORITIES.skillCast,
      mapping: {
        caster: 'owner',
        target: 'owner',
      },
    },
  },
  {
    id: 'gongfa-suffix-hp-recovery',
    displayName: '生命泉眼',
    displayDescription: '每回合恢复额外气血',
    category: 'suffix',
    match: matchAll([CreationTags.MATERIAL.SEMANTIC_SUSTAIN, CreationTags.MATERIAL.TYPE_HERB]),
    weight: 68,
    energyCost: 8,
    applicableTo: ['gongfa'],
    effectTemplate: {
      type: 'heal',
      params: {
        value: {
          base: { base: 8, scale: 'quality', coefficient: 3 },
          attribute: AttributeType.VITALITY,
          coefficient: 0.15,
        },
      },
    },
    listenerSpec: {
      eventType: GameplayTags.EVENT.ROUND_PRE,
      scope: GameplayTags.SCOPE.GLOBAL,
      priority: CREATION_LISTENER_PRIORITIES.roundPre,
      mapping: {
        caster: 'owner',
        target: 'owner',
      },
    },
  },
  {
    id: 'gongfa-suffix-armor-up',
    displayName: '金刚护体',
    displayDescription: '受击时减免一部分伤害',
    category: 'suffix',
    match: matchAll([CreationTags.MATERIAL.SEMANTIC_GUARD, CreationTags.MATERIAL.TYPE_ORE]),
    weight: 65,
    energyCost: 8,
    applicableTo: ['gongfa'],
    effectTemplate: {
      type: 'percent_damage_modifier',
      params: {
        mode: 'reduce',
        value: { base: 0.1, scale: 'quality', coefficient: 0.02 },
        cap: 0.4,
      },
    },
    listenerSpec: {
      eventType: GameplayTags.EVENT.DAMAGE_REQUEST,
      scope: GameplayTags.SCOPE.OWNER_AS_TARGET,
      priority: CREATION_LISTENER_PRIORITIES.damageRequest,
    },
  },
  {
    id: 'gongfa-suffix-lifesteal-passive',
    displayName: '吸血决',
    displayDescription: '造成伤害后吸收部分气血',
    category: 'suffix',
    match: matchAll([CreationTags.MATERIAL.SEMANTIC_BURST, CreationTags.MATERIAL.SEMANTIC_SUSTAIN]),
    exclusiveGroup: 'gongfa-suffix-lifesteal-tier',
    weight: 60,
    energyCost: 9,
    applicableTo: ['gongfa'],
    effectTemplate: {
      type: 'resource_drain',
      params: {
        sourceType: 'hp',
        targetType: 'hp',
        ratio: { base: 0.08, scale: 'quality', coefficient: 0.02 },
      },
    },
    listenerSpec: {
      eventType: GameplayTags.EVENT.DAMAGE_TAKEN,
      scope: GameplayTags.SCOPE.OWNER_AS_CASTER,
      priority: CREATION_LISTENER_PRIORITIES.damageTaken,
    },
  },
  {
    id: 'gongfa-suffix-debuff-cleanse',
    displayName: '净化灵气',
    displayDescription: '每回合自动解除一层debuff',
    category: 'suffix',
    match: matchAll([CreationTags.MATERIAL.SEMANTIC_SPIRIT, CreationTags.MATERIAL.TYPE_MANUAL]),
    weight: 58,
    energyCost: 8,
    applicableTo: ['gongfa'],
    effectTemplate: {
      type: 'dispel',
      params: {
        targetTag: GameplayTags.BUFF.TYPE.DEBUFF,
        maxCount: 1,
      },
    },
    listenerSpec: {
      eventType: GameplayTags.EVENT.ROUND_PRE,
      scope: GameplayTags.SCOPE.GLOBAL,
      priority: CREATION_LISTENER_PRIORITIES.roundPre,
      mapping: {
        caster: 'owner',
        target: 'owner',
      },
    },
  },
  {
    id: 'gongfa-suffix-shield-passive',
    displayName: '护体光环',
    displayDescription: '持续维持一个护盾',
    category: 'suffix',
    match: matchAll([CreationTags.MATERIAL.SEMANTIC_GUARD, CreationTags.MATERIAL.SEMANTIC_SPIRIT]),
    weight: 55,
    energyCost: 9,
    applicableTo: ['gongfa'],
    effectTemplate: {
      type: 'shield',
      params: {
        value: {
          base: { base: 12, scale: 'quality', coefficient: 5 },
          attribute: AttributeType.SPIRIT,
          coefficient: 0.2,
        },
      },
    },
    listenerSpec: {
      eventType: GameplayTags.EVENT.ROUND_PRE,
      scope: GameplayTags.SCOPE.GLOBAL,
      priority: CREATION_LISTENER_PRIORITIES.roundPre,
      mapping: {
        caster: 'owner',
        target: 'owner',
      },
    },
  },
  {
    id: 'gongfa-suffix-execution-passive',
    displayName: '绝杀意念',
    displayDescription: '对低血量目标造成额外伤害',
    category: 'suffix',
    match: matchAll([CreationTags.MATERIAL.SEMANTIC_BURST]),
    weight: 50,
    energyCost: 10,
    applicableTo: ['gongfa'],
    effectTemplate: {
      type: 'percent_damage_modifier',
      conditions: [{ type: 'hp_below', params: { value: 0.35 } }],
      params: {
        mode: 'increase',
        value: { base: 0.15, scale: 'quality', coefficient: 0.03 },
        cap: 0.75,
      },
    },
    listenerSpec: {
      eventType: GameplayTags.EVENT.DAMAGE_REQUEST,
      scope: GameplayTags.SCOPE.OWNER_AS_CASTER,
      priority: CREATION_LISTENER_PRIORITIES.damageRequest,
    },
  },
  {
    id: 'gongfa-suffix-overflow-punish',
    displayName: '盈海断流',
    displayDescription: '仅在目标高蓝时触发蚀元压制',
    category: 'suffix',
    match: matchAll([
      CreationTags.MATERIAL.SEMANTIC_THUNDER,
      CreationTags.MATERIAL.SEMANTIC_SPIRIT,
    ]),
    weight: 39,
    energyCost: 10,
    applicableTo: ['gongfa'],
    effectTemplate: {
      type: 'mana_burn',
      conditions: [{ type: 'mp_above', params: { value: 0.7 } }],
      params: {
        value: {
          base: { base: 14, scale: 'quality', coefficient: 4 },
          attribute: AttributeType.MAGIC_ATK,
          coefficient: 0.2,
        },
      },
    },
    listenerSpec: {
      eventType: GameplayTags.EVENT.DAMAGE_TAKEN,
      scope: GameplayTags.SCOPE.OWNER_AS_CASTER,
      priority: CREATION_LISTENER_PRIORITIES.damageTaken,
    },
  },

  // ========================
  // ===== RESONANCE 词缀 (5 种)
  // ========================
  {
    id: 'gongfa-resonance-healing-loop',
    displayName: '治疗循环',
    displayDescription: '治疗效果与防御能力相互增幅',
    category: 'resonance',
    match: matchAll([CreationTags.MATERIAL.SEMANTIC_SUSTAIN, CreationTags.MATERIAL.SEMANTIC_GUARD]),
    weight: 55,
    energyCost: 11,
    applicableTo: ['gongfa'],
    effectTemplate: {
      type: 'heal',
      params: {
        value: {
          base: { base: 6, scale: 'quality', coefficient: 2 },
          attribute: AttributeType.SPIRIT,
          coefficient: 0.12,
        },
      },
    },
    listenerSpec: {
      eventType: GameplayTags.EVENT.ROUND_PRE,
      scope: GameplayTags.SCOPE.GLOBAL,
      priority: CREATION_LISTENER_PRIORITIES.roundPre,
      mapping: {
        caster: 'owner',
        target: 'owner',
      },
    },
  },
  {
    id: 'gongfa-resonance-spirit-flow',
    displayName: '灵力流动',
    displayDescription: '灵力恢复与消耗相互补衡',
    category: 'resonance',
    match: matchAll([CreationTags.MATERIAL.SEMANTIC_SPIRIT, CreationTags.MATERIAL.SEMANTIC_SUSTAIN]),
    weight: 52,
    energyCost: 11,
    applicableTo: ['gongfa'],
    effectTemplate: {
      type: 'apply_buff',
      params: {
        buffConfig: {
          id: 'craft-spirit-harmony',
          name: '灵力和谐',
          type: BuffType.BUFF,
          duration: -1,
          stackRule: StackRule.IGNORE,
          tags: POSITIVE_BUFF_TAGS,
          statusTags: GENERIC_BUFF_STATUS_TAGS,
          listeners: [
            {
              eventType: GameplayTags.EVENT.ROUND_PRE,
              scope: GameplayTags.SCOPE.GLOBAL,
              priority: CREATION_LISTENER_PRIORITIES.roundPre,
              mapping: {
                caster: 'owner',
                target: 'owner',
              },
              effects: [
                {
                  type: 'heal',
                  params: {
                    target: 'mp',
                    value: {
                      base: 10,
                      attribute: AttributeType.SPIRIT,
                      coefficient: 0.08,
                    },
                  },
                },
              ],
            },
          ],
        },
        chance: 1,
      },
    },
    listenerSpec: {
      eventType: GameplayTags.EVENT.ROUND_PRE,
      scope: GameplayTags.SCOPE.GLOBAL,
      priority: CREATION_LISTENER_PRIORITIES.roundPre,
      mapping: {
        caster: 'owner',
        target: 'owner',
      },
    },
  },
  {
    id: 'gongfa-resonance-damage-reduction',
    displayName: '伤害衰减',
    displayDescription: '多个防御机制叠加衰减伤害',
    category: 'resonance',
    match: matchAll([
      CreationTags.MATERIAL.SEMANTIC_GUARD,
      CreationTags.MATERIAL.SEMANTIC_SPIRIT,
      CreationTags.MATERIAL.SEMANTIC_SUSTAIN,
    ]),
    weight: 48,
    energyCost: 11,
    applicableTo: ['gongfa'],
    effectTemplate: {
      type: 'percent_damage_modifier',
      params: {
        mode: 'reduce',
        value: { base: 0.08, scale: 'quality', coefficient: 0.02 },
        cap: 0.5,
      },
    },
    listenerSpec: {
      eventType: GameplayTags.EVENT.DAMAGE_REQUEST,
      scope: GameplayTags.SCOPE.OWNER_AS_TARGET,
      priority: CREATION_LISTENER_PRIORITIES.damageRequest,
    },
  },
  {
    id: 'gongfa-resonance-elemental-mastery',
    displayName: '五行掌控',
    displayDescription: '元素技能造成的伤害相互强化',
    category: 'resonance',
    match: matchAll([
      CreationTags.MATERIAL.SEMANTIC_FLAME,
      CreationTags.MATERIAL.SEMANTIC_FREEZE,
      CreationTags.MATERIAL.SEMANTIC_THUNDER,
    ]),
    weight: 45,
    energyCost: 11,
    applicableTo: ['gongfa'],
    effectTemplate: {
      type: 'percent_damage_modifier',
      conditions: [
        {
          type: 'ability_has_tag',
          params: { tag: GameplayTags.ABILITY.ELEMENT.ROOT },
        },
      ],
      params: {
        mode: 'increase',
        value: { base: 0.08, scale: 'quality', coefficient: 0.02 },
        cap: 0.5,
      },
    },
    listenerSpec: {
      eventType: GameplayTags.EVENT.DAMAGE_REQUEST,
      scope: GameplayTags.SCOPE.OWNER_AS_CASTER,
      priority: CREATION_LISTENER_PRIORITIES.damageRequest,
    },
  },
  {
    id: 'gongfa-resonance-opening-zenith',
    displayName: '先机极境',
    displayDescription: '仅在目标高血时触发先手压制增伤',
    category: 'resonance',
    match: matchAll([
      CreationTags.MATERIAL.SEMANTIC_MANUAL,
      CreationTags.MATERIAL.SEMANTIC_BURST,
    ]),
    weight: 37,
    energyCost: 11,
    applicableTo: ['gongfa'],
    effectTemplate: {
      type: 'percent_damage_modifier',
      conditions: [{ type: 'hp_above', params: { value: 0.8 } }],
      params: {
        mode: 'increase',
        value: { base: 0.12, scale: 'quality', coefficient: 0.02 },
        cap: 0.6,
      },
    },
    listenerSpec: {
      eventType: GameplayTags.EVENT.DAMAGE_REQUEST,
      scope: GameplayTags.SCOPE.OWNER_AS_CASTER,
      priority: CREATION_LISTENER_PRIORITIES.damageRequest,
    },
  },

  // ========================
  // ===== SYNERGY 词缀 (5 种)
  // ========================
  {
    id: 'gongfa-synergy-perfect-balance',
    displayName: '完美平衡',
    displayDescription: '所有属性均衡提升，产生协同效应',
    category: 'synergy',
    match: matchAll([
      CreationTags.MATERIAL.SEMANTIC_SPIRIT,
      CreationTags.MATERIAL.SEMANTIC_GUARD,
      CreationTags.MATERIAL.SEMANTIC_SUSTAIN,
    ]),
    weight: 50,
    energyCost: 12,
    applicableTo: ['gongfa'],
    effectTemplate: {
      type: 'attribute_modifier',
      params: {
        attrType: AttributeType.SPIRIT,
        modType: ModifierType.ADD,
        value: { base: 0.05, scale: 'quality', coefficient: 0.01 },
      },
    },
  },
  {
    id: 'gongfa-synergy-immortal-guardian',
    displayName: '不灭守护',
    displayDescription: '治疗、防御、吸取三者相互强化',
    category: 'synergy',
    match: matchAll([
      CreationTags.MATERIAL.SEMANTIC_SUSTAIN,
      CreationTags.MATERIAL.SEMANTIC_GUARD,
      CreationTags.MATERIAL.SEMANTIC_BURST,
    ]),
    weight: 47,
    energyCost: 12,
    applicableTo: ['gongfa'],
    effectTemplate: {
      type: 'heal',
      params: {
        value: {
          base: { base: 8, scale: 'quality', coefficient: 3 },
          attribute: AttributeType.SPIRIT,
          coefficient: 0.16,
        },
      },
    },
    listenerSpec: {
      eventType: GameplayTags.EVENT.ROUND_PRE,
      scope: GameplayTags.SCOPE.GLOBAL,
      priority: CREATION_LISTENER_PRIORITIES.roundPre,
      mapping: {
        caster: 'owner',
        target: 'owner',
      },
    },
  },
  {
    id: 'gongfa-synergy-unstoppable-force',
    displayName: '浩荡之力',
    displayDescription: '攻防一体，伤害与吸取相互驱动',
    category: 'synergy',
    match: matchAll([
      CreationTags.MATERIAL.SEMANTIC_BURST,
      CreationTags.MATERIAL.SEMANTIC_GUARD,
      CreationTags.MATERIAL.SEMANTIC_BLADE,
    ]),
    weight: 44,
    energyCost: 12,
    applicableTo: ['gongfa'],
    effectTemplate: {
      type: 'percent_damage_modifier',
      params: {
        mode: 'increase',
        value: { base: 0.1, scale: 'quality', coefficient: 0.02 },
        cap: 0.6,
      },
    },
    listenerSpec: {
      eventType: GameplayTags.EVENT.DAMAGE_REQUEST,
      scope: GameplayTags.SCOPE.OWNER_AS_CASTER,
      priority: CREATION_LISTENER_PRIORITIES.damageRequest,
    },
  },
  {
    id: 'gongfa-synergy-crisis-reversal',
    displayName: '危机逆转',
    displayDescription: '仅在低血时触发的恢复与韧性强化',
    category: 'synergy',
    match: matchAll([
      CreationTags.MATERIAL.SEMANTIC_SUSTAIN,
      CreationTags.MATERIAL.SEMANTIC_GUARD,
    ]),
    weight: 40,
    energyCost: 12,
    applicableTo: ['gongfa'],
    effectTemplate: {
      type: 'heal',
      conditions: [{ type: 'hp_below', params: { value: 0.45, scope: 'caster' } }],
      params: {
        value: {
          base: { base: 10, scale: 'quality', coefficient: 3 },
          attribute: AttributeType.SPIRIT,
          coefficient: 0.18,
        },
      },
    },
    listenerSpec: {
      eventType: GameplayTags.EVENT.ROUND_PRE,
      scope: GameplayTags.SCOPE.GLOBAL,
      priority: CREATION_LISTENER_PRIORITIES.roundPre,
      mapping: {
        caster: 'owner',
        target: 'owner',
      },
    },
  },
  {
    id: 'gongfa-synergy-empty-sea-break',
    displayName: '空海折锋',
    displayDescription: '仅在目标低蓝时触发的额外伤害压制',
    category: 'synergy',
    match: matchAll([
      CreationTags.MATERIAL.SEMANTIC_THUNDER,
      CreationTags.MATERIAL.SEMANTIC_SPIRIT,
    ]),
    weight: 38,
    energyCost: 12,
    applicableTo: ['gongfa'],
    effectTemplate: {
      type: 'percent_damage_modifier',
      conditions: [{ type: 'mp_below', params: { value: 0.35 } }],
      params: {
        mode: 'increase',
        value: { base: 0.16, scale: 'quality', coefficient: 0.03 },
        cap: 0.8,
      },
    },
    listenerSpec: {
      eventType: GameplayTags.EVENT.DAMAGE_REQUEST,
      scope: GameplayTags.SCOPE.OWNER_AS_CASTER,
      priority: CREATION_LISTENER_PRIORITIES.damageRequest,
    },
  },

  // ========================
  // ===== SIGNATURE 词缀 (3 种)
  // ========================
  {
    id: 'gongfa-signature-comprehension',
    displayName: '天道感悟',
    displayDescription: '感悟天道，大幅提升悟性（百分比）',
    category: 'signature',
    match: matchAll([CreationTags.MATERIAL.SEMANTIC_MANUAL, CreationTags.MATERIAL.SEMANTIC_SPIRIT]),
    exclusiveGroup: 'gongfa-signature-ultimate',
    weight: 28,
    energyCost: 13,
    minQuality: '玄品',
    applicableTo: ['gongfa'],
    effectTemplate: {
      type: 'attribute_modifier',
      params: {
        attrType: AttributeType.WISDOM,
        modType: ModifierType.ADD,
        value: { base: 0.12, scale: 'quality', coefficient: 0.02 },
      },
    },
  },
  {
    id: 'gongfa-signature-unbound-mind',
    displayName: '万念不染',
    displayDescription: '解脱束缚，增强所有属性',
    category: 'signature',
    match: matchAll([CreationTags.MATERIAL.SEMANTIC_MANUAL, CreationTags.MATERIAL.TYPE_SPECIAL]),
    exclusiveGroup: 'gongfa-signature-ultimate',
    weight: 25,
    energyCost: 14,
    minQuality: '真品',
    applicableTo: ['gongfa'],
    effectTemplate: {
      type: 'apply_buff',
      params: {
        buffConfig: {
          id: 'craft-unbound-state',
          name: '无念境界',
          type: BuffType.BUFF,
          duration: -1,
          stackRule: StackRule.IGNORE,
          tags: POSITIVE_BUFF_TAGS,
          statusTags: MYTHIC_BUFF_STATUS_TAGS,
          modifiers: [
            {
              attrType: AttributeType.SPEED,
              type: ModifierType.ADD,
              value: 0.08,
            },
            {
              attrType: AttributeType.MAGIC_ATK,
              type: ModifierType.ADD,
              value: 0.08,
            },
          ],
        },
        chance: 1,
      },
    },
    listenerSpec: {
      eventType: GameplayTags.EVENT.ROUND_PRE,
      scope: GameplayTags.SCOPE.GLOBAL,
      priority: CREATION_LISTENER_PRIORITIES.roundPre,
      mapping: {
        caster: 'owner',
        target: 'owner',
      },
    },
  },
  {
    id: 'gongfa-signature-eternal-phoenix',
    displayName: '永恒凤凰',
    displayDescription: '战斗中不断重生与回复，越战越强',
    category: 'signature',
    match: matchAll([
      CreationTags.MATERIAL.SEMANTIC_SUSTAIN,
      CreationTags.MATERIAL.SEMANTIC_FLAME,
      CreationTags.MATERIAL.TYPE_SPECIAL,
    ]),
    exclusiveGroup: 'gongfa-signature-ultimate',
    weight: 22,
    energyCost: 15,
    minQuality: '地品',
    applicableTo: ['gongfa'],
    effectTemplate: {
      type: 'heal',
      conditions: [{ type: 'hp_below', params: { value: 0.6, scope: 'caster' } }],
      params: {
        value: {
          base: { base: 15, scale: 'quality', coefficient: 5 },
          attribute: AttributeType.SPIRIT,
          coefficient: 0.3,
        },
      },
    },
    listenerSpec: {
      eventType: GameplayTags.EVENT.ROUND_PRE,
      scope: GameplayTags.SCOPE.GLOBAL,
      priority: CREATION_LISTENER_PRIORITIES.roundPre,
      mapping: {
        caster: 'owner',
        target: 'owner',
      },
    },
  },

  // ========================
  // ===== MYTHIC 词缀 (2 种)
  // ========================
  {
    id: 'gongfa-mythic-void-aegis',
    displayName: '太虚无相',
    displayDescription: '濒危时短暂屏退万法，概率免疫法术型伤害',
    category: 'mythic',
    match: matchAll([
      CreationTags.MATERIAL.SEMANTIC_GUARD,
      CreationTags.MATERIAL.SEMANTIC_SPIRIT,
      CreationTags.MATERIAL.TYPE_SPECIAL,
    ]),
    exclusiveGroup: 'gongfa-mythic-transcendent',
    weight: 7,
    energyCost: 18,
    minQuality: '地品',
    applicableTo: ['gongfa'],
    effectTemplate: {
      type: 'damage_immunity',
      conditions: [
        { type: 'hp_below', params: { value: 0.5, scope: 'caster' } },
        { type: 'chance', params: { value: 0.45 } },
      ],
      params: {
        tags: [GameplayTags.ABILITY.CHANNEL.MAGIC],
      },
    },
    listenerSpec: {
      eventType: GameplayTags.EVENT.DAMAGE,
      scope: GameplayTags.SCOPE.OWNER_AS_TARGET,
      priority: CREATION_LISTENER_PRIORITIES.damageApplyImmunity,
    },
  },
  {
    id: 'gongfa-mythic-ascension',
    displayName: '飞升大道',
    displayDescription: '功法达到超越凡俗的境界，所有属性与效果指数增长',
    category: 'mythic',
    match: matchAll([
      CreationTags.MATERIAL.SEMANTIC_SPIRIT,
      CreationTags.MATERIAL.SEMANTIC_MANUAL,
      CreationTags.MATERIAL.TYPE_SPECIAL,
    ]),
    exclusiveGroup: 'gongfa-mythic-transcendent',
    weight: 8,
    energyCost: 18,
    minQuality: '玄品',
    applicableTo: ['gongfa'],
    effectTemplate: {
      type: 'apply_buff',
      conditions: [{ type: 'hp_above', params: { value: 0.5, scope: 'caster' } }],
      params: {
        buffConfig: {
          id: 'craft-ascension-state',
          name: '飞升大道',
          type: BuffType.BUFF,
          duration: -1,
          stackRule: StackRule.IGNORE,
          tags: POSITIVE_BUFF_TAGS,
          statusTags: MYTHIC_BUFF_STATUS_TAGS,
          modifiers: [
            {
              attrType: AttributeType.WISDOM,
              type: ModifierType.ADD,
              value: 0.15,
            },
            {
              attrType: AttributeType.SPIRIT,
              type: ModifierType.ADD,
              value: 0.12,
            },
          ],
        },
        chance: 1,
      },
    },
    listenerSpec: {
      eventType: GameplayTags.EVENT.ROUND_PRE,
      scope: GameplayTags.SCOPE.GLOBAL,
      priority: CREATION_LISTENER_PRIORITIES.roundPre,
      mapping: {
        caster: 'owner',
        target: 'owner',
      },
    },
  },
  // ========================
  // ===== 强度分层扩充 T2 / T3 / T4 + 天品仙品专属
  // ========================

  // --- 核心灵力 T2（玄品+，exclusiveGroup: gongfa-core-stat）---
  {
    id: 'gongfa-core-spirit-t2',
    displayName: '玄脉凝灵',
    displayDescription: '玄灵脉道运转，灵力大幅提升',
    category: 'core',
    match: matchAll([
      CreationTags.MATERIAL.SEMANTIC_SPIRIT,
      CreationTags.MATERIAL.TYPE_HERB,
      CreationTags.MATERIAL.SEMANTIC_MANUAL,
    ]),
    exclusiveGroup: 'gongfa-core-stat',
    weight: 52,
    energyCost: 10,
    minQuality: '玄品',
    applicableTo: ['gongfa'],
    effectTemplate: {
      type: 'attribute_modifier',
      params: {
        attrType: AttributeType.SPIRIT,
        modType: ModifierType.FIXED,
        value: { base: 8, scale: 'quality', coefficient: 3 },
      },
    },
  },

  // --- 核心灵力 T3（真品+，exclusiveGroup: gongfa-core-stat）---
  {
    id: 'gongfa-core-spirit-t3',
    displayName: '太玄灵脉极境',
    displayDescription: '真灵凝聚，灵力之境超凡脱俗',
    category: 'core',
    match: matchAll([
      CreationTags.MATERIAL.SEMANTIC_SPIRIT,
      CreationTags.MATERIAL.TYPE_SPECIAL,
    ]),
    exclusiveGroup: 'gongfa-core-stat',
    weight: 22,
    energyCost: 12,
    minQuality: '真品',
    applicableTo: ['gongfa'],
    effectTemplate: {
      type: 'attribute_modifier',
      params: {
        attrType: AttributeType.SPIRIT,
        modType: ModifierType.FIXED,
        value: { base: 13, scale: 'quality', coefficient: 5 },
      },
    },
  },

  // --- 核心灵力 T4（地品+，exclusiveGroup: gongfa-core-stat）---
  {
    id: 'gongfa-core-spirit-t4',
    displayName: '地劫灵源真体',
    displayDescription: '地阶材料炼就，灵力化为本体，触之冥化万灵',
    category: 'core',
    match: matchAll([
      CreationTags.MATERIAL.SEMANTIC_SPIRIT,
      CreationTags.MATERIAL.TYPE_SPECIAL,
    ]),
    exclusiveGroup: 'gongfa-core-stat',
    weight: 7,
    energyCost: 14,
    minQuality: '地品',
    applicableTo: ['gongfa'],
    effectTemplate: {
      type: 'attribute_modifier',
      params: {
        attrType: AttributeType.SPIRIT,
        modType: ModifierType.FIXED,
        value: { base: 21, scale: 'quality', coefficient: 8 },
      },
    },
  },

  // --- 核心体魄 T2（玄品+，exclusiveGroup: gongfa-core-stat）---
  {
    id: 'gongfa-core-vitality-t2',
    displayName: '玄铁金刚体',
    displayDescription: '玄铁淬炼，体魄大幅强化',
    category: 'core',
    match: matchAll([
      CreationTags.MATERIAL.TYPE_ORE,
      CreationTags.MATERIAL.TYPE_HERB,
      CreationTags.MATERIAL.SEMANTIC_GUARD,
    ]),
    exclusiveGroup: 'gongfa-core-stat',
    weight: 48,
    energyCost: 10,
    minQuality: '玄品',
    applicableTo: ['gongfa'],
    effectTemplate: {
      type: 'attribute_modifier',
      params: {
        attrType: AttributeType.VITALITY,
        modType: ModifierType.FIXED,
        value: { base: 8, scale: 'quality', coefficient: 3 },
      },
    },
  },

  // --- 核心体魄 T3（真品+，exclusiveGroup: gongfa-core-stat）---
  {
    id: 'gongfa-core-vitality-t3',
    displayName: '万古金刚不坏神功',
    displayDescription: '真品铸就不坏之躯，体魄强健令寻常伤害毫无用处',
    category: 'core',
    match: matchAll([
      CreationTags.MATERIAL.TYPE_ORE,
      CreationTags.MATERIAL.SEMANTIC_GUARD,
      CreationTags.MATERIAL.TYPE_SPECIAL,
    ]),
    exclusiveGroup: 'gongfa-core-stat',
    weight: 20,
    energyCost: 12,
    minQuality: '真品',
    applicableTo: ['gongfa'],
    effectTemplate: {
      type: 'attribute_modifier',
      params: {
        attrType: AttributeType.VITALITY,
        modType: ModifierType.FIXED,
        value: { base: 13, scale: 'quality', coefficient: 5 },
      },
    },
  },
  ...GONGFA_PRIMARY_STAT_TIER_AFFIXES,

  // --- 前缀暴击伤害 T2（玄品+，exclusiveGroup: gongfa-prefix-crit-dmg-tier）---
  {
    id: 'gongfa-prefix-crit-damage-t2',
    displayName: '玄空极刺',
    displayDescription: '玄空合一，每次暴击威力倍增',
    category: 'prefix',
    match: matchAll([
      CreationTags.MATERIAL.SEMANTIC_BLADE,
      CreationTags.MATERIAL.TYPE_MONSTER,
      CreationTags.MATERIAL.SEMANTIC_BURST,
    ]),
    exclusiveGroup: 'gongfa-prefix-crit-dmg-tier',
    weight: 50,
    energyCost: 8,
    minQuality: '玄品',
    applicableTo: ['gongfa'],
    effectTemplate: {
      type: 'attribute_modifier',
      params: {
        attrType: AttributeType.CRIT_DAMAGE_MULT,
        modType: ModifierType.FIXED,
        value: { base: 0.10, scale: 'quality', coefficient: 0.03 },
      },
    },
  },

  // --- 前缀暴击伤害 T3（真品+，exclusiveGroup: gongfa-prefix-crit-dmg-tier）---
  {
    id: 'gongfa-prefix-crit-damage-t3',
    displayName: '天裂一击',
    displayDescription: '真灵暴击无双，每次暴击都能造成灭天之力',
    category: 'prefix',
    match: matchAll([
      CreationTags.MATERIAL.SEMANTIC_BLADE,
      CreationTags.MATERIAL.TYPE_SPECIAL,
    ]),
    exclusiveGroup: 'gongfa-prefix-crit-dmg-tier',
    weight: 18,
    energyCost: 10,
    minQuality: '真品',
    applicableTo: ['gongfa'],
    effectTemplate: {
      type: 'attribute_modifier',
      params: {
        attrType: AttributeType.CRIT_DAMAGE_MULT,
        modType: ModifierType.FIXED,
        value: { base: 0.16, scale: 'quality', coefficient: 0.05 },
      },
    },
  },

  // --- 前缀治疗增幅 T2（玄品+，exclusiveGroup: gongfa-prefix-heal-tier）---
  {
    id: 'gongfa-prefix-heal-amplify-t2',
    displayName: '玄灵再生',
    displayDescription: '玄级治疗增幅，术法治疗效果倍增',
    category: 'prefix',
    match: matchAll([
      CreationTags.MATERIAL.SEMANTIC_SUSTAIN,
      CreationTags.MATERIAL.TYPE_HERB,
      CreationTags.MATERIAL.SEMANTIC_SPIRIT,
    ]),
    exclusiveGroup: 'gongfa-prefix-heal-tier',
    weight: 46,
    energyCost: 8,
    minQuality: '玄品',
    applicableTo: ['gongfa'],
    effectTemplate: {
      type: 'attribute_modifier',
      params: {
        attrType: AttributeType.HEAL_AMPLIFY,
        modType: ModifierType.FIXED,
        value: { base: 0.10, scale: 'quality', coefficient: 0.03 },
      },
    },
  },

  // --- 前缀治疗增幅 T3（真品+，exclusiveGroup: gongfa-prefix-heal-tier）---
  {
    id: 'gongfa-prefix-heal-amplify-t3',
    displayName: '渡厄春暖',
    displayDescription: '真灵春泽，治疗效果突破极限，令重伤迅速痊愈',
    category: 'prefix',
    match: matchAll([
      CreationTags.MATERIAL.SEMANTIC_SUSTAIN,
      CreationTags.MATERIAL.TYPE_SPECIAL,
    ]),
    exclusiveGroup: 'gongfa-prefix-heal-tier',
    weight: 17,
    energyCost: 10,
    minQuality: '真品',
    applicableTo: ['gongfa'],
    effectTemplate: {
      type: 'attribute_modifier',
      params: {
        attrType: AttributeType.HEAL_AMPLIFY,
        modType: ModifierType.FIXED,
        value: { base: 0.16, scale: 'quality', coefficient: 0.05 },
      },
    },
  },

  // --- 后缀每回合回血 T2（玄品+，exclusiveGroup: gongfa-suffix-round-heal-tier）---
  {
    id: 'gongfa-suffix-round-heal-t2',
    displayName: '玄气吐纳',
    displayDescription: '玄级吐纳功法，每回合大量恢复气血',
    category: 'suffix',
    match: matchAll([
      CreationTags.MATERIAL.SEMANTIC_SPIRIT,
      CreationTags.MATERIAL.TYPE_HERB,
      CreationTags.MATERIAL.SEMANTIC_SUSTAIN,
    ]),
    exclusiveGroup: 'gongfa-suffix-round-heal-tier',
    weight: 44,
    energyCost: 10,
    minQuality: '玄品',
    applicableTo: ['gongfa'],
    effectTemplate: {
      type: 'heal',
      params: {
        value: {
          base: { base: 16, scale: 'quality', coefficient: 6 },
          attribute: AttributeType.SPIRIT,
          coefficient: 0.30,
        },
      },
    },
    listenerSpec: {
      eventType: GameplayTags.EVENT.ROUND_PRE,
      scope: GameplayTags.SCOPE.GLOBAL,
      priority: CREATION_LISTENER_PRIORITIES.roundPre,
      mapping: {
        caster: 'owner',
        target: 'owner',
      },
    },
  },

  // --- 后缀每回合回血 T3（真品+，exclusiveGroup: gongfa-suffix-round-heal-tier）---
  {
    id: 'gongfa-suffix-round-heal-t3',
    displayName: '元气周天归一',
    displayDescription: '真灵周天圆融，每回合气血大量恢复，几近不死',
    category: 'suffix',
    match: matchAll([
      CreationTags.MATERIAL.SEMANTIC_SPIRIT,
      CreationTags.MATERIAL.SEMANTIC_SUSTAIN,
      CreationTags.MATERIAL.TYPE_SPECIAL,
    ]),
    exclusiveGroup: 'gongfa-suffix-round-heal-tier',
    weight: 15,
    energyCost: 12,
    minQuality: '真品',
    applicableTo: ['gongfa'],
    effectTemplate: {
      type: 'heal',
      params: {
        value: {
          base: { base: 25, scale: 'quality', coefficient: 9 },
          attribute: AttributeType.SPIRIT,
          coefficient: 0.45,
        },
      },
    },
    listenerSpec: {
      eventType: GameplayTags.EVENT.ROUND_PRE,
      scope: GameplayTags.SCOPE.GLOBAL,
      priority: CREATION_LISTENER_PRIORITIES.roundPre,
      mapping: {
        caster: 'owner',
        target: 'owner',
      },
    },
  },

  // --- 后缀吸血 T2（玄品+，exclusiveGroup: gongfa-suffix-lifesteal-tier）---
  {
    id: 'gongfa-suffix-lifesteal-t2',
    displayName: '玄吸决',
    displayDescription: '玄级吸血功法，造成伤害后大量回复气血',
    category: 'suffix',
    match: matchAll([
      CreationTags.MATERIAL.SEMANTIC_BURST,
      CreationTags.MATERIAL.SEMANTIC_SUSTAIN,
      CreationTags.MATERIAL.TYPE_MONSTER,
    ]),
    exclusiveGroup: 'gongfa-suffix-lifesteal-tier',
    weight: 40,
    energyCost: 11,
    minQuality: '玄品',
    applicableTo: ['gongfa'],
    effectTemplate: {
      type: 'resource_drain',
      params: {
        sourceType: 'hp',
        targetType: 'hp',
        ratio: { base: 0.15, scale: 'quality', coefficient: 0.03 },
      },
    },
    listenerSpec: {
      eventType: GameplayTags.EVENT.DAMAGE_TAKEN,
      scope: GameplayTags.SCOPE.OWNER_AS_CASTER,
      priority: CREATION_LISTENER_PRIORITIES.damageTaken,
    },
  },

  // --- 后缀吸血 T3（真品+，exclusiveGroup: gongfa-suffix-lifesteal-tier）---
  {
    id: 'gongfa-suffix-lifesteal-t3',
    displayName: '天噬归元神功',
    displayDescription: '真灵汲取，造成伤害时回复大量气血，战场上几乎无法耗尽',
    category: 'suffix',
    match: matchAll([
      CreationTags.MATERIAL.SEMANTIC_BURST,
      CreationTags.MATERIAL.SEMANTIC_SUSTAIN,
      CreationTags.MATERIAL.TYPE_SPECIAL,
    ]),
    exclusiveGroup: 'gongfa-suffix-lifesteal-tier',
    weight: 15,
    energyCost: 13,
    minQuality: '真品',
    applicableTo: ['gongfa'],
    effectTemplate: {
      type: 'resource_drain',
      params: {
        sourceType: 'hp',
        targetType: 'hp',
        ratio: { base: 0.24, scale: 'quality', coefficient: 0.04 },
      },
    },
    listenerSpec: {
      eventType: GameplayTags.EVENT.DAMAGE_TAKEN,
      scope: GameplayTags.SCOPE.OWNER_AS_CASTER,
      priority: CREATION_LISTENER_PRIORITIES.damageTaken,
    },
  },

  // --- 天品专属：天道不死神功（天品+）---
  {
    id: 'gongfa-heaven-immortal-body',
    displayName: '天道不死神功',
    displayDescription: '天品功法，每回合恢复大量气血',
    category: 'signature',
    match: matchAll([
      CreationTags.MATERIAL.SEMANTIC_GUARD,
      CreationTags.MATERIAL.SEMANTIC_SUSTAIN,
      CreationTags.MATERIAL.TYPE_SPECIAL,
    ]),
    exclusiveGroup: 'gongfa-heaven-tier',
    weight: 3,
    energyCost: 15,
    minQuality: '天品',
    applicableTo: ['gongfa'],
    effectTemplate: {
      type: 'heal',
      params: {
        value: {
          base: { base: 30, scale: 'quality', coefficient: 12 },
          attribute: AttributeType.VITALITY,
          coefficient: 0.50,
        },
      },
    },
    listenerSpec: {
      eventType: GameplayTags.EVENT.ROUND_PRE,
      scope: GameplayTags.SCOPE.GLOBAL,
      priority: CREATION_LISTENER_PRIORITIES.roundPre,
      mapping: {
        caster: 'owner',
        target: 'owner',
      },
    },
  },

  // --- 天品专属：万法归一（天品+，感悟叠加增幅）---
  {
    id: 'gongfa-heaven-myriad-laws',
    displayName: '万法归一',
    displayDescription: '天品功法，每次命中积累领悟层数，持续强化全属性',
    category: 'mythic',
    match: matchAll([
      CreationTags.MATERIAL.SEMANTIC_MANUAL,
      CreationTags.MATERIAL.SEMANTIC_SPIRIT,
      CreationTags.MATERIAL.TYPE_SPECIAL,
    ]),
    exclusiveGroup: 'gongfa-heaven-tier',
    weight: 2,
    energyCost: 16,
    minQuality: '天品',
    applicableTo: ['gongfa'],
    effectTemplate: {
      type: 'apply_buff',
      params: {
        buffConfig: {
          id: 'craft-myriad-laws',
          name: '万法感悟',
          type: BuffType.BUFF,
          duration: -1,
          stackRule: StackRule.STACK_LAYER,
          tags: POSITIVE_BUFF_TAGS,
          statusTags: GENERIC_BUFF_STATUS_TAGS,
          modifiers: [
            { attrType: AttributeType.MAGIC_ATK, type: ModifierType.ADD, value: 0.10 },
            { attrType: AttributeType.ATK, type: ModifierType.ADD, value: 0.10 },
            { attrType: AttributeType.DEF, type: ModifierType.ADD, value: 0.08 },
          ],
        },
        chance: { base: 0.60, scale: 'quality', coefficient: 0.06 },
      },
    },
    listenerSpec: {
      eventType: GameplayTags.EVENT.DAMAGE_TAKEN,
      scope: GameplayTags.SCOPE.OWNER_AS_CASTER,
      priority: CREATION_LISTENER_PRIORITIES.damageTaken,
    },
  },

  // --- 仙品专属：大道无极功（仙品+）---
  {
    id: 'gongfa-immortal-great-dao',
    displayName: '大道无极功',
    displayDescription: '仙品至高功法，战斗中灵力全属性大幅提升',
    category: 'mythic',
    match: matchAll([
      CreationTags.MATERIAL.SEMANTIC_DIVINE,
      CreationTags.MATERIAL.SEMANTIC_SPIRIT,
      CreationTags.MATERIAL.TYPE_SPECIAL,
    ]),
    exclusiveGroup: 'gongfa-immortal-tier',
    weight: 1,
    energyCost: 18,
    minQuality: '仙品',
    applicableTo: ['gongfa'],
    effectTemplate: {
      type: 'attribute_modifier',
      params: {
        attrType: AttributeType.SPIRIT,
        modType: ModifierType.ADD,
        value: { base: 0.50, scale: 'quality', coefficient: 0.06 },
      },
    },
  },
  // --- 核心体魄 T4（地品+，exclusiveGroup: gongfa-core-stat）---
  {
    id: 'gongfa-core-vitality-t4',
    displayName: '地劫金刚极境',
    displayDescription: '地阶材料淬炼，体魄化为金刚，寻常伤害形同虚设',
    category: 'core',
    match: matchAll([
      CreationTags.MATERIAL.TYPE_ORE,
      CreationTags.MATERIAL.SEMANTIC_GUARD,
      CreationTags.MATERIAL.TYPE_SPECIAL,
    ]),
    exclusiveGroup: 'gongfa-core-stat',
    weight: 7,
    energyCost: 14,
    minQuality: '地品',
    applicableTo: ['gongfa'],
    effectTemplate: {
      type: 'attribute_modifier',
      params: {
        attrType: AttributeType.VITALITY,
        modType: ModifierType.FIXED,
        value: { base: 21, scale: 'quality', coefficient: 8 },
      },
    },
  },

  // --- 前缀暴击伤害 T4（地品+，exclusiveGroup: gongfa-prefix-crit-dmg-tier）---
  {
    id: 'gongfa-prefix-crit-damage-t4',
    displayName: '灭世一击',
    displayDescription: '地阶必杀极意，暴击如同天地崩裂，敌无幸免',
    category: 'prefix',
    match: matchAll([
      CreationTags.MATERIAL.SEMANTIC_BLADE,
      CreationTags.MATERIAL.TYPE_SPECIAL,
    ]),
    exclusiveGroup: 'gongfa-prefix-crit-dmg-tier',
    weight: 4,
    energyCost: 12,
    minQuality: '地品',
    applicableTo: ['gongfa'],
    effectTemplate: {
      type: 'attribute_modifier',
      params: {
        attrType: AttributeType.CRIT_DAMAGE_MULT,
        modType: ModifierType.FIXED,
        value: { base: 0.26, scale: 'quality', coefficient: 0.07 },
      },
    },
  },

  // --- 前缀治疗增幅 T4（地品+，exclusiveGroup: gongfa-prefix-heal-tier）---
  {
    id: 'gongfa-prefix-heal-amplify-t4',
    displayName: '天道慈悲',
    displayDescription: '地阶慈悲大法，治疗效果极境，伤势几乎无法影响持有者',
    category: 'prefix',
    match: matchAll([
      CreationTags.MATERIAL.SEMANTIC_SUSTAIN,
      CreationTags.MATERIAL.TYPE_SPECIAL,
    ]),
    exclusiveGroup: 'gongfa-prefix-heal-tier',
    weight: 4,
    energyCost: 12,
    minQuality: '地品',
    applicableTo: ['gongfa'],
    effectTemplate: {
      type: 'attribute_modifier',
      params: {
        attrType: AttributeType.HEAL_AMPLIFY,
        modType: ModifierType.FIXED,
        value: { base: 0.26, scale: 'quality', coefficient: 0.07 },
      },
    },
  },

  // --- 后缀每回合回血 T4（地品+，exclusiveGroup: gongfa-suffix-round-heal-tier）---
  {
    id: 'gongfa-suffix-round-heal-t4',
    displayName: '不死神功·完',
    displayDescription: '地阶不死神功，每回合恢复气血量令对手绝望',
    category: 'suffix',
    match: matchAll([
      CreationTags.MATERIAL.SEMANTIC_SPIRIT,
      CreationTags.MATERIAL.SEMANTIC_SUSTAIN,
      CreationTags.MATERIAL.TYPE_SPECIAL,
    ]),
    exclusiveGroup: 'gongfa-suffix-round-heal-tier',
    weight: 4,
    energyCost: 14,
    minQuality: '地品',
    applicableTo: ['gongfa'],
    effectTemplate: {
      type: 'heal',
      params: {
        value: {
          base: { base: 38, scale: 'quality', coefficient: 14 },
          attribute: AttributeType.SPIRIT,
          coefficient: 0.65,
        },
      },
    },
    listenerSpec: {
      eventType: GameplayTags.EVENT.ROUND_PRE,
      scope: GameplayTags.SCOPE.GLOBAL,
      priority: CREATION_LISTENER_PRIORITIES.roundPre,
      mapping: {
        caster: 'owner',
        target: 'owner',
      },
    },
  },

  // --- 后缀吸血 T4（地品+，exclusiveGroup: gongfa-suffix-lifesteal-tier）---
  {
    id: 'gongfa-suffix-lifesteal-t4',
    displayName: '乾坤汲源',
    displayDescription: '地阶乾坤之力，每次出手吸取目标大量气血，令对手精力耗竭',
    category: 'suffix',
    match: matchAll([
      CreationTags.MATERIAL.SEMANTIC_BURST,
      CreationTags.MATERIAL.SEMANTIC_SUSTAIN,
      CreationTags.MATERIAL.TYPE_SPECIAL,
    ]),
    exclusiveGroup: 'gongfa-suffix-lifesteal-tier',
    weight: 4,
    energyCost: 15,
    minQuality: '地品',
    applicableTo: ['gongfa'],
    effectTemplate: {
      type: 'resource_drain',
      params: {
        sourceType: 'hp',
        targetType: 'hp',
        ratio: { base: 0.38, scale: 'quality', coefficient: 0.06 },
      },
    },
    listenerSpec: {
      eventType: GameplayTags.EVENT.DAMAGE_TAKEN,
      scope: GameplayTags.SCOPE.OWNER_AS_CASTER,
      priority: CREATION_LISTENER_PRIORITIES.damageTaken,
    },
  },
]);
