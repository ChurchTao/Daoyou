/*
 * 灵能消耗平衡规则 (Energy Cost Balance Rule - V2):
 * 1. 核心池 (Core/Panel): 8 ~ 15 点。作为基础底盘，保证产物基本强度。
 * 2. 变体池 (Variant/School/Defense): 12 ~ 20 点。主要能量吸收点，定义流派特色。
 * 3. 稀有池 (Rare/Secret/Treasure): 35 ~ 55 点。顶级消耗项，吸收神品材料溢出能量，产出质变效果。
 *
 * PBU 换算逻辑：PBU = (∑词缀消耗 * 类别系数 * 效率加成) * 品质乘数 + 极品奖励。
 */
import { DamageType } from '@shared/engine/battle-v5/core/types';
import {
  CreationTags,
  ELEMENT_TO_RUNTIME_ABILITY_TAG,
  GameplayTags,
} from '@shared/engine/shared/tag-domain';
import { CREATION_LISTENER_PRIORITIES } from '../../config/CreationBalance';
import { ELEMENT_TO_MATERIAL_TAG } from '../../config/CreationMappings';
import {
  AttributeType,
  BuffType,
  ModifierType,
  StackRule,
} from '../../contracts/battle';
import { EXCLUSIVE_GROUP } from '../exclusiveGroups';
import { AffixDefinition } from '../types';
import { qualityScaledCoefficient } from './utils';

export const GONGFA_AFFIXES: AffixDefinition[] = [
  // ================================================================
  // ===== GONGFA_FOUNDATION 池 (14 种) — 百分比根骨属性 + 通用规则
  // ================================================================

  // --- 10 种百分比属性 ---
  {
    id: 'gongfa-foundation-spirit',
    displayName: '灵力充沛',
    displayDescription: '功脉生息，提升灵力属性，使体内灵力更为充沛',
    slot: 'core',
    rarity: 'common',
    match: {
      all: [CreationTags.MATERIAL.SEMANTIC_SPIRIT],
      any: [
        CreationTags.MATERIAL.SEMANTIC_QI,
        CreationTags.MATERIAL.TYPE_MANUAL,
      ],
    },
    exclusiveGroup: EXCLUSIVE_GROUP.GONGFA.FOUNDATION_STAT,
    weight: 100,
    energyCost: 10,
    applicableTo: ['gongfa'],
    effectTemplate: {
      type: 'attribute_modifier',
      params: {
        attrType: AttributeType.SPIRIT,
        modType: ModifierType.ADD,
        value: { base: 0.02, scale: 'quality', coefficient: 0.02 },
      },
    },
  },
  {
    id: 'gongfa-foundation-vitality',
    displayName: '强壮',
    displayDescription: '大脉强劲，提升气血属性，使肉身体魄更为强壮',
    slot: 'core',
    rarity: 'common',
    match: {
      all: [CreationTags.MATERIAL.SEMANTIC_SUSTAIN],
      any: [
        CreationTags.MATERIAL.SEMANTIC_BLOOD,
        CreationTags.MATERIAL.SEMANTIC_LIFE,
        CreationTags.MATERIAL.TYPE_MANUAL,
      ],
    },
    exclusiveGroup: EXCLUSIVE_GROUP.GONGFA.FOUNDATION_STAT,
    weight: 95,
    energyCost: 10,
    applicableTo: ['gongfa'],
    effectTemplate: {
      type: 'attribute_modifier',
      params: {
        attrType: AttributeType.VITALITY,
        modType: ModifierType.ADD,
        value: { base: 0.02, scale: 'quality', coefficient: 0.02 },
      },
    },
  },
  {
    id: 'gongfa-foundation-wisdom',
    displayName: '慧根',
    displayDescription: '心眼通明，提升悟性属性，使修行感悟更加敏锐',
    slot: 'core',
    rarity: 'common',
    match: {
      all: [CreationTags.MATERIAL.SEMANTIC_MANUAL],
      any: [
        CreationTags.MATERIAL.SEMANTIC_SPIRIT,
        CreationTags.MATERIAL.SEMANTIC_DIVINE,
      ],
    },
    exclusiveGroup: EXCLUSIVE_GROUP.GONGFA.FOUNDATION_STAT,
    weight: 80,
    energyCost: 10,
    applicableTo: ['gongfa'],
    effectTemplate: {
      type: 'attribute_modifier',
      params: {
        attrType: AttributeType.WISDOM,
        modType: ModifierType.ADD,
        value: { base: 0.02, scale: 'quality', coefficient: 0.02 },
      },
    },
  },
  {
    id: 'gongfa-foundation-willpower',
    displayName: '固神',
    displayDescription: '识海如固，提升意志属性，使神识更为稳固',
    slot: 'core',
    rarity: 'common',
    match: {
      all: [CreationTags.MATERIAL.SEMANTIC_GUARD],
      any: [
        CreationTags.MATERIAL.SEMANTIC_SPIRIT,
        CreationTags.MATERIAL.SEMANTIC_EARTH,
        CreationTags.MATERIAL.SEMANTIC_DIVINE,
      ],
    },
    exclusiveGroup: EXCLUSIVE_GROUP.GONGFA.FOUNDATION_STAT,
    weight: 70,
    energyCost: 10,
    applicableTo: ['gongfa'],
    effectTemplate: {
      type: 'attribute_modifier',
      params: {
        attrType: AttributeType.WILLPOWER,
        modType: ModifierType.ADD,
        value: { base: 0.02, scale: 'quality', coefficient: 0.02 },
      },
    },
  },
  {
    id: 'gongfa-foundation-speed',
    displayName: '御风',
    displayDescription: '步踏罡斗，提升速度属性，使身法运转更为迅捷',
    slot: 'core',
    rarity: 'common',
    match: {
      all: [CreationTags.MATERIAL.SEMANTIC_WIND],
      any: [
        CreationTags.MATERIAL.SEMANTIC_SPACE,
        CreationTags.MATERIAL.SEMANTIC_ILLUSION,
      ],
    },
    exclusiveGroup: EXCLUSIVE_GROUP.GONGFA.FOUNDATION_STAT,
    weight: 75,
    energyCost: 10,
    applicableTo: ['gongfa'],
    effectTemplate: {
      type: 'attribute_modifier',
      params: {
        attrType: AttributeType.SPEED,
        modType: ModifierType.ADD,
        value: { base: 0.02, scale: 'quality', coefficient: 0.02 },
      },
    },
  },
  {
    id: 'gongfa-foundation-atk',
    displayName: '根骨',
    displayDescription: '淬炼筋骨，提升攻击属性，增强物理杀伤',
    slot: 'core',
    rarity: 'common',
    match: {
      all: [CreationTags.MATERIAL.SEMANTIC_BLADE],
      any: [
        CreationTags.MATERIAL.SEMANTIC_METAL,
        CreationTags.MATERIAL.SEMANTIC_BEAST,
        CreationTags.MATERIAL.SEMANTIC_BURST,
      ],
    },
    exclusiveGroup: EXCLUSIVE_GROUP.GONGFA.FOUNDATION_STAT,
    weight: 90,
    energyCost: 10,
    applicableTo: ['gongfa'],
    effectTemplate: {
      type: 'attribute_modifier',
      params: {
        attrType: AttributeType.ATK,
        modType: ModifierType.ADD,
        value: { base: 0.02, scale: 'quality', coefficient: 0.02 },
      },
    },
  },
  {
    id: 'gongfa-foundation-magic-atk',
    displayName: '通明',
    displayDescription: '通明达微，提升法术攻击属性，增强术法威能',
    slot: 'core',
    rarity: 'common',
    match: {
      all: [CreationTags.MATERIAL.SEMANTIC_SPIRIT],
      any: [
        CreationTags.MATERIAL.SEMANTIC_BURST,
        CreationTags.MATERIAL.SEMANTIC_QI,
        CreationTags.MATERIAL.SEMANTIC_FLAME,
      ],
    },
    exclusiveGroup: EXCLUSIVE_GROUP.GONGFA.FOUNDATION_STAT,
    weight: 90,
    energyCost: 10,
    applicableTo: ['gongfa'],
    effectTemplate: {
      type: 'attribute_modifier',
      params: {
        attrType: AttributeType.MAGIC_ATK,
        modType: ModifierType.ADD,
        value: { base: 0.02, scale: 'quality', coefficient: 0.02 },
      },
    },
  },
  {
    id: 'gongfa-foundation-def',
    displayName: '厚重',
    displayDescription: '搬山卸岭，提升防御属性，使肉身更加厚重坚实',
    slot: 'core',
    rarity: 'common',
    match: {
      all: [CreationTags.MATERIAL.SEMANTIC_GUARD],
      any: [
        CreationTags.MATERIAL.SEMANTIC_METAL,
        CreationTags.MATERIAL.SEMANTIC_EARTH,
        CreationTags.MATERIAL.TYPE_ORE,
      ],
    },
    exclusiveGroup: EXCLUSIVE_GROUP.GONGFA.FOUNDATION_STAT,
    weight: 60,
    energyCost: 10,
    applicableTo: ['gongfa'],
    effectTemplate: {
      type: 'attribute_modifier',
      params: {
        attrType: AttributeType.DEF,
        modType: ModifierType.ADD,
        value: { base: 0.02, scale: 'quality', coefficient: 0.02 },
      },
    },
  },
  {
    id: 'gongfa-foundation-magic-def',
    displayName: '凝神',
    displayDescription: '凝神聚气，提升法术防御属性，强化护体灵障',
    slot: 'core',
    rarity: 'common',
    match: {
      all: [CreationTags.MATERIAL.SEMANTIC_GUARD],
      any: [
        CreationTags.MATERIAL.SEMANTIC_SPIRIT,
        CreationTags.MATERIAL.SEMANTIC_WATER,
        CreationTags.MATERIAL.SEMANTIC_DIVINE,
      ],
    },
    exclusiveGroup: EXCLUSIVE_GROUP.GONGFA.FOUNDATION_STAT,
    weight: 55,
    energyCost: 10,
    applicableTo: ['gongfa'],
    effectTemplate: {
      type: 'attribute_modifier',
      params: {
        attrType: AttributeType.MAGIC_DEF,
        modType: ModifierType.ADD,
        value: { base: 0.02, scale: 'quality', coefficient: 0.02 },
      },
    },
  },
  {
    id: 'gongfa-foundation-max-hp',
    displayName: '养元',
    displayDescription: '血海绵长，提升最大气血，使续战根基更为深厚',
    slot: 'core',
    rarity: 'common',
    match: {
      all: [CreationTags.MATERIAL.SEMANTIC_SUSTAIN],
      any: [
        CreationTags.MATERIAL.SEMANTIC_BLOOD,
        CreationTags.MATERIAL.SEMANTIC_LIFE,
        CreationTags.MATERIAL.TYPE_MANUAL,
      ],
    },
    exclusiveGroup: EXCLUSIVE_GROUP.GONGFA.FOUNDATION_STAT,
    weight: 85,
    energyCost: 10,
    applicableTo: ['gongfa'],
    effectTemplate: {
      type: 'attribute_modifier',
      params: {
        attrType: AttributeType.MAX_HP,
        modType: ModifierType.ADD,
        value: { base: 0.02, scale: 'quality', coefficient: 0.02 },
      },
    },
  },
  {
    id: 'gongfa-foundation-max-mp',
    displayName: '聚炁',
    displayDescription: '气府深藏，提升最大法力，使灵力储备更为充盈',
    slot: 'core',
    rarity: 'common',
    match: {
      all: [CreationTags.MATERIAL.SEMANTIC_SPIRIT],
      any: [
        CreationTags.MATERIAL.SEMANTIC_QI,
        CreationTags.MATERIAL.SEMANTIC_WATER,
        CreationTags.MATERIAL.TYPE_MANUAL,
      ],
    },
    exclusiveGroup: EXCLUSIVE_GROUP.GONGFA.FOUNDATION_STAT,
    weight: 80,
    energyCost: 10,
    applicableTo: ['gongfa'],
    effectTemplate: {
      type: 'attribute_modifier',
      params: {
        attrType: AttributeType.MAX_MP,
        modType: ModifierType.ADD,
        value: { base: 0.02, scale: 'quality', coefficient: 0.02 },
      },
    },
  },
  {
    id: 'gongfa-foundation-heal-amplify',
    displayName: '生息',
    displayDescription: '长青无极，提升治疗加成，使疗伤手段更为有效',
    slot: 'core',
    rarity: 'common',
    match: {
      all: [CreationTags.MATERIAL.SEMANTIC_SUSTAIN],
      any: [
        CreationTags.MATERIAL.SEMANTIC_SPIRIT,
        CreationTags.MATERIAL.SEMANTIC_LIFE,
        CreationTags.MATERIAL.TYPE_HERB,
      ],
    },
    exclusiveGroup: EXCLUSIVE_GROUP.GONGFA.FOUNDATION_STAT,
    weight: 50,
    energyCost: 10,
    applicableTo: ['gongfa'],
    effectTemplate: {
      type: 'attribute_modifier',
      params: {
        attrType: AttributeType.HEAL_AMPLIFY,
        modType: ModifierType.ADD,
        value: { base: 0.02, scale: 'quality', coefficient: 0.02 },
      },
    },
  },

  // --- 控制命中 ---
  {
    id: 'gongfa-foundation-control-hit',
    displayName: '锁魂',
    displayDescription: '天威如网，提升控制命中，使控制类效果更易生效',
    slot: 'core',
    rarity: 'uncommon',
    match: {
      any: [
        CreationTags.MATERIAL.SEMANTIC_THUNDER,
        CreationTags.MATERIAL.SEMANTIC_ILLUSION,
        CreationTags.MATERIAL.SEMANTIC_FREEZE,
        CreationTags.MATERIAL.SEMANTIC_DIVINE,
      ],
    },
    exclusiveGroup: EXCLUSIVE_GROUP.GONGFA.FOUNDATION_STAT,
    weight: 45,
    energyCost: 10,
    applicableTo: ['gongfa'],
    effectTemplate: {
      type: 'attribute_modifier',
      params: {
        attrType: AttributeType.CONTROL_HIT,
        modType: ModifierType.ADD,
        value: { base: 0.02, scale: 'quality', coefficient: 0.02 },
      },
    },
  },

  // --- 控制抗性 ---
  {
    id: 'gongfa-foundation-control-resistance',
    displayName: '镇厄',
    displayDescription: '镇压万邪，提升控制抗性，使自身更不易受控',
    slot: 'core',
    rarity: 'uncommon',
    match: {
      all: [CreationTags.MATERIAL.SEMANTIC_GUARD],
      any: [
        CreationTags.MATERIAL.SEMANTIC_EARTH,
        CreationTags.MATERIAL.SEMANTIC_SPIRIT,
        CreationTags.MATERIAL.SEMANTIC_DIVINE,
      ],
    },
    exclusiveGroup: EXCLUSIVE_GROUP.GONGFA.FOUNDATION_STAT,
    weight: 40,
    energyCost: 10,
    applicableTo: ['gongfa'],
    effectTemplate: {
      type: 'attribute_modifier',
      params: {
        attrType: AttributeType.CONTROL_RESISTANCE,
        modType: ModifierType.ADD,
        value: { base: 0.02, scale: 'quality', coefficient: 0.02 },
      },
    },
  },

  // --- 通用增伤 ---
  {
    id: 'gongfa-foundation-damage-increase',
    displayName: '狂歌',
    displayDescription: '道蕴不羁，直接提升造成的伤害',
    slot: 'core',
    rarity: 'rare',
    match: {
      all: [CreationTags.MATERIAL.SEMANTIC_BURST],
      any: [
        CreationTags.MATERIAL.SEMANTIC_BLADE,
        CreationTags.MATERIAL.SEMANTIC_METAL,
        CreationTags.MATERIAL.SEMANTIC_BEAST,
      ],
    },
    exclusiveGroup: EXCLUSIVE_GROUP.GONGFA.FOUNDATION_DAMAGE_MOD,
    weight: 33,
    energyCost: 33,
    applicableTo: ['gongfa'],
    effectTemplate: {
      type: 'percent_damage_modifier',
      params: {
        mode: 'increase',
        value: { base: 0.02, scale: 'quality', coefficient: 0.01 },
        cap: 0.5,
      },
    },
    listenerSpec: {
      eventType: GameplayTags.EVENT.DAMAGE_REQUEST,
      scope: GameplayTags.SCOPE.OWNER_AS_CASTER,
      priority: CREATION_LISTENER_PRIORITIES.damageRequest,
    },
  },

  // ================================================================
  // ===== GONGFA_SCHOOL 池 (16 种) — 定义"这套到底怎么玩"
  // ================================================================

  // --- 8 种元素专精 ---
  {
    id: 'gongfa-school-fire-spec',
    displayName: '火行真解',
    displayDescription: '通晓真火大道，提升火系技能造成的伤害',
    slot: 'identity',
    rarity: 'uncommon',
    match: {
      all: [ELEMENT_TO_MATERIAL_TAG['火']],
      any: [
        CreationTags.MATERIAL.SEMANTIC_FLAME,
        CreationTags.MATERIAL.SEMANTIC_BURST,
        CreationTags.MATERIAL.SEMANTIC_BLADE,
      ],
    },
    exclusiveGroup: EXCLUSIVE_GROUP.GONGFA.PRIMARY_SCHOOL,
    selectionMeta: {
      gongfa: { role: 'primary', archetype: 'fire', element: '火' },
    },
    weight: 75,
    energyCost: 16,
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
        mode: 'increase',
        value: { base: 0.02, scale: 'quality', coefficient: 0.01 },
        cap: 0.8,
      },
    },
    listenerSpec: {
      eventType: GameplayTags.EVENT.DAMAGE_REQUEST,
      scope: GameplayTags.SCOPE.OWNER_AS_CASTER,
      priority: CREATION_LISTENER_PRIORITIES.damageRequest,
    },
  },
  {
    id: 'gongfa-school-ice-spec',
    displayName: '寒魄真解',
    displayDescription: '凝绝幽寒，提升冰系技能造成的伤害',
    slot: 'identity',
    rarity: 'uncommon',
    match: {
      all: [ELEMENT_TO_MATERIAL_TAG['冰']],
      any: [
        CreationTags.MATERIAL.SEMANTIC_FREEZE,
        CreationTags.MATERIAL.SEMANTIC_BURST,
        CreationTags.MATERIAL.SEMANTIC_BLADE,
      ],
    },
    exclusiveGroup: EXCLUSIVE_GROUP.GONGFA.PRIMARY_SCHOOL,
    selectionMeta: {
      gongfa: { role: 'primary', archetype: 'ice', element: '冰' },
    },
    weight: 72,
    energyCost: 16,
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
        mode: 'increase',
        value: { base: 0.02, scale: 'quality', coefficient: 0.01 },
        cap: 0.8,
      },
    },
    listenerSpec: {
      eventType: GameplayTags.EVENT.DAMAGE_REQUEST,
      scope: GameplayTags.SCOPE.OWNER_AS_CASTER,
      priority: CREATION_LISTENER_PRIORITIES.damageRequest,
    },
  },
  {
    id: 'gongfa-school-thunder-spec',
    displayName: '惊雷真解',
    displayDescription: '参透雷霆幻变之机，提升雷系技能造成的伤害',
    slot: 'identity',
    rarity: 'uncommon',
    match: {
      all: [ELEMENT_TO_MATERIAL_TAG['雷']],
      any: [
        CreationTags.MATERIAL.SEMANTIC_THUNDER,
        CreationTags.MATERIAL.SEMANTIC_BURST,
        CreationTags.MATERIAL.SEMANTIC_BLADE,
      ],
    },
    exclusiveGroup: EXCLUSIVE_GROUP.GONGFA.PRIMARY_SCHOOL,
    selectionMeta: {
      gongfa: { role: 'primary', archetype: 'thunder', element: '雷' },
    },
    weight: 70,
    energyCost: 16,
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
        mode: 'increase',
        value: { base: 0.02, scale: 'quality', coefficient: 0.01 },
        cap: 0.8,
      },
    },
    listenerSpec: {
      eventType: GameplayTags.EVENT.DAMAGE_REQUEST,
      scope: GameplayTags.SCOPE.OWNER_AS_CASTER,
      priority: CREATION_LISTENER_PRIORITIES.damageRequest,
    },
  },
  {
    id: 'gongfa-school-wind-spec',
    displayName: '风行真解',
    displayDescription: '明谙风行之道，提升风系技能造成的伤害',
    slot: 'identity',
    rarity: 'uncommon',
    match: {
      all: [ELEMENT_TO_MATERIAL_TAG['风']],
      any: [
        CreationTags.MATERIAL.SEMANTIC_WIND,
        CreationTags.MATERIAL.SEMANTIC_BURST,
        CreationTags.MATERIAL.SEMANTIC_BLADE,
      ],
    },
    exclusiveGroup: EXCLUSIVE_GROUP.GONGFA.PRIMARY_SCHOOL,
    selectionMeta: {
      gongfa: { role: 'primary', archetype: 'wind', element: '风' },
    },
    weight: 68,
    energyCost: 16,
    applicableTo: ['gongfa'],
    effectTemplate: {
      type: 'percent_damage_modifier',
      conditions: [
        {
          type: 'ability_has_tag',
          params: { tag: ELEMENT_TO_RUNTIME_ABILITY_TAG['风'] },
        },
      ],
      params: {
        mode: 'increase',
        value: { base: 0.02, scale: 'quality', coefficient: 0.01 },
        cap: 0.8,
      },
    },
    listenerSpec: {
      eventType: GameplayTags.EVENT.DAMAGE_REQUEST,
      scope: GameplayTags.SCOPE.OWNER_AS_CASTER,
      priority: CREATION_LISTENER_PRIORITIES.damageRequest,
    },
  },
  {
    id: 'gongfa-school-metal-spec',
    displayName: '金行真解',
    displayDescription: '金修内蕴之法，提升金系技能造成的伤害',
    slot: 'identity',
    rarity: 'uncommon',
    match: {
      all: [ELEMENT_TO_MATERIAL_TAG['金']],
      any: [
        CreationTags.MATERIAL.SEMANTIC_METAL,
        CreationTags.MATERIAL.SEMANTIC_BLADE,
        CreationTags.MATERIAL.SEMANTIC_BURST,
      ],
    },
    exclusiveGroup: EXCLUSIVE_GROUP.GONGFA.PRIMARY_SCHOOL,
    selectionMeta: {
      gongfa: { role: 'primary', archetype: 'metal', element: '金' },
    },
    weight: 65,
    energyCost: 16,
    applicableTo: ['gongfa'],
    effectTemplate: {
      type: 'percent_damage_modifier',
      conditions: [
        {
          type: 'ability_has_tag',
          params: { tag: ELEMENT_TO_RUNTIME_ABILITY_TAG['金'] },
        },
      ],
      params: {
        mode: 'increase',
        value: { base: 0.02, scale: 'quality', coefficient: 0.01 },
        cap: 0.8,
      },
    },
    listenerSpec: {
      eventType: GameplayTags.EVENT.DAMAGE_REQUEST,
      scope: GameplayTags.SCOPE.OWNER_AS_CASTER,
      priority: CREATION_LISTENER_PRIORITIES.damageRequest,
    },
  },
  {
    id: 'gongfa-school-water-spec',
    displayName: '水行真解',
    displayDescription: '通悉若水无定之形，提升水系技能造成的伤害',
    slot: 'identity',
    rarity: 'uncommon',
    match: {
      all: [ELEMENT_TO_MATERIAL_TAG['水']],
      any: [
        CreationTags.MATERIAL.SEMANTIC_WATER,
        CreationTags.MATERIAL.SEMANTIC_SPIRIT,
        CreationTags.MATERIAL.SEMANTIC_BURST,
      ],
    },
    exclusiveGroup: EXCLUSIVE_GROUP.GONGFA.PRIMARY_SCHOOL,
    selectionMeta: {
      gongfa: { role: 'primary', archetype: 'water', element: '水' },
    },
    weight: 63,
    energyCost: 16,
    applicableTo: ['gongfa'],
    effectTemplate: {
      type: 'percent_damage_modifier',
      conditions: [
        {
          type: 'ability_has_tag',
          params: { tag: ELEMENT_TO_RUNTIME_ABILITY_TAG['水'] },
        },
      ],
      params: {
        mode: 'increase',
        value: { base: 0.02, scale: 'quality', coefficient: 0.01 },
        cap: 0.8,
      },
    },
    listenerSpec: {
      eventType: GameplayTags.EVENT.DAMAGE_REQUEST,
      scope: GameplayTags.SCOPE.OWNER_AS_CASTER,
      priority: CREATION_LISTENER_PRIORITIES.damageRequest,
    },
  },
  {
    id: 'gongfa-school-wood-spec',
    displayName: '青木真解',
    displayDescription: '融生克于一体，提升木系技能造成的伤害',
    slot: 'identity',
    rarity: 'uncommon',
    match: {
      all: [ELEMENT_TO_MATERIAL_TAG['木']],
      any: [
        CreationTags.MATERIAL.SEMANTIC_WOOD,
        CreationTags.MATERIAL.SEMANTIC_LIFE,
        CreationTags.MATERIAL.SEMANTIC_SUSTAIN,
      ],
    },
    exclusiveGroup: EXCLUSIVE_GROUP.GONGFA.PRIMARY_SCHOOL,
    selectionMeta: {
      gongfa: { role: 'primary', archetype: 'wood', element: '木' },
    },
    weight: 60,
    energyCost: 16,
    applicableTo: ['gongfa'],
    effectTemplate: {
      type: 'percent_damage_modifier',
      conditions: [
        {
          type: 'ability_has_tag',
          params: { tag: ELEMENT_TO_RUNTIME_ABILITY_TAG['木'] },
        },
      ],
      params: {
        mode: 'increase',
        value: { base: 0.02, scale: 'quality', coefficient: 0.01 },
        cap: 0.8,
      },
    },
    listenerSpec: {
      eventType: GameplayTags.EVENT.DAMAGE_REQUEST,
      scope: GameplayTags.SCOPE.OWNER_AS_CASTER,
      priority: CREATION_LISTENER_PRIORITIES.damageRequest,
    },
  },
  {
    id: 'gongfa-school-earth-spec',
    displayName: '厚土真解',
    displayDescription: '立足浩荡地脉，提升土系技能造成的伤害',
    slot: 'identity',
    rarity: 'uncommon',
    match: {
      all: [ELEMENT_TO_MATERIAL_TAG['土']],
      any: [
        CreationTags.MATERIAL.SEMANTIC_EARTH,
        CreationTags.MATERIAL.SEMANTIC_GUARD,
        CreationTags.MATERIAL.SEMANTIC_BURST,
      ],
    },
    exclusiveGroup: EXCLUSIVE_GROUP.GONGFA.PRIMARY_SCHOOL,
    selectionMeta: {
      gongfa: { role: 'primary', archetype: 'earth', element: '土' },
    },
    weight: 58,
    energyCost: 16,
    applicableTo: ['gongfa'],
    effectTemplate: {
      type: 'percent_damage_modifier',
      conditions: [
        {
          type: 'ability_has_tag',
          params: { tag: ELEMENT_TO_RUNTIME_ABILITY_TAG['土'] },
        },
      ],
      params: {
        mode: 'increase',
        value: { base: 0.02, scale: 'quality', coefficient: 0.01 },
        cap: 0.8,
      },
    },
    listenerSpec: {
      eventType: GameplayTags.EVENT.DAMAGE_REQUEST,
      scope: GameplayTags.SCOPE.OWNER_AS_CASTER,
      priority: CREATION_LISTENER_PRIORITIES.damageRequest,
    },
  },

  // --- 多元素主修：材料呈现三系以上均衡时，替代多重单元素专精 ---
  {
    id: 'gongfa-school-five-phase-flow',
    displayName: '五行流转',
    displayDescription: '诸行轮转不息，提升造成的伤害，但单系锋芒不及专修',
    slot: 'identity',
    rarity: 'uncommon',
    match: {
      any: [
        ELEMENT_TO_MATERIAL_TAG['金'],
        ELEMENT_TO_MATERIAL_TAG['木'],
        ELEMENT_TO_MATERIAL_TAG['水'],
        ELEMENT_TO_MATERIAL_TAG['火'],
        ELEMENT_TO_MATERIAL_TAG['土'],
        ELEMENT_TO_MATERIAL_TAG['风'],
        ELEMENT_TO_MATERIAL_TAG['雷'],
        ELEMENT_TO_MATERIAL_TAG['冰'],
      ],
    },
    exclusiveGroup: EXCLUSIVE_GROUP.GONGFA.PRIMARY_SCHOOL,
    selectionMeta: {
      gongfa: { role: 'primary', archetype: 'mixed-elements' },
    },
    weight: 42,
    energyCost: 18,
    applicableTo: ['gongfa'],
    effectTemplate: {
      type: 'percent_damage_modifier',
      params: {
        mode: 'increase',
        value: { base: 0.015, scale: 'quality', coefficient: 0.008 },
        cap: 0.45,
      },
    },
    listenerSpec: {
      eventType: GameplayTags.EVENT.DAMAGE_REQUEST,
      scope: GameplayTags.SCOPE.OWNER_AS_CASTER,
      priority: CREATION_LISTENER_PRIORITIES.damageRequest,
    },
  },

  // --- 双元素共鸣：作为主修支脉，而不是第二个完整元素专精 ---
  {
    id: 'gongfa-school-ice-thunder-resonance',
    displayName: '冰雷共鸣',
    displayDescription: '寒霆相激，雷系技能攻击受控目标时伤害提升',
    slot: 'resonance',
    rarity: 'rare',
    match: {
      all: [ELEMENT_TO_MATERIAL_TAG['冰'], ELEMENT_TO_MATERIAL_TAG['雷']],
      any: [
        CreationTags.MATERIAL.SEMANTIC_FREEZE,
        CreationTags.MATERIAL.SEMANTIC_THUNDER,
      ],
    },
    selectionMeta: {
      gongfa: {
        role: 'resonance',
        archetype: 'ice-thunder',
        resonanceElements: ['冰', '雷'],
      },
    },
    weight: 24,
    energyCost: 18,
    applicableTo: ['gongfa'],
    effectTemplate: {
      type: 'percent_damage_modifier',
      conditions: [
        {
          type: 'ability_has_tag',
          params: { tag: ELEMENT_TO_RUNTIME_ABILITY_TAG['雷'] },
        },
        {
          type: 'has_tag',
          params: { tag: GameplayTags.STATUS.CONTROL.ROOT },
        },
      ],
      params: {
        mode: 'increase',
        value: { base: 0.04, scale: 'quality', coefficient: 0.015 },
        cap: 0.45,
      },
    },
    listenerSpec: {
      eventType: GameplayTags.EVENT.DAMAGE_REQUEST,
      scope: GameplayTags.SCOPE.OWNER_AS_CASTER,
      priority: CREATION_LISTENER_PRIORITIES.damageRequest,
    },
  },
  {
    id: 'gongfa-school-wind-fire-resonance',
    displayName: '风火相生',
    displayDescription: '风助火势，自身气血充盈时火系技能伤害提升',
    slot: 'resonance',
    rarity: 'rare',
    match: {
      all: [ELEMENT_TO_MATERIAL_TAG['风'], ELEMENT_TO_MATERIAL_TAG['火']],
      any: [
        CreationTags.MATERIAL.SEMANTIC_WIND,
        CreationTags.MATERIAL.SEMANTIC_FLAME,
        CreationTags.MATERIAL.SEMANTIC_BURST,
      ],
    },
    selectionMeta: {
      gongfa: {
        role: 'resonance',
        archetype: 'wind-fire',
        resonanceElements: ['风', '火'],
      },
    },
    weight: 24,
    energyCost: 18,
    applicableTo: ['gongfa'],
    effectTemplate: {
      type: 'percent_damage_modifier',
      conditions: [
        {
          type: 'ability_has_tag',
          params: { tag: ELEMENT_TO_RUNTIME_ABILITY_TAG['火'] },
        },
        { type: 'hp_above', params: { value: 0.8, scope: 'caster' } },
      ],
      params: {
        mode: 'increase',
        value: { base: 0.035, scale: 'quality', coefficient: 0.015 },
        cap: 0.45,
      },
    },
    listenerSpec: {
      eventType: GameplayTags.EVENT.DAMAGE_REQUEST,
      scope: GameplayTags.SCOPE.OWNER_AS_CASTER,
      priority: CREATION_LISTENER_PRIORITIES.damageRequest,
    },
  },
  {
    id: 'gongfa-school-metal-fire-resonance',
    displayName: '金火锻锋',
    displayDescription: '烈火锻金，金系技能暴击时伤害提升',
    slot: 'resonance',
    rarity: 'rare',
    match: {
      all: [ELEMENT_TO_MATERIAL_TAG['金'], ELEMENT_TO_MATERIAL_TAG['火']],
      any: [
        CreationTags.MATERIAL.SEMANTIC_METAL,
        CreationTags.MATERIAL.SEMANTIC_FLAME,
        CreationTags.MATERIAL.SEMANTIC_BLADE,
      ],
    },
    selectionMeta: {
      gongfa: {
        role: 'resonance',
        archetype: 'metal-fire',
        resonanceElements: ['金', '火'],
      },
    },
    weight: 22,
    energyCost: 18,
    applicableTo: ['gongfa'],
    effectTemplate: {
      type: 'percent_damage_modifier',
      conditions: [
        {
          type: 'ability_has_tag',
          params: { tag: ELEMENT_TO_RUNTIME_ABILITY_TAG['金'] },
        },
        { type: 'is_critical', params: {} },
      ],
      params: {
        mode: 'increase',
        value: { base: 0.04, scale: 'quality', coefficient: 0.015 },
        cap: 0.45,
      },
    },
    listenerSpec: {
      eventType: GameplayTags.EVENT.DAMAGE_REQUEST,
      scope: GameplayTags.SCOPE.OWNER_AS_CASTER,
      priority: CREATION_LISTENER_PRIORITIES.damageRequest,
    },
  },
  {
    id: 'gongfa-school-water-wood-resonance',
    displayName: '水木生息',
    displayDescription: '水养青木，自身拥有护盾时木系技能伤害提升',
    slot: 'resonance',
    rarity: 'rare',
    match: {
      all: [ELEMENT_TO_MATERIAL_TAG['水'], ELEMENT_TO_MATERIAL_TAG['木']],
      any: [
        CreationTags.MATERIAL.SEMANTIC_WATER,
        CreationTags.MATERIAL.SEMANTIC_WOOD,
        CreationTags.MATERIAL.SEMANTIC_LIFE,
      ],
    },
    selectionMeta: {
      gongfa: {
        role: 'resonance',
        archetype: 'water-wood',
        resonanceElements: ['水', '木'],
      },
    },
    weight: 22,
    energyCost: 18,
    applicableTo: ['gongfa'],
    effectTemplate: {
      type: 'percent_damage_modifier',
      conditions: [
        {
          type: 'ability_has_tag',
          params: { tag: ELEMENT_TO_RUNTIME_ABILITY_TAG['木'] },
        },
        { type: 'has_shield', params: { scope: 'caster' } },
      ],
      params: {
        mode: 'increase',
        value: { base: 0.035, scale: 'quality', coefficient: 0.015 },
        cap: 0.45,
      },
    },
    listenerSpec: {
      eventType: GameplayTags.EVENT.DAMAGE_REQUEST,
      scope: GameplayTags.SCOPE.OWNER_AS_CASTER,
      priority: CREATION_LISTENER_PRIORITIES.damageRequest,
    },
  },

  // --- 暴击回蓝 ---
  {
    id: 'gongfa-school-crit-mana',
    displayName: '涌潮',
    displayDescription: '灵力如潮，暴击时回复灵力',
    slot: 'modifier',
    rarity: 'uncommon',
    match: {
      all: [CreationTags.MATERIAL.SEMANTIC_BURST],
      any: [
        CreationTags.MATERIAL.SEMANTIC_SPIRIT,
        CreationTags.MATERIAL.SEMANTIC_QI,
        CreationTags.MATERIAL.SEMANTIC_THUNDER,
      ],
    },
    selectionMeta: {
      gongfa: { role: 'support', archetype: 'crit-mana' },
    },
    weight: 50,
    energyCost: 12,
    applicableTo: ['gongfa'],
    grantedAbilityTags: [GameplayTags.ABILITY.FUNCTION.HEAL],
    effectTemplate: {
      type: 'heal',
      conditions: [{ type: 'is_critical', params: {} }],
      params: {
        target: 'mp',
        value: {
          attribute: AttributeType.SPIRIT,
          coefficient: qualityScaledCoefficient(0.08),
        },
      },
    },
    listenerSpec: {
      eventType: GameplayTags.EVENT.DAMAGE_REQUEST,
      scope: GameplayTags.SCOPE.OWNER_AS_CASTER,
      priority: CREATION_LISTENER_PRIORITIES.damageRequest + 1,
    },
  },

  // --- 低蓝增伤 ---
  {
    id: 'gongfa-school-low-mp-boost',
    displayName: '破釜',
    displayDescription: '燃灵破釜，自身灵力低于 30% 时造成的伤害提升',
    slot: 'modifier',
    rarity: 'uncommon',
    match: {
      all: [CreationTags.MATERIAL.SEMANTIC_BURST],
      any: [
        CreationTags.MATERIAL.SEMANTIC_SPIRIT,
        CreationTags.MATERIAL.SEMANTIC_QI,
        CreationTags.MATERIAL.TYPE_MANUAL,
      ],
    },
    selectionMeta: {
      gongfa: { role: 'support', archetype: 'low-mp-burst' },
    },
    weight: 42,
    energyCost: 12,
    applicableTo: ['gongfa'],
    effectTemplate: {
      type: 'percent_damage_modifier',
      conditions: [
        { type: 'mp_below', params: { value: 0.3, scope: 'caster' } },
      ],
      params: {
        mode: 'increase',
        value: { base: 0.06, scale: 'quality', coefficient: 0.02 },
        cap: 0.8,
      },
    },
    listenerSpec: {
      eventType: GameplayTags.EVENT.DAMAGE_REQUEST,
      scope: GameplayTags.SCOPE.OWNER_AS_CASTER,
      priority: CREATION_LISTENER_PRIORITIES.damageRequest,
    },
  },

  // --- 首回合强化 ---
  {
    id: 'gongfa-school-first-round-boost',
    displayName: '傲气',
    displayDescription: '气脉全盛，自身气血高于 95% 时造成的伤害提升',
    slot: 'modifier',
    rarity: 'uncommon',
    match: {
      all: [CreationTags.MATERIAL.SEMANTIC_WIND],
      any: [
        CreationTags.MATERIAL.SEMANTIC_BURST,
        CreationTags.MATERIAL.SEMANTIC_BLADE,
        CreationTags.MATERIAL.SEMANTIC_THUNDER,
      ],
    },
    selectionMeta: {
      gongfa: { role: 'support', archetype: 'opening-burst' },
    },
    weight: 38,
    energyCost: 16,
    applicableTo: ['gongfa'],
    effectTemplate: {
      type: 'percent_damage_modifier',
      conditions: [
        { type: 'hp_above', params: { value: 0.95, scope: 'caster' } },
      ],
      params: {
        mode: 'increase',
        value: { base: 0.1, scale: 'quality', coefficient: 0.03 },
        cap: 1.0,
      },
    },
    listenerSpec: {
      eventType: GameplayTags.EVENT.DAMAGE_REQUEST,
      scope: GameplayTags.SCOPE.OWNER_AS_CASTER,
      priority: CREATION_LISTENER_PRIORITIES.damageRequest,
    },
  },

  // --- 低血强化 ---
  {
    id: 'gongfa-school-low-hp-boost',
    displayName: '死战',
    displayDescription: '退无可退，自身气血低于 30% 时造成的伤害提升',
    slot: 'modifier',
    rarity: 'uncommon',
    match: {
      all: [CreationTags.MATERIAL.SEMANTIC_BLADE],
      any: [
        CreationTags.MATERIAL.SEMANTIC_BLOOD,
        CreationTags.MATERIAL.SEMANTIC_BURST,
        CreationTags.MATERIAL.SEMANTIC_BEAST,
      ],
    },
    selectionMeta: {
      gongfa: { role: 'support', archetype: 'low-hp-burst' },
    },
    weight: 40,
    energyCost: 16,
    applicableTo: ['gongfa'],
    effectTemplate: {
      type: 'percent_damage_modifier',
      conditions: [
        { type: 'hp_below', params: { value: 0.3, scope: 'caster' } },
      ],
      params: {
        mode: 'increase',
        value: { base: 0.08, scale: 'quality', coefficient: 0.02 },
      },
    },
    listenerSpec: {
      eventType: GameplayTags.EVENT.DAMAGE_REQUEST,
      scope: GameplayTags.SCOPE.OWNER_AS_CASTER,
      priority: CREATION_LISTENER_PRIORITIES.damageRequest,
    },
  },

  // --- 护盾存在时强化 ---
  {
    id: 'gongfa-school-shielded-boost',
    displayName: '胆小鬼',
    displayDescription: '借护身灵罩为依托，自身拥有护盾时造成的伤害提升',
    slot: 'modifier',
    rarity: 'uncommon',
    match: {
      all: [CreationTags.MATERIAL.SEMANTIC_GUARD],
      any: [
        CreationTags.MATERIAL.SEMANTIC_BURST,
        CreationTags.MATERIAL.SEMANTIC_METAL,
        CreationTags.MATERIAL.SEMANTIC_BLADE,
      ],
    },
    selectionMeta: {
      gongfa: { role: 'support', archetype: 'shielded-burst' },
    },
    weight: 35,
    energyCost: 16,
    applicableTo: ['gongfa'],
    effectTemplate: {
      type: 'percent_damage_modifier',
      conditions: [
        {
          type: 'has_shield',
          params: { scope: 'caster' },
        },
      ],
      params: {
        mode: 'increase',
        value: { base: 0.06, scale: 'quality', coefficient: 0.02 },
        cap: 0.6,
      },
    },
    listenerSpec: {
      eventType: GameplayTags.EVENT.DAMAGE_REQUEST,
      scope: GameplayTags.SCOPE.OWNER_AS_CASTER,
      priority: CREATION_LISTENER_PRIORITIES.damageRequest,
    },
  },

  // --- 减益伤害加深 ---
  {
    id: 'gongfa-school-debuff-extend',
    displayName: '趁他病要他命',
    displayDescription: '痛打落水之狗，对带有减益状态的目标造成更高伤害',
    slot: 'modifier',
    rarity: 'rare',
    match: {
      all: [CreationTags.MATERIAL.SEMANTIC_POISON],
      any: [
        CreationTags.MATERIAL.SEMANTIC_MANUAL,
        CreationTags.MATERIAL.SEMANTIC_BLOOD,
        CreationTags.MATERIAL.SEMANTIC_BEAST,
      ],
    },
    selectionMeta: {
      gongfa: { role: 'support', archetype: 'debuff-exploit' },
    },
    weight: 30,
    energyCost: 20,
    applicableTo: ['gongfa'],
    effectTemplate: {
      type: 'percent_damage_modifier',
      conditions: [
        {
          type: 'has_tag',
          params: { tag: GameplayTags.STATUS.CATEGORY.DEBUFF },
        },
      ],
      params: {
        mode: 'increase',
        value: { base: 0.06, scale: 'quality', coefficient: 0.02 },
        cap: 0.5,
      },
    },
    listenerSpec: {
      eventType: GameplayTags.EVENT.DAMAGE_REQUEST,
      scope: GameplayTags.SCOPE.OWNER_AS_CASTER,
      priority: CREATION_LISTENER_PRIORITIES.damageRequest,
    },
  },

  // --- DOT 放大 ---
  {
    id: 'gongfa-school-dot-amplify',
    displayName: '异常精通',
    displayDescription: '异常精通，持续伤害提升',
    slot: 'modifier',
    rarity: 'rare',
    match: {
      any: [
        CreationTags.MATERIAL.SEMANTIC_FLAME,
        CreationTags.MATERIAL.SEMANTIC_POISON,
        CreationTags.MATERIAL.SEMANTIC_BLOOD,
      ],
    },
    selectionMeta: {
      gongfa: { role: 'support', archetype: 'dot-amplify' },
    },
    weight: 32,
    energyCost: 20,
    applicableTo: ['gongfa'],
    effectTemplate: {
      type: 'percent_damage_modifier',
      conditions: [
        {
          type: 'damage_type_is',
          params: { damageType: DamageType.DOT },
        },
      ],
      params: {
        mode: 'increase',
        value: { base: 0.08, scale: 'quality', coefficient: 0.03 },
      },
    },
    listenerSpec: {
      eventType: GameplayTags.EVENT.DAMAGE_REQUEST,
      scope: GameplayTags.SCOPE.OWNER_AS_CASTER,
      priority: CREATION_LISTENER_PRIORITIES.damageRequest,
    },
  },

  // --- 控制链强化（受控目标增伤） ---
  {
    id: 'gongfa-school-control-exploit',
    displayName: '摧心',
    displayDescription: '乘敌身形受制，对被定身的目标造成更高伤害',
    slot: 'modifier',
    rarity: 'rare',
    match: {
      any: [
        CreationTags.MATERIAL.SEMANTIC_FREEZE,
        CreationTags.MATERIAL.SEMANTIC_THUNDER,
        CreationTags.MATERIAL.SEMANTIC_ILLUSION,
      ],
    },
    selectionMeta: {
      gongfa: { role: 'support', archetype: 'control-exploit' },
    },
    weight: 35,
    energyCost: 20,
    applicableTo: ['gongfa'],
    effectTemplate: {
      type: 'percent_damage_modifier',
      conditions: [
        {
          type: 'has_tag',
          params: { tag: GameplayTags.STATUS.CONTROL.ROOT },
        },
      ],
      params: {
        mode: 'increase',
        value: { base: 0.04, scale: 'quality', coefficient: 0.02 },
      },
    },
    listenerSpec: {
      eventType: GameplayTags.EVENT.DAMAGE_REQUEST,
      scope: GameplayTags.SCOPE.OWNER_AS_CASTER,
      priority: CREATION_LISTENER_PRIORITIES.damageRequest,
    },
  },

  // ================================================================
  // ===== GONGFA_SECRET 池 (4 种) — 制造"门派真传感"
  // ================================================================

  // --- 焚天诀：火系命中灼烧目标最终伤害再提高 ---
  {
    id: 'gongfa-secret-inferno',
    displayName: '火噬',
    displayDescription: '火系技能攻击灼烧目标时，造成的伤害进一步提升',
    slot: 'modifier',
    rarity: 'legendary',
    match: {
      all: [
        CreationTags.MATERIAL.SEMANTIC_FLAME,
        ELEMENT_TO_MATERIAL_TAG['火'],
      ],
      any: [
        CreationTags.MATERIAL.TYPE_SPECIAL,
        CreationTags.MATERIAL.SEMANTIC_BURST,
      ],
    },
    exclusiveGroup: EXCLUSIVE_GROUP.GONGFA.SECRET_ULTIMATE,
    selectionMeta: {
      gongfa: { role: 'secret', archetype: 'inferno', element: '火' },
    },
    weight: 8,
    energyCost: 50,
    applicableTo: ['gongfa'],
    effectTemplate: {
      type: 'percent_damage_modifier',
      conditions: [
        {
          type: 'ability_has_tag',
          params: { tag: ELEMENT_TO_RUNTIME_ABILITY_TAG['火'] },
        },
        {
          type: 'has_tag',
          params: { tag: GameplayTags.STATUS.STATE.BURNED },
        },
      ],
      params: {
        mode: 'increase',
        value: { base: 0.12, scale: 'quality', coefficient: 0.04 },
      },
    },
    listenerSpec: {
      eventType: GameplayTags.EVENT.DAMAGE_REQUEST,
      scope: GameplayTags.SCOPE.OWNER_AS_CASTER,
      priority: CREATION_LISTENER_PRIORITIES.damageRequest,
    },
  },

  // --- 寒魄诀：攻击冰缓目标附带最大生命比例伤害 ---
  {
    id: 'gongfa-secret-frost-soul',
    displayName: '寒霜之息',
    displayDescription: '攻击冰缓目标时，附带目标最大气血一定比例的额外伤害',
    slot: 'modifier',
    rarity: 'legendary',
    match: {
      all: [
        CreationTags.MATERIAL.SEMANTIC_FREEZE,
        ELEMENT_TO_MATERIAL_TAG['冰'],
      ],
      any: [
        CreationTags.MATERIAL.TYPE_SPECIAL,
        CreationTags.MATERIAL.SEMANTIC_SPIRIT,
      ],
    },
    exclusiveGroup: EXCLUSIVE_GROUP.GONGFA.SECRET_ULTIMATE,
    selectionMeta: {
      gongfa: { role: 'secret', archetype: 'frost-soul', element: '冰' },
    },
    weight: 8,
    energyCost: 50,
    applicableTo: ['gongfa'],
    effectTemplate: {
      type: 'damage',
      conditions: [
        {
          type: 'has_tag',
          params: { tag: GameplayTags.STATUS.STATE.CHILLED },
        },
      ],
      params: {
        value: {
          targetMaxHpRatio: { base: 0.06, scale: 'quality', coefficient: 0.01 },
        },
      },
    },
    listenerSpec: {
      eventType: GameplayTags.EVENT.DAMAGE_REQUEST,
      scope: GameplayTags.SCOPE.OWNER_AS_CASTER,
      priority: CREATION_LISTENER_PRIORITIES.damageRequest + 1,
    },
  },

  // --- 轮回诀：技能命中后有几率减少随机技能 CD ---
  {
    id: 'gongfa-secret-cycle',
    displayName: '回到过去',
    displayDescription: '施放技能时，有概率减少自身随机一个技能的冷却',
    slot: 'modifier',
    rarity: 'legendary',
    match: {
      all: [
        CreationTags.MATERIAL.SEMANTIC_MANUAL,
        CreationTags.MATERIAL.TYPE_SPECIAL,
      ],
      any: [
        CreationTags.MATERIAL.SEMANTIC_WIND,
        CreationTags.MATERIAL.SEMANTIC_TIME,
        CreationTags.MATERIAL.SEMANTIC_SPIRIT,
      ],
    },
    exclusiveGroup: EXCLUSIVE_GROUP.GONGFA.SECRET_ULTIMATE,
    selectionMeta: {
      gongfa: { role: 'secret', archetype: 'cycle' },
    },
    weight: 8,
    energyCost: 45,
    applicableTo: ['gongfa'],
    grantedAbilityTags: [GameplayTags.TRAIT.COOLDOWN],
    effectTemplate: {
      type: 'cooldown_modify',
      conditions: [{ type: 'chance', params: { value: 0.2 } }],
      params: {
        cdModifyValue: { base: -1, scale: 'quality', coefficient: -0.25 },
        maxCount: 1,
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

  // --- 无相诀：根据当前最高副属性切换强化方向 ---
  {
    id: 'gongfa-secret-adaptive',
    displayName: '无相之变',
    displayDescription: '随机大幅度提升两项属性',
    slot: 'modifier',
    rarity: 'legendary',
    match: {
      all: [
        CreationTags.MATERIAL.SEMANTIC_SPIRIT,
        CreationTags.MATERIAL.TYPE_SPECIAL,
      ],
      any: [
        CreationTags.MATERIAL.SEMANTIC_MANUAL,
        CreationTags.MATERIAL.SEMANTIC_DIVINE,
        CreationTags.MATERIAL.SEMANTIC_QI,
      ],
    },
    exclusiveGroup: EXCLUSIVE_GROUP.GONGFA.SECRET_ULTIMATE,
    selectionMeta: {
      gongfa: { role: 'secret', archetype: 'adaptive' },
    },
    weight: 8,
    energyCost: 55,
    applicableTo: ['gongfa'],
    effectTemplate: {
      type: 'random_attribute_modifier',
      params: {
        pool: [
          {
            attrType: AttributeType.ATK,
            modType: ModifierType.ADD,
            value: { base: 0.05, scale: 'quality', coefficient: 0.02 },
          },
          {
            attrType: AttributeType.MAGIC_ATK,
            modType: ModifierType.ADD,
            value: { base: 0.05, scale: 'quality', coefficient: 0.02 },
          },
          {
            attrType: AttributeType.DEF,
            modType: ModifierType.ADD,
            value: { base: 0.05, scale: 'quality', coefficient: 0.02 },
          },
          {
            attrType: AttributeType.MAGIC_DEF,
            modType: ModifierType.ADD,
            value: { base: 0.05, scale: 'quality', coefficient: 0.02 },
          },
          {
            attrType: AttributeType.SPIRIT,
            modType: ModifierType.ADD,
            value: { base: 0.03, scale: 'quality', coefficient: 0.015 },
          },
          {
            attrType: AttributeType.VITALITY,
            modType: ModifierType.ADD,
            value: { base: 0.03, scale: 'quality', coefficient: 0.015 },
          },
          {
            attrType: AttributeType.WISDOM,
            modType: ModifierType.ADD,
            value: { base: 0.03, scale: 'quality', coefficient: 0.015 },
          },
          {
            attrType: AttributeType.WILLPOWER,
            modType: ModifierType.ADD,
            value: { base: 0.03, scale: 'quality', coefficient: 0.015 },
          },
          {
            attrType: AttributeType.SPEED,
            modType: ModifierType.ADD,
            value: { base: 0.03, scale: 'quality', coefficient: 0.015 },
          },
        ],
        pickCount: 2,
      },
    },
  },
  {
    id: 'gongfa-secret-causality-scripture',
    displayName: '因果经',
    displayDescription: '受击时记录气血与护盾承伤，并按比例以真伤返还',
    slot: 'modifier',
    rarity: 'legendary',
    match: {
      any: [
        CreationTags.MATERIAL.SEMANTIC_DIVINE,
        CreationTags.MATERIAL.SEMANTIC_TIME,
      ],
    },
    exclusiveGroup: EXCLUSIVE_GROUP.GONGFA.SECRET_ULTIMATE,
    weight: 6,
    energyCost: 50,
    applicableTo: ['gongfa'],
    globalUnique: {
      key: 'gongfa-secret-causality-scripture',
      label: '因果经',
    },
    grantedAbilityTags: [
      GameplayTags.ABILITY.FUNCTION.DAMAGE,
      GameplayTags.ABILITY.CHANNEL.TRUE,
    ],
    effectTemplate: {
      type: 'damage_memory',
      params: {
        key: 'causality_damage',
        mode: 'release',
        ratio: {
          base: 0.16,
          scale: 'quality',
          coefficient: 0.03,
          max: 0.38,
        },
        releaseAs: 'reflect',
        target: 'target',
        includeShieldAbsorbed: true,
      },
    },
    listenerSpec: {
      eventType: GameplayTags.EVENT.DAMAGE_TAKEN,
      scope: GameplayTags.SCOPE.OWNER_AS_TARGET,
      priority: CREATION_LISTENER_PRIORITIES.damageTaken,
      mapping: { caster: 'event.caster', target: 'owner' },
      guard: { skipSecondaryDamageSource: true },
    },
  },
  {
    id: 'gongfa-secret-myriad-unity',
    displayName: '万象归一',
    displayDescription: '连续运转后，使下一次神通转为真实伤害',
    slot: 'modifier',
    rarity: 'legendary',
    match: {
      any: [
        CreationTags.MATERIAL.SEMANTIC_SPIRIT,
        CreationTags.MATERIAL.SEMANTIC_FORMATION,
      ],
    },
    exclusiveGroup: EXCLUSIVE_GROUP.GONGFA.SECRET_ULTIMATE,
    weight: 6,
    energyCost: 48,
    applicableTo: ['gongfa'],
    grantedAbilityTags: [GameplayTags.ABILITY.FUNCTION.BUFF],
    effectTemplate: {
      type: 'element_history',
      params: {
        key: 'myriad_unity',
        threshold: 3,
        effects: [
          {
            type: 'ability_transform',
            params: {
              id: 'myriad_unity_true_damage',
              triggers: 1,
              trueDamage: true,
            },
          },
        ],
      },
    },
    listenerSpec: {
      eventType: GameplayTags.EVENT.SKILL_CAST,
      scope: GameplayTags.SCOPE.OWNER_AS_CASTER,
      priority: CREATION_LISTENER_PRIORITIES.skillCast,
      mapping: { caster: 'owner', target: 'owner' },
    },
  },
  {
    id: 'gongfa-school-reverse-cultivation',
    displayName: '逆修诀',
    displayDescription: '气血越低，造成的伤害越高',
    slot: 'modifier',
    rarity: 'rare',
    match: {
      any: [
        CreationTags.MATERIAL.SEMANTIC_BLOOD,
        CreationTags.MATERIAL.SEMANTIC_MANUAL,
      ],
    },
    selectionMeta: {
      gongfa: { role: 'support', archetype: 'reverse-cultivation' },
    },
    weight: 12,
    energyCost: 28,
    applicableTo: ['gongfa'],
    effectTemplate: {
      type: 'dynamic_scalar',
      params: {
        mode: 'increase',
        resource: 'hp',
        lowerIsStronger: true,
        value: { base: 0.12, scale: 'quality', coefficient: 0.04 },
        cap: 0.35,
      },
    },
    listenerSpec: {
      eventType: GameplayTags.EVENT.DAMAGE_REQUEST,
      scope: GameplayTags.SCOPE.OWNER_AS_CASTER,
      priority: CREATION_LISTENER_PRIORITIES.damageRequest,
    },
  },
  {
    id: 'gongfa-secret-three-breath-sword',
    displayName: '养剑三息',
    displayDescription: '蓄势后强化下一次物理神通',
    slot: 'modifier',
    rarity: 'legendary',
    match: {
      any: [
        CreationTags.MATERIAL.SEMANTIC_BLADE,
        CreationTags.MATERIAL.SEMANTIC_MANUAL,
      ],
    },
    exclusiveGroup: EXCLUSIVE_GROUP.GONGFA.SECRET_ULTIMATE,
    weight: 6,
    energyCost: 46,
    applicableTo: ['gongfa'],
    grantedAbilityTags: [
      GameplayTags.ABILITY.FUNCTION.BUFF,
      GameplayTags.ABILITY.FUNCTION.DAMAGE,
      GameplayTags.ABILITY.FUNCTION.HEAL,
      GameplayTags.ABILITY.CHANNEL.MAGIC,
    ],
    effectTemplate: {
      type: 'turn_state_counter',
      params: {
        key: 'three_breath_sword',
        event: 'no_damage_dealt',
        threshold: 2,
        effects: [
          {
            type: 'ability_transform',
            params: {
              id: 'three_breath_sword_burst',
              triggers: 1,
              appliesToTags: [GameplayTags.ABILITY.CHANNEL.PHYSICAL],
              trueDamage: true,
            },
          },
        ],
      },
    },
    listenerSpec: {
      eventType: GameplayTags.EVENT.ROUND_PRE,
      scope: GameplayTags.SCOPE.GLOBAL,
      priority: CREATION_LISTENER_PRIORITIES.roundPre,
      mapping: { caster: 'owner', target: 'owner' },
    },
  },
  {
    id: 'gongfa-secret-heaven-jealous-root',
    displayName: '天妒灵根',
    displayDescription: '暴击时叠加天妒，达到层数后爆发治疗',
    slot: 'modifier',
    rarity: 'legendary',
    match: {
      any: [
        CreationTags.MATERIAL.SEMANTIC_DIVINE,
        CreationTags.MATERIAL.SEMANTIC_THUNDER,
      ],
    },
    exclusiveGroup: EXCLUSIVE_GROUP.GONGFA.SECRET_ULTIMATE,
    weight: 6,
    energyCost: 50,
    applicableTo: ['gongfa'],
    grantedAbilityTags: [
      GameplayTags.ABILITY.FUNCTION.BUFF,
      GameplayTags.ABILITY.FUNCTION.DAMAGE,
      GameplayTags.ABILITY.FUNCTION.HEAL,
      GameplayTags.ABILITY.CHANNEL.MAGIC,
    ],
    effectTemplate: {
      type: 'apply_buff',
      conditions: [{ type: 'is_critical', params: { scope: 'caster' } }],
      params: {
        buffConfig: {
          id: 'heaven_jealousy',
          name: '天妒',
          description: '每次行动前受到少量反噬；达到5层时清空层数并爆发治疗。',
          type: BuffType.BUFF,
          duration: 4,
          stackRule: StackRule.STACK_LAYER,
          tags: [GameplayTags.BUFF.TYPE.BUFF],
          listeners: [
            {
              eventType: GameplayTags.EVENT.ACTION_PRE,
              scope: GameplayTags.SCOPE.OWNER_AS_ACTOR,
              priority: CREATION_LISTENER_PRIORITIES.actionPreBuff,
              effects: [
                {
                  type: 'damage',
                  params: {
                    value: {
                      attribute: AttributeType.MAGIC_ATK,
                      coefficient: qualityScaledCoefficient(0.035),
                      targetMaxHpRatio: {
                        base: 0.015,
                        scale: 'quality',
                        coefficient: 0.002,
                        max: 0.03,
                      },
                    },
                  },
                },
                {
                  type: 'buff_layer_modify',
                  conditions: [
                    {
                      type: 'buff_layer_at_least',
                      params: { id: 'heaven_jealousy', value: 5 },
                    },
                  ],
                  params: {
                    match: { id: 'heaven_jealousy' },
                    operation: 'clear',
                    effects: [
                      {
                        type: 'heal',
                        params: {
                          value: {
                            attribute: AttributeType.SPIRIT,
                            coefficient: qualityScaledCoefficient(0.65),
                            targetMaxHpRatio: {
                              base: 0.08,
                              scale: 'quality',
                              coefficient: 0.01,
                              max: 0.15,
                            },
                          },
                        },
                      },
                    ],
                  },
                },
              ],
            },
          ],
        },
      },
    },
    listenerSpec: {
      eventType: GameplayTags.EVENT.DAMAGE_TAKEN,
      scope: GameplayTags.SCOPE.OWNER_AS_CASTER,
      priority: CREATION_LISTENER_PRIORITIES.damageTaken,
      mapping: { caster: 'owner', target: 'owner' },
    },
  },
  {
    id: 'gongfa-secret-leakless-body',
    displayName: '无漏法身',
    displayDescription: '抵抗控制后获得无漏，下一次受击免伤',
    slot: 'modifier',
    rarity: 'legendary',
    match: {
      any: [
        CreationTags.MATERIAL.SEMANTIC_GUARD,
        CreationTags.MATERIAL.SEMANTIC_DIVINE,
      ],
    },
    exclusiveGroup: EXCLUSIVE_GROUP.GONGFA.SECRET_ULTIMATE,
    weight: 6,
    energyCost: 48,
    applicableTo: ['gongfa'],
    grantedAbilityTags: [GameplayTags.ABILITY.FUNCTION.BUFF],
    effectTemplate: {
      type: 'apply_buff',
      params: {
        buffConfig: {
          id: 'leakless_body',
          name: '无漏',
          description: '下一次受到伤害时免疫该次伤害，触发后消失。',
          type: BuffType.BUFF,
          duration: 2,
          stackRule: StackRule.OVERRIDE,
          tags: [GameplayTags.BUFF.TYPE.BUFF],
          listeners: [
            {
              eventType: GameplayTags.EVENT.DAMAGE,
              scope: GameplayTags.SCOPE.OWNER_AS_TARGET,
              priority: CREATION_LISTENER_PRIORITIES.damageApply,
              effects: [
                {
                  type: 'damage_immunity',
                  params: {
                    tags: [
                      GameplayTags.ABILITY.CHANNEL.MAGIC,
                      GameplayTags.ABILITY.CHANNEL.PHYSICAL,
                      GameplayTags.ABILITY.CHANNEL.TRUE,
                    ],
                  },
                },
                {
                  type: 'buff_layer_modify',
                  params: {
                    match: { id: 'leakless_body' },
                    operation: 'clear',
                  },
                },
              ],
            },
          ],
        },
      },
    },
    listenerSpec: {
      eventType: 'ControlResistEvent',
      scope: GameplayTags.SCOPE.OWNER_AS_TARGET,
      priority: CREATION_LISTENER_PRIORITIES.buffIntercept,
      mapping: { caster: 'owner', target: 'owner' },
    },
  },
  {
    id: 'gongfa-secret-void-step',
    displayName: '空亡步',
    displayDescription: '闪避后储存空亡，下一次命中必暴',
    slot: 'modifier',
    rarity: 'legendary',
    match: {
      any: [
        CreationTags.MATERIAL.SEMANTIC_WIND,
        CreationTags.MATERIAL.SEMANTIC_SPACE,
      ],
    },
    exclusiveGroup: EXCLUSIVE_GROUP.GONGFA.SECRET_ULTIMATE,
    weight: 6,
    energyCost: 44,
    applicableTo: ['gongfa'],
    grantedAbilityTags: [GameplayTags.ABILITY.FUNCTION.BUFF],
    effectTemplate: {
      type: 'next_hit_rule',
      params: { forceCritical: true, triggers: 1 },
    },
    listenerSpec: {
      eventType: 'DodgeEvent',
      scope: GameplayTags.SCOPE.OWNER_AS_TARGET,
      priority: CREATION_LISTENER_PRIORITIES.damageApply,
      mapping: { caster: 'owner', target: 'owner' },
    },
  },
  {
    id: 'gongfa-school-borrowed-law-returned',
    displayName: '借法还真',
    displayDescription: '治疗后记录治疗量，之后可转化为伤害资源',
    slot: 'modifier',
    rarity: 'rare',
    match: {
      any: [
        CreationTags.MATERIAL.SEMANTIC_LIFE,
        CreationTags.MATERIAL.SEMANTIC_MANUAL,
      ],
    },
    selectionMeta: { gongfa: { role: 'support', archetype: 'heal-convert' } },
    weight: 12,
    energyCost: 28,
    applicableTo: ['gongfa'],
    effectTemplate: {
      type: 'effect_sequence',
      params: {
        effects: [
          {
            type: 'damage_memory',
            params: {
              key: 'borrowed_heal',
              mode: 'record',
              event: 'heal',
              target: 'caster',
              maxStoredValue: {
                targetMaxHpRatio: {
                  base: 0.45,
                  scale: 'quality',
                  coefficient: 0.06,
                  max: 0.9,
                },
              },
            },
          },
          {
            type: 'ability_transform',
            params: {
              id: 'borrowed_law_returned',
              triggers: 1,
              appliesToTags: [GameplayTags.ABILITY.FUNCTION.DAMAGE],
              bonusDamageMemory: {
                key: 'borrowed_heal',
                ratio: {
                  base: 0.3,
                  scale: 'quality',
                  coefficient: 0.04,
                  max: 0.58,
                },
              },
            },
          },
        ],
      },
    },
    listenerSpec: {
      eventType: 'HealEvent',
      scope: GameplayTags.SCOPE.OWNER_AS_CASTER,
      priority: CREATION_LISTENER_PRIORITIES.damageTaken,
    },
  },
];
