/*
 * gongfaAffixes: 功法词缀定义集合（示例数据）。
 * 功法词缀通常用于被动属性或战斗中触发的长期效果，通常会映射为 listenerSpec。
 */
import { CREATION_LISTENER_PRIORITIES } from '../../config/CreationBalance';
import { CreationTags } from '../../core/GameplayTags';
import { AttributeType, ModifierType } from '../../contracts/battle';
import { AffixDefinition } from '../types';

/**
 * 功法词缀池
 * applicableTo: ['gongfa']
 * 功法词缀均含 listenerSpec（领域产出 gongfa，战斗层投影为 passive ability）
 * core 词缀为属性永久提升（attribute_stat_buff via ActionPreEvent）
 * prefix/suffix 为战斗触发或辅助属性
 */
export const GONGFA_AFFIXES: AffixDefinition[] = [
  // ===== core 词缀（3 种）=====
  {
    id: 'gongfa-core-spirit',
    displayName: '灵脉运转',
    displayDescription: '战斗中永久提升灵力',
    category: 'core',
    tagQuery: [CreationTags.MATERIAL.SEMANTIC_SPIRIT, CreationTags.MATERIAL.TYPE_HERB],
    exclusiveGroup: 'gongfa-core',
    weight: 80,
    energyCost: 8,
    applicableTo: ['gongfa'],
    effectTemplate: {
      type: 'attribute_stat_buff',
      params: {
        attrType: AttributeType.SPIRIT,
        modType: ModifierType.FIXED,
        value: { base: 5, scale: 'quality', coefficient: 2 },
      },
    },
    listenerSpec: { eventType: CreationTags.BATTLE_EVENT.ACTION_PRE, scope: CreationTags.LISTENER_SCOPE.OWNER_AS_ACTOR, priority: CREATION_LISTENER_PRIORITIES.actionPreBuff },
  },
  {
    id: 'gongfa-core-vitality',
    displayName: '金刚体魄',
    displayDescription: '战斗中永久提升体魄',
    category: 'core',
    tagQuery: [CreationTags.MATERIAL.TYPE_ORE, CreationTags.MATERIAL.TYPE_HERB],
    exclusiveGroup: 'gongfa-core',
    weight: 80,
    energyCost: 8,
    applicableTo: ['gongfa'],
    effectTemplate: {
      type: 'attribute_stat_buff',
      params: {
        attrType: AttributeType.VITALITY,
        modType: ModifierType.FIXED,
        value: { base: 5, scale: 'quality', coefficient: 2 },
      },
    },
    listenerSpec: { eventType: CreationTags.BATTLE_EVENT.ACTION_PRE, scope: CreationTags.LISTENER_SCOPE.OWNER_AS_ACTOR, priority: CREATION_LISTENER_PRIORITIES.actionPreBuff },
  },
  {
    id: 'gongfa-core-wisdom',
    displayName: '悟道明心',
    displayDescription: '战斗中永久提升悟性',
    category: 'core',
    tagQuery: [
      CreationTags.MATERIAL.SEMANTIC_SPIRIT,
      CreationTags.MATERIAL.SEMANTIC_MANUAL,
      CreationTags.MATERIAL.TYPE_MANUAL,
    ],
    exclusiveGroup: 'gongfa-core',
    weight: 70,
    energyCost: 8,
    applicableTo: ['gongfa'],
    effectTemplate: {
      type: 'attribute_stat_buff',
      params: {
        attrType: AttributeType.WISDOM,
        modType: ModifierType.FIXED,
        value: { base: 4, scale: 'quality', coefficient: 2 },
      },
    },
    listenerSpec: { eventType: CreationTags.BATTLE_EVENT.ACTION_PRE, scope: CreationTags.LISTENER_SCOPE.OWNER_AS_ACTOR, priority: CREATION_LISTENER_PRIORITIES.actionPreBuff },
  },

  // ===== prefix 词缀（2 种）=====
  {
    id: 'gongfa-prefix-crit-damage',
    displayName: '破虚一剑',
    displayDescription: '战斗中永久提升暴击伤害倍率',
    category: 'prefix',
    tagQuery: [CreationTags.MATERIAL.SEMANTIC_BLADE, CreationTags.MATERIAL.TYPE_MONSTER],
    weight: 70,
    energyCost: 6,
    applicableTo: ['gongfa'],
    effectTemplate: {
      type: 'attribute_stat_buff',
      params: {
        attrType: AttributeType.CRIT_DAMAGE_MULT,
        modType: ModifierType.FIXED,
        value: { base: 0.06, scale: 'quality', coefficient: 0.02 },
      },
    },
    listenerSpec: { eventType: CreationTags.BATTLE_EVENT.ACTION_PRE, scope: CreationTags.LISTENER_SCOPE.OWNER_AS_ACTOR, priority: CREATION_LISTENER_PRIORITIES.actionPreBuff },
  },
  {
    id: 'gongfa-prefix-heal-amplify',
    displayName: '生生不息',
    displayDescription: '战斗中永久提升治疗增强',
    category: 'prefix',
    tagQuery: [CreationTags.MATERIAL.SEMANTIC_SUSTAIN, CreationTags.MATERIAL.TYPE_HERB],
    weight: 60,
    energyCost: 6,
    applicableTo: ['gongfa'],
    effectTemplate: {
      type: 'attribute_stat_buff',
      params: {
        attrType: AttributeType.HEAL_AMPLIFY,
        modType: ModifierType.FIXED,
        value: { base: 0.06, scale: 'quality', coefficient: 0.02 },
      },
    },
    listenerSpec: { eventType: CreationTags.BATTLE_EVENT.ACTION_PRE, scope: CreationTags.LISTENER_SCOPE.OWNER_AS_ACTOR, priority: CREATION_LISTENER_PRIORITIES.actionPreBuff },
  },

  // ===== suffix 词缀（1 种）=====
  {
    id: 'gongfa-suffix-round-heal',
    displayName: '吐纳归元',
    displayDescription: '每回合开始时恢复少量气血',
    category: 'suffix',
    tagQuery: [
      CreationTags.MATERIAL.SEMANTIC_SPIRIT,
      CreationTags.MATERIAL.TYPE_HERB,
      CreationTags.MATERIAL.SEMANTIC_MANUAL,
    ],
    weight: 60,
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

  // ===== signature 词缀（1 种）=====
  {
    id: 'gongfa-signature-comprehension',
    displayName: '天道感悟',
    displayDescription: '感悟天道，大幅提升悟性（百分比）',
    category: 'signature',
    tagQuery: [CreationTags.MATERIAL.SEMANTIC_MANUAL, CreationTags.MATERIAL.SEMANTIC_SPIRIT],
    exclusiveGroup: 'gongfa-signature',
    weight: 20,
    energyCost: 12,
    minQuality: '玄品',
    applicableTo: ['gongfa'],
    effectTemplate: {
      type: 'attribute_stat_buff',
      params: {
        attrType: AttributeType.WISDOM,
        modType: ModifierType.MULTIPLY,
        value: { base: 0.12, scale: 'quality', coefficient: 0.02 },
      },
    },
    listenerSpec: { eventType: CreationTags.BATTLE_EVENT.ACTION_PRE, scope: CreationTags.LISTENER_SCOPE.OWNER_AS_ACTOR, priority: CREATION_LISTENER_PRIORITIES.actionPreBuff },
  },
  {
    id: 'gongfa-signature-unbound-mind',
    displayName: '万念不染',
    displayDescription: '心神澄明，不受控制类负面状态侵扰',
    category: 'signature',
    tagQuery: [
      CreationTags.MATERIAL.SEMANTIC_MANUAL,
      CreationTags.MATERIAL.SEMANTIC_SPIRIT,
      CreationTags.MATERIAL.TYPE_HERB,
    ],
    exclusiveGroup: 'gongfa-signature',
    weight: 24,
    energyCost: 12,
    minQuality: '玄品',
    applicableTo: ['gongfa'],
    effectTemplate: {
      type: 'buff_immunity',
      params: {
        tags: [CreationTags.BATTLE.BUFF_TYPE_CONTROL],
      },
    },
    listenerSpec: {
      eventType: CreationTags.BATTLE_EVENT.BUFF_ADD,
      scope: CreationTags.LISTENER_SCOPE.OWNER_AS_TARGET,
      priority: CREATION_LISTENER_PRIORITIES.buffIntercept,
    },
  },
];
