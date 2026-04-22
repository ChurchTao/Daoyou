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
import {
  AttributeType,
  ModifierType,
} from '../../contracts/battle';
import { EXCLUSIVE_GROUP } from '../exclusiveGroups';
import { AffixDefinition } from '../types';

export const GONGFA_AFFIXES: AffixDefinition[] = [
  // ================================================================
  // ===== GONGFA_FOUNDATION 池 (14 种) — 百分比根骨属性 + 通用规则
  // ================================================================

  // --- 10 种百分比属性 ---
  {
    id: 'gongfa-foundation-spirit',
    displayName: '灵力强化',
    displayDescription: '战斗中提升灵力百分比，法术收益随境界成倍放大',
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
        value: { base: 0.08, scale: 'quality', coefficient: 0.02 },
      },
    },
  },
  {
    id: 'gongfa-foundation-vitality',
    displayName: '体魄强化',
    displayDescription: '战斗中提升体力百分比，气血池更加深厚',
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
        value: { base: 0.08, scale: 'quality', coefficient: 0.02 },
      },
    },
  },
  {
    id: 'gongfa-foundation-wisdom',
    displayName: '根骨增益',
    displayDescription: '战斗中提升根骨百分比，法术穿透与命中提高',
    category: 'gongfa_foundation',
    rarity: 'common',
    match: {
      all: [CreationTags.MATERIAL.SEMANTIC_MANUAL],
      any: [
        CreationTags.MATERIAL.SEMANTIC_SPIRIT,
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
        attrType: AttributeType.WISDOM,
        modType: ModifierType.ADD,
        value: { base: 0.06, scale: 'quality', coefficient: 0.015 },
      },
    },
  },
  {
    id: 'gongfa-foundation-willpower',
    displayName: '意志强化',
    displayDescription: '战斗中提升意志百分比，抗性与控制抵抗提高',
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
        value: { base: 0.06, scale: 'quality', coefficient: 0.015 },
      },
    },
  },
  {
    id: 'gongfa-foundation-speed',
    displayName: '身法强化',
    displayDescription: '战斗中提升身法百分比，先手与回避更具优势',
    category: 'gongfa_foundation',
    rarity: 'common',
    match: { all: [CreationTags.MATERIAL.SEMANTIC_WIND] },
    exclusiveGroup: EXCLUSIVE_GROUP.GONGFA.FOUNDATION_STAT,
    weight: 75,
    energyCost: 10,
    applicableTo: ['gongfa'],
    effectTemplate: {
      type: 'attribute_modifier',
      params: {
        attrType: AttributeType.SPEED,
        modType: ModifierType.ADD,
        value: { base: 0.06, scale: 'quality', coefficient: 0.015 },
      },
    },
  },
  {
    id: 'gongfa-foundation-atk',
    displayName: '物攻强化',
    displayDescription: '战斗中提升物理攻击百分比',
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
        value: { base: 0.08, scale: 'quality', coefficient: 0.02 },
      },
    },
  },
  {
    id: 'gongfa-foundation-magic-atk',
    displayName: '法攻强化',
    displayDescription: '战斗中提升法术攻击百分比',
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
        value: { base: 0.08, scale: 'quality', coefficient: 0.02 },
      },
    },
  },
  {
    id: 'gongfa-foundation-def',
    displayName: '物防强化',
    displayDescription: '战斗中提升物理防御百分比',
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
        value: { base: 0.06, scale: 'quality', coefficient: 0.015 },
      },
    },
  },
  {
    id: 'gongfa-foundation-magic-def',
    displayName: '法防强化',
    displayDescription: '战斗中提升法术防御百分比',
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
        value: { base: 0.06, scale: 'quality', coefficient: 0.015 },
      },
    },
  },
  {
    id: 'gongfa-foundation-heal-amplify',
    displayName: '疗伤增幅',
    displayDescription: '战斗中提升治疗效果百分比',
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
        value: { base: 0.06, scale: 'quality', coefficient: 0.02 },
      },
    },
  },

  // --- 控制命中 ---
  {
    id: 'gongfa-foundation-control-hit',
    displayName: '控制命中',
    displayDescription: '提升控制效果命中率，使控制技更稳定生效',
    category: 'gongfa_foundation',
    rarity: 'uncommon',
    match: {
      any: [
        CreationTags.MATERIAL.SEMANTIC_THUNDER,
        CreationTags.MATERIAL.SEMANTIC_ILLUSION,
        CreationTags.MATERIAL.SEMANTIC_FREEZE,
        CreationTags.MATERIAL.SEMANTIC_MANUAL,
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
        value: { base: 0.05, scale: 'quality', coefficient: 0.015 },
      },
    },
  },

  // --- 控制抗性 ---
  {
    id: 'gongfa-foundation-control-resistance',
    displayName: '控制抗性',
    displayDescription: '提升控制效果抵抗率，减少被控风险',
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
        value: { base: 0.05, scale: 'quality', coefficient: 0.015 },
      },
    },
  },

  // --- 通用增伤 ---
  {
    id: 'gongfa-foundation-damage-increase',
    displayName: '功法增伤',
    displayDescription: '全局造成伤害提高',
    category: 'gongfa_foundation',
    rarity: 'uncommon',
    match: {
      all: [CreationTags.MATERIAL.SEMANTIC_BURST],
      any: [
        CreationTags.MATERIAL.SEMANTIC_BLADE,
        CreationTags.MATERIAL.SEMANTIC_METAL,
        CreationTags.MATERIAL.SEMANTIC_BEAST,
      ],
    },
    exclusiveGroup: EXCLUSIVE_GROUP.GONGFA.FOUNDATION_DAMAGE_MOD,
    weight: 55,
    energyCost: 12,
    applicableTo: ['gongfa'],
    effectTemplate: {
      type: 'percent_damage_modifier',
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

  // --- 通用减伤（静态防御加成） ---
  {
    id: 'gongfa-foundation-damage-reduce',
    displayName: '功法减伤',
    displayDescription: '提升防御属性，降低受到的伤害',
    category: 'gongfa_foundation',
    rarity: 'uncommon',
    match: {
      all: [CreationTags.MATERIAL.SEMANTIC_GUARD],
      any: [
        CreationTags.MATERIAL.SEMANTIC_SUSTAIN,
        CreationTags.MATERIAL.SEMANTIC_EARTH,
        CreationTags.MATERIAL.SEMANTIC_WATER,
      ],
    },
    exclusiveGroup: EXCLUSIVE_GROUP.GONGFA.FOUNDATION_DAMAGE_MOD,
    weight: 45,
    energyCost: 12,
    applicableTo: ['gongfa'],
    effectTemplate: {
      type: 'attribute_modifier',
      params: {
        attrType: AttributeType.DEF,
        modType: ModifierType.ADD,
        value: { base: 0.06, scale: 'quality', coefficient: 0.02 },
      },
    },
  },

  // ================================================================
  // ===== GONGFA_SCHOOL 池 (16 种) — 定义"这套到底怎么玩"
  // ================================================================

  // --- 8 种元素专精 ---
  {
    id: 'gongfa-school-fire-spec',
    displayName: '火系专精',
    displayDescription: '火系技能伤害提高，火修路线核心词条',
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
        value: { base: 0.12, scale: 'quality', coefficient: 0.04 },
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
    displayName: '冰系专精',
    displayDescription: '冰系技能伤害提高',
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
        value: { base: 0.12, scale: 'quality', coefficient: 0.04 },
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
    displayName: '雷系专精',
    displayDescription: '雷系技能伤害提高',
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
        value: { base: 0.12, scale: 'quality', coefficient: 0.04 },
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
    displayName: '风系专精',
    displayDescription: '风系技能伤害提高',
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
        value: { base: 0.12, scale: 'quality', coefficient: 0.04 },
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
    displayName: '金系专精',
    displayDescription: '金系技能伤害提高',
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
        value: { base: 0.12, scale: 'quality', coefficient: 0.04 },
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
    displayName: '水系专精',
    displayDescription: '水系技能伤害提高',
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
        value: { base: 0.12, scale: 'quality', coefficient: 0.04 },
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
    displayName: '木系专精',
    displayDescription: '木系技能伤害提高',
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
        value: { base: 0.12, scale: 'quality', coefficient: 0.04 },
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
    displayName: '土系专精',
    displayDescription: '土系技能伤害提高',
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
        value: { base: 0.12, scale: 'quality', coefficient: 0.04 },
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
    displayName: '暴击回蓝',
    displayDescription: '暴击时回复灵力，维持高攻节奏',
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
      conditions: [{ type: 'is_critical' ,params:{}}],
      params: {
        target: 'mp',
        value: {
          base: { base: 8, scale: 'quality', coefficient: 3 },
          attribute: AttributeType.SPIRIT,
          coefficient: 0.06,
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
    displayName: '低蓝增伤',
    displayDescription: '灵力低于阈值时伤害提高，破釜沉舟的背水之战',
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
        value: { base: 0.18, scale: 'quality', coefficient: 0.04 },
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
    displayName: '先手强化',
    displayDescription: '气血充足时伤害大幅提高，抢先机定胜负',
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
        { type: 'hp_above', params: { value: 0.8, scope: 'caster' } },
      ],
      params: {
        mode: 'increase',
        value: { base: 0.25, scale: 'quality', coefficient: 0.05 },
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
    displayName: '绝境爆发',
    displayDescription: '气血低于阈值时伤害大幅提高',
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
        value: { base: 0.22, scale: 'quality', coefficient: 0.05 },
        cap: 0.9,
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
    displayName: '盾攻一体',
    displayDescription: '拥有护盾时伤害提高，攻守同步',
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
          type: 'buff_count_at_least',
          params: { value: 1, scope: 'caster' },
        },
      ],
      params: {
        mode: 'increase',
        value: { base: 0.15, scale: 'quality', coefficient: 0.03 },
        cap: 0.6,
      },
    },
    listenerSpec: {
      eventType: GameplayTags.EVENT.DAMAGE_REQUEST,
      scope: GameplayTags.SCOPE.OWNER_AS_CASTER,
      priority: CREATION_LISTENER_PRIORITIES.damageRequest,
    },
  },

  // --- 状态延长 ---
  {
    id: 'gongfa-school-debuff-extend',
    displayName: '蚀骨增伤',
    displayDescription: '对带有负面状态的目标伤害提高',
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
        value: { base: 0.12, scale: 'quality', coefficient: 0.03 },
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
    displayName: 'DOT 放大',
    displayDescription: '对处于持续伤害状态的目标造成额外伤害',
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
        value: { base: 0.2, scale: 'quality', coefficient: 0.05 },
        cap: 1.0,
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
    displayName: '控场压制',
    displayDescription: '对处于控制状态的目标伤害提高',
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
        value: { base: 0.18, scale: 'quality', coefficient: 0.04 },
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
    displayName: '焚天诀',
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
        value: { base: 0.3, scale: 'quality', coefficient: 0.08 },
        cap: 1.5,
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
    displayName: '寒魄诀',
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
    displayName: '轮回诀',
    displayDescription: '技能命中后有概率减少自身随机一个技能的冷却',
    category: 'gongfa_secret',
    rarity: 'rare',
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
        cdModifyValue: { base: -2, scale: 'quality', coefficient: -0.5 },
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
    displayName: '无相诀',
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
            value: { base: 0.12, scale: 'quality', coefficient: 0.03 },
          },
          {
            attrType: AttributeType.MAGIC_ATK,
            modType: ModifierType.ADD,
            value: { base: 0.12, scale: 'quality', coefficient: 0.03 },
          },
          {
            attrType: AttributeType.DEF,
            modType: ModifierType.ADD,
            value: { base: 0.1, scale: 'quality', coefficient: 0.025 },
          },
          {
            attrType: AttributeType.SPEED,
            modType: ModifierType.ADD,
            value: { base: 0.1, scale: 'quality', coefficient: 0.025 },
          },
        ],
        pickCount: 2,
      },
    },
  },
];

