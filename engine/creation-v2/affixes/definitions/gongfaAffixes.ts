/*
 * 灵能消耗平衡规则 (Energy Cost Balance Rule - V2):
 * 1. 核心池 (Core/Panel): 8 ~ 15 点。作为基础底盘，保证产物基本强度。
 * 2. 变体池 (Variant/School/Defense): 12 ~ 20 点。主要能量吸收点，定义流派特色。
 * 3. 稀有池 (Rare/Secret/Treasure): 35 ~ 55 点。顶级消耗项，吸收神品材料溢出能量，产出质变效果。
 *
 * PBU 换算逻辑：PBU = (∑词缀消耗 * 类别系数 * 效率加成) * 品质乘数 + 极品奖励。
 */
import {
  CreationTags,
  ELEMENT_TO_RUNTIME_ABILITY_TAG,
  GameplayTags,
} from '@/engine/shared/tag-domain';
import { CREATION_LISTENER_PRIORITIES } from '../../config/CreationBalance';
import { ELEMENT_TO_MATERIAL_TAG } from '../../config/CreationMappings';
import { AttributeType, ModifierType } from '../../contracts/battle';
import { EXCLUSIVE_GROUP } from '../exclusiveGroups';
import { AffixDefinition } from '../types';

export const GONGFA_AFFIXES: AffixDefinition[] = [
  // ================================================================
  // ===== GONGFA_FOUNDATION 池 (14 种) — 百分比根骨属性 + 通用规则
  // ================================================================

  // --- 10 种百分比属性 ---
  {
    id: 'gongfa-foundation-spirit',
    displayName: '灵力充沛',
    displayDescription: '功脉生息，提升体内灵力储量灵力充沛',
    category: 'gongfa_foundation',
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
    displayDescription: '大脉强劲，增淬肉壳生机气血强壮',
    category: 'gongfa_foundation',
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
    displayDescription: '心眼通明，提升修者天资悟性之根',
    category: 'gongfa_foundation',
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
    displayDescription: '识海如固，坚守神宫不破之意志固神',
    category: 'gongfa_foundation',
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
    displayDescription: '步踏罡斗，使身法运转更为无迹可寻',
    category: 'gongfa_foundation',
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
    displayDescription: '增强肉身体质，提升物理攻击力',
    category: 'gongfa_foundation',
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
    displayDescription: '通明达微，使五行法术威能凭空暴涨',
    category: 'gongfa_foundation',
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
    displayDescription: '搬山卸岭，练就如玄土重岩般的肉身金脉',
    category: 'gongfa_foundation',
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
    displayDescription: '如清水流云罩体，化散漫天轰落的敌方奇术',
    category: 'gongfa_foundation',
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
    id: 'gongfa-foundation-heal-amplify',
    displayName: '生息',
    displayDescription: '长青无极，运转间能够更有效激发疗伤药性与医术真气',
    category: 'gongfa_foundation',
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
    displayDescription: '天威如网，大幅拔高诸般摄心索灵异术的生效契机',
    category: 'gongfa_foundation',
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
    displayDescription: '镇压万邪，凭浩荡灵台强挡一切诡谲邪教的迷障控制',
    category: 'gongfa_foundation',
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
    displayDescription: '道蕴不羁，使修行者举手投足间带出远超常理的骇人神威',
    category: 'gongfa_foundation',
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
    displayName: '火灵根强化',
    displayDescription: '通晓真火大道，大幅提升火系神通的威能',
    category: 'gongfa_school',
    rarity: 'uncommon',
    match: {
      all: [ELEMENT_TO_MATERIAL_TAG['火']],
      any: [
        CreationTags.MATERIAL.SEMANTIC_FLAME,
        CreationTags.MATERIAL.SEMANTIC_BURST,
        CreationTags.MATERIAL.SEMANTIC_BLADE,
      ],
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
    displayName: '冰灵根强化',
    displayDescription: '凝绝幽寒，明悟此门可大幅提升冰系神通的威能',
    category: 'gongfa_school',
    rarity: 'uncommon',
    match: {
      all: [ELEMENT_TO_MATERIAL_TAG['冰']],
      any: [
        CreationTags.MATERIAL.SEMANTIC_FREEZE,
        CreationTags.MATERIAL.SEMANTIC_BURST,
        CreationTags.MATERIAL.SEMANTIC_BLADE,
      ],
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
    displayName: '雷灵根强化',
    displayDescription: '参透雷霆幻变之机，大幅提升雷系法术的威势',
    category: 'gongfa_school',
    rarity: 'uncommon',
    match: {
      all: [ELEMENT_TO_MATERIAL_TAG['雷']],
      any: [
        CreationTags.MATERIAL.SEMANTIC_THUNDER,
        CreationTags.MATERIAL.SEMANTIC_BURST,
        CreationTags.MATERIAL.SEMANTIC_BLADE,
      ],
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
    displayName: '风灵根强化',
    displayDescription: '明谙风行之道，修习后能够大举强化风系流派杀招',
    category: 'gongfa_school',
    rarity: 'uncommon',
    match: {
      all: [ELEMENT_TO_MATERIAL_TAG['风']],
      any: [
        CreationTags.MATERIAL.SEMANTIC_WIND,
        CreationTags.MATERIAL.SEMANTIC_BURST,
        CreationTags.MATERIAL.SEMANTIC_BLADE,
      ],
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
    displayName: '金灵根强化',
    displayDescription: '金修内蕴之法，破阵裂城威力更甚平常',
    category: 'gongfa_school',
    rarity: 'uncommon',
    match: {
      all: [ELEMENT_TO_MATERIAL_TAG['金']],
      any: [
        CreationTags.MATERIAL.SEMANTIC_METAL,
        CreationTags.MATERIAL.SEMANTIC_BLADE,
        CreationTags.MATERIAL.SEMANTIC_BURST,
      ],
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
    displayName: '水灵根强化',
    displayDescription: '通悉若水无定之形，大幅抬高水行神通的伤害界限',
    category: 'gongfa_school',
    rarity: 'uncommon',
    match: {
      all: [ELEMENT_TO_MATERIAL_TAG['水']],
      any: [
        CreationTags.MATERIAL.SEMANTIC_WATER,
        CreationTags.MATERIAL.SEMANTIC_SPIRIT,
        CreationTags.MATERIAL.SEMANTIC_BURST,
      ],
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
    displayName: '木灵根强化',
    displayDescription: '融生克于一体，显著助长木系道法的肆虐之威',
    category: 'gongfa_school',
    rarity: 'uncommon',
    match: {
      all: [ELEMENT_TO_MATERIAL_TAG['木']],
      any: [
        CreationTags.MATERIAL.SEMANTIC_WOOD,
        CreationTags.MATERIAL.SEMANTIC_LIFE,
        CreationTags.MATERIAL.SEMANTIC_SUSTAIN,
      ],
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
    displayName: '土灵根强化',
    displayDescription: '立足浩荡地脉，使所有土系手段变得沉重绝伦',
    category: 'gongfa_school',
    rarity: 'uncommon',
    match: {
      all: [ELEMENT_TO_MATERIAL_TAG['土']],
      any: [
        CreationTags.MATERIAL.SEMANTIC_EARTH,
        CreationTags.MATERIAL.SEMANTIC_GUARD,
        CreationTags.MATERIAL.SEMANTIC_BURST,
      ],
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

  // --- 暴击回蓝 ---
  {
    id: 'gongfa-school-crit-mana',
    displayName: '涌潮',
    displayDescription: '灵力如潮，施展爆发破绽之时顺势汲引大量天地灵气入体',
    category: 'gongfa_school',
    rarity: 'uncommon',
    match: {
      all: [CreationTags.MATERIAL.SEMANTIC_BURST],
      any: [
        CreationTags.MATERIAL.SEMANTIC_SPIRIT,
        CreationTags.MATERIAL.SEMANTIC_QI,
        CreationTags.MATERIAL.SEMANTIC_THUNDER,
      ],
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
          base: { base: 8, scale: 'quality', coefficient: 3 },
          attribute: AttributeType.SPIRIT,
          coefficient: 0.02,
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
    displayDescription:
      '燃灵破釜，当体内真元临近枯竭时强行榨取残力发挥惊天之威',
    category: 'gongfa_school',
    rarity: 'uncommon',
    match: {
      all: [CreationTags.MATERIAL.SEMANTIC_BURST],
      any: [
        CreationTags.MATERIAL.SEMANTIC_SPIRIT,
        CreationTags.MATERIAL.SEMANTIC_QI,
        CreationTags.MATERIAL.TYPE_MANUAL,
      ],
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
    displayDescription: '气脉全盛时出手自然不容抗拒，此法在满气血时具倾覆之威',
    category: 'gongfa_school',
    rarity: 'uncommon',
    match: {
      all: [CreationTags.MATERIAL.SEMANTIC_WIND],
      any: [
        CreationTags.MATERIAL.SEMANTIC_BURST,
        CreationTags.MATERIAL.SEMANTIC_BLADE,
        CreationTags.MATERIAL.SEMANTIC_THUNDER,
      ],
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
    displayDescription: '退无可退即为死战，周身负创严重时爆发出搏命一击',
    category: 'gongfa_school',
    rarity: 'uncommon',
    match: {
      all: [CreationTags.MATERIAL.SEMANTIC_BLADE],
      any: [
        CreationTags.MATERIAL.SEMANTIC_BLOOD,
        CreationTags.MATERIAL.SEMANTIC_BURST,
        CreationTags.MATERIAL.SEMANTIC_BEAST,
      ],
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
    displayDescription: '借护身灵罩作为依托，攻守共济下打出极为沉重的道术',
    category: 'gongfa_school',
    rarity: 'uncommon',
    match: {
      all: [CreationTags.MATERIAL.SEMANTIC_GUARD],
      any: [
        CreationTags.MATERIAL.SEMANTIC_BURST,
        CreationTags.MATERIAL.SEMANTIC_METAL,
        CreationTags.MATERIAL.SEMANTIC_BLADE,
      ],
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
    displayDescription: '痛打落水之狗，趁敌方身中衰弱与剧毒时扩大杀伤',
    category: 'gongfa_school',
    rarity: 'rare',
    match: {
      all: [CreationTags.MATERIAL.SEMANTIC_POISON],
      any: [
        CreationTags.MATERIAL.SEMANTIC_MANUAL,
        CreationTags.MATERIAL.SEMANTIC_BLOOD,
        CreationTags.MATERIAL.SEMANTIC_BEAST,
      ],
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
    displayDescription: '异常状态命中敌人时，造成伤害提升',
    category: 'gongfa_school',
    rarity: 'rare',
    match: {
      any: [
        CreationTags.MATERIAL.SEMANTIC_FLAME,
        CreationTags.MATERIAL.SEMANTIC_POISON,
        CreationTags.MATERIAL.SEMANTIC_BLOOD,
      ],
    },
    weight: 32,
    energyCost: 20,
    applicableTo: ['gongfa'],
    effectTemplate: {
      type: 'percent_damage_modifier',
      conditions: [
        {
          type: 'has_tag',
          params: { tag: GameplayTags.STATUS.CATEGORY.DOT },
        },
      ],
      params: {
        mode: 'increase',
        value: { base: 0.08, scale: 'quality', coefficient: 0.04 },
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
    displayDescription: '乘敌身形受制、难以自持之际，直击破绽摧毁其防御',
    category: 'gongfa_school',
    rarity: 'rare',
    match: {
      any: [
        CreationTags.MATERIAL.SEMANTIC_FREEZE,
        CreationTags.MATERIAL.SEMANTIC_THUNDER,
        CreationTags.MATERIAL.SEMANTIC_ILLUSION,
      ],
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
        value: { base: 0.8, scale: 'quality', coefficient: 0.04 },
        cap: 0.8,
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
    displayDescription: '火系技能命中灼烧目标时，最终伤害再次提升',
    category: 'gongfa_secret',
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
    weight: 5,
    energyCost: 50,
    minQuality: '玄品',
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
    displayDescription: '攻击冰缓目标时附带目标最大气血比例的额外伤害',
    category: 'gongfa_secret',
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
    weight: 5,
    energyCost: 50,
    minQuality: '玄品',
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
          base: 0,
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
    displayDescription: '技能命中后有概率减少自身随机一个技能的冷却',
    category: 'gongfa_secret',
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
    weight: 6,
    energyCost: 45,
    minQuality: '灵品',
    applicableTo: ['gongfa'],
    grantedAbilityTags: [GameplayTags.TRAIT.COOLDOWN],
    effectTemplate: {
      type: 'cooldown_modify',
      conditions: [{ type: 'chance', params: { value: 0.35 } }],
      params: {
        cdModifyValue: { base: -1, scale: 'quality', coefficient: -0.5 },
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
    displayDescription: '修炼时随机强化两项属性',
    category: 'gongfa_secret',
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
    weight: 4,
    energyCost: 55,
    minQuality: '真品',
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
];
