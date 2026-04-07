/*
 * artifactAffixes: 法宝词缀定义集合（大幅扩展）。
 * 法宝词缀特点：通常包含 listenerSpec，用于被动能力的 listener 注册
 * 包括常驻属性修改、战斗中被动触发、以及高阶联动效果
 */
import { CREATION_LISTENER_PRIORITIES } from '../../config/CreationBalance';
import { ELEMENT_TO_MATERIAL_TAG } from '../../config/CreationMappings';
import { CreationTags } from '../../core/GameplayTags';
import { AttributeType, ModifierType, BuffType, StackRule } from '../../contracts/battle';
import { AffixDefinition } from '../types';

export const ARTIFACT_AFFIXES: AffixDefinition[] = [
  // ========================
  // ===== CORE 词缀 (9 种)
  // ========================
  {
    id: 'artifact-core-vitality',
    displayName: '万载玄铁之躯',
    displayDescription: '永久提升体魄，增强耐久力',
    category: 'core',
    tagQuery: [CreationTags.MATERIAL.TYPE_ORE, CreationTags.MATERIAL.SEMANTIC_GUARD],
    exclusiveGroup: 'artifact-core-stat',
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
    displayName: '灵光聚蕴',
    displayDescription: '永久提升灵力，增加魔法威力',
    category: 'core',
    tagQuery: [CreationTags.MATERIAL.SEMANTIC_SPIRIT, CreationTags.MATERIAL.TYPE_MONSTER],
    exclusiveGroup: 'artifact-core-stat',
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
    displayName: '锐金神锋',
    displayDescription: '永久提升物理攻击力',
    category: 'core',
    tagQuery: [CreationTags.MATERIAL.SEMANTIC_BLADE, CreationTags.MATERIAL.TYPE_ORE],
    exclusiveGroup: 'artifact-core-stat',
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
    displayName: '法力汇聚',
    displayDescription: '永久提升法术攻击力',
    category: 'core',
    tagQuery: [CreationTags.MATERIAL.SEMANTIC_SPIRIT, CreationTags.MATERIAL.SEMANTIC_BURST],
    exclusiveGroup: 'artifact-core-stat',
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
    displayName: '护盾反应',
    displayDescription: '受击时自动生成防护护盾',
    category: 'core',
    tagQuery: [
      CreationTags.MATERIAL.SEMANTIC_GUARD,
      CreationTags.MATERIAL.TYPE_ORE,
      CreationTags.MATERIAL.SEMANTIC_BURST,
    ],
    exclusiveGroup: 'artifact-core-defense',
    weight: 75,
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
    listenerSpec: {
      eventType: CreationTags.BATTLE_EVENT.DAMAGE_TAKEN,
      scope: CreationTags.LISTENER_SCOPE.OWNER_AS_TARGET,
      priority: CREATION_LISTENER_PRIORITIES.damageTaken,
    },
  },
  {
    id: 'artifact-core-reflect-thorns',
    displayName: '荆甲反噬',
    displayDescription: '受击后反震伤害给攻击者',
    category: 'core',
    tagQuery: [CreationTags.MATERIAL.SEMANTIC_GUARD, CreationTags.MATERIAL.SEMANTIC_BURST],
    exclusiveGroup: 'artifact-core-defense',
    weight: 70,
    energyCost: 10,
    applicableTo: ['artifact'],
    effectTemplate: {
      type: 'reflect',
      params: {
        ratio: { base: 0.12, scale: 'quality', coefficient: 0.03 },
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
    id: 'artifact-core-heal-passive',
    displayName: '生命泉眼',
    displayDescription: '战斗中每回合恢复气血',
    category: 'core',
    tagQuery: [CreationTags.MATERIAL.SEMANTIC_SUSTAIN, CreationTags.MATERIAL.TYPE_HERB],
    exclusiveGroup: 'artifact-core-defense',
    weight: 68,
    energyCost: 9,
    applicableTo: ['artifact'],
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
    id: 'artifact-core-death-prevent',
    displayName: '临危不惧',
    displayDescription: '一次战斗中当生命危急时强行续住一线',
    category: 'core',
    tagQuery: [
      CreationTags.MATERIAL.SEMANTIC_GUARD,
      CreationTags.MATERIAL.SEMANTIC_SPIRIT,
      CreationTags.MATERIAL.TYPE_SPECIAL,
    ],
    exclusiveGroup: 'artifact-core-defense',
    weight: 55,
    energyCost: 11,
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
  {
    id: 'artifact-core-last-stand-shell',
    displayName: '玄壳逆守',
    displayDescription: '仅在自身低血时触发强化护盾',
    category: 'core',
    tagQuery: [
      CreationTags.MATERIAL.SEMANTIC_GUARD,
      CreationTags.MATERIAL.SEMANTIC_SPIRIT,
      CreationTags.SCENARIO.CASTER_LOW_HP,
    ],
    exclusiveGroup: 'artifact-core-defense',
    weight: 44,
    energyCost: 11,
    minQuality: '灵品',
    applicableTo: ['artifact'],
    effectTemplate: {
      type: 'shield',
      conditions: [{ type: 'hp_below', params: { value: 0.4 } }],
      params: {
        value: {
          base: { base: 18, scale: 'quality', coefficient: 6 },
          attribute: AttributeType.SPIRIT,
          coefficient: 0.25,
        },
      },
    },
    listenerSpec: {
      eventType: CreationTags.BATTLE_EVENT.DAMAGE_TAKEN,
      scope: CreationTags.LISTENER_SCOPE.OWNER_AS_TARGET,
      priority: CREATION_LISTENER_PRIORITIES.damageTaken,
    },
  },

  // ========================
  // ===== PREFIX 词缀 (13 种)
  // ========================
  {
    id: 'artifact-prefix-crit-rate',
    displayName: '锋刃之势',
    displayDescription: '永久提升暴击率',
    category: 'prefix',
    tagQuery: [CreationTags.MATERIAL.SEMANTIC_BLADE, CreationTags.MATERIAL.TYPE_MONSTER],
    exclusiveGroup: 'artifact-prefix-crit-rate-tier',
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
    displayName: '风行步',
    displayDescription: '永久提升身法速度',
    category: 'prefix',
    tagQuery: [CreationTags.MATERIAL.SEMANTIC_WIND, ELEMENT_TO_MATERIAL_TAG['风']],
    exclusiveGroup: 'artifact-prefix-mobility',
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
    displayName: '轻灵之影',
    displayDescription: '永久提升闪避率',
    category: 'prefix',
    tagQuery: [CreationTags.MATERIAL.SEMANTIC_WIND, CreationTags.MATERIAL.SEMANTIC_BLADE],
    exclusiveGroup: 'artifact-prefix-mobility',
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
    tagQuery: [CreationTags.MATERIAL.SEMANTIC_SPIRIT, CreationTags.MATERIAL.SEMANTIC_BURST],
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
    displayName: '暴击深化',
    displayDescription: '永久提升暴击伤害倍数',
    category: 'prefix',
    tagQuery: [CreationTags.MATERIAL.SEMANTIC_BURST, CreationTags.MATERIAL.TYPE_ORE],
    exclusiveGroup: 'artifact-prefix-crit-dmg-tier',
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
    displayName: '医手回春',
    displayDescription: '永久提升治疗效果倍数',
    category: 'prefix',
    tagQuery: [CreationTags.MATERIAL.SEMANTIC_SUSTAIN, CreationTags.MATERIAL.SEMANTIC_SPIRIT],
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
    displayName: '封窍镇息',
    displayDescription: '持有者施法命中时延长目标冷却',
    category: 'prefix',
    tagQuery: [CreationTags.MATERIAL.SEMANTIC_MANUAL, CreationTags.MATERIAL.SEMANTIC_GUARD],
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
      eventType: CreationTags.BATTLE_EVENT.SKILL_CAST,
      scope: CreationTags.LISTENER_SCOPE.OWNER_AS_CASTER,
      priority: CREATION_LISTENER_PRIORITIES.skillCast,
      mapping: {
        caster: 'owner',
        target: 'event.target',
      },
    },
  },
  {
    id: 'artifact-prefix-physical-defense',
    displayName: '铁血护体',
    displayDescription: '永久提升物理防御',
    category: 'prefix',
    tagQuery: [CreationTags.MATERIAL.SEMANTIC_GUARD, CreationTags.MATERIAL.TYPE_ORE],
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
    displayName: '法力屏障',
    displayDescription: '永久提升法术防御',
    category: 'prefix',
    tagQuery: [CreationTags.MATERIAL.SEMANTIC_SPIRIT, CreationTags.MATERIAL.TYPE_HERB],
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
    displayName: '心如磐石',
    displayDescription: '永久提升意志力，抵抗控制',
    category: 'prefix',
    tagQuery: [CreationTags.MATERIAL.SEMANTIC_MANUAL, CreationTags.MATERIAL.TYPE_MANUAL],
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
    displayName: '明慧识海',
    displayDescription: '永久提升悟性，加快修为',
    category: 'prefix',
    tagQuery: [CreationTags.MATERIAL.SEMANTIC_SPIRIT, CreationTags.MATERIAL.SEMANTIC_MANUAL],
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
    displayName: '霜痕猎袭',
    displayDescription: '仅对冰缓目标触发额外增伤',
    category: 'prefix',
    tagQuery: [
      CreationTags.MATERIAL.SEMANTIC_FREEZE,
      CreationTags.MATERIAL.SEMANTIC_BURST,
      CreationTags.SCENARIO.TARGET_HAS_CHILL,
    ],
    weight: 42,
    energyCost: 7,
    applicableTo: ['artifact'],
    effectTemplate: {
      type: 'percent_damage_modifier',
      conditions: [{ type: 'has_tag', params: { tag: 'Status.Chill' } }],
      params: {
        mode: 'increase',
        value: { base: 0.13, scale: 'quality', coefficient: 0.025 },
        cap: 0.7,
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
    id: 'artifact-suffix-heal-on-round',
    displayName: '回生珠',
    displayDescription: '每回合开始时恢复气血',
    category: 'suffix',
    tagQuery: [CreationTags.MATERIAL.SEMANTIC_SUSTAIN, CreationTags.MATERIAL.TYPE_HERB],
    exclusiveGroup: 'artifact-suffix-round-heal-tier',
    weight: 75,
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
    id: 'artifact-suffix-armor-passive',
    displayName: '坚壁',
    displayDescription: '受击时减免伤害',
    category: 'suffix',
    tagQuery: [CreationTags.MATERIAL.SEMANTIC_GUARD, CreationTags.MATERIAL.TYPE_ORE],
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
      eventType: CreationTags.BATTLE_EVENT.DAMAGE_REQUEST,
      scope: CreationTags.LISTENER_SCOPE.OWNER_AS_TARGET,
      priority: CREATION_LISTENER_PRIORITIES.damageRequest,
    },
  },
  {
    id: 'artifact-suffix-magic-shield',
    displayName: '玄光法幕',
    displayDescription: '受击时消耗灵力抵消伤害',
    category: 'suffix',
    tagQuery: [CreationTags.MATERIAL.SEMANTIC_SPIRIT, CreationTags.MATERIAL.SEMANTIC_GUARD],
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
      eventType: CreationTags.BATTLE_EVENT.DAMAGE,
      scope: CreationTags.LISTENER_SCOPE.OWNER_AS_TARGET,
      priority: CREATION_LISTENER_PRIORITIES.damageApplyImmunity,
    },
  },
  {
    id: 'artifact-suffix-vampiric-core',
    displayName: '噬生核心',
    displayDescription: '持有者造成伤害后回复气血',
    category: 'suffix',
    tagQuery: [CreationTags.MATERIAL.SEMANTIC_BURST, CreationTags.MATERIAL.SEMANTIC_SUSTAIN],
    weight: 65,
    energyCost: 9,
    applicableTo: ['artifact'],
    effectTemplate: {
      type: 'resource_drain',
      params: {
        sourceType: 'hp',
        targetType: 'hp',
        ratio: { base: 0.1, scale: 'quality', coefficient: 0.03 },
      },
    },
    listenerSpec: {
      eventType: CreationTags.BATTLE_EVENT.DAMAGE_TAKEN,
      scope: CreationTags.LISTENER_SCOPE.OWNER_AS_CASTER,
      priority: CREATION_LISTENER_PRIORITIES.damageTaken,
    },
  },
  {
    id: 'artifact-suffix-mana-recovery',
    displayName: '灵力回源',
    displayDescription: '每回合恢复一定灵力',
    category: 'suffix',
    tagQuery: [CreationTags.MATERIAL.SEMANTIC_SPIRIT, CreationTags.MATERIAL.TYPE_HERB],
    weight: 60,
    energyCost: 8,
    applicableTo: ['artifact'],
    effectTemplate: {
      type: 'apply_buff',
      params: {
        buffConfig: {
          id: 'craft-mana-regen',
          name: '灵力恢复',
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
    id: 'artifact-suffix-counter-attack',
    displayName: '反制之舞',
    displayDescription: '受击时反击攻击者',
    category: 'suffix',
    tagQuery: [CreationTags.MATERIAL.SEMANTIC_BLADE, CreationTags.MATERIAL.SEMANTIC_BURST],
    weight: 58,
    energyCost: 9,
    applicableTo: ['artifact'],
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
      eventType: CreationTags.BATTLE_EVENT.DAMAGE_TAKEN,
      scope: CreationTags.LISTENER_SCOPE.OWNER_AS_TARGET,
      priority: CREATION_LISTENER_PRIORITIES.damageTaken,
    },
  },
  {
    id: 'artifact-suffix-buff-immunity',
    displayName: '纯净之域',
    displayDescription: '对特定类型buff免疫',
    category: 'suffix',
    tagQuery: [CreationTags.MATERIAL.SEMANTIC_SPIRIT, CreationTags.MATERIAL.SEMANTIC_GUARD],
    weight: 50,
    energyCost: 10,
    applicableTo: ['artifact'],
    effectTemplate: {
      type: 'buff_immunity',
      params: {
        tags: ['Status.Debuff'],
      },
    },
    listenerSpec: {
      eventType: CreationTags.BATTLE_EVENT.BUFF_ADD,
      scope: CreationTags.LISTENER_SCOPE.OWNER_AS_TARGET,
      priority: CREATION_LISTENER_PRIORITIES.buffIntercept,
    },
  },
  {
    id: 'artifact-suffix-damage-type-reduce',
    displayName: '元素克制',
    displayDescription: '减少特定伤害类型伤害',
    category: 'suffix',
    tagQuery: [CreationTags.MATERIAL.SEMANTIC_GUARD, ELEMENT_TO_MATERIAL_TAG['冰']],
    weight: 48,
    energyCost: 9,
    applicableTo: ['artifact'],
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
    id: 'artifact-suffix-dispel-debuff',
    displayName: '涤心术',
    displayDescription: '每回合自动解除一层debuff',
    category: 'suffix',
    tagQuery: [CreationTags.MATERIAL.SEMANTIC_SPIRIT, CreationTags.MATERIAL.TYPE_MANUAL],
    weight: 45,
    energyCost: 8,
    applicableTo: ['artifact'],
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
    id: 'artifact-suffix-high-mana-sunder',
    displayName: '灵潮断界',
    displayDescription: '仅在目标高蓝时触发灵能压制',
    category: 'suffix',
    tagQuery: [
      CreationTags.MATERIAL.SEMANTIC_THUNDER,
      CreationTags.MATERIAL.SEMANTIC_SPIRIT,
      CreationTags.SCENARIO.TARGET_HIGH_MP,
    ],
    weight: 38,
    energyCost: 9,
    applicableTo: ['artifact'],
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
      eventType: CreationTags.BATTLE_EVENT.DAMAGE_TAKEN,
      scope: CreationTags.LISTENER_SCOPE.OWNER_AS_CASTER,
      priority: CREATION_LISTENER_PRIORITIES.damageTaken,
    },
  },

  // ========================
  // ===== RESONANCE 词缀 (5 种)
  // ========================
  {
    id: 'artifact-resonance-element-force',
    displayName: '元素共鸣',
    displayDescription: '同元素伤害持续增幅',
    category: 'resonance',
    tagQuery: [
      CreationTags.MATERIAL.SEMANTIC_FLAME,
      CreationTags.MATERIAL.SEMANTIC_FREEZE,
      ELEMENT_TO_MATERIAL_TAG['火'],
    ],
    weight: 55,
    energyCost: 11,
    applicableTo: ['artifact'],
    effectTemplate: {
      type: 'percent_damage_modifier',
      params: {
        mode: 'increase',
        value: { base: 0.06, scale: 'quality', coefficient: 0.015 },
        cap: 0.4,
      },
    },
    listenerSpec: {
      eventType: CreationTags.BATTLE_EVENT.DAMAGE_REQUEST,
      scope: CreationTags.LISTENER_SCOPE.OWNER_AS_CASTER,
      priority: CREATION_LISTENER_PRIORITIES.damageRequest,
    },
  },
  {
    id: 'artifact-resonance-dual-defense',
    displayName: '盾阵同心',
    displayDescription: '物防与法防同步增幅',
    category: 'resonance',
    tagQuery: [CreationTags.MATERIAL.SEMANTIC_GUARD, CreationTags.MATERIAL.SEMANTIC_SPIRIT],
    weight: 52,
    energyCost: 11,
    applicableTo: ['artifact'],
    effectTemplate: {
      type: 'attribute_modifier',
      params: {
        attrType: AttributeType.DEF,
        modType: ModifierType.ADD,
        value: { base: 0.08, scale: 'quality', coefficient: 0.015 },
      },
    },
  },
  {
    id: 'artifact-resonance-sustain-bond',
    displayName: '生命纽带',
    displayDescription: '治疗效果与防御相互强化',
    category: 'resonance',
    tagQuery: [CreationTags.MATERIAL.SEMANTIC_SUSTAIN, CreationTags.MATERIAL.SEMANTIC_GUARD],
    weight: 49,
    energyCost: 10,
    applicableTo: ['artifact'],
    effectTemplate: {
      type: 'heal',
      params: {
        value: {
          base: { base: 6, scale: 'quality', coefficient: 2 },
          attribute: AttributeType.SPIRIT,
          coefficient: 0.1,
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
    id: 'artifact-resonance-offensense-flow',
    displayName: '攻防循环',
    displayDescription: '攻击与防御在战斗中相互转化',
    category: 'resonance',
    tagQuery: [CreationTags.MATERIAL.SEMANTIC_BURST, CreationTags.MATERIAL.SEMANTIC_GUARD],
    weight: 46,
    energyCost: 11,
    applicableTo: ['artifact'],
    effectTemplate: {
      type: 'percent_damage_modifier',
      params: {
        mode: 'increase',
        value: { base: 0.05, scale: 'quality', coefficient: 0.01 },
        cap: 0.35,
      },
    },
    listenerSpec: {
      eventType: CreationTags.BATTLE_EVENT.DAMAGE_REQUEST,
      scope: CreationTags.LISTENER_SCOPE.OWNER_AS_CASTER,
      priority: CREATION_LISTENER_PRIORITIES.damageRequest,
    },
  },
  {
    id: 'artifact-resonance-opening-pressure',
    displayName: '开局震压',
    displayDescription: '仅在目标高血时触发开局攻势加成',
    category: 'resonance',
    tagQuery: [
      CreationTags.MATERIAL.SEMANTIC_BURST,
      CreationTags.MATERIAL.SEMANTIC_GUARD,
      CreationTags.SCENARIO.TARGET_HIGH_HP,
    ],
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
      eventType: CreationTags.BATTLE_EVENT.DAMAGE_REQUEST,
      scope: CreationTags.LISTENER_SCOPE.OWNER_AS_CASTER,
      priority: CREATION_LISTENER_PRIORITIES.damageRequest,
    },
  },

  // ========================
  // ===== SYNERGY 词缀 (6 种)
  // ========================
  {
    id: 'artifact-synergy-multi-defense',
    displayName: '三重防御',
    displayDescription: '多层防御机制相互补强',
    category: 'synergy',
    tagQuery: [
      CreationTags.MATERIAL.SEMANTIC_GUARD,
      CreationTags.MATERIAL.SEMANTIC_SPIRIT,
      CreationTags.MATERIAL.TYPE_ORE,
    ],
    weight: 48,
    energyCost: 12,
    applicableTo: ['artifact'],
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
      eventType: CreationTags.BATTLE_EVENT.DAMAGE_TAKEN,
      scope: CreationTags.LISTENER_SCOPE.OWNER_AS_TARGET,
      priority: CREATION_LISTENER_PRIORITIES.damageTaken,
    },
  },
  {
    id: 'artifact-synergy-reflect-burst',
    displayName: '反击爆裂',
    displayDescription: '反伤与反击叠加触发',
    category: 'synergy',
    tagQuery: [CreationTags.MATERIAL.SEMANTIC_BURST, CreationTags.MATERIAL.SEMANTIC_GUARD],
    weight: 45,
    energyCost: 12,
    applicableTo: ['artifact'],
    effectTemplate: {
      type: 'reflect',
      params: {
        ratio: { base: 0.18, scale: 'quality', coefficient: 0.035 },
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
    id: 'artifact-synergy-lifesteal-sustain',
    displayName: '吸血强生',
    displayDescription: '生命吸取与恢复相互增幅',
    category: 'synergy',
    tagQuery: [CreationTags.MATERIAL.SEMANTIC_SUSTAIN, CreationTags.MATERIAL.SEMANTIC_BURST],
    weight: 42,
    energyCost: 12,
    applicableTo: ['artifact'],
    effectTemplate: {
      type: 'resource_drain',
      params: {
        sourceType: 'hp',
        targetType: 'hp',
        ratio: { base: 0.14, scale: 'quality', coefficient: 0.035 },
      },
    },
    listenerSpec: {
      eventType: CreationTags.BATTLE_EVENT.DAMAGE_TAKEN,
      scope: CreationTags.LISTENER_SCOPE.OWNER_AS_CASTER,
      priority: CREATION_LISTENER_PRIORITIES.damageTaken,
    },
  },
  {
    id: 'artifact-synergy-control-immunity',
    displayName: '坚志不渝',
    displayDescription: '控制抗性与意志力相互强化',
    category: 'synergy',
    tagQuery: [
      CreationTags.MATERIAL.SEMANTIC_MANUAL,
      CreationTags.MATERIAL.SEMANTIC_GUARD,
      CreationTags.SCENARIO.MANY_BUFFS,
    ],
    weight: 39,
    energyCost: 11,
    applicableTo: ['artifact'],
    effectTemplate: {
      type: 'attribute_modifier',
      params: {
        attrType: AttributeType.WILLPOWER,
        modType: ModifierType.ADD,
        value: { base: 0.12, scale: 'quality', coefficient: 0.025 },
      },
    },
  },
  {
    id: 'artifact-synergy-desperate-aegis',
    displayName: '绝境护界',
    displayDescription: '仅在自身低血时触发的大幅减伤护持',
    category: 'synergy',
    tagQuery: [
      CreationTags.MATERIAL.SEMANTIC_GUARD,
      CreationTags.MATERIAL.SEMANTIC_SPIRIT,
      CreationTags.SCENARIO.CASTER_LOW_HP,
    ],
    weight: 35,
    energyCost: 12,
    applicableTo: ['artifact'],
    effectTemplate: {
      type: 'percent_damage_modifier',
      conditions: [{ type: 'hp_below', params: { value: 0.4 } }],
      params: {
        mode: 'reduce',
        value: { base: 0.2, scale: 'quality', coefficient: 0.03 },
        cap: 0.7,
      },
    },
    listenerSpec: {
      eventType: CreationTags.BATTLE_EVENT.DAMAGE_REQUEST,
      scope: CreationTags.LISTENER_SCOPE.OWNER_AS_TARGET,
      priority: CREATION_LISTENER_PRIORITIES.damageRequest,
    },
  },
  {
    id: 'artifact-synergy-burn-punisher',
    displayName: '灼痕裁决',
    displayDescription: '仅对带灼烧目标触发的额外反震',
    category: 'synergy',
    tagQuery: [
      CreationTags.MATERIAL.SEMANTIC_FLAME,
      CreationTags.MATERIAL.SEMANTIC_BURST,
      CreationTags.SCENARIO.TARGET_HAS_BURN,
    ],
    weight: 34,
    energyCost: 12,
    applicableTo: ['artifact'],
    effectTemplate: {
      type: 'reflect',
      conditions: [
        { type: 'has_tag', params: { tag: 'Status.Burn' } },
        { type: 'chance', params: { value: 0.75 } },
      ],
      params: {
        ratio: { base: 0.2, scale: 'quality', coefficient: 0.03 },
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

  // ========================
  // ===== SIGNATURE 词缀 (4 种)
  // ========================
  {
    id: 'artifact-signature-ice-armor',
    displayName: '玄冰神甲',
    displayDescription: '冰属性保护，大幅提升防御',
    category: 'signature',
    tagQuery: [ELEMENT_TO_MATERIAL_TAG['冰'], CreationTags.MATERIAL.SEMANTIC_FREEZE],
    exclusiveGroup: 'artifact-signature-ultimate',
    weight: 35,
    energyCost: 14,
    minQuality: '真品',
    applicableTo: ['artifact'],
    effectTemplate: {
      type: 'attribute_modifier',
      params: {
        attrType: AttributeType.DEF,
        modType: ModifierType.MULTIPLY,
        value: { base: 0.15, scale: 'quality', coefficient: 0.03 },
      },
    },
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
    exclusiveGroup: 'artifact-signature-ultimate',
    weight: 26,
    energyCost: 14,
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
    id: 'artifact-signature-prismatic-aegis',
    displayName: '万象法界',
    displayDescription: '以灵力构筑高阶法幕，压低瞬时伤害',
    category: 'signature',
    tagQuery: [
      CreationTags.MATERIAL.SEMANTIC_SPIRIT,
      CreationTags.MATERIAL.SEMANTIC_GUARD,
      CreationTags.MATERIAL.TYPE_MANUAL,
    ],
    exclusiveGroup: 'artifact-signature-ultimate',
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
      eventType: CreationTags.BATTLE_EVENT.DAMAGE,
      scope: CreationTags.LISTENER_SCOPE.OWNER_AS_TARGET,
      priority: CREATION_LISTENER_PRIORITIES.damageApplyImmunity,
    },
  },
  {
    id: 'artifact-signature-eternal-defense',
    displayName: '永恒堡垒',
    displayDescription: '多重防御机制永久运转，战斗越久越强',
    category: 'signature',
    tagQuery: [
      CreationTags.MATERIAL.SEMANTIC_GUARD,
      CreationTags.MATERIAL.TYPE_SPECIAL,
      CreationTags.MATERIAL.SEMANTIC_SPIRIT,
    ],
    exclusiveGroup: 'artifact-signature-ultimate',
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
      eventType: CreationTags.BATTLE_EVENT.DAMAGE_REQUEST,
      scope: CreationTags.LISTENER_SCOPE.OWNER_AS_TARGET,
      priority: CREATION_LISTENER_PRIORITIES.damageRequest,
    },
  },

  // ========================
  // ===== MYTHIC 词缀 (1 种)
  // ========================
  {
    id: 'artifact-mythic-judgment-seal',
    displayName: '末世审判',
    displayDescription: '战斗中所有防御与反击相互共鸣并指数增长',
    category: 'mythic',
    tagQuery: [
      CreationTags.MATERIAL.SEMANTIC_GUARD,
      CreationTags.MATERIAL.SEMANTIC_BURST,
      CreationTags.MATERIAL.TYPE_SPECIAL,
    ],
    exclusiveGroup: 'artifact-mythic-transcendent',
    weight: 8,
    energyCost: 18,
    minQuality: '玄品',
    applicableTo: ['artifact'],
    effectTemplate: {
      type: 'reflect',
      conditions: [{ type: 'chance', params: { value: 0.82 } }],
      params: {
        ratio: { base: 0.3, scale: 'quality', coefficient: 0.05 },
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
  // ========================
  // ===== 强度分层扩充 T2 / T3 / T4 + 天品仙品专属
  // ========================

  // --- 核心体魄 T2（玄品+，exclusiveGroup: artifact-core-stat）---
  {
    id: 'artifact-core-vitality-t2',
    displayName: '玄铁锻骨',
    displayDescription: '玄铁炼体，体魄极大强化',
    category: 'core',
    tagQuery: [
      CreationTags.MATERIAL.TYPE_ORE,
      CreationTags.MATERIAL.SEMANTIC_GUARD,
      CreationTags.MATERIAL.SEMANTIC_SPIRIT,
    ],
    exclusiveGroup: 'artifact-core-stat',
    weight: 50,
    energyCost: 10,
    minQuality: '玄品',
    applicableTo: ['artifact'],
    effectTemplate: {
      type: 'attribute_modifier',
      params: {
        attrType: AttributeType.VITALITY,
        modType: ModifierType.FIXED,
        value: { base: 7, scale: 'quality', coefficient: 3 },
      },
    },
  },

  // --- 核心体魄 T3（真品+，exclusiveGroup: artifact-core-stat）---
  {
    id: 'artifact-core-vitality-t3',
    displayName: '万载玄晶体魄',
    displayDescription: '真灵玄晶淬炼，体魄铸就超凡，难以撼动',
    category: 'core',
    tagQuery: [
      CreationTags.MATERIAL.TYPE_ORE,
      CreationTags.MATERIAL.SEMANTIC_GUARD,
      CreationTags.MATERIAL.TYPE_SPECIAL,
    ],
    exclusiveGroup: 'artifact-core-stat',
    weight: 20,
    energyCost: 12,
    minQuality: '真品',
    applicableTo: ['artifact'],
    effectTemplate: {
      type: 'attribute_modifier',
      params: {
        attrType: AttributeType.VITALITY,
        modType: ModifierType.FIXED,
        value: { base: 12, scale: 'quality', coefficient: 5 },
      },
    },
  },

  // --- 核心体魄 T4（地品+，exclusiveGroup: artifact-core-stat）---
  {
    id: 'artifact-core-vitality-t4',
    displayName: '地劫焚骨秘体',
    displayDescription: '地阶材料铸就，体魄坚若大地，寻常伤害难撼分毫',
    category: 'core',
    tagQuery: [
      CreationTags.MATERIAL.TYPE_ORE,
      CreationTags.MATERIAL.SEMANTIC_GUARD,
      CreationTags.MATERIAL.TYPE_SPECIAL,
    ],
    exclusiveGroup: 'artifact-core-stat',
    weight: 6,
    energyCost: 14,
    minQuality: '地品',
    applicableTo: ['artifact'],
    effectTemplate: {
      type: 'attribute_modifier',
      params: {
        attrType: AttributeType.VITALITY,
        modType: ModifierType.FIXED,
        value: { base: 20, scale: 'quality', coefficient: 8 },
      },
    },
  },

  // --- 核心灵力 T2（玄品+，exclusiveGroup: artifact-core-stat）---
  {
    id: 'artifact-core-spirit-t2',
    displayName: '太初灵光汇聚',
    displayDescription: '玄级灵力汇聚，法力大幅增强',
    category: 'core',
    tagQuery: [
      CreationTags.MATERIAL.SEMANTIC_SPIRIT,
      CreationTags.MATERIAL.TYPE_MONSTER,
      CreationTags.MATERIAL.SEMANTIC_BURST,
    ],
    exclusiveGroup: 'artifact-core-stat',
    weight: 48,
    energyCost: 10,
    minQuality: '玄品',
    applicableTo: ['artifact'],
    effectTemplate: {
      type: 'attribute_modifier',
      params: {
        attrType: AttributeType.SPIRIT,
        modType: ModifierType.FIXED,
        value: { base: 7, scale: 'quality', coefficient: 3 },
      },
    },
  },

  // --- 核心灵力 T3（真品+，exclusiveGroup: artifact-core-stat）---
  {
    id: 'artifact-core-spirit-t3',
    displayName: '太一灵光',
    displayDescription: '真灵聚顶，灵力跨越凡俗，直指大道',
    category: 'core',
    tagQuery: [
      CreationTags.MATERIAL.SEMANTIC_SPIRIT,
      CreationTags.MATERIAL.TYPE_SPECIAL,
    ],
    exclusiveGroup: 'artifact-core-stat',
    weight: 19,
    energyCost: 12,
    minQuality: '真品',
    applicableTo: ['artifact'],
    effectTemplate: {
      type: 'attribute_modifier',
      params: {
        attrType: AttributeType.SPIRIT,
        modType: ModifierType.FIXED,
        value: { base: 12, scale: 'quality', coefficient: 5 },
      },
    },
  },

  // --- 核心法术攻击 T2（玄品+，exclusiveGroup: artifact-core-stat）---
  {
    id: 'artifact-core-magic-attack-t2',
    displayName: '凌云法力汇聚',
    displayDescription: '玄级法力凝聚，法术攻击大幅增强',
    category: 'core',
    tagQuery: [
      CreationTags.MATERIAL.SEMANTIC_SPIRIT,
      CreationTags.MATERIAL.SEMANTIC_BURST,
      CreationTags.MATERIAL.TYPE_MONSTER,
    ],
    exclusiveGroup: 'artifact-core-stat',
    weight: 45,
    energyCost: 10,
    minQuality: '玄品',
    applicableTo: ['artifact'],
    effectTemplate: {
      type: 'attribute_modifier',
      params: {
        attrType: AttributeType.MAGIC_ATK,
        modType: ModifierType.FIXED,
        value: { base: 7, scale: 'quality', coefficient: 3 },
      },
    },
  },

  // --- 核心法术攻击 T3（真品+，exclusiveGroup: artifact-core-stat）---
  {
    id: 'artifact-core-magic-attack-t3',
    displayName: '太虚法力极境',
    displayDescription: '真灵法力涌现，法术攻击达到极限',
    category: 'core',
    tagQuery: [
      CreationTags.MATERIAL.SEMANTIC_SPIRIT,
      CreationTags.MATERIAL.SEMANTIC_BURST,
      CreationTags.MATERIAL.TYPE_SPECIAL,
    ],
    exclusiveGroup: 'artifact-core-stat',
    weight: 18,
    energyCost: 12,
    minQuality: '真品',
    applicableTo: ['artifact'],
    effectTemplate: {
      type: 'attribute_modifier',
      params: {
        attrType: AttributeType.MAGIC_ATK,
        modType: ModifierType.FIXED,
        value: { base: 12, scale: 'quality', coefficient: 5 },
      },
    },
  },

  // --- 前缀暴击率 T2（玄品+，exclusiveGroup: artifact-prefix-crit-rate-tier）---
  {
    id: 'artifact-prefix-crit-rate-t2',
    displayName: '凌锋极势',
    displayDescription: '玄气凝聚锋芒，暴击率大幅提升',
    category: 'prefix',
    tagQuery: [
      CreationTags.MATERIAL.SEMANTIC_BLADE,
      CreationTags.MATERIAL.TYPE_MONSTER,
      CreationTags.MATERIAL.SEMANTIC_BURST,
    ],
    exclusiveGroup: 'artifact-prefix-crit-rate-tier',
    weight: 48,
    energyCost: 8,
    minQuality: '玄品',
    applicableTo: ['artifact'],
    effectTemplate: {
      type: 'attribute_modifier',
      params: {
        attrType: AttributeType.CRIT_RATE,
        modType: ModifierType.FIXED,
        value: { base: 0.06, scale: 'quality', coefficient: 0.015 },
      },
    },
  },

  // --- 前缀暴击率 T3（真品+，exclusiveGroup: artifact-prefix-crit-rate-tier）---
  {
    id: 'artifact-prefix-crit-rate-t3',
    displayName: '绝杀锋芒',
    displayDescription: '真灵极锋，主动暴击成为常态',
    category: 'prefix',
    tagQuery: [
      CreationTags.MATERIAL.SEMANTIC_BLADE,
      CreationTags.MATERIAL.TYPE_SPECIAL,
    ],
    exclusiveGroup: 'artifact-prefix-crit-rate-tier',
    weight: 18,
    energyCost: 10,
    minQuality: '真品',
    applicableTo: ['artifact'],
    effectTemplate: {
      type: 'attribute_modifier',
      params: {
        attrType: AttributeType.CRIT_RATE,
        modType: ModifierType.FIXED,
        value: { base: 0.10, scale: 'quality', coefficient: 0.025 },
      },
    },
  },

  // --- 前缀暴击伤害 T2（玄品+，exclusiveGroup: artifact-prefix-crit-dmg-tier）---
  {
    id: 'artifact-prefix-crit-damage-t2',
    displayName: '暴击极深化',
    displayDescription: '玄级暴击强化，暴击伤害倍数大幅提升',
    category: 'prefix',
    tagQuery: [
      CreationTags.MATERIAL.SEMANTIC_BURST,
      CreationTags.MATERIAL.TYPE_ORE,
      CreationTags.MATERIAL.SEMANTIC_BLADE,
    ],
    exclusiveGroup: 'artifact-prefix-crit-dmg-tier',
    weight: 45,
    energyCost: 9,
    minQuality: '玄品',
    applicableTo: ['artifact'],
    effectTemplate: {
      type: 'attribute_modifier',
      params: {
        attrType: AttributeType.CRIT_DAMAGE_MULT,
        modType: ModifierType.FIXED,
        value: { base: 0.18, scale: 'quality', coefficient: 0.03 },
      },
    },
  },

  // --- 前缀暴击伤害 T3（真品+，exclusiveGroup: artifact-prefix-crit-dmg-tier）---
  {
    id: 'artifact-prefix-crit-damage-t3',
    displayName: '神裂天击',
    displayDescription: '真灵极域，每次暴击都能造成毁天灭地之力',
    category: 'prefix',
    tagQuery: [
      CreationTags.MATERIAL.SEMANTIC_BURST,
      CreationTags.MATERIAL.TYPE_SPECIAL,
    ],
    exclusiveGroup: 'artifact-prefix-crit-dmg-tier',
    weight: 17,
    energyCost: 11,
    minQuality: '真品',
    applicableTo: ['artifact'],
    effectTemplate: {
      type: 'attribute_modifier',
      params: {
        attrType: AttributeType.CRIT_DAMAGE_MULT,
        modType: ModifierType.FIXED,
        value: { base: 0.30, scale: 'quality', coefficient: 0.05 },
      },
    },
  },

  // --- 后缀每回合回血 T2（玄品+，exclusiveGroup: artifact-suffix-round-heal-tier）---
  {
    id: 'artifact-suffix-round-heal-t2',
    displayName: '涌泉回生',
    displayDescription: '玄灵泉水灌注，每回合大量恢复气血',
    category: 'suffix',
    tagQuery: [
      CreationTags.MATERIAL.SEMANTIC_SUSTAIN,
      CreationTags.MATERIAL.TYPE_HERB,
      CreationTags.MATERIAL.SEMANTIC_SPIRIT,
    ],
    exclusiveGroup: 'artifact-suffix-round-heal-tier',
    weight: 42,
    energyCost: 10,
    minQuality: '玄品',
    applicableTo: ['artifact'],
    effectTemplate: {
      type: 'heal',
      params: {
        value: {
          base: { base: 14, scale: 'quality', coefficient: 6 },
          attribute: AttributeType.SPIRIT,
          coefficient: 0.28,
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

  // --- 后缀每回合回血 T3（真品+，exclusiveGroup: artifact-suffix-round-heal-tier）---
  {
    id: 'artifact-suffix-round-heal-t3',
    displayName: '生命轮回',
    displayDescription: '真灵循环流转，每回合气血大量涌现',
    category: 'suffix',
    tagQuery: [
      CreationTags.MATERIAL.SEMANTIC_SUSTAIN,
      CreationTags.MATERIAL.TYPE_SPECIAL,
    ],
    exclusiveGroup: 'artifact-suffix-round-heal-tier',
    weight: 15,
    energyCost: 12,
    minQuality: '真品',
    applicableTo: ['artifact'],
    effectTemplate: {
      type: 'heal',
      params: {
        value: {
          base: { base: 22, scale: 'quality', coefficient: 9 },
          attribute: AttributeType.SPIRIT,
          coefficient: 0.44,
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

  // --- 天品专属：魂铠天筑（天品+）---
  {
    id: 'artifact-heaven-soul-fortress',
    displayName: '魂铠天筑',
    displayDescription: '天品法宝，受击时以灵魂之力凝结巨大护盾',
    category: 'signature',
    tagQuery: [
      CreationTags.MATERIAL.SEMANTIC_GUARD,
      CreationTags.MATERIAL.SEMANTIC_SPIRIT,
      CreationTags.MATERIAL.TYPE_SPECIAL,
    ],
    exclusiveGroup: 'artifact-heaven-tier',
    weight: 3,
    energyCost: 15,
    minQuality: '天品',
    applicableTo: ['artifact'],
    effectTemplate: {
      type: 'shield',
      params: {
        value: {
          base: { base: 28, scale: 'quality', coefficient: 10 },
          attribute: AttributeType.SPIRIT,
          coefficient: 0.55,
        },
      },
    },
    listenerSpec: {
      eventType: CreationTags.BATTLE_EVENT.DAMAGE_TAKEN,
      scope: CreationTags.LISTENER_SCOPE.OWNER_AS_TARGET,
      priority: CREATION_LISTENER_PRIORITIES.damageTaken,
    },
  },

  // --- 天品专属：天道轮回（天品+）---
  {
    id: 'artifact-heaven-rebirth',
    displayName: '天道轮回',
    displayDescription: '天品法宝，唤醒轮回之力，一战中可免死',
    category: 'mythic',
    tagQuery: [
      CreationTags.MATERIAL.SEMANTIC_DIVINE,
      CreationTags.MATERIAL.SEMANTIC_GUARD,
      CreationTags.MATERIAL.TYPE_SPECIAL,
    ],
    exclusiveGroup: 'artifact-heaven-tier',
    weight: 2,
    energyCost: 16,
    minQuality: '天品',
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

  // --- 仙品专属：万古不灭意志（仙品+）---
  {
    id: 'artifact-immortal-undying-will',
    displayName: '万古不灭意志',
    displayDescription: '仙品法宝，持有者受到的所有伤害大幅削减，几近无敌',
    category: 'mythic',
    tagQuery: [
      CreationTags.MATERIAL.SEMANTIC_DIVINE,
      CreationTags.MATERIAL.SEMANTIC_GUARD,
      CreationTags.MATERIAL.TYPE_SPECIAL,
    ],
    exclusiveGroup: 'artifact-immortal-tier',
    weight: 1,
    energyCost: 18,
    minQuality: '仙品',
    applicableTo: ['artifact'],
    effectTemplate: {
      type: 'percent_damage_modifier',
      params: {
        mode: 'reduce',
        value: { base: 0.55, scale: 'quality', coefficient: 0.05 },
        cap: 0.80,
      },
    },
    listenerSpec: {
      eventType: CreationTags.BATTLE_EVENT.DAMAGE_REQUEST,
      scope: CreationTags.LISTENER_SCOPE.OWNER_AS_TARGET,
      priority: CREATION_LISTENER_PRIORITIES.damageRequest,
    },
  },
  // --- 核心灵力 T4（地品+，exclusiveGroup: artifact-core-stat）---
  {
    id: 'artifact-core-spirit-t4',
    displayName: '仙灵聚顶',
    displayDescription: '地阶仙灵汇聚，灵力之强超越常识',
    category: 'core',
    tagQuery: [
      CreationTags.MATERIAL.SEMANTIC_SPIRIT,
      CreationTags.MATERIAL.TYPE_SPECIAL,
    ],
    exclusiveGroup: 'artifact-core-stat',
    weight: 6,
    energyCost: 14,
    minQuality: '地品',
    applicableTo: ['artifact'],
    effectTemplate: {
      type: 'attribute_modifier',
      params: {
        attrType: AttributeType.SPIRIT,
        modType: ModifierType.FIXED,
        value: { base: 20, scale: 'quality', coefficient: 8 },
      },
    },
  },

  // --- 核心法术攻击 T4（地品+，exclusiveGroup: artifact-core-stat）---
  {
    id: 'artifact-core-magic-attack-t4',
    displayName: '法力极境天门',
    displayDescription: '地阶材料开启法力天门，法术攻击逼近道的极限',
    category: 'core',
    tagQuery: [
      CreationTags.MATERIAL.SEMANTIC_SPIRIT,
      CreationTags.MATERIAL.SEMANTIC_BURST,
      CreationTags.MATERIAL.TYPE_SPECIAL,
    ],
    exclusiveGroup: 'artifact-core-stat',
    weight: 6,
    energyCost: 14,
    minQuality: '地品',
    applicableTo: ['artifact'],
    effectTemplate: {
      type: 'attribute_modifier',
      params: {
        attrType: AttributeType.MAGIC_ATK,
        modType: ModifierType.FIXED,
        value: { base: 20, scale: 'quality', coefficient: 8 },
      },
    },
  },

  // --- 前缀暴击率 T4（地品+，exclusiveGroup: artifact-prefix-crit-rate-tier）---
  {
    id: 'artifact-prefix-crit-rate-t4',
    displayName: '必杀锋极',
    displayDescription: '地阶神兵，每一击几乎必然暴击',
    category: 'prefix',
    tagQuery: [
      CreationTags.MATERIAL.SEMANTIC_BLADE,
      CreationTags.MATERIAL.TYPE_SPECIAL,
    ],
    exclusiveGroup: 'artifact-prefix-crit-rate-tier',
    weight: 4,
    energyCost: 12,
    minQuality: '地品',
    applicableTo: ['artifact'],
    effectTemplate: {
      type: 'attribute_modifier',
      params: {
        attrType: AttributeType.CRIT_RATE,
        modType: ModifierType.FIXED,
        value: { base: 0.16, scale: 'quality', coefficient: 0.04 },
      },
    },
  },

  // --- 前缀暴击伤害 T4（地品+，exclusiveGroup: artifact-prefix-crit-dmg-tier）---
  {
    id: 'artifact-prefix-crit-damage-t4',
    displayName: '天道轰杀',
    displayDescription: '地阶天道之力，每次暴击有如天惩降临，伤害无限放大',
    category: 'prefix',
    tagQuery: [
      CreationTags.MATERIAL.SEMANTIC_BURST,
      CreationTags.MATERIAL.TYPE_SPECIAL,
    ],
    exclusiveGroup: 'artifact-prefix-crit-dmg-tier',
    weight: 4,
    energyCost: 13,
    minQuality: '地品',
    applicableTo: ['artifact'],
    effectTemplate: {
      type: 'attribute_modifier',
      params: {
        attrType: AttributeType.CRIT_DAMAGE_MULT,
        modType: ModifierType.FIXED,
        value: { base: 0.48, scale: 'quality', coefficient: 0.07 },
      },
    },
  },

  // --- 后缀每回合回血 T4（地品+，exclusiveGroup: artifact-suffix-round-heal-tier）---
  {
    id: 'artifact-suffix-round-heal-t4',
    displayName: '万古生机',
    displayDescription: '地阶生机之力，每回合恢复超量气血，犹如永生',
    category: 'suffix',
    tagQuery: [
      CreationTags.MATERIAL.SEMANTIC_SUSTAIN,
      CreationTags.MATERIAL.TYPE_SPECIAL,
    ],
    exclusiveGroup: 'artifact-suffix-round-heal-tier',
    weight: 4,
    energyCost: 14,
    minQuality: '地品',
    applicableTo: ['artifact'],
    effectTemplate: {
      type: 'heal',
      params: {
        value: {
          base: { base: 34, scale: 'quality', coefficient: 13 },
          attribute: AttributeType.SPIRIT,
          coefficient: 0.65,
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
];
