/*
 * artifactAffixes: 法宝词缀定义集合。
 * 法宝定位：磐石与底线 — 固定面板属性 + 受击/防守触发。
 * 允许的 listenerSpec.scope：OWNER_AS_TARGET, GLOBAL（禁止 OWNER_AS_CASTER）。
 * 包含：常驻属性修改（固定值）、受击被动触发、以及元素减伤防御。
 */
import {
  CreationTags,
  ELEMENT_TO_RUNTIME_ABILITY_TAG,
  GameplayTags,
} from '@/engine/shared/tag-domain';
import type { ElementType } from '@/types/constants';
import { CREATION_LISTENER_PRIORITIES } from '../../config/CreationBalance';
import { ELEMENT_TO_MATERIAL_TAG } from '../../config/CreationMappings';
import { AttributeType, ModifierType } from '../../contracts/battle';
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
    displayDescription:
      '造物时从全部二级属性池中随机抽取2条属性強化，每件配饰属性组合独一无二',
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
          {
            attrType: AttributeType.CRIT_RATE,
            modType: ModifierType.FIXED,
            value: { base: 0.035, scale: 'quality', coefficient: 0.008 },
          },
          {
            attrType: AttributeType.CRIT_DAMAGE_MULT,
            modType: ModifierType.FIXED,
            value: { base: 0.08, scale: 'quality', coefficient: 0.02 },
          },
          {
            attrType: AttributeType.EVASION_RATE,
            modType: ModifierType.FIXED,
            value: { base: 0.035, scale: 'quality', coefficient: 0.008 },
          },
          {
            attrType: AttributeType.ACCURACY,
            modType: ModifierType.FIXED,
            value: { base: 0.06, scale: 'quality', coefficient: 0.015 },
          },
          {
            attrType: AttributeType.CONTROL_HIT,
            modType: ModifierType.FIXED,
            value: { base: 0.045, scale: 'quality', coefficient: 0.01 },
          },
          {
            attrType: AttributeType.CONTROL_RESISTANCE,
            modType: ModifierType.FIXED,
            value: { base: 0.045, scale: 'quality', coefficient: 0.01 },
          },
          {
            attrType: AttributeType.ARMOR_PENETRATION,
            modType: ModifierType.FIXED,
            value: { base: 0.08, scale: 'quality', coefficient: 0.015 },
          },
          {
            attrType: AttributeType.MAGIC_PENETRATION,
            modType: ModifierType.FIXED,
            value: { base: 0.08, scale: 'quality', coefficient: 0.015 },
          },
          {
            attrType: AttributeType.CRIT_RESIST,
            modType: ModifierType.FIXED,
            value: { base: 0.05, scale: 'quality', coefficient: 0.01 },
          },
          {
            attrType: AttributeType.CRIT_DAMAGE_REDUCTION,
            modType: ModifierType.FIXED,
            value: { base: 0.08, scale: 'quality', coefficient: 0.015 },
          },
          {
            attrType: AttributeType.HEAL_AMPLIFY,
            modType: ModifierType.FIXED,
            value: { base: 0.07, scale: 'quality', coefficient: 0.015 },
          },
        ],
      },
    },
  },

  // ========================
  // ===== prefix / suffix 非槽位词缀
  // ========================
  {
    id: 'artifact-suffix-reflect-thorns',
    displayName: '受击反伤',
    displayDescription: '受击后把一部分伤害反给敌人',
    category: 'suffix',
    match: matchAll([
      CreationTags.MATERIAL.SEMANTIC_GUARD,
      CreationTags.MATERIAL.SEMANTIC_BONE,
    ]),
    exclusiveGroup: EXCLUSIVE_GROUP.ARTIFACT.CORE_DEFENSE,
    weight: 70,
    energyCost: 10,
    applicableTo: ['artifact'],
    applicableArtifactSlots: ['armor'],
    grantedAbilityTags: [GameplayTags.TRAIT.REFLECT],
    effectTemplate: {
      type: 'reflect',
      params: {
        ratio: { base: 0.05, scale: 'quality', coefficient: 0.01 },
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
    id: 'artifact-suffix-death-prevent',
    displayName: '濒死续命',
    displayDescription: '每场战斗可在致命时刻保命一次',
    category: 'suffix',
    match: {
      all: [
        CreationTags.MATERIAL.SEMANTIC_GUARD,
        CreationTags.MATERIAL.TYPE_SPECIAL,
      ],
      any: [
        CreationTags.MATERIAL.SEMANTIC_SPIRIT,
        CreationTags.MATERIAL.SEMANTIC_TIME,
        CreationTags.MATERIAL.SEMANTIC_LIFE,
      ],
    },
    exclusiveGroup: EXCLUSIVE_GROUP.ARTIFACT.CORE_DEFENSE,
    weight: 55,
    energyCost: 11,
    applicableTo: ['artifact'],
    applicableArtifactSlots: ['accessory'],
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
    // todo 全局触发一次
    id: 'artifact-suffix-last-stand-shell',
    displayName: '低血护盾',
    displayDescription: '血量低时触发更强护盾，适合反打',
    category: 'suffix',
    match: {
      all: [
        CreationTags.MATERIAL.SEMANTIC_GUARD,
        CreationTags.MATERIAL.SEMANTIC_BURST,
      ],
      any: [
        CreationTags.MATERIAL.SEMANTIC_BLOOD,
        CreationTags.MATERIAL.SEMANTIC_QI,
      ],
    },
    exclusiveGroup: EXCLUSIVE_GROUP.ARTIFACT.CORE_DEFENSE,
    weight: 44,
    energyCost: 11,
    minQuality: '灵品',
    applicableTo: ['artifact'],
    applicableArtifactSlots: ['armor'],
    grantedAbilityTags: [GameplayTags.TRAIT.SHIELD_MASTER],
    effectTemplate: {
      type: 'shield',
      conditions: [
        { type: 'hp_below', params: { value: 0.4, scope: 'caster' } },
      ],
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
  {
    id: 'artifact-suffix-armor-passive',
    displayName: '全能减伤',
    displayDescription: '受击时百分比减免伤害',
    category: 'suffix',
    match: {
      all: [
        CreationTags.MATERIAL.SEMANTIC_GUARD,
        CreationTags.MATERIAL.TYPE_ORE,
      ],
      any: [
        CreationTags.MATERIAL.SEMANTIC_METAL,
        CreationTags.MATERIAL.SEMANTIC_SPACE,
        CreationTags.MATERIAL.SEMANTIC_FORMATION,
      ],
    },
    weight: 70,
    energyCost: 8,
    applicableTo: ['artifact'],
    applicableArtifactSlots: ['armor'],
    effectTemplate: {
      type: 'percent_damage_modifier',
      params: {
        mode: 'reduce',
        value: { base: 0.05, scale: 'quality', coefficient: 0.01 },
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
    id: 'artifact-suffix-mana-recovery',
    displayName: '回合回蓝',
    displayDescription: '每回合恢复一定灵力',
    category: 'suffix',
    match: {
      all: [
        CreationTags.MATERIAL.SEMANTIC_SPIRIT,
        CreationTags.MATERIAL.TYPE_AUXILIARY,
      ],
      any: [
        CreationTags.MATERIAL.SEMANTIC_WATER,
        CreationTags.MATERIAL.SEMANTIC_LIFE,
        CreationTags.MATERIAL.SEMANTIC_ALCHEMY,
      ],
    },
    weight: 60,
    energyCost: 8,
    applicableTo: ['artifact'],
    applicableArtifactSlots: ['accessory'],
    grantedAbilityTags: [GameplayTags.ABILITY.FUNCTION.HEAL],
    effectTemplate: {
      type: 'heal',
      params: {
        target: 'mp',
        value: {
          base: { base: 10, scale: 'quality', coefficient: 4 },
          attribute: AttributeType.SPIRIT,
          coefficient: 0.05,
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
    id: 'artifact-synergy-desperate-aegis',
    displayName: '残血减伤',
    displayDescription: '仅在自身低血时触发的大幅减伤护持',
    category: 'synergy',
    match: {
      all: [
        CreationTags.MATERIAL.SEMANTIC_GUARD,
        CreationTags.MATERIAL.SEMANTIC_BURST,
      ],
      any: [
        CreationTags.MATERIAL.SEMANTIC_BLOOD,
        CreationTags.MATERIAL.SEMANTIC_QI,
      ],
    },
    weight: 35,
    energyCost: 12,
    applicableTo: ['artifact'],
    effectTemplate: {
      type: 'percent_damage_modifier',
      conditions: [
        { type: 'hp_below', params: { value: 0.4, scope: 'caster' } },
      ],
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

  // ========================
  // ===== SIGNATURE 词缀 (4 种)
  // ========================
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
    applicableArtifactSlots: ['accessory'],
    effectTemplate: {
      type: 'damage_immunity',
      conditions: [
        {
          type: 'chance',
          params: {
            value: 0.2,
          },
        },
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
    applicableArtifactSlots: ['armor'],
    effectTemplate: {
      type: 'magic_shield',
      params: {
        absorbRatio: { base: 0.7, scale: 'quality', coefficient: 0.03 },
      },
    },
    listenerSpec: {
      eventType: GameplayTags.EVENT.DAMAGE,
      scope: GameplayTags.SCOPE.OWNER_AS_TARGET,
      priority: CREATION_LISTENER_PRIORITIES.damageApplyImmunity,
    },
  },
  {
    id: 'artifact-mythic-void-aegis',
    displayName: '濒危法免',
    displayDescription: '血量危险时法宝自动激活，有概率免疫法术伤害',
    category: 'mythic',
    match: matchAll([
      CreationTags.MATERIAL.SEMANTIC_GUARD,
      CreationTags.MATERIAL.SEMANTIC_SPIRIT,
      CreationTags.MATERIAL.TYPE_SPECIAL,
    ]),
    exclusiveGroup: EXCLUSIVE_GROUP.ARTIFACT.MYTHIC_TRANSCENDENT,
    weight: 7,
    energyCost: 18,
    minQuality: '地品',
    applicableTo: ['artifact'],
    applicableArtifactSlots: ['armor'],
    effectTemplate: {
      type: 'damage_immunity',
      conditions: [
        { type: 'hp_below', params: { value: 0.3, scope: 'caster' } },
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
];

// ========================
// ===== 通用固定属性 prefix (迁自 commonAffixes — artifact 专用，固定值面板)
// ========================
const ARTIFACT_COMMON_PREFIX_AFFIXES: AffixDefinition[] = [
  {
    id: 'artifact-prefix-vitality',
    displayName: '体魄强化',
    displayDescription: '永久提升体魄，打持久战更稳',
    category: 'prefix',
    match: matchAll([
      CreationTags.MATERIAL.TYPE_ORE,
      CreationTags.MATERIAL.SEMANTIC_GUARD,
    ]),
    weight: 95,
    energyCost: 8,
    applicableTo: ['artifact'],
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
    id: 'artifact-prefix-spirit',
    displayName: '灵力强化',
    displayDescription: '永久提升灵力，提高法术相关收益',
    category: 'prefix',
    match: matchAll([
      CreationTags.MATERIAL.SEMANTIC_SPIRIT,
      CreationTags.MATERIAL.TYPE_MONSTER,
    ]),
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
    id: 'artifact-prefix-willpower-boost',
    displayName: '神识强化',
    displayDescription: '永久提升神识，抵抗控制',
    category: 'prefix',
    match: matchAll([
      CreationTags.MATERIAL.SEMANTIC_MANUAL,
      CreationTags.MATERIAL.TYPE_MANUAL,
    ]),
    weight: 52,
    energyCost: 6,
    applicableTo: ['artifact'],
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
    id: 'artifact-prefix-wisdom-insight',
    displayName: '悟性强化',
    displayDescription: '永久提升悟性，加快修为',
    category: 'prefix',
    match: matchAll([
      CreationTags.MATERIAL.SEMANTIC_SPIRIT,
      CreationTags.MATERIAL.SEMANTIC_MANUAL,
    ]),
    weight: 50,
    energyCost: 6,
    applicableTo: ['artifact'],
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
    id: 'artifact-prefix-speed',
    displayName: '身法强化',
    displayDescription: '永久提升身法，先手更容易',
    category: 'prefix',
    match: matchAll([
      CreationTags.MATERIAL.SEMANTIC_WIND,
      ELEMENT_TO_MATERIAL_TAG['风'],
    ]),
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
    id: 'artifact-prefix-attack',
    displayName: '物攻强化',
    displayDescription: '永久提升物理攻击力，剑修常用',
    category: 'prefix',
    match: matchAll([
      CreationTags.MATERIAL.SEMANTIC_BLADE,
      CreationTags.MATERIAL.TYPE_ORE,
    ]),
    weight: 82,
    energyCost: 8,
    applicableTo: ['artifact'],
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
    id: 'artifact-prefix-magic-attack',
    displayName: '法攻强化',
    displayDescription: '永久提升法术攻击力，术法流核心之一',
    category: 'prefix',
    match: matchAll([
      CreationTags.MATERIAL.SEMANTIC_SPIRIT,
      CreationTags.MATERIAL.SEMANTIC_BURST,
    ]),
    weight: 80,
    energyCost: 8,
    applicableTo: ['artifact'],
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
    id: 'artifact-prefix-physical-defense',
    displayName: '物防强化',
    displayDescription: '永久提升物理防御',
    category: 'prefix',
    match: matchAll([
      CreationTags.MATERIAL.SEMANTIC_GUARD,
      CreationTags.MATERIAL.TYPE_ORE,
    ]),
    weight: 58,
    energyCost: 6,
    applicableTo: ['artifact'],
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
    id: 'artifact-prefix-magic-defense',
    displayName: '法防强化',
    displayDescription: '永久提升法术防御',
    category: 'prefix',
    match: matchAll([
      CreationTags.MATERIAL.SEMANTIC_SPIRIT,
      CreationTags.MATERIAL.TYPE_HERB,
    ]),
    weight: 56,
    energyCost: 6,
    applicableTo: ['artifact'],
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
    id: 'artifact-prefix-crit-rate',
    displayName: '暴击率强化',
    displayDescription: '永久提升暴击率',
    category: 'prefix',
    match: matchAll([
      CreationTags.MATERIAL.SEMANTIC_BLADE,
      CreationTags.MATERIAL.TYPE_MONSTER,
    ]),
    weight: 90,
    energyCost: 6,
    applicableTo: ['artifact'],
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
    id: 'artifact-prefix-crit-damage',
    displayName: '暴伤强化',
    displayDescription: '永久提升暴击伤害倍数',
    category: 'prefix',
    match: matchAll([
      CreationTags.MATERIAL.SEMANTIC_BURST,
      CreationTags.MATERIAL.TYPE_ORE,
    ]),
    weight: 68,
    energyCost: 7,
    applicableTo: ['artifact'],
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
    id: 'artifact-prefix-evasion',
    displayName: '闪避强化',
    displayDescription: '永久提升闪避率',
    category: 'prefix',
    match: matchAll([
      CreationTags.MATERIAL.SEMANTIC_WIND,
      CreationTags.MATERIAL.SEMANTIC_BLADE,
    ]),
    weight: 75,
    energyCost: 6,
    applicableTo: ['artifact'],
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
    id: 'artifact-prefix-magic-penetration',
    displayName: '法穿锐锋',
    displayDescription: '永久提升法术穿透',
    category: 'prefix',
    match: matchAll([
      CreationTags.MATERIAL.SEMANTIC_SPIRIT,
      CreationTags.MATERIAL.SEMANTIC_BURST,
    ]),
    weight: 70,
    energyCost: 7,
    applicableTo: ['artifact'],
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
    id: 'artifact-prefix-armor-penetration',
    displayName: '破甲锐锋',
    displayDescription: '永久提升物理穿透',
    category: 'prefix',
    match: matchAll([
      CreationTags.MATERIAL.SEMANTIC_BLADE,
      CreationTags.MATERIAL.SEMANTIC_BURST,
    ]),
    weight: 69,
    energyCost: 7,
    applicableTo: ['artifact'],
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
    id: 'artifact-prefix-accuracy',
    displayName: '精准强化',
    displayDescription: '永久提升精准，降低被闪避风险',
    category: 'prefix',
    match: matchAll([
      CreationTags.MATERIAL.SEMANTIC_BLADE,
      CreationTags.MATERIAL.SEMANTIC_WIND,
    ]),
    weight: 72,
    energyCost: 6,
    applicableTo: ['artifact'],
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
    id: 'artifact-prefix-control-hit',
    displayName: '效果命中强化',
    displayDescription: '永久提升控制命中，控制更稳定',
    category: 'prefix',
    match: matchAll([
      CreationTags.MATERIAL.SEMANTIC_MANUAL,
      CreationTags.MATERIAL.SEMANTIC_SPIRIT,
    ]),
    weight: 64,
    energyCost: 7,
    applicableTo: ['artifact'],
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
    id: 'artifact-prefix-control-resistance',
    displayName: '效果抵抗强化',
    displayDescription: '永久提升控制抗性，减少被控风险',
    category: 'prefix',
    match: matchAll([
      CreationTags.MATERIAL.SEMANTIC_GUARD,
      CreationTags.MATERIAL.SEMANTIC_SPIRIT,
    ]),
    weight: 62,
    energyCost: 7,
    applicableTo: ['artifact'],
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
    id: 'artifact-prefix-crit-resist',
    displayName: '抗暴强化',
    displayDescription: '永久提升暴击韧性，降低被暴击概率',
    category: 'prefix',
    match: matchAll([
      CreationTags.MATERIAL.SEMANTIC_GUARD,
      CreationTags.MATERIAL.SEMANTIC_WATER,
    ]),
    weight: 61,
    energyCost: 7,
    applicableTo: ['artifact'],
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
    id: 'artifact-prefix-crit-damage-reduction',
    displayName: '暴伤减免强化',
    displayDescription: '永久提升暴击减伤，降低暴击爆发伤害',
    category: 'prefix',
    match: matchAll([
      CreationTags.MATERIAL.SEMANTIC_GUARD,
      CreationTags.MATERIAL.SEMANTIC_SUSTAIN,
    ]),
    weight: 60,
    energyCost: 7,
    applicableTo: ['artifact'],
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
    id: 'artifact-prefix-heal-amplify',
    displayName: '治疗强化',
    displayDescription: '永久提升治疗效果倍数',
    category: 'prefix',
    match: matchAll([
      CreationTags.MATERIAL.SEMANTIC_SUSTAIN,
      CreationTags.MATERIAL.SEMANTIC_SPIRIT,
    ]),
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
];

// ========================
// ===== 元素/通道减伤 suffix builders (迁自 commonAffixes — artifact 专用，OWNER_AS_TARGET)
// ========================
const buildArtifactElementReduceAffix = (
  element: ElementType,
): AffixDefinition => ({
  id: `artifact-suffix-elem-${ELEMENT_TO_MATERIAL_TAG[element]}-reduce`,
  displayName: `${element}系减伤`,
  displayDescription: `减少受到${element}系技能的伤害`,
  category: 'suffix',
  match: matchAll([
    CreationTags.MATERIAL.SEMANTIC_GUARD,
    ELEMENT_TO_MATERIAL_TAG[element],
  ]),
  weight: 48,
  energyCost: 9,
  applicableTo: ['artifact'],
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

type DamageChannel =
  | typeof GameplayTags.ABILITY.CHANNEL.MAGIC
  | typeof GameplayTags.ABILITY.CHANNEL.PHYSICAL;

const buildArtifactChannelReduceAffix = (
  channel: DamageChannel,
): AffixDefinition => {
  const channelNameMap: Record<DamageChannel, string> = {
    [GameplayTags.ABILITY.CHANNEL.MAGIC]: '法术',
    [GameplayTags.ABILITY.CHANNEL.PHYSICAL]: '物理',
  };
  const matchTagMap: Record<DamageChannel, string> = {
    [GameplayTags.ABILITY.CHANNEL.MAGIC]: CreationTags.MATERIAL.SEMANTIC_SPIRIT,
    [GameplayTags.ABILITY.CHANNEL.PHYSICAL]: CreationTags.MATERIAL.TYPE_ORE,
  };
  const channelNameEn = channel.split('.').slice(-1)[0].toLowerCase();
  return {
    id: `artifact-suffix-chan-${channelNameEn}-reduce`,
    displayName: `${channelNameMap[channel]}减伤`,
    displayDescription: `减少受到的${channelNameMap[channel]}伤害`,
    category: 'suffix',
    match: matchAll([
      CreationTags.MATERIAL.SEMANTIC_GUARD,
      matchTagMap[channel],
    ]),
    weight: 42,
    energyCost: 9,
    applicableTo: ['artifact'],
    effectTemplate: {
      type: 'percent_damage_modifier',
      conditions: [{ type: 'ability_has_tag', params: { tag: channel } }],
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

export const ARTIFACT_ELEMENT_REDUCE_AFFIXES: AffixDefinition[] = [
  buildArtifactElementReduceAffix('金'),
  buildArtifactElementReduceAffix('木'),
  buildArtifactElementReduceAffix('水'),
  buildArtifactElementReduceAffix('火'),
  buildArtifactElementReduceAffix('土'),
  buildArtifactElementReduceAffix('风'),
  buildArtifactElementReduceAffix('雷'),
  buildArtifactElementReduceAffix('冰'),
  buildArtifactChannelReduceAffix(GameplayTags.ABILITY.CHANNEL.MAGIC),
  buildArtifactChannelReduceAffix(GameplayTags.ABILITY.CHANNEL.PHYSICAL),
];

export { ARTIFACT_COMMON_PREFIX_AFFIXES };
