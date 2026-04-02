/*
 * artifactAffixes: 法宝词缀定义集合（示例数据）。
 * 说明见 skillAffixes 注释：法宝词缀一般包含 listenerSpec，用于被动能力的 listener 注册。
 */
import { CREATION_LISTENER_PRIORITIES } from '../../config/CreationBalance';
import { ELEMENT_TO_MATERIAL_TAG } from '../../config/CreationMappings';
import { CreationTags } from '../../core/GameplayTags';
import { AttributeType, ModifierType } from '../../contracts/battle';
import { AffixDefinition } from '../types';

/**
 * 法宝词缀池
 * applicableTo: ['artifact']
 * 法宝词缀均含 listenerSpec（领域产出 artifact，战斗层投影为 passive ability）
 */
export const ARTIFACT_AFFIXES: AffixDefinition[] = [
  // ===== core 词缀（3 种）=====
  {
    id: 'artifact-core-vitality',
    displayName: '万载玄铁之躯',
    displayDescription: '战斗中永久提升体魄',
    category: 'core',
    tagQuery: [CreationTags.MATERIAL.TYPE_ORE, CreationTags.MATERIAL.SEMANTIC_GUARD],
    exclusiveGroup: 'artifact-core',
    weight: 80,
    energyCost: 8,
    applicableTo: ['artifact'],
    effectTemplate: {
      type: 'attribute_stat_buff',
      params: {
        attrType: AttributeType.VITALITY,
        modType: ModifierType.FIXED,
        value: { base: 4, scale: 'quality', coefficient: 2 },
      },
    },
    listenerSpec: { eventType: CreationTags.BATTLE_EVENT.ACTION_PRE, scope: CreationTags.LISTENER_SCOPE.OWNER_AS_ACTOR, priority: CREATION_LISTENER_PRIORITIES.actionPreBuff },
  },
  {
    id: 'artifact-core-spirit',
    displayName: '灵光聚蕴',
    displayDescription: '战斗中永久提升灵力',
    category: 'core',
    tagQuery: [CreationTags.MATERIAL.SEMANTIC_SPIRIT, CreationTags.MATERIAL.TYPE_MONSTER],
    exclusiveGroup: 'artifact-core',
    weight: 70,
    energyCost: 8,
    applicableTo: ['artifact'],
    effectTemplate: {
      type: 'attribute_stat_buff',
      params: {
        attrType: AttributeType.SPIRIT,
        modType: ModifierType.FIXED,
        value: { base: 4, scale: 'quality', coefficient: 2 },
      },
    },
    listenerSpec: { eventType: CreationTags.BATTLE_EVENT.ACTION_PRE, scope: CreationTags.LISTENER_SCOPE.OWNER_AS_ACTOR, priority: CREATION_LISTENER_PRIORITIES.actionPreBuff },
  },
  {
    id: 'artifact-core-shield-on-hit',
    displayName: '护盾反应',
    displayDescription: '受击时生成护盾',
    category: 'core',
    tagQuery: [
      CreationTags.MATERIAL.SEMANTIC_GUARD,
      CreationTags.MATERIAL.TYPE_ORE,
      CreationTags.MATERIAL.SEMANTIC_BURST,
    ],
    exclusiveGroup: 'artifact-core',
    weight: 60,
    energyCost: 10,
    applicableTo: ['artifact'],
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
    listenerSpec: { eventType: CreationTags.BATTLE_EVENT.DAMAGE_TAKEN, scope: CreationTags.LISTENER_SCOPE.OWNER_AS_TARGET, priority: CREATION_LISTENER_PRIORITIES.damageTaken },
  },

  // ===== prefix 词缀（3 种）=====
  {
    id: 'artifact-prefix-crit-rate',
    displayName: '锋刃之势',
    displayDescription: '战斗中永久提升暴击率',
    category: 'prefix',
    tagQuery: [CreationTags.MATERIAL.SEMANTIC_BLADE, CreationTags.MATERIAL.TYPE_MONSTER],
    weight: 80,
    energyCost: 6,
    applicableTo: ['artifact'],
    effectTemplate: {
      type: 'attribute_stat_buff',
      params: {
        attrType: AttributeType.CRIT_RATE,
        modType: ModifierType.FIXED,
        value: { base: 0.03, scale: 'quality', coefficient: 0.01 },
      },
    },
    listenerSpec: { eventType: CreationTags.BATTLE_EVENT.ACTION_PRE, scope: CreationTags.LISTENER_SCOPE.OWNER_AS_ACTOR, priority: CREATION_LISTENER_PRIORITIES.actionPreBuff },
  },
  {
    id: 'artifact-prefix-speed',
    displayName: '风行步',
    displayDescription: '战斗中永久提升身法',
    category: 'prefix',
    tagQuery: [CreationTags.MATERIAL.SEMANTIC_WIND, ELEMENT_TO_MATERIAL_TAG['风']],
    exclusiveGroup: 'artifact-prefix-mobility',
    weight: 70,
    energyCost: 6,
    applicableTo: ['artifact'],
    effectTemplate: {
      type: 'attribute_stat_buff',
      params: {
        attrType: AttributeType.SPEED,
        modType: ModifierType.FIXED,
        value: { base: 2, scale: 'quality', coefficient: 1 },
      },
    },
    listenerSpec: { eventType: CreationTags.BATTLE_EVENT.ACTION_PRE, scope: CreationTags.LISTENER_SCOPE.OWNER_AS_ACTOR, priority: CREATION_LISTENER_PRIORITIES.actionPreBuff },
  },
  {
    id: 'artifact-prefix-evasion',
    displayName: '轻灵之影',
    displayDescription: '战斗中永久提升闪避率',
    category: 'prefix',
    tagQuery: [CreationTags.MATERIAL.SEMANTIC_WIND, CreationTags.MATERIAL.SEMANTIC_BLADE],
    exclusiveGroup: 'artifact-prefix-mobility',
    weight: 60,
    energyCost: 6,
    applicableTo: ['artifact'],
    effectTemplate: {
      type: 'attribute_stat_buff',
      params: {
        attrType: AttributeType.EVASION_RATE,
        modType: ModifierType.FIXED,
        value: { base: 0.03, scale: 'quality', coefficient: 0.01 },
      },
    },
    listenerSpec: { eventType: CreationTags.BATTLE_EVENT.ACTION_PRE, scope: CreationTags.LISTENER_SCOPE.OWNER_AS_ACTOR, priority: CREATION_LISTENER_PRIORITIES.actionPreBuff },
  },

  // ===== suffix 词缀（2 种）=====
  {
    id: 'artifact-suffix-heal-on-round',
    displayName: '回生珠',
    displayDescription: '每回合开始时恢复少量气血',
    category: 'suffix',
    tagQuery: [CreationTags.MATERIAL.SEMANTIC_SUSTAIN, CreationTags.MATERIAL.TYPE_HERB],
    weight: 60,
    energyCost: 8,
    applicableTo: ['artifact'],
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
    id: 'artifact-suffix-armor',
    displayName: '坚壁',
    displayDescription: '受击时减免部分伤害',
    category: 'suffix',
    tagQuery: [CreationTags.MATERIAL.SEMANTIC_GUARD, CreationTags.MATERIAL.TYPE_ORE],
    weight: 50,
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
      eventType: CreationTags.BATTLE_EVENT.DAMAGE_REQUEST,
      scope: CreationTags.LISTENER_SCOPE.OWNER_AS_TARGET,
      priority: CREATION_LISTENER_PRIORITIES.damageRequest,
    },
  },

  // ===== signature 词缀（1 种）=====
  {
    id: 'artifact-signature-ice-armor',
    displayName: '玄冰神甲',
    displayDescription: '冰属性保护，大幅提升防御',
    category: 'signature',
    tagQuery: [ELEMENT_TO_MATERIAL_TAG['冰'], CreationTags.MATERIAL.SEMANTIC_FREEZE],
    exclusiveGroup: 'artifact-signature',
    weight: 30,
    energyCost: 14,
    minQuality: '真品',
    applicableTo: ['artifact'],
    effectTemplate: {
      type: 'attribute_stat_buff',
      params: {
        attrType: AttributeType.DEF,
        modType: ModifierType.MULTIPLY,
        value: { base: 0.15, scale: 'quality', coefficient: 0.03 },
      },
    },
    listenerSpec: { eventType: CreationTags.BATTLE_EVENT.ACTION_PRE, scope: CreationTags.LISTENER_SCOPE.OWNER_AS_ACTOR, priority: CREATION_LISTENER_PRIORITIES.actionPreBuff },
  },
  {
    id: 'artifact-signature-spellward',
    displayName: '玄罡避法罩',
    displayDescription: '在受创瞬间隔断法术侵袭，免疫命中魔法标签的伤害',
    category: 'signature',
    tagQuery: [
      CreationTags.MATERIAL.SEMANTIC_GUARD,
      CreationTags.MATERIAL.SEMANTIC_SPIRIT,
      CreationTags.MATERIAL.TYPE_ORE,
    ],
    exclusiveGroup: 'artifact-signature',
    weight: 24,
    energyCost: 12,
    minQuality: '真品',
    applicableTo: ['artifact'],
    effectTemplate: {
      type: 'damage_immunity',
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
    id: 'artifact-signature-last-stand',
    displayName: '守一续命印',
    displayDescription: '遭逢致命一击时强行续住一线生机',
    category: 'signature',
    tagQuery: [
      CreationTags.MATERIAL.SEMANTIC_GUARD,
      CreationTags.MATERIAL.SEMANTIC_SPIRIT,
      CreationTags.MATERIAL.TYPE_MONSTER,
    ],
    exclusiveGroup: 'artifact-signature',
    weight: 18,
    energyCost: 14,
    minQuality: '地品',
    applicableTo: ['artifact'],
    effectTemplate: {
      type: 'death_prevent',
      params: {},
    },
    listenerSpec: {
      eventType: CreationTags.BATTLE_EVENT.DAMAGE_TAKEN,
      scope: CreationTags.LISTENER_SCOPE.OWNER_AS_TARGET,
      priority: CREATION_LISTENER_PRIORITIES.damageTaken,
      guard: {
        requireOwnerAlive: false,
        allowLethalWindow: true,
      },
    },
  },
];
