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
 * 功法词缀可为 listener 触发型或静态属性型（attribute_modifier）
 * core 词缀可包含属性静态提升（attribute_modifier）
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
    displayDescription: '战斗中永久提升体魄',
    category: 'core',
    tagQuery: [CreationTags.MATERIAL.TYPE_ORE, CreationTags.MATERIAL.TYPE_HERB],
    exclusiveGroup: 'gongfa-core',
    weight: 80,
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
      type: 'attribute_modifier',
      params: {
        attrType: AttributeType.WISDOM,
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
    exclusiveGroup: 'gongfa-core',
    weight: 48,
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
    weight: 60,
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
    weight: 44,
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
    weight: 42,
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
  {
    id: 'gongfa-suffix-mp-siphon',
    displayName: '归元汲气',
    displayDescription: '造成伤害后恢复灵力，强化续航',
    category: 'suffix',
    tagQuery: [CreationTags.MATERIAL.SEMANTIC_SPIRIT, CreationTags.MATERIAL.SEMANTIC_BURST],
    weight: 46,
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
    weight: 40,
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
  {
    id: 'gongfa-signature-celestial-aegis',
    displayName: '太虚灵罡',
    displayDescription: '构筑高阶灵罡护幕，显著削减直击伤害',
    category: 'signature',
    tagQuery: [
      CreationTags.MATERIAL.SEMANTIC_SPIRIT,
      CreationTags.MATERIAL.SEMANTIC_GUARD,
      CreationTags.MATERIAL.TYPE_MANUAL,
    ],
    exclusiveGroup: 'gongfa-signature',
    weight: 14,
    energyCost: 13,
    minQuality: '真品',
    applicableTo: ['gongfa'],
    effectTemplate: {
      type: 'magic_shield',
      params: {
        absorbRatio: { base: 0.88, scale: 'quality', coefficient: 0.02 },
      },
    },
    listenerSpec: {
      eventType: CreationTags.BATTLE_EVENT.DAMAGE,
      scope: CreationTags.LISTENER_SCOPE.OWNER_AS_TARGET,
      priority: CREATION_LISTENER_PRIORITIES.damageApplyImmunity,
    },
  },
  {
    id: 'gongfa-signature-burn-collapse',
    displayName: '焚痕崩诀',
    displayDescription: '施法命中灼烧目标时，引爆灼痕造成额外伤害',
    category: 'signature',
    tagQuery: [
      CreationTags.MATERIAL.SEMANTIC_FLAME,
      CreationTags.MATERIAL.SEMANTIC_BURST,
      CreationTags.MATERIAL.SEMANTIC_MANUAL,
    ],
    exclusiveGroup: 'gongfa-signature',
    weight: 12,
    energyCost: 14,
    minQuality: '地品',
    applicableTo: ['gongfa'],
    effectTemplate: {
      type: 'tag_trigger',
      params: {
        triggerTag: 'Status.Burn',
        damageRatio: { base: 1.5, scale: 'quality', coefficient: 0.2 },
        removeOnTrigger: false,
      },
    },
    listenerSpec: {
      eventType: CreationTags.BATTLE_EVENT.SKILL_CAST,
      scope: CreationTags.LISTENER_SCOPE.OWNER_AS_CASTER,
      priority: CREATION_LISTENER_PRIORITIES.skillCast,
      mapping: {
        caster: 'owner',
        target: 'event.target',
      },
    },
  },
];
