/*
 * artifactAffixes: 法宝词缀定义集合（大幅扩展）。
 * 法宝词缀特点：通常包含 listenerSpec，用于被动能力的 listener 注册
 * 包括常驻属性修改、战斗中被动触发、以及高阶联动效果
 */
import { CREATION_LISTENER_PRIORITIES } from '../../config/CreationBalance';
import { ELEMENT_TO_MATERIAL_TAG } from '../../config/CreationMappings';
import {
  CreationTags,
  ELEMENT_TO_RUNTIME_ABILITY_TAG,
  GameplayTags,
} from '@/engine/shared/tag-domain';
import {
  AttributeType,
  BuffType,
  ModifierType,
  StackRule,
} from '../../contracts/battle';
import { EXCLUSIVE_GROUP } from '../exclusiveGroups';
import { AffixDefinition, matchAll } from '../types';

export const ARTIFACT_AFFIXES: AffixDefinition[] = [
  // ========================
  // ===== SLOT-BOUND CORE 词缀 (artifact only)
  // ========================
  {
    id: 'artifact-core-weapon-dual-edge',
    displayName: '双攻战器',
    displayDescription: '永久提升物攻和法攻，修士常用的基础战器词条',
    category: 'core',
    match: matchAll([]),
    exclusiveGroup: EXCLUSIVE_GROUP.ARTIFACT.CORE_SLOT_WEAPON,
    weight: 100,
    energyCost: 8,
    applicableArtifactSlots: ['weapon'],
    applicableTo: ['artifact'],
    effectTemplate: {
      type: 'attribute_modifier',
      params: {
        modifiers: [
          {
            attrType: AttributeType.ATK,
            modType: ModifierType.FIXED,
            value: { base: 6, scale: 'quality', coefficient: 2 },
          },
          {
            attrType: AttributeType.MAGIC_ATK,
            modType: ModifierType.FIXED,
            value: { base: 6, scale: 'quality', coefficient: 2 },
          },
        ],
      },
    },
  },
  {
    id: 'artifact-core-armor-dual-ward',
    displayName: '双防护甲',
    displayDescription: '永久提升物防和法防，适合稳扎稳打的护甲词条',
    category: 'core',
    match: matchAll([]),
    exclusiveGroup: EXCLUSIVE_GROUP.ARTIFACT.CORE_SLOT_ARMOR,
    weight: 100,
    energyCost: 8,
    applicableArtifactSlots: ['armor'],
    applicableTo: ['artifact'],
    effectTemplate: {
      type: 'attribute_modifier',
      params: {
        modifiers: [
          {
            attrType: AttributeType.DEF,
            modType: ModifierType.FIXED,
            value: { base: 6, scale: 'quality', coefficient: 2 },
          },
          {
            attrType: AttributeType.MAGIC_DEF,
            modType: ModifierType.FIXED,
            value: { base: 6, scale: 'quality', coefficient: 2 },
          },
        ],
      },
    },
  },
  {
    id: 'artifact-core-accessory-secondary-roll',
    displayName: '二级属性佩',
    displayDescription: '造物时从全部二级属性池中随机抽取2条属性強化，每件配饰属性组合独一无二',
    category: 'core',
    match: matchAll([]),
    exclusiveGroup: EXCLUSIVE_GROUP.ARTIFACT.CORE_SLOT_ACCESSORY,
    weight: 100,
    energyCost: 8,
    applicableArtifactSlots: ['accessory'],
    applicableTo: ['artifact'],
    effectTemplate: {
      type: 'random_attribute_modifier',
      params: {
        pickCount: 2,
        pool: [
          { attrType: AttributeType.CRIT_RATE,             modType: ModifierType.FIXED, value: { base: 0.035, scale: 'quality', coefficient: 0.008 } },
          { attrType: AttributeType.CRIT_DAMAGE_MULT,      modType: ModifierType.FIXED, value: { base: 0.08,  scale: 'quality', coefficient: 0.02  } },
          { attrType: AttributeType.EVASION_RATE,          modType: ModifierType.FIXED, value: { base: 0.035, scale: 'quality', coefficient: 0.008 } },
          { attrType: AttributeType.ACCURACY,              modType: ModifierType.FIXED, value: { base: 0.06,  scale: 'quality', coefficient: 0.015 } },
          { attrType: AttributeType.CONTROL_HIT,           modType: ModifierType.FIXED, value: { base: 0.045, scale: 'quality', coefficient: 0.01  } },
          { attrType: AttributeType.CONTROL_RESISTANCE,    modType: ModifierType.FIXED, value: { base: 0.045, scale: 'quality', coefficient: 0.01  } },
          { attrType: AttributeType.ARMOR_PENETRATION,     modType: ModifierType.FIXED, value: { base: 0.08,  scale: 'quality', coefficient: 0.015 } },
          { attrType: AttributeType.MAGIC_PENETRATION,     modType: ModifierType.FIXED, value: { base: 0.08,  scale: 'quality', coefficient: 0.015 } },
          { attrType: AttributeType.CRIT_RESIST,           modType: ModifierType.FIXED, value: { base: 0.05,  scale: 'quality', coefficient: 0.01  } },
          { attrType: AttributeType.CRIT_DAMAGE_REDUCTION, modType: ModifierType.FIXED, value: { base: 0.08,  scale: 'quality', coefficient: 0.015 } },
          { attrType: AttributeType.HEAL_AMPLIFY,          modType: ModifierType.FIXED, value: { base: 0.07,  scale: 'quality', coefficient: 0.015 } },
        ],
      },
    },
  },

  // ========================
  // ===== LEGACY 非槽位词缀（已降级为 prefix / suffix，避免继续占用 core 合约）
  // ========================
  {
    id: 'artifact-core-vitality',
    displayName: '体魄强化',
    displayDescription: '永久提升体魄，打持久战更稳',
    category: 'prefix',
    match: matchAll([CreationTags.MATERIAL.TYPE_ORE, CreationTags.MATERIAL.SEMANTIC_GUARD]),
    exclusiveGroup: EXCLUSIVE_GROUP.ARTIFACT.CORE_STAT,
    weight: 95,
    energyCost: 8,
    applicableTo: ['artifact'],
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
    id: 'artifact-core-spirit',
    displayName: '灵力强化',
    displayDescription: '永久提升灵力，提高法术相关收益',
    category: 'prefix',
    match: matchAll([CreationTags.MATERIAL.SEMANTIC_SPIRIT, CreationTags.MATERIAL.TYPE_MONSTER]),
    exclusiveGroup: EXCLUSIVE_GROUP.ARTIFACT.CORE_STAT,
    weight: 90,
    energyCost: 8,
    applicableTo: ['artifact'],
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
    id: 'artifact-core-attack-power',
    displayName: '物攻强化',
    displayDescription: '永久提升物理攻击力，剑修常用',
    category: 'prefix',
    match: matchAll([CreationTags.MATERIAL.SEMANTIC_BLADE, CreationTags.MATERIAL.TYPE_ORE]),
    exclusiveGroup: EXCLUSIVE_GROUP.ARTIFACT.CORE_STAT,
    weight: 82,
    energyCost: 8,
    applicableTo: ['artifact'],
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
    id: 'artifact-core-magic-attack',
    displayName: '法攻强化',
    displayDescription: '永久提升法术攻击力，术法流核心之一',
    category: 'prefix',
    match: matchAll([CreationTags.MATERIAL.SEMANTIC_SPIRIT, CreationTags.MATERIAL.SEMANTIC_BURST]),
    exclusiveGroup: EXCLUSIVE_GROUP.ARTIFACT.CORE_STAT,
    weight: 80,
    energyCost: 8,
    applicableTo: ['artifact'],
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
    id: 'artifact-core-shield-on-hit',
    displayName: '受击护盾',
    displayDescription: '受击时自动生成护盾，提升容错',
    category: 'suffix',
    match: matchAll([
      CreationTags.MATERIAL.SEMANTIC_GUARD,
      CreationTags.MATERIAL.TYPE_ORE,
      CreationTags.MATERIAL.SEMANTIC_BURST,
    ]),
    exclusiveGroup: EXCLUSIVE_GROUP.ARTIFACT.CORE_DEFENSE,
    weight: 75,
    energyCost: 10,
    applicableTo: ['artifact'],
    grantedAbilityTags: [GameplayTags.TRAIT.SHIELD_MASTER],
    effectTemplate: {
      type: 'shield',
      params: {
        value: {
          base: { base: 14, scale: 'quality', coefficient: 6 },
          attribute: AttributeType.SPIRIT,
          coefficient: 0.3,
        },
      },
    },
    listenerSpec: {
      eventType: GameplayTags.EVENT.DAMAGE_TAKEN,
      scope: GameplayTags.SCOPE.OWNER_AS_TARGET,
      priority: CREATION_LISTENER_PRIORITIES.damageTaken,
    },
  },
  {
    id: 'artifact-core-reflect-thorns',
    displayName: '受击反伤',
    displayDescription: '受击后把一部分伤害反给敌人',
    category: 'suffix',
    match: matchAll([CreationTags.MATERIAL.SEMANTIC_GUARD, CreationTags.MATERIAL.SEMANTIC_BURST]),
    exclusiveGroup: EXCLUSIVE_GROUP.ARTIFACT.CORE_DEFENSE,
    weight: 70,
    energyCost: 10,
    applicableTo: ['artifact'],
    grantedAbilityTags: [GameplayTags.TRAIT.REFLECT],
    effectTemplate: {
      type: 'reflect',
      params: {
        ratio: { base: 0.12, scale: 'quality', coefficient: 0.03 },
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
    id: 'artifact-core-heal-passive',
    displayName: '回合回血',
    displayDescription: '每回合自动恢复气血，续航更稳定',
    category: 'suffix',
    match: matchAll([CreationTags.MATERIAL.SEMANTIC_SUSTAIN, CreationTags.MATERIAL.TYPE_HERB]),
    exclusiveGroup: EXCLUSIVE_GROUP.ARTIFACT.CORE_DEFENSE,
    weight: 68,
    energyCost: 9,
    applicableTo: ['artifact'],
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
    id: 'artifact-core-death-prevent',
    displayName: '濒死续命',
    displayDescription: '每场战斗可在致命时刻保命一次',
    category: 'suffix',
    match: matchAll([
      CreationTags.MATERIAL.SEMANTIC_GUARD,
      CreationTags.MATERIAL.SEMANTIC_SPIRIT,
      CreationTags.MATERIAL.TYPE_SPECIAL,
    ]),
    exclusiveGroup: EXCLUSIVE_GROUP.ARTIFACT.CORE_DEFENSE,
    weight: 55,
    energyCost: 11,
    applicableTo: ['artifact'],
    effectTemplate: {
      type: 'death_prevent',
      params: {},
    },
    listenerSpec: {
      eventType: GameplayTags.EVENT.DAMAGE_TAKEN,
      scope: GameplayTags.SCOPE.OWNER_AS_TARGET,
      priority: CREATION_LISTENER_PRIORITIES.damageTaken,
      guard: {
        requireOwnerAlive: false,
        allowLethalWindow: true,
      },
    },
  },
  {
    id: 'artifact-core-last-stand-shell',
    displayName: '低血护盾',
    displayDescription: '血量低时触发更强护盾，适合反打',
    category: 'suffix',
    match: matchAll([
      CreationTags.MATERIAL.SEMANTIC_GUARD,
      CreationTags.MATERIAL.SEMANTIC_SPIRIT,
    ]),
    exclusiveGroup: EXCLUSIVE_GROUP.ARTIFACT.CORE_DEFENSE,
    weight: 44,
    energyCost: 11,
    minQuality: '灵品',
    applicableTo: ['artifact'],
    grantedAbilityTags: [GameplayTags.TRAIT.SHIELD_MASTER],
    effectTemplate: {
      type: 'shield',
      conditions: [{ type: 'hp_below', params: { value: 0.4, scope: 'caster' } }],
      params: {
        value: {
          base: { base: 18, scale: 'quality', coefficient: 6 },
          attribute: AttributeType.SPIRIT,
          coefficient: 0.25,
        },
      },
    },
    listenerSpec: {
      eventType: GameplayTags.EVENT.DAMAGE_TAKEN,
      scope: GameplayTags.SCOPE.OWNER_AS_TARGET,
      priority: CREATION_LISTENER_PRIORITIES.damageTaken,
    },
  },

  // ========================
  // ===== PREFIX 词缀 (13 种)
  // ========================
  {
    id: 'artifact-prefix-crit-rate',
    displayName: '暴击率强化',
    displayDescription: '永久提升暴击率',
    category: 'prefix',
    match: matchAll([CreationTags.MATERIAL.SEMANTIC_BLADE, CreationTags.MATERIAL.TYPE_MONSTER]),
    exclusiveGroup: EXCLUSIVE_GROUP.ARTIFACT.PREFIX_CRIT_RATE,
    weight: 90,
    energyCost: 6,
    applicableTo: ['artifact'],
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
    id: 'artifact-prefix-speed',
    displayName: '速度强化',
    displayDescription: '永久提升速度，先手更容易',
    category: 'prefix',
    match: matchAll([CreationTags.MATERIAL.SEMANTIC_WIND, ELEMENT_TO_MATERIAL_TAG['风']]),
    exclusiveGroup: EXCLUSIVE_GROUP.ARTIFACT.PREFIX_MOBILITY,
    weight: 80,
    energyCost: 6,
    applicableTo: ['artifact'],
    effectTemplate: {
      type: 'attribute_modifier',
      params: {
        attrType: AttributeType.SPEED,
        modType: ModifierType.FIXED,
        value: { base: 2, scale: 'quality', coefficient: 1 },
      },
    },
  },
  {
    id: 'artifact-prefix-evasion',
    displayName: '闪避强化',
    displayDescription: '永久提升闪避率',
    category: 'prefix',
    match: matchAll([CreationTags.MATERIAL.SEMANTIC_WIND, CreationTags.MATERIAL.SEMANTIC_BLADE]),
    exclusiveGroup: EXCLUSIVE_GROUP.ARTIFACT.PREFIX_MOBILITY,
    weight: 75,
    energyCost: 6,
    applicableTo: ['artifact'],
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
    id: 'artifact-prefix-magic-penetration',
    displayName: '法穿锐锋',
    displayDescription: '永久提升法术穿透',
    category: 'prefix',
    match: matchAll([CreationTags.MATERIAL.SEMANTIC_SPIRIT, CreationTags.MATERIAL.SEMANTIC_BURST]),
    weight: 70,
    energyCost: 7,
    applicableTo: ['artifact'],
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
    id: 'artifact-prefix-crit-damage',
    displayName: '暴伤强化',
    displayDescription: '永久提升暴击伤害倍数',
    category: 'prefix',
    match: matchAll([CreationTags.MATERIAL.SEMANTIC_BURST, CreationTags.MATERIAL.TYPE_ORE]),
    exclusiveGroup: EXCLUSIVE_GROUP.ARTIFACT.PREFIX_CRIT_DMG,
    weight: 68,
    energyCost: 7,
    applicableTo: ['artifact'],
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
    id: 'artifact-prefix-heal-amplify',
    displayName: '治疗强化',
    displayDescription: '永久提升治疗效果倍数',
    category: 'prefix',
    match: matchAll([CreationTags.MATERIAL.SEMANTIC_SUSTAIN, CreationTags.MATERIAL.SEMANTIC_SPIRIT]),
    weight: 65,
    energyCost: 7,
    applicableTo: ['artifact'],
    effectTemplate: {
      type: 'attribute_modifier',
      params: {
        attrType: AttributeType.HEAL_AMPLIFY,
        modType: ModifierType.FIXED,
        value: { base: 0.08, scale: 'quality', coefficient: 0.015 },
      },
    },
  },
  {
    id: 'artifact-prefix-cooldown-seal',
    displayName: '冷却压制',
    displayDescription: '技能命中后延长目标冷却，压制对手节奏',
    category: 'prefix',
    match: matchAll([CreationTags.MATERIAL.SEMANTIC_MANUAL, CreationTags.MATERIAL.SEMANTIC_GUARD]),
    weight: 60,
    energyCost: 7,
    applicableTo: ['artifact'],
    effectTemplate: {
      type: 'cooldown_modify',
      params: {
        cdModifyValue: { base: 0.8, scale: 'quality', coefficient: 0.15 },
      },
    },
    listenerSpec: {
      eventType: GameplayTags.EVENT.SKILL_CAST,
      scope: GameplayTags.SCOPE.OWNER_AS_CASTER,
      priority: CREATION_LISTENER_PRIORITIES.skillCast,
      mapping: {
        caster: 'owner',
        target: 'event.target',
      },
    },
  },
  {
    id: 'artifact-prefix-physical-defense',
    displayName: '物防强化',
    displayDescription: '永久提升物理防御',
    category: 'prefix',
    match: matchAll([CreationTags.MATERIAL.SEMANTIC_GUARD, CreationTags.MATERIAL.TYPE_ORE]),
    weight: 58,
    energyCost: 6,
    applicableTo: ['artifact'],
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
    id: 'artifact-prefix-magic-defense',
    displayName: '法防强化',
    displayDescription: '永久提升法术防御',
    category: 'prefix',
    match: matchAll([CreationTags.MATERIAL.SEMANTIC_SPIRIT, CreationTags.MATERIAL.TYPE_HERB]),
    weight: 56,
    energyCost: 6,
    applicableTo: ['artifact'],
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
    id: 'artifact-prefix-willpower-boost',
    displayName: '意志强化',
    displayDescription: '永久提升意志力，抵抗控制',
    category: 'prefix',
    match: matchAll([CreationTags.MATERIAL.SEMANTIC_MANUAL, CreationTags.MATERIAL.TYPE_MANUAL]),
    weight: 52,
    energyCost: 6,
    applicableTo: ['artifact'],
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
    id: 'artifact-prefix-wisdom-insight',
    displayName: '悟性强化',
    displayDescription: '永久提升悟性，加快修为',
    category: 'prefix',
    match: matchAll([CreationTags.MATERIAL.SEMANTIC_SPIRIT, CreationTags.MATERIAL.SEMANTIC_MANUAL]),
    weight: 50,
    energyCost: 6,
    applicableTo: ['artifact'],
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
    id: 'artifact-prefix-chill-hunter',
    displayName: '冰缓追击',
    displayDescription: '只对冰缓目标额外增伤，适合冰系配队',
    category: 'prefix',
    match: matchAll([
      CreationTags.MATERIAL.SEMANTIC_FREEZE,
      CreationTags.MATERIAL.SEMANTIC_BURST,
    ]),
    weight: 42,
    energyCost: 7,
    applicableTo: ['artifact'],
    effectTemplate: {
      type: 'percent_damage_modifier',
      conditions: [
        { type: 'has_tag', params: { tag: GameplayTags.STATUS.STATE.CHILLED } },
      ],
      params: {
        mode: 'increase',
        value: { base: 0.13, scale: 'quality', coefficient: 0.025 },
        cap: 0.7,
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
    id: 'artifact-suffix-heal-on-round',
    displayName: '回合回血',
    displayDescription: '每回合开始时恢复气血',
    category: 'suffix',
    match: matchAll([CreationTags.MATERIAL.SEMANTIC_SUSTAIN, CreationTags.MATERIAL.TYPE_HERB]),
    exclusiveGroup: EXCLUSIVE_GROUP.ARTIFACT.SUFFIX_ROUND_HEAL,
    weight: 75,
    energyCost: 8,
    applicableTo: ['artifact'],
    grantedAbilityTags: [GameplayTags.ABILITY.FUNCTION.HEAL],
    effectTemplate: {
      type: 'heal',
      params: {
        value: {
          base: { base: 8, scale: 'quality', coefficient: 4 },
          attribute: AttributeType.SPIRIT,
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
    id: 'artifact-suffix-armor-passive',
    displayName: '受击减伤',
    displayDescription: '受击时减免伤害',
    category: 'suffix',
    match: matchAll([CreationTags.MATERIAL.SEMANTIC_GUARD, CreationTags.MATERIAL.TYPE_ORE]),
    weight: 70,
    energyCost: 8,
    applicableTo: ['artifact'],
    effectTemplate: {
      type: 'percent_damage_modifier',
      params: {
        mode: 'reduce',
        value: { base: 0.08, scale: 'quality', coefficient: 0.02 },
        cap: 0.35,
      },
    },
    listenerSpec: {
      eventType: GameplayTags.EVENT.DAMAGE_REQUEST,
      scope: GameplayTags.SCOPE.OWNER_AS_TARGET,
      priority: CREATION_LISTENER_PRIORITIES.damageRequest,
    },
  },
  {
    id: 'artifact-suffix-magic-shield',
    displayName: '法力护幕',
    displayDescription: '受击时消耗灵力抵消伤害',
    category: 'suffix',
    match: matchAll([CreationTags.MATERIAL.SEMANTIC_SPIRIT, CreationTags.MATERIAL.SEMANTIC_GUARD]),
    weight: 68,
    energyCost: 9,
    applicableTo: ['artifact'],
    effectTemplate: {
      type: 'magic_shield',
      params: {
        absorbRatio: { base: 0.78, scale: 'quality', coefficient: 0.03 },
      },
    },
    listenerSpec: {
      eventType: GameplayTags.EVENT.DAMAGE,
      scope: GameplayTags.SCOPE.OWNER_AS_TARGET,
      priority: CREATION_LISTENER_PRIORITIES.damageApplyImmunity,
    },
  },
  {
    id: 'artifact-suffix-vampiric-core',
    displayName: '伤害吸血',
    displayDescription: '造成伤害后按比例回复气血',
    category: 'suffix',
    match: matchAll([CreationTags.MATERIAL.SEMANTIC_BURST, CreationTags.MATERIAL.SEMANTIC_SUSTAIN]),
    weight: 65,
    energyCost: 9,
    applicableTo: ['artifact'],
    grantedAbilityTags: [GameplayTags.TRAIT.LIFESTEAL],
    effectTemplate: {
      type: 'resource_drain',
      params: {
        sourceType: 'hp',
        targetType: 'hp',
        ratio: { base: 0.1, scale: 'quality', coefficient: 0.03 },
      },
    },
    listenerSpec: {
      eventType: GameplayTags.EVENT.DAMAGE_TAKEN,
      scope: GameplayTags.SCOPE.OWNER_AS_CASTER,
      priority: CREATION_LISTENER_PRIORITIES.damageTaken,
    },
  },
  {
    id: 'artifact-suffix-mana-recovery',
    displayName: '回合回蓝',
    displayDescription: '每回合恢复一定灵力',
    category: 'suffix',
    match: matchAll([CreationTags.MATERIAL.SEMANTIC_SPIRIT, CreationTags.MATERIAL.TYPE_HERB]),
    weight: 60,
    energyCost: 8,
    applicableTo: ['artifact'],
    grantedAbilityTags: [GameplayTags.ABILITY.FUNCTION.HEAL],
    effectTemplate: {
      type: 'heal',
      params: {
        target: 'mp',
        value: {
          base: { base: 10, scale: 'quality', coefficient: 4 },
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
    id: 'artifact-suffix-counter-attack',
    displayName: '受击反击',
    displayDescription: '受击时反击攻击者',
    category: 'suffix',
    match: matchAll([CreationTags.MATERIAL.SEMANTIC_BLADE, CreationTags.MATERIAL.SEMANTIC_BURST]),
    weight: 58,
    energyCost: 9,
    applicableTo: ['artifact'],
    grantedAbilityTags: [
      GameplayTags.ABILITY.FUNCTION.DAMAGE,
      GameplayTags.ABILITY.CHANNEL.PHYSICAL,
    ],
    effectTemplate: {
      type: 'damage',
      params: {
        value: {
          base: { base: 5, scale: 'quality', coefficient: 2 },
          attribute: AttributeType.ATK,
          coefficient: 0.25,
        },
      },
    },
    listenerSpec: {
      eventType: GameplayTags.EVENT.DAMAGE_TAKEN,
      scope: GameplayTags.SCOPE.OWNER_AS_TARGET,
      priority: CREATION_LISTENER_PRIORITIES.damageTaken,
      mapping: {
        caster: 'owner',
        target: 'event.caster',
      },
    },
  },
  {
    id: 'artifact-suffix-buff-immunity',
    displayName: '减益免疫',
    displayDescription: '免疫指定类型的减益效果',
    category: 'suffix',
    match: matchAll([CreationTags.MATERIAL.SEMANTIC_SPIRIT, CreationTags.MATERIAL.SEMANTIC_GUARD]),
    weight: 50,
    energyCost: 10,
    applicableTo: ['artifact'],
    effectTemplate: {
      type: 'buff_immunity',
      params: {
        tags: [GameplayTags.BUFF.TYPE.DEBUFF],
      },
    },
    listenerSpec: {
      eventType: GameplayTags.EVENT.BUFF_ADD,
      scope: GameplayTags.SCOPE.OWNER_AS_TARGET,
      priority: CREATION_LISTENER_PRIORITIES.buffIntercept,
    },
  },
  {
    id: 'artifact-suffix-damage-type-reduce',
    displayName: '冰伤减免',
    displayDescription: '减少冰系技能造成的伤害',
    category: 'suffix',
    match: matchAll([CreationTags.MATERIAL.SEMANTIC_GUARD, ELEMENT_TO_MATERIAL_TAG['冰']]),
    weight: 48,
    energyCost: 9,
    applicableTo: ['artifact'],
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
    id: 'artifact-suffix-dispel-debuff',
    displayName: '回合驱散',
    displayDescription: '每回合自动驱散一层减益',
    category: 'suffix',
    match: matchAll([CreationTags.MATERIAL.SEMANTIC_SPIRIT, CreationTags.MATERIAL.TYPE_MANUAL]),
    weight: 45,
    energyCost: 8,
    applicableTo: ['artifact'],
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
    id: 'artifact-suffix-high-mana-sunder',
    displayName: '高蓝燃灵',
    displayDescription: '只对高法力目标触发燃灵效果',
    category: 'suffix',
    match: matchAll([
      CreationTags.MATERIAL.SEMANTIC_THUNDER,
      CreationTags.MATERIAL.SEMANTIC_SPIRIT,
    ]),
    weight: 38,
    energyCost: 9,
    applicableTo: ['artifact'],
    grantedAbilityTags: [GameplayTags.TRAIT.MANA_THIEF],
    effectTemplate: {
      type: 'mana_burn',
      conditions: [{ type: 'mp_above', params: { value: 0.65 } }],
      params: {
        value: {
          base: { base: 12, scale: 'quality', coefficient: 4 },
          attribute: AttributeType.MAGIC_ATK,
          coefficient: 0.18,
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
    id: 'artifact-resonance-element-force',
    displayName: '元素增伤共鸣',
    displayDescription: '元素技能造成的伤害持续增幅',
    category: 'resonance',
    match: matchAll([
      CreationTags.MATERIAL.SEMANTIC_FLAME,
      CreationTags.MATERIAL.SEMANTIC_FREEZE,
      ELEMENT_TO_MATERIAL_TAG['火'],
    ]),
    weight: 55,
    energyCost: 11,
    applicableTo: ['artifact'],
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
        value: { base: 0.06, scale: 'quality', coefficient: 0.015 },
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
    id: 'artifact-resonance-dual-defense',
    displayName: '双防共鸣',
    displayDescription: '物防和法防同步提升，护体更稳',
    category: 'resonance',
    match: matchAll([CreationTags.MATERIAL.SEMANTIC_GUARD, CreationTags.MATERIAL.SEMANTIC_SPIRIT]),
    weight: 52,
    energyCost: 11,
    applicableTo: ['artifact'],
    effectTemplate: {
      type: 'attribute_modifier',
      params: {
        modifiers: [
          {
            attrType: AttributeType.DEF,
            modType: ModifierType.ADD,
            value: { base: 0.08, scale: 'quality', coefficient: 0.015 },
          },
          {
            attrType: AttributeType.MAGIC_DEF,
            modType: ModifierType.ADD,
            value: { base: 0.08, scale: 'quality', coefficient: 0.015 },
          },
        ],
      },
    },
  },
  {
    id: 'artifact-resonance-sustain-bond',
    displayName: '续航护体共鸣',
    displayDescription: '治疗和防御同时强化，适合持久战',
    category: 'resonance',
    match: matchAll([CreationTags.MATERIAL.SEMANTIC_SUSTAIN, CreationTags.MATERIAL.SEMANTIC_GUARD]),
    weight: 49,
    energyCost: 10,
    applicableTo: ['artifact'],
    effectTemplate: {
      type: 'attribute_modifier',
      params: {
        modifiers: [
          {
            attrType: AttributeType.HEAL_AMPLIFY,
            modType: ModifierType.FIXED,
            value: { base: 0.07, scale: 'quality', coefficient: 0.015 },
          },
          {
            attrType: AttributeType.DEF,
            modType: ModifierType.ADD,
            value: { base: 0.05, scale: 'quality', coefficient: 0.01 },
          },
          {
            attrType: AttributeType.MAGIC_DEF,
            modType: ModifierType.ADD,
            value: { base: 0.05, scale: 'quality', coefficient: 0.01 },
          },
        ],
      },
    },
  },
  {
    id: 'artifact-resonance-offensense-flow',
    displayName: '攻防同修',
    displayDescription: '攻防属性一起提升，打法更均衡',
    category: 'resonance',
    match: matchAll([CreationTags.MATERIAL.SEMANTIC_BURST, CreationTags.MATERIAL.SEMANTIC_GUARD]),
    weight: 46,
    energyCost: 11,
    applicableTo: ['artifact'],
    effectTemplate: {
      type: 'attribute_modifier',
      params: {
        modifiers: [
          {
            attrType: AttributeType.ATK,
            modType: ModifierType.ADD,
            value: { base: 0.05, scale: 'quality', coefficient: 0.01 },
          },
          {
            attrType: AttributeType.MAGIC_ATK,
            modType: ModifierType.ADD,
            value: { base: 0.05, scale: 'quality', coefficient: 0.01 },
          },
          {
            attrType: AttributeType.DEF,
            modType: ModifierType.ADD,
            value: { base: 0.05, scale: 'quality', coefficient: 0.01 },
          },
          {
            attrType: AttributeType.MAGIC_DEF,
            modType: ModifierType.ADD,
            value: { base: 0.05, scale: 'quality', coefficient: 0.01 },
          },
        ],
      },
    },
  },
  {
    id: 'artifact-resonance-opening-pressure',
    displayName: '开局压制',
    displayDescription: '仅在目标高血时触发开局攻势加成',
    category: 'resonance',
    match: matchAll([
      CreationTags.MATERIAL.SEMANTIC_BURST,
      CreationTags.MATERIAL.SEMANTIC_GUARD,
    ]),
    weight: 36,
    energyCost: 11,
    applicableTo: ['artifact'],
    effectTemplate: {
      type: 'percent_damage_modifier',
      conditions: [{ type: 'hp_above', params: { value: 0.75 } }],
      params: {
        mode: 'increase',
        value: { base: 0.11, scale: 'quality', coefficient: 0.02 },
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
  // ===== SYNERGY 词缀 (6 种)
  // ========================
  {
    id: 'artifact-synergy-multi-defense',
    displayName: '多重护体',
    displayDescription: '多层防御机制相互补强',
    category: 'synergy',
    match: matchAll([
      CreationTags.MATERIAL.SEMANTIC_GUARD,
      CreationTags.MATERIAL.SEMANTIC_SPIRIT,
      CreationTags.MATERIAL.TYPE_ORE,
    ]),
    weight: 48,
    energyCost: 12,
    applicableTo: ['artifact'],
    grantedAbilityTags: [GameplayTags.TRAIT.SHIELD_MASTER],
    effectTemplate: {
      type: 'shield',
      params: {
        value: {
          base: { base: 12, scale: 'quality', coefficient: 5 },
          attribute: AttributeType.SPIRIT,
          coefficient: 0.25,
        },
      },
    },
    listenerSpec: {
      eventType: GameplayTags.EVENT.DAMAGE_TAKEN,
      scope: GameplayTags.SCOPE.OWNER_AS_TARGET,
      priority: CREATION_LISTENER_PRIORITIES.damageTaken,
    },
  },
  {
    id: 'artifact-synergy-reflect-burst',
    displayName: '反伤联动',
    displayDescription: '受击时联动反伤机制，压制近战对手',
    category: 'synergy',
    match: matchAll([CreationTags.MATERIAL.SEMANTIC_BURST, CreationTags.MATERIAL.SEMANTIC_GUARD]),
    weight: 45,
    energyCost: 12,
    applicableTo: ['artifact'],
    grantedAbilityTags: [GameplayTags.TRAIT.REFLECT],
    effectTemplate: {
      type: 'reflect',
      params: {
        ratio: { base: 0.18, scale: 'quality', coefficient: 0.035 },
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
    id: 'artifact-synergy-lifesteal-sustain',
    displayName: '吸血续航',
    displayDescription: '吸血与恢复配合，持续作战能力更强',
    category: 'synergy',
    match: matchAll([CreationTags.MATERIAL.SEMANTIC_SUSTAIN, CreationTags.MATERIAL.SEMANTIC_BURST]),
    weight: 42,
    energyCost: 12,
    applicableTo: ['artifact'],
    grantedAbilityTags: [GameplayTags.TRAIT.LIFESTEAL],
    effectTemplate: {
      type: 'resource_drain',
      params: {
        sourceType: 'hp',
        targetType: 'hp',
        ratio: { base: 0.14, scale: 'quality', coefficient: 0.035 },
      },
    },
    listenerSpec: {
      eventType: GameplayTags.EVENT.DAMAGE_TAKEN,
      scope: GameplayTags.SCOPE.OWNER_AS_CASTER,
      priority: CREATION_LISTENER_PRIORITIES.damageTaken,
    },
  },
  {
    id: 'artifact-synergy-control-immunity',
    displayName: '受控反制',
    displayDescription: '在受控压力下强化意志和抗控',
    category: 'synergy',
    match: matchAll([
      CreationTags.MATERIAL.SEMANTIC_MANUAL,
      CreationTags.MATERIAL.SEMANTIC_GUARD,
    ]),
    weight: 39,
    energyCost: 11,
    applicableTo: ['artifact'],
    effectTemplate: {
      type: 'apply_buff',
      conditions: [
        {
          type: 'buff_count_at_least',
          params: { value: 2, scope: 'caster' },
        },
      ],
      params: {
        buffConfig: {
          id: 'craft-control-immunity-window',
          name: '坚志不渝',
          type: BuffType.BUFF,
          duration: 1,
          stackRule: StackRule.OVERRIDE,
          tags: [GameplayTags.BUFF.TYPE.BUFF],
          statusTags: [GameplayTags.STATUS.CATEGORY.BUFF],
          modifiers: [
            {
              attrType: AttributeType.WILLPOWER,
              type: ModifierType.ADD,
              value: 0.12,
            },
            {
              attrType: AttributeType.CONTROL_RESISTANCE,
              type: ModifierType.FIXED,
              value: 0.06,
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
    id: 'artifact-synergy-desperate-aegis',
    displayName: '残血减伤',
    displayDescription: '仅在自身低血时触发的大幅减伤护持',
    category: 'synergy',
    match: matchAll([
      CreationTags.MATERIAL.SEMANTIC_GUARD,
      CreationTags.MATERIAL.SEMANTIC_SPIRIT,
    ]),
    weight: 35,
    energyCost: 12,
    applicableTo: ['artifact'],
    effectTemplate: {
      type: 'percent_damage_modifier',
      conditions: [{ type: 'hp_below', params: { value: 0.4, scope: 'caster' } }],
      params: {
        mode: 'reduce',
        value: { base: 0.2, scale: 'quality', coefficient: 0.03 },
        cap: 0.7,
      },
    },
    listenerSpec: {
      eventType: GameplayTags.EVENT.DAMAGE_REQUEST,
      scope: GameplayTags.SCOPE.OWNER_AS_TARGET,
      priority: CREATION_LISTENER_PRIORITIES.damageRequest,
    },
  },
  {
    id: 'artifact-synergy-burn-punisher',
    displayName: '灼烧反震',
    displayDescription: '对灼烧目标触发额外反震伤害',
    category: 'synergy',
    match: matchAll([
      CreationTags.MATERIAL.SEMANTIC_FLAME,
      CreationTags.MATERIAL.SEMANTIC_BURST,
    ]),
    weight: 34,
    energyCost: 12,
    applicableTo: ['artifact'],
    grantedAbilityTags: [GameplayTags.TRAIT.REFLECT],
    effectTemplate: {
      type: 'reflect',
      conditions: [
        { type: 'has_tag', params: { tag: GameplayTags.STATUS.STATE.BURNED } },
        { type: 'chance', params: { value: 0.75 } },
      ],
      params: {
        ratio: { base: 0.2, scale: 'quality', coefficient: 0.03 },
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

  // ========================
  // ===== SIGNATURE 词缀 (4 种)
  // ========================
  {
    id: 'artifact-signature-ice-armor',
    displayName: '冰甲护体',
    displayDescription: '冰系护体词条，大幅提升防御能力',
    category: 'signature',
    match: matchAll([ELEMENT_TO_MATERIAL_TAG['冰'], CreationTags.MATERIAL.SEMANTIC_FREEZE]),
    exclusiveGroup: EXCLUSIVE_GROUP.ARTIFACT.SIGNATURE_ULTIMATE,
    weight: 35,
    energyCost: 14,
    minQuality: '真品',
    applicableTo: ['artifact'],
    effectTemplate: {
      type: 'attribute_modifier',
      params: {
        attrType: AttributeType.DEF,
        modType: ModifierType.ADD,
        value: { base: 0.15, scale: 'quality', coefficient: 0.03 },
      },
    },
  },
  {
    id: 'artifact-signature-spellward',
    displayName: '法术免伤罩',
    displayDescription: '受击时可免疫法术通道伤害，专克法修',
    category: 'signature',
    match: matchAll([
      CreationTags.MATERIAL.SEMANTIC_GUARD,
      CreationTags.MATERIAL.SEMANTIC_SPIRIT,
      CreationTags.MATERIAL.TYPE_ORE,
    ]),
    exclusiveGroup: EXCLUSIVE_GROUP.ARTIFACT.SIGNATURE_ULTIMATE,
    weight: 26,
    energyCost: 14,
    minQuality: '真品',
    applicableTo: ['artifact'],
    effectTemplate: {
      type: 'damage_immunity',
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
    id: 'artifact-signature-prismatic-aegis',
    displayName: '法力护界',
    displayDescription: '消耗法力吸收伤害，降低爆发压力',
    category: 'signature',
    match: matchAll([
      CreationTags.MATERIAL.SEMANTIC_SPIRIT,
      CreationTags.MATERIAL.SEMANTIC_GUARD,
      CreationTags.MATERIAL.TYPE_MANUAL,
    ]),
    exclusiveGroup: EXCLUSIVE_GROUP.ARTIFACT.SIGNATURE_ULTIMATE,
    weight: 32,
    energyCost: 14,
    minQuality: '真品',
    applicableTo: ['artifact'],
    effectTemplate: {
      type: 'magic_shield',
      params: {
        absorbRatio: { base: 0.9, scale: 'quality', coefficient: 0.02 },
      },
    },
    listenerSpec: {
      eventType: GameplayTags.EVENT.DAMAGE,
      scope: GameplayTags.SCOPE.OWNER_AS_TARGET,
      priority: CREATION_LISTENER_PRIORITIES.damageApplyImmunity,
    },
  },
  {
    id: 'artifact-signature-eternal-defense',
    displayName: '残血堡垒',
    displayDescription: '血量降低后触发强减伤，适合残局翻盘',
    category: 'signature',
    match: matchAll([
      CreationTags.MATERIAL.SEMANTIC_GUARD,
      CreationTags.MATERIAL.TYPE_SPECIAL,
      CreationTags.MATERIAL.SEMANTIC_SPIRIT,
    ]),
    exclusiveGroup: EXCLUSIVE_GROUP.ARTIFACT.SIGNATURE_ULTIMATE,
    weight: 28,
    energyCost: 15,
    minQuality: '地品',
    applicableTo: ['artifact'],
    effectTemplate: {
      type: 'percent_damage_modifier',
      conditions: [{ type: 'hp_below', params: { value: 0.65, scope: 'caster' } }],
      params: {
        mode: 'reduce',
        value: { base: 0.12, scale: 'quality', coefficient: 0.03 },
        cap: 0.6,
      },
    },
    listenerSpec: {
      eventType: GameplayTags.EVENT.DAMAGE_REQUEST,
      scope: GameplayTags.SCOPE.OWNER_AS_TARGET,
      priority: CREATION_LISTENER_PRIORITIES.damageRequest,
    },
  },

  // ========================
  // ===== MYTHIC 词缀 (1 种)
  // ========================
  {
    id: 'artifact-mythic-judgment-seal',
    displayName: '终战反伤印',
    displayDescription: '高阶反伤词条，受击时强力反震敌人',
    category: 'mythic',
    match: matchAll([
      CreationTags.MATERIAL.SEMANTIC_GUARD,
      CreationTags.MATERIAL.SEMANTIC_BURST,
      CreationTags.MATERIAL.TYPE_SPECIAL,
    ]),
    exclusiveGroup: EXCLUSIVE_GROUP.ARTIFACT.MYTHIC_TRANSCENDENT,
    weight: 28,
    energyCost: 16,
    minQuality: '玄品',
    applicableTo: ['artifact'],
    grantedAbilityTags: [GameplayTags.TRAIT.REFLECT],
    effectTemplate: {
      type: 'reflect',
      conditions: [{ type: 'chance', params: { value: 0.82 } }],
      params: {
        ratio: { base: 0.3, scale: 'quality', coefficient: 0.05 },
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
];
