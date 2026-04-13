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


export const GONGFA_AFFIXES: AffixDefinition[] = [
  // ========================
  // ===== CORE 词缀 (5 种)
  // ========================
  {
    id: 'gongfa-core-spirit',
    displayName: '灵力强化',
    displayDescription: '战斗中永久提升灵力，法术收益更高',
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
    displayName: '体魄强化',
    displayDescription: '战斗中永久提升体魄，生存更稳',
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
    displayName: '悟性强化',
    displayDescription: '战斗中永久提升悟性，术法发挥更稳定',
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
    displayName: '意志强化',
    displayDescription: '战斗中永久提升意志，抗控更强',
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
    displayName: '速度强化',
    displayDescription: '战斗中永久提升速度，先手更容易',
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
    displayName: '暴伤强化',
    displayDescription: '战斗中永久提升暴击伤害倍率',
    category: 'prefix',
    match: matchAll([CreationTags.MATERIAL.SEMANTIC_BLADE, CreationTags.MATERIAL.TYPE_MONSTER]),
    exclusiveGroup: 'gongfa-prefix-crit-dmg',
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
    displayName: '治疗强化',
    displayDescription: '战斗中永久提升治疗增幅',
    category: 'prefix',
    match: matchAll([CreationTags.MATERIAL.SEMANTIC_SUSTAIN, CreationTags.MATERIAL.TYPE_HERB]),
    exclusiveGroup: 'gongfa-prefix-heal',
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
    displayName: '受击反伤',
    displayDescription: '受击后小幅反震伤害给敌人',
    category: 'prefix',
    match: matchAll([CreationTags.MATERIAL.SEMANTIC_GUARD, CreationTags.MATERIAL.TYPE_ORE]),
    weight: 68,
    energyCost: 7,
    applicableTo: ['gongfa'],
    grantedAbilityTags: [GameplayTags.TRAIT.REFLECT],
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
    displayName: '法力护幕',
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
    displayName: '闪避强化',
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
    displayName: '增益延长',
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
    displayName: '冰伤减免',
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
    displayName: '火伤减免',
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
    displayName: '雷伤减免',
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
    id: 'gongfa-suffix-round-heal',
    displayName: '回合回血',
    displayDescription: '每回合开始时恢复气血',
    category: 'suffix',
    match: matchAll([
      CreationTags.MATERIAL.SEMANTIC_SPIRIT,
      CreationTags.MATERIAL.TYPE_HERB,
      CreationTags.MATERIAL.SEMANTIC_MANUAL,
    ]),
    exclusiveGroup: 'gongfa-suffix-round-heal',
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
    displayDescription: '造成伤害后恢复灵力',
    category: 'suffix',
    match: matchAll([CreationTags.MATERIAL.SEMANTIC_SPIRIT, CreationTags.MATERIAL.SEMANTIC_BURST]),
    weight: 75,
    energyCost: 9,
    applicableTo: ['gongfa'],
    grantedAbilityTags: [GameplayTags.TRAIT.MANA_THIEF],
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
    displayName: '施法加速',
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
    displayName: '持续回血',
    displayDescription: '每回合恢复额外气血',
    category: 'suffix',
    match: matchAll([CreationTags.MATERIAL.SEMANTIC_SUSTAIN, CreationTags.MATERIAL.TYPE_HERB]),
    weight: 68,
    energyCost: 8,
    applicableTo: ['gongfa'],
    grantedAbilityTags: [GameplayTags.ABILITY.FUNCTION.HEAL],
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
    displayName: '受击减伤',
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
    displayName: '伤害吸血',
    displayDescription: '造成伤害后吸收部分气血',
    category: 'suffix',
    match: matchAll([CreationTags.MATERIAL.SEMANTIC_BURST, CreationTags.MATERIAL.SEMANTIC_SUSTAIN]),
    exclusiveGroup: 'gongfa-suffix-lifesteal',
    weight: 60,
    energyCost: 9,
    applicableTo: ['gongfa'],
    grantedAbilityTags: [GameplayTags.TRAIT.LIFESTEAL],
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
    displayName: '回合驱散',
    displayDescription: '每回合自动解除一层减益',
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
    displayName: '持续护盾',
    displayDescription: '持续维持一个护盾',
    category: 'suffix',
    match: matchAll([CreationTags.MATERIAL.SEMANTIC_GUARD, CreationTags.MATERIAL.SEMANTIC_SPIRIT]),
    weight: 55,
    energyCost: 9,
    applicableTo: ['gongfa'],
    grantedAbilityTags: [GameplayTags.TRAIT.SHIELD_MASTER],
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

  // ========================
  // ===== RESONANCE 词缀 (5 种)
  // ========================
  {
    id: 'gongfa-resonance-healing-loop',
    displayName: '治疗共鸣',
    displayDescription: '治疗效果与防御能力相互增幅',
    category: 'resonance',
    match: matchAll([CreationTags.MATERIAL.SEMANTIC_SUSTAIN, CreationTags.MATERIAL.SEMANTIC_GUARD]),
    weight: 55,
    energyCost: 11,
    applicableTo: ['gongfa'],
    grantedAbilityTags: [GameplayTags.ABILITY.FUNCTION.HEAL],
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
    displayName: '灵力共鸣',
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
          tags: [GameplayTags.BUFF.TYPE.BUFF],
          statusTags: [GameplayTags.STATUS.CATEGORY.BUFF],
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
    displayName: '减伤共鸣',
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
    displayName: '元素共鸣',
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
    displayName: '开局压制',
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
    displayName: '生存联动',
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
    grantedAbilityTags: [GameplayTags.ABILITY.FUNCTION.HEAL],
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
    displayName: '攻防联动',
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
    displayName: '残血回稳',
    displayDescription: '仅在低血时触发的恢复与韧性强化',
    category: 'synergy',
    match: matchAll([
      CreationTags.MATERIAL.SEMANTIC_SUSTAIN,
      CreationTags.MATERIAL.SEMANTIC_GUARD,
    ]),
    weight: 40,
    energyCost: 12,
    applicableTo: ['gongfa'],
    grantedAbilityTags: [GameplayTags.ABILITY.FUNCTION.HEAL],
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
    displayName: '悟道加持',
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
    displayName: '无念加持',
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
          tags: [GameplayTags.BUFF.TYPE.BUFF],
          statusTags: [GameplayTags.STATUS.CATEGORY.MYTHIC],
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
    displayName: '浴火回春',
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
    grantedAbilityTags: [GameplayTags.ABILITY.FUNCTION.HEAL],
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
    displayName: '濒危法免',
    displayDescription: '血量危险时有概率免疫法术伤害',
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
    displayName: '飞升增幅',
    displayDescription: '高阶增幅词条，稳定提升关键属性',
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
          tags: [GameplayTags.BUFF.TYPE.BUFF],
          statusTags: [GameplayTags.STATUS.CATEGORY.MYTHIC],
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

];
