/*
 * gongfaAffixes: 功法词缀定义集合（大幅扩展）。
 * 功法词缀特点：
 * - 通常用于被动属性能力或战斗中触发的持续效果
 * - 包含战斗中长期增幅、触发链、以及修为相关机制
 * - 映射为AbilityConfig.modifiers或listeners
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
  BuffType,
  ModifierType,
  StackRule,
} from '../../contracts/battle';
import { EXCLUSIVE_GROUP } from '../exclusiveGroups';
import { AffixDefinition, matchAll } from '../types';

export const GONGFA_AFFIXES: AffixDefinition[] = [
  // ========================
  // ===== CORE 词缀 (5 种)
  // ========================
  {
    id: 'gongfa-core-spirit',
    displayName: '灵力强化',
    displayDescription: '战斗中提升灵力百分比，法术收益随境界成倍放大',
    category: 'core',
    match: matchAll([
      CreationTags.MATERIAL.SEMANTIC_SPIRIT,
      CreationTags.MATERIAL.TYPE_HERB,
    ]),
    exclusiveGroup: EXCLUSIVE_GROUP.GONGFA.CORE_STAT,
    weight: 100,
    energyCost: 8,
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
    id: 'gongfa-core-vitality',
    displayName: '体魄强化',
    displayDescription: '战斗中提升体魄百分比，高境界修士生存更稳',
    category: 'core',
    match: matchAll([
      CreationTags.MATERIAL.TYPE_ORE,
      CreationTags.MATERIAL.TYPE_HERB,
    ]),
    exclusiveGroup: EXCLUSIVE_GROUP.GONGFA.CORE_STAT,
    weight: 95,
    energyCost: 8,
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
    id: 'gongfa-core-wisdom',
    displayName: '悟性强化',
    displayDescription: '战斗中提升悟性百分比，术法发挥愈发稳定',
    category: 'core',
    match: matchAll([
      CreationTags.MATERIAL.SEMANTIC_SPIRIT,
      CreationTags.MATERIAL.SEMANTIC_MANUAL,
      CreationTags.MATERIAL.TYPE_MANUAL,
    ]),
    exclusiveGroup: EXCLUSIVE_GROUP.GONGFA.CORE_STAT,
    weight: 88,
    energyCost: 8,
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
    id: 'gongfa-core-willpower',
    displayName: '意志强化',
    displayDescription: '战斗中提升意志百分比，抗控效果与境界同步提升',
    category: 'core',
    match: matchAll([
      CreationTags.MATERIAL.SEMANTIC_MANUAL,
      CreationTags.MATERIAL.TYPE_MANUAL,
    ]),
    exclusiveGroup: EXCLUSIVE_GROUP.GONGFA.CORE_STAT,
    weight: 80,
    energyCost: 8,
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
    id: 'gongfa-core-speed-mastery',
    displayName: '速度强化',
    displayDescription: '战斗中提升身法百分比，先手优势随境界成长',
    category: 'core',
    match: matchAll([
      CreationTags.MATERIAL.SEMANTIC_WIND,
      CreationTags.MATERIAL.SEMANTIC_BLADE,
    ]),
    exclusiveGroup: EXCLUSIVE_GROUP.GONGFA.CORE_STAT,
    weight: 55,
    energyCost: 8,
    applicableTo: ['gongfa'],
    effectTemplate: {
      type: 'attribute_modifier',
      params: {
        attrType: AttributeType.SPEED,
        modType: ModifierType.ADD,
        value: { base: 0.05, scale: 'quality', coefficient: 0.015 },
      },
    },
  },

  // ========================
  // ===== PREFIX 词缀 (OWNER_AS_CASTER / GLOBAL 边界词缀)
  // ========================

  {
    // todo 不需要通过buff实现，可以直接用listener实现
    id: 'gongfa-prefix-buff-sustain',
    displayName: '增益延长',
    displayDescription: '己方buff持续时间延长',
    category: 'prefix',
    match: matchAll([
      CreationTags.MATERIAL.SEMANTIC_SUSTAIN,
      CreationTags.MATERIAL.SEMANTIC_MANUAL,
    ]),
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
          tags: [GameplayTags.BUFF.TYPE.BUFF],
          statusTags: [GameplayTags.STATUS.CATEGORY.BUFF],
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
      eventType: GameplayTags.EVENT.BUFF_ADD,
      scope: GameplayTags.SCOPE.GLOBAL,
      priority: CREATION_LISTENER_PRIORITIES.buffIntercept,
      mapping: {
        caster: 'owner',
        target: 'owner',
      },
    },
  },
  {
    id: 'gongfa-prefix-chill-breaker',
    displayName: '冰缓追击',
    displayDescription: '仅在目标冰缓时触发额外增伤',
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
    // todo 迁移到skill中变成给自己试用的增益buff
    id: 'gongfa-suffix-round-heal',
    displayName: '回合回血',
    displayDescription: '每回合开始时恢复气血',
    category: 'suffix',
    match: matchAll([
      CreationTags.MATERIAL.SEMANTIC_SPIRIT,
      CreationTags.MATERIAL.TYPE_HERB,
      CreationTags.MATERIAL.SEMANTIC_MANUAL,
    ]),
    exclusiveGroup: EXCLUSIVE_GROUP.GONGFA.SUFFIX_ROUND_HEAL,
    weight: 80,
    energyCost: 8,
    applicableTo: ['gongfa'],
    grantedAbilityTags: [GameplayTags.ABILITY.FUNCTION.HEAL],
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
    displayName: '伤害回蓝',
    displayDescription: '造成伤害后恢复法力',
    category: 'suffix',
    match: matchAll([
      CreationTags.MATERIAL.SEMANTIC_SPIRIT,
      CreationTags.MATERIAL.SEMANTIC_BURST,
    ]),
    weight: 75,
    energyCost: 9,
    applicableTo: ['gongfa'],
    grantedAbilityTags: [GameplayTags.TRAIT.MANA_THIEF],
    effectTemplate: {
      type: 'resource_drain',
      params: {
        sourceType: 'hp',
        targetType: 'mp',
        ratio: { base: 0.5, scale: 'quality', coefficient: 0.02 },
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
    displayName: '施法加速',
    displayDescription: '施法后缩短自身其余技能冷却',
    category: 'suffix',
    match: matchAll([
      CreationTags.MATERIAL.SEMANTIC_MANUAL,
      CreationTags.MATERIAL.SEMANTIC_WIND,
    ]),
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
    id: 'gongfa-suffix-lifesteal-passive',
    displayName: '伤害吸血',
    displayDescription: '造成伤害后吸收部分气血',
    category: 'suffix',
    match: matchAll([
      CreationTags.MATERIAL.SEMANTIC_BURST,
      CreationTags.MATERIAL.SEMANTIC_SUSTAIN,
    ]),
    exclusiveGroup: EXCLUSIVE_GROUP.GONGFA.SUFFIX_LIFESTEAL,
    weight: 60,
    energyCost: 9,
    applicableTo: ['gongfa'],
    grantedAbilityTags: [GameplayTags.TRAIT.LIFESTEAL],
    effectTemplate: {
      type: 'resource_drain',
      params: {
        sourceType: 'hp',
        targetType: 'hp',
        ratio: { base: 0.02, scale: 'quality', coefficient: 0.02 },
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
    displayName: '回合驱散',
    displayDescription: '每回合自动解除一层减益',
    category: 'suffix',
    match: {
      all: [
        CreationTags.MATERIAL.SEMANTIC_GUARD,
        CreationTags.MATERIAL.TYPE_SPECIAL,
      ],
      any: [
        CreationTags.MATERIAL.SEMANTIC_DIVINE,
        CreationTags.MATERIAL.SEMANTIC_SPIRIT,
      ],
    },
    weight: 33,
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
    id: 'gongfa-suffix-execution-passive',
    displayName: '低血斩杀',
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
    displayName: '高蓝燃灵',
    displayDescription: '仅在目标高法力时触发燃灵压制',
    category: 'suffix',
    match: matchAll([
      CreationTags.MATERIAL.SEMANTIC_THUNDER,
      CreationTags.MATERIAL.SEMANTIC_SPIRIT,
    ]),
    weight: 39,
    energyCost: 10,
    applicableTo: ['gongfa'],
    grantedAbilityTags: [GameplayTags.TRAIT.MANA_THIEF],
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
  {
    id: 'gongfa-resonance-opening-zenith',
    displayName: '巨人杀手',
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
    displayName: '均衡同修',
    displayDescription: '随机强化一项根骨属性，形成均衡修行的协同收益',
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
      type: 'random_attribute_modifier',
      params: {
        pickCount: 1,
        pool: [
          {
            attrType: AttributeType.SPIRIT,
            modType: ModifierType.ADD,
            value: { base: 0.05, scale: 'quality', coefficient: 0.01 },
          },
          {
            attrType: AttributeType.VITALITY,
            modType: ModifierType.ADD,
            value: { base: 0.05, scale: 'quality', coefficient: 0.01 },
          },
          {
            attrType: AttributeType.WISDOM,
            modType: ModifierType.ADD,
            value: { base: 0.05, scale: 'quality', coefficient: 0.01 },
          },
          {
            attrType: AttributeType.WILLPOWER,
            modType: ModifierType.ADD,
            value: { base: 0.05, scale: 'quality', coefficient: 0.01 },
          },
          {
            attrType: AttributeType.SPEED,
            modType: ModifierType.ADD,
            value: { base: 0.05, scale: 'quality', coefficient: 0.01 },
          },
        ],
      },
    },
  },
  {
    id: 'gongfa-synergy-empty-sea-break',
    displayName: '低蓝压制',
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
      conditions: [{ type: 'mp_below', params: { value: 0.20 } }],
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
  {
    id: 'gongfa-prefix-metal-specialization',
    displayName: '庚金锐意',
    displayDescription: '金系技能造成的伤害提升',
    category: 'prefix',
    match: matchAll([
      CreationTags.MATERIAL.SEMANTIC_METAL,
      ELEMENT_TO_MATERIAL_TAG['金'],
      CreationTags.MATERIAL.SEMANTIC_SPIRIT,
    ]),
    weight: 45,
    energyCost: 7,
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
        value: { base: 0.1, scale: 'quality', coefficient: 0.02 },
        cap: 0.55,
      },
    },
    listenerSpec: {
      eventType: GameplayTags.EVENT.DAMAGE_REQUEST,
      scope: GameplayTags.SCOPE.OWNER_AS_CASTER,
      priority: CREATION_LISTENER_PRIORITIES.damageRequest,
    },
  },
  {
    id: 'gongfa-prefix-wood-specialization',
    displayName: '青木生衍',
    displayDescription: '木系技能造成的伤害提升',
    category: 'prefix',
    match: matchAll([
      CreationTags.MATERIAL.SEMANTIC_WOOD,
      ELEMENT_TO_MATERIAL_TAG['木'],
      CreationTags.MATERIAL.SEMANTIC_SPIRIT,
    ]),
    weight: 45,
    energyCost: 7,
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
        value: { base: 0.1, scale: 'quality', coefficient: 0.02 },
        cap: 0.55,
      },
    },
    listenerSpec: {
      eventType: GameplayTags.EVENT.DAMAGE_REQUEST,
      scope: GameplayTags.SCOPE.OWNER_AS_CASTER,
      priority: CREATION_LISTENER_PRIORITIES.damageRequest,
    },
  },
  {
    id: 'gongfa-prefix-water-specialization',
    displayName: '玄水归流',
    displayDescription: '水系技能造成的伤害提升',
    category: 'prefix',
    match: matchAll([
      CreationTags.MATERIAL.SEMANTIC_WATER,
      ELEMENT_TO_MATERIAL_TAG['水'],
      CreationTags.MATERIAL.SEMANTIC_SPIRIT,
    ]),
    weight: 46,
    energyCost: 7,
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
        value: { base: 0.1, scale: 'quality', coefficient: 0.02 },
        cap: 0.55,
      },
    },
    listenerSpec: {
      eventType: GameplayTags.EVENT.DAMAGE_REQUEST,
      scope: GameplayTags.SCOPE.OWNER_AS_CASTER,
      priority: CREATION_LISTENER_PRIORITIES.damageRequest,
    },
  },
  {
    id: 'gongfa-prefix-fire-specialization',
    displayName: '赤炎焚脉',
    displayDescription: '火系技能造成的伤害提升',
    category: 'prefix',
    match: matchAll([
      CreationTags.MATERIAL.SEMANTIC_FLAME,
      ELEMENT_TO_MATERIAL_TAG['火'],
      CreationTags.MATERIAL.SEMANTIC_SPIRIT,
    ]),
    weight: 48,
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
  },
  {
    id: 'gongfa-prefix-earth-specialization',
    displayName: '厚土镇元',
    displayDescription: '土系技能造成的伤害提升',
    category: 'prefix',
    match: matchAll([
      CreationTags.MATERIAL.SEMANTIC_EARTH,
      ELEMENT_TO_MATERIAL_TAG['土'],
      CreationTags.MATERIAL.SEMANTIC_SPIRIT,
    ]),
    weight: 44,
    energyCost: 7,
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
        value: { base: 0.1, scale: 'quality', coefficient: 0.02 },
        cap: 0.55,
      },
    },
    listenerSpec: {
      eventType: GameplayTags.EVENT.DAMAGE_REQUEST,
      scope: GameplayTags.SCOPE.OWNER_AS_CASTER,
      priority: CREATION_LISTENER_PRIORITIES.damageRequest,
    },
  },
  {
    id: 'gongfa-prefix-wind-specialization',
    displayName: '岚息游龙',
    displayDescription: '风系技能造成的伤害提升',
    category: 'prefix',
    match: matchAll([
      CreationTags.MATERIAL.SEMANTIC_WIND,
      ELEMENT_TO_MATERIAL_TAG['风'],
      CreationTags.MATERIAL.SEMANTIC_SPIRIT,
    ]),
    weight: 47,
    energyCost: 7,
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
        value: { base: 0.1, scale: 'quality', coefficient: 0.02 },
        cap: 0.55,
      },
    },
    listenerSpec: {
      eventType: GameplayTags.EVENT.DAMAGE_REQUEST,
      scope: GameplayTags.SCOPE.OWNER_AS_CASTER,
      priority: CREATION_LISTENER_PRIORITIES.damageRequest,
    },
  },
  {
    id: 'gongfa-prefix-thunder-specialization',
    displayName: '惊霆裂脉',
    displayDescription: '雷系技能造成的伤害提升',
    category: 'prefix',
    match: matchAll([
      CreationTags.MATERIAL.SEMANTIC_THUNDER,
      ELEMENT_TO_MATERIAL_TAG['雷'],
      CreationTags.MATERIAL.SEMANTIC_SPIRIT,
    ]),
    weight: 47,
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
  },
  {
    id: 'gongfa-prefix-ice-specialization',
    displayName: '玄霜凝意',
    displayDescription: '冰系技能造成的伤害提升',
    category: 'prefix',
    match: matchAll([
      CreationTags.MATERIAL.SEMANTIC_FREEZE,
      ELEMENT_TO_MATERIAL_TAG['冰'],
      CreationTags.MATERIAL.SEMANTIC_SPIRIT,
    ]),
    weight: 46,
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
  },

  // ========================
  // ===== ADD 百分比属性 prefix (杠杆加成 — 区别于 artifact 固定面板)
  // ========================
  {
    id: 'gongfa-prefix-atk-add',
    displayName: '炼体强攻',
    displayDescription: '功法炼化体魄经脉，战斗中按百分比提升物理攻击',
    category: 'prefix',
    match: matchAll([
      CreationTags.MATERIAL.SEMANTIC_BLADE,
      CreationTags.MATERIAL.TYPE_ORE,
    ]),
    weight: 82,
    energyCost: 8,
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
    id: 'gongfa-prefix-magic-atk-add',
    displayName: '御灵强法',
    displayDescription: '功法提升法脉运转效率，战斗中按百分比提升法术攻击',
    category: 'prefix',
    match: matchAll([
      CreationTags.MATERIAL.SEMANTIC_SPIRIT,
      CreationTags.MATERIAL.SEMANTIC_BURST,
    ]),
    weight: 80,
    energyCost: 8,
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
    id: 'gongfa-prefix-def-add',
    displayName: '磐石护体',
    displayDescription: '功法强化气血壁垒，战斗中按百分比提升物理防御',
    category: 'prefix',
    match: matchAll([
      CreationTags.MATERIAL.SEMANTIC_GUARD,
      CreationTags.MATERIAL.TYPE_ORE,
    ]),
    weight: 75,
    energyCost: 8,
    applicableTo: ['gongfa'],
    effectTemplate: {
      type: 'attribute_modifier',
      params: {
        attrType: AttributeType.DEF,
        modType: ModifierType.ADD,
        value: { base: 0.07, scale: 'quality', coefficient: 0.015 },
      },
    },
  },
  {
    id: 'gongfa-prefix-magic-def-add',
    displayName: '灵障护法',
    displayDescription: '功法凝练神识壁垒，战斗中按百分比提升法术防御',
    category: 'prefix',
    match: matchAll([
      CreationTags.MATERIAL.SEMANTIC_SPIRIT,
      CreationTags.MATERIAL.TYPE_HERB,
    ]),
    weight: 72,
    energyCost: 8,
    applicableTo: ['gongfa'],
    effectTemplate: {
      type: 'attribute_modifier',
      params: {
        attrType: AttributeType.MAGIC_DEF,
        modType: ModifierType.ADD,
        value: { base: 0.07, scale: 'quality', coefficient: 0.015 },
      },
    },
  },

  // ========================
  // ===== 通道增幅 suffix (法/物伤害通道增幅 — 迁自 commonAffixes 有别于元素专精)
  // ========================
  {
    id: 'gongfa-suffix-chan-magic-boost',
    displayName: '法术增幅',
    displayDescription: '功法提升所有法术通道伤害输出',
    category: 'suffix',
    match: matchAll([
      CreationTags.MATERIAL.SEMANTIC_SPIRIT,
      CreationTags.MATERIAL.SEMANTIC_BLADE,
    ]),
    weight: 42,
    energyCost: 9,
    applicableTo: ['gongfa'],
    effectTemplate: {
      type: 'percent_damage_modifier',
      conditions: [
        {
          type: 'ability_has_tag',
          params: { tag: GameplayTags.ABILITY.CHANNEL.MAGIC },
        },
      ],
      params: {
        mode: 'increase',
        value: { base: 0.03, scale: 'quality', coefficient: 0.015 },
        cap: 0.4,
      },
    },
    listenerSpec: {
      eventType: GameplayTags.EVENT.DAMAGE_REQUEST,
      scope: GameplayTags.SCOPE.OWNER_AS_CASTER,
      priority: CREATION_LISTENER_PRIORITIES.damageRequest,
    },
  },
  {
    id: 'gongfa-suffix-chan-physical-boost',
    displayName: '物理增幅',
    displayDescription: '功法提升所有物理通道伤害输出',
    category: 'suffix',
    match: matchAll([
      CreationTags.MATERIAL.TYPE_ORE,
      CreationTags.MATERIAL.SEMANTIC_BLADE,
    ]),
    weight: 42,
    energyCost: 9,
    applicableTo: ['gongfa'],
    effectTemplate: {
      type: 'percent_damage_modifier',
      conditions: [
        {
          type: 'ability_has_tag',
          params: { tag: GameplayTags.ABILITY.CHANNEL.PHYSICAL },
        },
      ],
      params: {
        mode: 'increase',
        value: { base: 0.03, scale: 'quality', coefficient: 0.015 },
        cap: 0.4,
      },
    },
    listenerSpec: {
      eventType: GameplayTags.EVENT.DAMAGE_REQUEST,
      scope: GameplayTags.SCOPE.OWNER_AS_CASTER,
      priority: CREATION_LISTENER_PRIORITIES.damageRequest,
    },
  },

  // ========================
  // ===== 状态链条共鸣 prefix (has_tag 条件增伤 — 平衡三角联动)
  // ========================
  {
    id: 'gongfa-prefix-burn-amp',
    displayName: '焚状增伤',
    displayDescription:
      '目标带有灼烧时，功法自动放大攻势（与技能附灼烧产生三角共鸣）',
    category: 'prefix',
    match: matchAll([
      CreationTags.MATERIAL.SEMANTIC_FLAME,
      CreationTags.MATERIAL.SEMANTIC_BURST,
    ]),
    weight: 38,
    energyCost: 9,
    applicableTo: ['gongfa'],
    effectTemplate: {
      type: 'percent_damage_modifier',
      conditions: [
        { type: 'has_tag', params: { tag: GameplayTags.STATUS.STATE.BURNED } },
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
  {
    id: 'gongfa-prefix-stun-amp',
    displayName: '控制压制',
    displayDescription:
      '目标处于控制状态时，功法自动强化攻势（与控制技能产生三角共鸣）',
    category: 'prefix',
    match: matchAll([
      CreationTags.MATERIAL.SEMANTIC_THUNDER,
      CreationTags.MATERIAL.SEMANTIC_BURST,
    ]),
    weight: 36,
    energyCost: 9,
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
        value: { base: 0.08, scale: 'quality', coefficient: 0.03 },
        cap: 0.7,
      },
    },
    listenerSpec: {
      eventType: GameplayTags.EVENT.DAMAGE_REQUEST,
      scope: GameplayTags.SCOPE.OWNER_AS_CASTER,
      priority: CREATION_LISTENER_PRIORITIES.damageRequest,
    },
  },
];
