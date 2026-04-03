/*
 * skillAffixes: 技能词缀定义集合（示例数据）。
 * 说明：
 * - applicableTo 字段限定词缀适用的产物类型
 * - 无 listenerSpec 的词缀直接作为 active_skill 的 effects
 * - 有 listenerSpec 的词缀会包装为技能的临时 listeners
 */
import { AttributeType, BuffType, ModifierType, StackRule } from '../../contracts/battle';
import { CREATION_LISTENER_PRIORITIES } from '../../config/CreationBalance';
import { ELEMENT_TO_MATERIAL_TAG } from '../../config/CreationMappings';
import { CreationTags } from '../../core/GameplayTags';
import { AffixDefinition } from '../types';

/**
 * 技能词缀池
 * applicableTo: ['skill']
 * 技能词缀可选 listenerSpec
 * 无 listenerSpec 的效果直接写入 active_skill effects[]
 * 有 listenerSpec 的效果会被包装为主动技能自己的临时 listeners[]
 */
export const SKILL_AFFIXES: AffixDefinition[] = [
  // ===== core 词缀（4 种） =====
  {
    id: 'skill-core-damage',
    displayName: '斩击',
    displayDescription: '施放时造成一次伤害',
    category: 'core',
    tagQuery: [
      CreationTags.MATERIAL.SEMANTIC_BLADE,
      CreationTags.MATERIAL.SEMANTIC_BURST,
      CreationTags.RECIPE.PRODUCT_BIAS_SKILL,
    ],
    exclusiveGroup: 'skill-core',
    weight: 80,
    energyCost: 8,
    applicableTo: ['skill'],
    effectTemplate: {
      type: 'damage',
      params: {
        value: {
          base: { base: 20, scale: 'quality', coefficient: 8 },
          attribute: AttributeType.MAGIC_ATK,
          coefficient: 0.5,
        },
      },
    },
  },
  {
    id: 'skill-core-damage-fire',
    displayName: '焚岳斩',
    displayDescription: '施放时造成一次火属性伤害',
    category: 'core',
    tagQuery: [CreationTags.MATERIAL.SEMANTIC_FLAME, ELEMENT_TO_MATERIAL_TAG['火']],
    exclusiveGroup: 'skill-core',
    weight: 60,
    energyCost: 10,
    applicableTo: ['skill'],
    effectTemplate: {
      type: 'damage',
      params: {
        value: {
          base: { base: 22, scale: 'quality', coefficient: 9 },
          attribute: AttributeType.MAGIC_ATK,
          coefficient: 0.55,
        },
      },
    },
  },
  {
    id: 'skill-core-damage-ice',
    displayName: '玄冰斩',
    displayDescription: '施放时造成一次冰属性伤害',
    category: 'core',
    tagQuery: [CreationTags.MATERIAL.SEMANTIC_FREEZE, ELEMENT_TO_MATERIAL_TAG['冰']],
    exclusiveGroup: 'skill-core',
    weight: 60,
    energyCost: 10,
    applicableTo: ['skill'],
    effectTemplate: {
      type: 'damage',
      params: {
        value: {
          base: { base: 20, scale: 'quality', coefficient: 9 },
          attribute: AttributeType.MAGIC_ATK,
          coefficient: 0.5,
        },
      },
    },
  },
  {
    id: 'skill-core-heal',
    displayName: '愈合',
    displayDescription: '施放时恢复目标气血',
    category: 'core',
    tagQuery: [CreationTags.MATERIAL.SEMANTIC_SUSTAIN, CreationTags.MATERIAL.TYPE_HERB],
    exclusiveGroup: 'skill-core',
    weight: 60,
    energyCost: 8,
    applicableTo: ['skill'],
    effectTemplate: {
      type: 'heal',
      params: {
        value: {
          base: { base: 18, scale: 'quality', coefficient: 7 },
          attribute: AttributeType.MAGIC_ATK,
          coefficient: 0.35,
        },
      },
    },
  },
  {
    id: 'skill-core-mana-burn',
    displayName: '裂神蚀元',
    displayDescription: '施放时灼烧目标灵力',
    category: 'core',
    tagQuery: [
      CreationTags.MATERIAL.SEMANTIC_THUNDER,
      CreationTags.MATERIAL.SEMANTIC_BURST,
      CreationTags.MATERIAL.SEMANTIC_SPIRIT,
    ],
    exclusiveGroup: 'skill-core',
    weight: 44,
    energyCost: 10,
    applicableTo: ['skill'],
    effectTemplate: {
      type: 'mana_burn',
      params: {
        value: {
          base: { base: 14, scale: 'quality', coefficient: 5 },
          attribute: AttributeType.MAGIC_ATK,
          coefficient: 0.28,
        },
      },
    },
  },
  {
    id: 'skill-core-control',
    displayName: '冻结',
    displayDescription: '施放时施加控制效果',
    category: 'core',
    tagQuery: [CreationTags.MATERIAL.SEMANTIC_FREEZE, CreationTags.MATERIAL.SEMANTIC_THUNDER],
    exclusiveGroup: 'skill-core',
    weight: 40,
    energyCost: 12,
    minQuality: '灵品',
    applicableTo: ['skill'],
    effectTemplate: {
      type: 'apply_buff',
      params: {
        buffConfig: {
          id: 'craft-stun',
          name: '眩晕',
          type: BuffType.CONTROL,
          duration: 1,
          stackRule: StackRule.IGNORE,
          tags: ['Status.Stun', 'Status.Control'],
        },
        chance: 0.8,
      },
    },
  },

  // ===== prefix 词缀（3 种） =====
  {
    id: 'skill-prefix-crit-boost',
    displayName: '锋锐',
    displayDescription: '提升本次技能伤害',
    category: 'prefix',
    tagQuery: [CreationTags.MATERIAL.SEMANTIC_BLADE, CreationTags.MATERIAL.TYPE_ORE],
    weight: 80,
    energyCost: 6,
    applicableTo: ['skill'],
    effectTemplate: {
      type: 'percent_damage_modifier',
      params: {
        mode: 'increase',
        value: { base: 0.12, scale: 'quality', coefficient: 0.03 },
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
    id: 'skill-prefix-magic-pen',
    displayName: '破法',
    displayDescription: '临时提升施法者法术穿透',
    category: 'prefix',
    tagQuery: [CreationTags.MATERIAL.TYPE_MONSTER, CreationTags.MATERIAL.SEMANTIC_BURST],
    weight: 60,
    energyCost: 6,
    applicableTo: ['skill'],
    effectTemplate: {
      type: 'attribute_stat_buff',
      params: {
        attrType: AttributeType.MAGIC_PENETRATION,
        modType: ModifierType.FIXED,
        value: { base: 0.06, scale: 'quality', coefficient: 0.02 },
        duration: 1,
        stackRule: StackRule.OVERRIDE,
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
    id: 'skill-prefix-spirit-boost',
    displayName: '灵机',
    displayDescription: '临时提升施法者灵力',
    category: 'prefix',
    tagQuery: [CreationTags.MATERIAL.SEMANTIC_SPIRIT, CreationTags.MATERIAL.TYPE_HERB],
    weight: 60,
    energyCost: 6,
    applicableTo: ['skill'],
    effectTemplate: {
      type: 'attribute_stat_buff',
      params: {
        attrType: AttributeType.SPIRIT,
        modType: ModifierType.FIXED,
        value: { base: 3, scale: 'quality', coefficient: 1 },
        duration: 1,
        stackRule: StackRule.OVERRIDE,
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
    id: 'skill-prefix-cooldown-shift',
    displayName: '回环诀',
    displayDescription: '命中后扰动目标术法节律，延长其其余技能冷却',
    category: 'prefix',
    tagQuery: [
      CreationTags.MATERIAL.SEMANTIC_MANUAL,
      CreationTags.MATERIAL.SEMANTIC_SPIRIT,
      CreationTags.MATERIAL.TYPE_MANUAL,
    ],
    weight: 44,
    energyCost: 7,
    applicableTo: ['skill'],
    effectTemplate: {
      type: 'cooldown_modify',
      params: {
        cdModifyValue: { base: 1, scale: 'quality', coefficient: 0.25 },
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
    id: 'skill-prefix-self-haste',
    displayName: '流光返息',
    displayDescription: '施放后缩短自身其他技能冷却',
    category: 'prefix',
    tagQuery: [CreationTags.MATERIAL.SEMANTIC_WIND, CreationTags.MATERIAL.SEMANTIC_SPIRIT],
    weight: 42,
    energyCost: 7,
    applicableTo: ['skill'],
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

  // ===== suffix 词缀（3 种） =====
  {
    id: 'skill-suffix-burn',
    displayName: '灼烧附加',
    displayDescription: '命中时附加灼烧 debuff',
    category: 'suffix',
    tagQuery: [CreationTags.MATERIAL.SEMANTIC_FLAME, ELEMENT_TO_MATERIAL_TAG['火']],
    weight: 60,
    energyCost: 8,
    applicableTo: ['skill'],
    effectTemplate: {
      type: 'apply_buff',
      params: {
        buffConfig: {
          id: 'craft-burn',
          name: '灼烧',
          type: BuffType.DEBUFF,
          duration: 2,
          stackRule: StackRule.REFRESH_DURATION,
          tags: ['Status.Burn', 'Status.DOT'],
          listeners: [
            {
              eventType: CreationTags.BATTLE_EVENT.ROUND_PRE,
              scope: CreationTags.LISTENER_SCOPE.OWNER_AS_TARGET,
              priority: 20,
              effects: [
                {
                  type: 'damage',
                  params: {
                    value: { base: 8, attribute: AttributeType.MAGIC_ATK, coefficient: 0.15 },
                  },
                },
              ],
            },
          ],
        },
        chance: { base: 0.6, scale: 'quality', coefficient: 0.05 },
      },
    },
  },
  {
    id: 'skill-suffix-dispel',
    displayName: '破除',
    displayDescription: '消除目标一层 debuff',
    category: 'suffix',
    tagQuery: [CreationTags.MATERIAL.SEMANTIC_SPIRIT, CreationTags.MATERIAL.SEMANTIC_MANUAL],
    weight: 40,
    energyCost: 6,
    applicableTo: ['skill'],
    effectTemplate: {
      type: 'dispel',
      params: { maxCount: 1 },
    },
  },
  {
    id: 'skill-suffix-freeze',
    displayName: '冰缓附加',
    displayDescription: '命中时附加减速 debuff',
    category: 'suffix',
    tagQuery: [CreationTags.MATERIAL.SEMANTIC_FREEZE, ELEMENT_TO_MATERIAL_TAG['冰']],
    weight: 60,
    energyCost: 8,
    applicableTo: ['skill'],
    effectTemplate: {
      type: 'apply_buff',
      params: {
        buffConfig: {
          id: 'craft-chill',
          name: '冰缓',
          type: BuffType.DEBUFF,
          duration: 2,
          stackRule: StackRule.REFRESH_DURATION,
          tags: ['Status.Chill'],
          modifiers: [
            {
              attrType: AttributeType.SPEED,
              type: ModifierType.FIXED,
              value: -3,
            },
          ],
        },
        chance: { base: 0.65, scale: 'quality', coefficient: 0.04 },
      },
    },
  },
  {
    id: 'skill-suffix-life-siphon',
    displayName: '噬元回生',
    displayDescription: '造成伤害后将部分伤害转化为气血恢复',
    category: 'suffix',
    tagQuery: [CreationTags.MATERIAL.SEMANTIC_BURST, CreationTags.MATERIAL.SEMANTIC_SUSTAIN],
    weight: 50,
    energyCost: 9,
    applicableTo: ['skill'],
    effectTemplate: {
      type: 'resource_drain',
      params: {
        sourceType: 'hp',
        targetType: 'hp',
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
    id: 'skill-suffix-mana-siphon',
    displayName: '噬灵夺魄',
    displayDescription: '造成伤害后恢复少量灵力',
    category: 'suffix',
    tagQuery: [CreationTags.MATERIAL.SEMANTIC_SPIRIT, CreationTags.MATERIAL.SEMANTIC_BURST],
    weight: 42,
    energyCost: 8,
    applicableTo: ['skill'],
    effectTemplate: {
      type: 'resource_drain',
      params: {
        sourceType: 'hp',
        targetType: 'mp',
        ratio: { base: 0.1, scale: 'quality', coefficient: 0.025 },
      },
    },
    listenerSpec: {
      eventType: CreationTags.BATTLE_EVENT.DAMAGE_TAKEN,
      scope: CreationTags.LISTENER_SCOPE.OWNER_AS_CASTER,
      priority: CREATION_LISTENER_PRIORITIES.damageTaken,
    },
  },
  {
    id: 'skill-suffix-burn-detonate',
    displayName: '焰痕引爆',
    displayDescription: '若目标带有灼烧标记，则触发额外爆裂伤害',
    category: 'suffix',
    tagQuery: [CreationTags.MATERIAL.SEMANTIC_FLAME, CreationTags.MATERIAL.SEMANTIC_BURST],
    weight: 38,
    energyCost: 9,
    applicableTo: ['skill'],
    effectTemplate: {
      type: 'tag_trigger',
      params: {
        triggerTag: 'Status.Burn',
        damageRatio: { base: 1.2, scale: 'quality', coefficient: 0.2 },
        removeOnTrigger: false,
      },
    },
    listenerSpec: {
      eventType: CreationTags.BATTLE_EVENT.SKILL_CAST,
      scope: CreationTags.LISTENER_SCOPE.OWNER_AS_CASTER,
      priority: CREATION_LISTENER_PRIORITIES.skillCast,
    },
  },

  // ===== signature 词缀（3 种） =====
  {
    id: 'skill-signature-shatter-mind',
    displayName: '裂神天鸣',
    displayDescription: '技能命中时强力灼烧灵力并附带爆发伤害',
    category: 'signature',
    tagQuery: [
      CreationTags.MATERIAL.SEMANTIC_THUNDER,
      CreationTags.MATERIAL.SEMANTIC_BURST,
      CreationTags.MATERIAL.SEMANTIC_SPIRIT,
    ],
    exclusiveGroup: 'skill-signature',
    weight: 20,
    energyCost: 13,
    minQuality: '玄品',
    applicableTo: ['skill'],
    effectTemplate: {
      type: 'mana_burn',
      params: {
        value: {
          base: { base: 24, scale: 'quality', coefficient: 7 },
          attribute: AttributeType.MAGIC_ATK,
          coefficient: 0.35,
        },
      },
    },
  },
  {
    id: 'skill-signature-time-lock',
    displayName: '刹那封脉',
    displayDescription: '命中后显著延长目标其余技能冷却',
    category: 'signature',
    tagQuery: [CreationTags.MATERIAL.SEMANTIC_MANUAL, CreationTags.MATERIAL.SEMANTIC_FREEZE],
    exclusiveGroup: 'skill-signature',
    weight: 18,
    energyCost: 14,
    minQuality: '真品',
    applicableTo: ['skill'],
    effectTemplate: {
      type: 'cooldown_modify',
      params: {
        cdModifyValue: { base: 2, scale: 'quality', coefficient: 0.25 },
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
    id: 'skill-signature-blood-siphon',
    displayName: '天渊噬生',
    displayDescription: '造成伤害后大幅吸取生命，形成高压续战能力',
    category: 'signature',
    tagQuery: [CreationTags.MATERIAL.SEMANTIC_BURST, CreationTags.MATERIAL.SEMANTIC_GUARD],
    exclusiveGroup: 'skill-signature',
    weight: 16,
    energyCost: 14,
    minQuality: '真品',
    applicableTo: ['skill'],
    effectTemplate: {
      type: 'resource_drain',
      params: {
        sourceType: 'hp',
        targetType: 'hp',
        ratio: { base: 0.2, scale: 'quality', coefficient: 0.04 },
      },
    },
    listenerSpec: {
      eventType: CreationTags.BATTLE_EVENT.DAMAGE_TAKEN,
      scope: CreationTags.LISTENER_SCOPE.OWNER_AS_CASTER,
      priority: CREATION_LISTENER_PRIORITIES.damageTaken,
    },
  },
];
