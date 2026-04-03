/*
 * gongfaAffixes: 功法词缀定义集合（大幅扩展）。
 * 功法词缀特点：
 * - 通常用于被动属性能力或战斗中触发的持续效果
 * - 包含战斗中长期增幅、触发链、以及修为相关机制
 * - 映射为AbilityConfig.modifiers或listeners
 */
import { CREATION_LISTENER_PRIORITIES } from '../../config/CreationBalance';
import { ELEMENT_TO_MATERIAL_TAG } from '../../config/CreationMappings';
import { CreationTags } from '../../core/GameplayTags';
import { AttributeType, ModifierType, BuffType, StackRule } from '../../contracts/battle';
import { AffixDefinition } from '../types';

export const GONGFA_AFFIXES: AffixDefinition[] = [
  // ========================
  // ===== CORE 词缀 (10 种)
  // ========================
  {
    id: 'gongfa-core-spirit',
    displayName: '灵脉运转',
    displayDescription: '战斗中永久提升灵力属性',
    category: 'core',
    tagQuery: [CreationTags.MATERIAL.SEMANTIC_SPIRIT, CreationTags.MATERIAL.TYPE_HERB],
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
    tagQuery: [CreationTags.MATERIAL.TYPE_ORE, CreationTags.MATERIAL.TYPE_HERB],
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
    tagQuery: [
      CreationTags.MATERIAL.SEMANTIC_SPIRIT,
      CreationTags.MATERIAL.SEMANTIC_MANUAL,
      CreationTags.MATERIAL.TYPE_MANUAL,
    ],
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
    tagQuery: [CreationTags.MATERIAL.SEMANTIC_MANUAL, CreationTags.MATERIAL.TYPE_MANUAL],
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
    id: 'gongfa-core-magic-attack',
    displayName: '法力凝聚',
    displayDescription: '战斗中永久提升法术攻击力',
    category: 'core',
    tagQuery: [CreationTags.MATERIAL.SEMANTIC_SPIRIT, CreationTags.MATERIAL.SEMANTIC_BURST],
    exclusiveGroup: 'gongfa-core-damage',
    weight: 78,
    energyCost: 9,
    applicableTo: ['gongfa'],
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
    id: 'gongfa-core-mana-burn-seal',
    displayName: '蚀元印',
    displayDescription: '持有者造成伤害时附带灵力灼烧',
    category: 'core',
    tagQuery: [
      CreationTags.MATERIAL.SEMANTIC_THUNDER,
      CreationTags.MATERIAL.SEMANTIC_MANUAL,
      CreationTags.MATERIAL.SEMANTIC_SPIRIT,
    ],
    exclusiveGroup: 'gongfa-core-damage',
    weight: 65,
    energyCost: 10,
    applicableTo: ['gongfa'],
    effectTemplate: {
      type: 'mana_burn',
      params: {
        value: {
          base: { base: 12, scale: 'quality', coefficient: 4 },
          attribute: AttributeType.MAGIC_ATK,
          coefficient: 0.22,
        },
      },
    },
    listenerSpec: {
      eventType: CreationTags.BATTLE_EVENT.DAMAGE_TAKEN,
      scope: CreationTags.LISTENER_SCOPE.OWNER_AS_CASTER,
      priority: CREATION_LISTENER_PRIORITIES.damageTaken,
    },
  },
  {
    id: 'gongfa-core-crit-rate-boost',
    displayName: '暴击易触',
    displayDescription: '战斗中永久提升暴击率',
    category: 'core',
    tagQuery: [CreationTags.MATERIAL.SEMANTIC_BLADE, CreationTags.MATERIAL.TYPE_ORE],
    exclusiveGroup: 'gongfa-core-damage',
    weight: 62,
    energyCost: 9,
    applicableTo: ['gongfa'],
    effectTemplate: {
      type: 'attribute_modifier',
      params: {
        attrType: AttributeType.CRIT_RATE,
        modType: ModifierType.FIXED,
        value: { base: 0.04, scale: 'quality', coefficient: 0.012 },
      },
    },
  },
  {
    id: 'gongfa-core-amp-dual-attribute',
    displayName: '阴阳平衡',
    displayDescription: '平衡身心，同时提升物防与法防',
    category: 'core',
    tagQuery: [CreationTags.MATERIAL.SEMANTIC_GUARD, CreationTags.MATERIAL.SEMANTIC_SPIRIT],
    exclusiveGroup: 'gongfa-core-defense',
    weight: 58,
    energyCost: 10,
    applicableTo: ['gongfa'],
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
    id: 'gongfa-core-speed-mastery',
    displayName: '身法精进',
    displayDescription: '战斗中永久提升身法',
    category: 'core',
    tagQuery: [CreationTags.MATERIAL.SEMANTIC_WIND, CreationTags.MATERIAL.SEMANTIC_BLADE],
    exclusiveGroup: 'gongfa-core-defense',
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
  {
    id: 'gongfa-core-backwater-mind',
    displayName: '背水明心',
    displayDescription: '仅在低血时触发的意志强化',
    category: 'core',
    tagQuery: [
      CreationTags.MATERIAL.SEMANTIC_MANUAL,
      CreationTags.MATERIAL.SEMANTIC_GUARD,
      CreationTags.SCENARIO.CASTER_LOW_HP,
    ],
    exclusiveGroup: 'gongfa-core-defense',
    weight: 42,
    energyCost: 10,
    applicableTo: ['gongfa'],
    effectTemplate: {
      type: 'attribute_modifier',
      conditions: [{ type: 'hp_below', params: { value: 0.45 } }],
      params: {
        attrType: AttributeType.WILLPOWER,
        modType: ModifierType.ADD,
        value: { base: 0.14, scale: 'quality', coefficient: 0.02 },
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
    tagQuery: [CreationTags.MATERIAL.SEMANTIC_BLADE, CreationTags.MATERIAL.TYPE_MONSTER],
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
    tagQuery: [CreationTags.MATERIAL.SEMANTIC_SUSTAIN, CreationTags.MATERIAL.TYPE_HERB],
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
    tagQuery: [CreationTags.MATERIAL.SEMANTIC_GUARD, CreationTags.MATERIAL.TYPE_ORE],
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
      eventType: CreationTags.BATTLE_EVENT.DAMAGE_TAKEN,
      scope: CreationTags.LISTENER_SCOPE.OWNER_AS_TARGET,
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
    tagQuery: [CreationTags.MATERIAL.SEMANTIC_SPIRIT, CreationTags.MATERIAL.TYPE_MANUAL],
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
      eventType: CreationTags.BATTLE_EVENT.DAMAGE,
      scope: CreationTags.LISTENER_SCOPE.OWNER_AS_TARGET,
      priority: CREATION_LISTENER_PRIORITIES.damageApplyImmunity,
    },
  },
  {
    id: 'gongfa-prefix-evasion-master',
    displayName: '鬼魅身法',
    displayDescription: '战斗中永久提升闪避率',
    category: 'prefix',
    tagQuery: [CreationTags.MATERIAL.SEMANTIC_WIND, CreationTags.MATERIAL.SEMANTIC_BLADE],
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
    tagQuery: [CreationTags.MATERIAL.SEMANTIC_SPIRIT, CreationTags.MATERIAL.SEMANTIC_BURST],
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
    tagQuery: [CreationTags.MATERIAL.SEMANTIC_SUSTAIN, CreationTags.MATERIAL.SEMANTIC_MANUAL],
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
          tags: ['Status.Buff'],
        },
        chance: 1,
      },
    },
    listenerSpec: {
      eventType: CreationTags.BATTLE_EVENT.ROUND_PRE,
      scope: CreationTags.LISTENER_SCOPE.GLOBAL,
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
    displayDescription: '减少冰冻效果伤害',
    category: 'prefix',
    tagQuery: [CreationTags.MATERIAL.SEMANTIC_FREEZE, ELEMENT_TO_MATERIAL_TAG['冰']],
    weight: 48,
    energyCost: 7,
    applicableTo: ['gongfa'],
    effectTemplate: {
      type: 'percent_damage_modifier',
      params: {
        mode: 'reduce',
        value: { base: 0.12, scale: 'quality', coefficient: 0.025 },
        cap: 0.45,
      },
    },
    listenerSpec: {
      eventType: CreationTags.BATTLE_EVENT.DAMAGE_REQUEST,
      scope: CreationTags.LISTENER_SCOPE.OWNER_AS_TARGET,
      priority: CREATION_LISTENER_PRIORITIES.damageRequest,
    },
  },
  {
    id: 'gongfa-prefix-fire-resistance',
    displayName: '炎阳决',
    displayDescription: '减少火焰效果伤害',
    category: 'prefix',
    tagQuery: [CreationTags.MATERIAL.SEMANTIC_FLAME, ELEMENT_TO_MATERIAL_TAG['火']],
    weight: 46,
    energyCost: 7,
    applicableTo: ['gongfa'],
    effectTemplate: {
      type: 'percent_damage_modifier',
      params: {
        mode: 'reduce',
        value: { base: 0.12, scale: 'quality', coefficient: 0.025 },
        cap: 0.45,
      },
    },
    listenerSpec: {
      eventType: CreationTags.BATTLE_EVENT.DAMAGE_REQUEST,
      scope: CreationTags.LISTENER_SCOPE.OWNER_AS_TARGET,
      priority: CREATION_LISTENER_PRIORITIES.damageRequest,
    },
  },
  {
    id: 'gongfa-prefix-thunder-resistance',
    displayName: '雷心闭合',
    displayDescription: '减少雷电效果伤害',
    category: 'prefix',
    tagQuery: [CreationTags.MATERIAL.SEMANTIC_THUNDER, ELEMENT_TO_MATERIAL_TAG['雷']],
    weight: 44,
    energyCost: 7,
    applicableTo: ['gongfa'],
    effectTemplate: {
      type: 'percent_damage_modifier',
      params: {
        mode: 'reduce',
        value: { base: 0.12, scale: 'quality', coefficient: 0.025 },
        cap: 0.45,
      },
    },
    listenerSpec: {
      eventType: CreationTags.BATTLE_EVENT.DAMAGE_REQUEST,
      scope: CreationTags.LISTENER_SCOPE.OWNER_AS_TARGET,
      priority: CREATION_LISTENER_PRIORITIES.damageRequest,
    },
  },
  {
    id: 'gongfa-prefix-chill-breaker',
    displayName: '寒痕破诀',
    displayDescription: '仅在目标冰缓时触发法伤增幅',
    category: 'prefix',
    tagQuery: [
      CreationTags.MATERIAL.SEMANTIC_FREEZE,
      CreationTags.MATERIAL.SEMANTIC_BURST,
      CreationTags.SCENARIO.TARGET_HAS_CHILL,
    ],
    weight: 40,
    energyCost: 8,
    applicableTo: ['gongfa'],
    effectTemplate: {
      type: 'percent_damage_modifier',
      conditions: [{ type: 'has_tag', params: { tag: 'Status.Chill' } }],
      params: {
        mode: 'increase',
        value: { base: 0.14, scale: 'quality', coefficient: 0.03 },
        cap: 0.75,
      },
    },
    listenerSpec: {
      eventType: CreationTags.BATTLE_EVENT.DAMAGE_REQUEST,
      scope: CreationTags.LISTENER_SCOPE.OWNER_AS_CASTER,
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
    tagQuery: [
      CreationTags.MATERIAL.SEMANTIC_SPIRIT,
      CreationTags.MATERIAL.TYPE_HERB,
      CreationTags.MATERIAL.SEMANTIC_MANUAL,
    ],
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
      eventType: CreationTags.BATTLE_EVENT.ROUND_PRE,
      scope: CreationTags.LISTENER_SCOPE.GLOBAL,
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
    tagQuery: [CreationTags.MATERIAL.SEMANTIC_SPIRIT, CreationTags.MATERIAL.SEMANTIC_BURST],
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
      eventType: CreationTags.BATTLE_EVENT.DAMAGE_TAKEN,
      scope: CreationTags.LISTENER_SCOPE.OWNER_AS_CASTER,
      priority: CREATION_LISTENER_PRIORITIES.damageTaken,
    },
  },
  {
    id: 'gongfa-suffix-self-haste',
    displayName: '周天回转',
    displayDescription: '施法后缩短自身其余技能冷却',
    category: 'suffix',
    tagQuery: [CreationTags.MATERIAL.SEMANTIC_MANUAL, CreationTags.MATERIAL.SEMANTIC_WIND],
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
      eventType: CreationTags.BATTLE_EVENT.SKILL_CAST,
      scope: CreationTags.LISTENER_SCOPE.OWNER_AS_CASTER,
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
    tagQuery: [CreationTags.MATERIAL.SEMANTIC_SUSTAIN, CreationTags.MATERIAL.TYPE_HERB],
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
      eventType: CreationTags.BATTLE_EVENT.ROUND_PRE,
      scope: CreationTags.LISTENER_SCOPE.GLOBAL,
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
    tagQuery: [CreationTags.MATERIAL.SEMANTIC_GUARD, CreationTags.MATERIAL.TYPE_ORE],
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
      eventType: CreationTags.BATTLE_EVENT.DAMAGE_REQUEST,
      scope: CreationTags.LISTENER_SCOPE.OWNER_AS_TARGET,
      priority: CREATION_LISTENER_PRIORITIES.damageRequest,
    },
  },
  {
    id: 'gongfa-suffix-lifesteal-passive',
    displayName: '吸血决',
    displayDescription: '造成伤害后吸收部分气血',
    category: 'suffix',
    tagQuery: [CreationTags.MATERIAL.SEMANTIC_BURST, CreationTags.MATERIAL.SEMANTIC_SUSTAIN],
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
      eventType: CreationTags.BATTLE_EVENT.DAMAGE_TAKEN,
      scope: CreationTags.LISTENER_SCOPE.OWNER_AS_CASTER,
      priority: CREATION_LISTENER_PRIORITIES.damageTaken,
    },
  },
  {
    id: 'gongfa-suffix-debuff-cleanse',
    displayName: '净化灵气',
    displayDescription: '每回合自动解除一层debuff',
    category: 'suffix',
    tagQuery: [CreationTags.MATERIAL.SEMANTIC_SPIRIT, CreationTags.MATERIAL.TYPE_MANUAL],
    weight: 58,
    energyCost: 8,
    applicableTo: ['gongfa'],
    effectTemplate: {
      type: 'dispel',
      params: {
        targetTag: 'Status.Debuff',
        maxCount: 1,
      },
    },
    listenerSpec: {
      eventType: CreationTags.BATTLE_EVENT.ROUND_PRE,
      scope: CreationTags.LISTENER_SCOPE.GLOBAL,
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
    tagQuery: [CreationTags.MATERIAL.SEMANTIC_GUARD, CreationTags.MATERIAL.SEMANTIC_SPIRIT],
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
      eventType: CreationTags.BATTLE_EVENT.ROUND_PRE,
      scope: CreationTags.LISTENER_SCOPE.GLOBAL,
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
    tagQuery: [CreationTags.MATERIAL.SEMANTIC_BURST, CreationTags.SCENARIO.LOW_HP],
    weight: 50,
    energyCost: 10,
    applicableTo: ['gongfa'],
    effectTemplate: {
      type: 'percent_damage_modifier',
      params: {
        mode: 'increase',
        value: { base: 0.15, scale: 'quality', coefficient: 0.03 },
        cap: 0.75,
      },
    },
    listenerSpec: {
      eventType: CreationTags.BATTLE_EVENT.DAMAGE_REQUEST,
      scope: CreationTags.LISTENER_SCOPE.OWNER_AS_CASTER,
      priority: CREATION_LISTENER_PRIORITIES.damageRequest,
    },
  },
  {
    id: 'gongfa-suffix-overflow-punish',
    displayName: '盈海断流',
    displayDescription: '仅在目标高蓝时触发蚀元压制',
    category: 'suffix',
    tagQuery: [
      CreationTags.MATERIAL.SEMANTIC_THUNDER,
      CreationTags.MATERIAL.SEMANTIC_SPIRIT,
      CreationTags.SCENARIO.TARGET_HIGH_MP,
    ],
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
      eventType: CreationTags.BATTLE_EVENT.DAMAGE_TAKEN,
      scope: CreationTags.LISTENER_SCOPE.OWNER_AS_CASTER,
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
    tagQuery: [CreationTags.MATERIAL.SEMANTIC_SUSTAIN, CreationTags.MATERIAL.SEMANTIC_GUARD],
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
      eventType: CreationTags.BATTLE_EVENT.ROUND_PRE,
      scope: CreationTags.LISTENER_SCOPE.GLOBAL,
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
    tagQuery: [CreationTags.MATERIAL.SEMANTIC_SPIRIT, CreationTags.MATERIAL.SEMANTIC_SUSTAIN],
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
          tags: ['Status.Buff'],
        },
        chance: 1,
      },
    },
    listenerSpec: {
      eventType: CreationTags.BATTLE_EVENT.ROUND_PRE,
      scope: CreationTags.LISTENER_SCOPE.GLOBAL,
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
    tagQuery: [
      CreationTags.MATERIAL.SEMANTIC_GUARD,
      CreationTags.MATERIAL.SEMANTIC_SPIRIT,
      CreationTags.MATERIAL.SEMANTIC_SUSTAIN,
    ],
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
      eventType: CreationTags.BATTLE_EVENT.DAMAGE_REQUEST,
      scope: CreationTags.LISTENER_SCOPE.OWNER_AS_TARGET,
      priority: CREATION_LISTENER_PRIORITIES.damageRequest,
    },
  },
  {
    id: 'gongfa-resonance-elemental-mastery',
    displayName: '五行掌控',
    displayDescription: '多种元素伤害相互强化',
    category: 'resonance',
    tagQuery: [
      CreationTags.MATERIAL.SEMANTIC_FLAME,
      CreationTags.MATERIAL.SEMANTIC_FREEZE,
      CreationTags.MATERIAL.SEMANTIC_THUNDER,
    ],
    weight: 45,
    energyCost: 11,
    applicableTo: ['gongfa'],
    effectTemplate: {
      type: 'percent_damage_modifier',
      params: {
        mode: 'increase',
        value: { base: 0.08, scale: 'quality', coefficient: 0.02 },
        cap: 0.5,
      },
    },
    listenerSpec: {
      eventType: CreationTags.BATTLE_EVENT.DAMAGE_REQUEST,
      scope: CreationTags.LISTENER_SCOPE.OWNER_AS_CASTER,
      priority: CREATION_LISTENER_PRIORITIES.damageRequest,
    },
  },
  {
    id: 'gongfa-resonance-opening-zenith',
    displayName: '先机极境',
    displayDescription: '仅在目标高血时触发先手压制增伤',
    category: 'resonance',
    tagQuery: [
      CreationTags.MATERIAL.SEMANTIC_MANUAL,
      CreationTags.MATERIAL.SEMANTIC_BURST,
      CreationTags.SCENARIO.TARGET_HIGH_HP,
    ],
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
      eventType: CreationTags.BATTLE_EVENT.DAMAGE_REQUEST,
      scope: CreationTags.LISTENER_SCOPE.OWNER_AS_CASTER,
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
    tagQuery: [
      CreationTags.MATERIAL.SEMANTIC_SPIRIT,
      CreationTags.MATERIAL.SEMANTIC_GUARD,
      CreationTags.MATERIAL.SEMANTIC_SUSTAIN,
    ],
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
    tagQuery: [
      CreationTags.MATERIAL.SEMANTIC_SUSTAIN,
      CreationTags.MATERIAL.SEMANTIC_GUARD,
      CreationTags.MATERIAL.SEMANTIC_BURST,
    ],
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
      eventType: CreationTags.BATTLE_EVENT.ROUND_PRE,
      scope: CreationTags.LISTENER_SCOPE.GLOBAL,
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
    tagQuery: [
      CreationTags.MATERIAL.SEMANTIC_BURST,
      CreationTags.MATERIAL.SEMANTIC_GUARD,
      CreationTags.MATERIAL.SEMANTIC_BLADE,
    ],
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
      eventType: CreationTags.BATTLE_EVENT.DAMAGE_REQUEST,
      scope: CreationTags.LISTENER_SCOPE.OWNER_AS_CASTER,
      priority: CREATION_LISTENER_PRIORITIES.damageRequest,
    },
  },
  {
    id: 'gongfa-synergy-crisis-reversal',
    displayName: '危机逆转',
    displayDescription: '仅在低血时触发的恢复与韧性强化',
    category: 'synergy',
    tagQuery: [
      CreationTags.MATERIAL.SEMANTIC_SUSTAIN,
      CreationTags.MATERIAL.SEMANTIC_GUARD,
      CreationTags.SCENARIO.CASTER_LOW_HP,
    ],
    weight: 40,
    energyCost: 12,
    applicableTo: ['gongfa'],
    effectTemplate: {
      type: 'heal',
      conditions: [{ type: 'hp_below', params: { value: 0.45 } }],
      params: {
        value: {
          base: { base: 10, scale: 'quality', coefficient: 3 },
          attribute: AttributeType.SPIRIT,
          coefficient: 0.18,
        },
      },
    },
    listenerSpec: {
      eventType: CreationTags.BATTLE_EVENT.ROUND_PRE,
      scope: CreationTags.LISTENER_SCOPE.GLOBAL,
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
    tagQuery: [
      CreationTags.MATERIAL.SEMANTIC_THUNDER,
      CreationTags.MATERIAL.SEMANTIC_SPIRIT,
      CreationTags.SCENARIO.TARGET_LOW_MP,
    ],
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
      eventType: CreationTags.BATTLE_EVENT.DAMAGE_REQUEST,
      scope: CreationTags.LISTENER_SCOPE.OWNER_AS_CASTER,
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
    tagQuery: [CreationTags.MATERIAL.SEMANTIC_MANUAL, CreationTags.MATERIAL.SEMANTIC_SPIRIT],
    exclusiveGroup: 'gongfa-signature-ultimate',
    weight: 28,
    energyCost: 13,
    minQuality: '玄品',
    applicableTo: ['gongfa'],
    effectTemplate: {
      type: 'attribute_modifier',
      params: {
        attrType: AttributeType.WISDOM,
        modType: ModifierType.MULTIPLY,
        value: { base: 0.12, scale: 'quality', coefficient: 0.02 },
      },
    },
  },
  {
    id: 'gongfa-signature-unbound-mind',
    displayName: '万念不染',
    displayDescription: '解脱束缚，增强所有属性',
    category: 'signature',
    tagQuery: [CreationTags.MATERIAL.SEMANTIC_MANUAL, CreationTags.MATERIAL.TYPE_SPECIAL],
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
          tags: ['Status.Mythic'],
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
      eventType: CreationTags.BATTLE_EVENT.ROUND_PRE,
      scope: CreationTags.LISTENER_SCOPE.GLOBAL,
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
    tagQuery: [
      CreationTags.MATERIAL.SEMANTIC_SUSTAIN,
      CreationTags.MATERIAL.SEMANTIC_FLAME,
      CreationTags.MATERIAL.TYPE_SPECIAL,
    ],
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
      eventType: CreationTags.BATTLE_EVENT.ROUND_PRE,
      scope: CreationTags.LISTENER_SCOPE.GLOBAL,
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
    tagQuery: [
      CreationTags.MATERIAL.SEMANTIC_GUARD,
      CreationTags.MATERIAL.SEMANTIC_SPIRIT,
      CreationTags.MATERIAL.TYPE_SPECIAL,
      CreationTags.SCENARIO.CASTER_LOW_HP,
    ],
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
        tags: [CreationTags.BATTLE.ABILITY_TYPE_MAGIC],
      },
    },
    listenerSpec: {
      eventType: CreationTags.BATTLE_EVENT.DAMAGE,
      scope: CreationTags.LISTENER_SCOPE.OWNER_AS_TARGET,
      priority: CREATION_LISTENER_PRIORITIES.damageApplyImmunity,
    },
  },
  {
    id: 'gongfa-mythic-ascension',
    displayName: '飞升大道',
    displayDescription: '功法达到超越凡俗的境界，所有属性与效果指数增长',
    category: 'mythic',
    tagQuery: [
      CreationTags.MATERIAL.SEMANTIC_SPIRIT,
      CreationTags.MATERIAL.SEMANTIC_MANUAL,
      CreationTags.MATERIAL.TYPE_SPECIAL,
    ],
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
          tags: ['Status.Mythic'],
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
      eventType: CreationTags.BATTLE_EVENT.ROUND_PRE,
      scope: CreationTags.LISTENER_SCOPE.GLOBAL,
      priority: CREATION_LISTENER_PRIORITIES.roundPre,
      mapping: {
        caster: 'owner',
        target: 'owner',
      },
    },
  },
];
