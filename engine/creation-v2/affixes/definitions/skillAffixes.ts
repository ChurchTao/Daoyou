/*
 * skillAffixes: 技能词缀定义集合（大幅扩展）。
 * 说明：
 * - 充分利用 battle-v5 支持的 GE 类型：damage, heal, resource_drain, dispel,
 *   shield, reflect, cooldown_modify, tag_trigger, percent_damage_modifier,
 *   buff_immunity, damage_immunity
 * - 条件触发统一通过 EffectConfig.conditions（由 AffixEffectTranslator 透传）
 * - 标签系统大幅扩展，支持语义、效果、战斗特性等多维度组合
 * - exclusive Groups 结构化，支持多个互斥集合
 */
import { AttributeType, BuffType, ModifierType, StackRule } from '../../contracts/battle';
import { CREATION_LISTENER_PRIORITIES } from '../../config/CreationBalance';
import { ELEMENT_TO_MATERIAL_TAG } from '../../config/CreationMappings';
import { CreationTags } from '../../core/GameplayTags';
import { AffixDefinition } from '../types';

export const SKILL_AFFIXES: AffixDefinition[] = [
  // ========================
  // ===== CORE 词缀 (10 种)
  // ========================
  {
    id: 'skill-core-damage',
    displayName: '斩击',
    displayDescription: '施放时造成一次基础伤害',
    category: 'core',
    tagQuery: [
      CreationTags.MATERIAL.SEMANTIC_BLADE,
      CreationTags.MATERIAL.SEMANTIC_BURST,
      CreationTags.RECIPE.PRODUCT_BIAS_SKILL,
    ],
    exclusiveGroup: 'skill-core-damage-type',
    weight: 100,
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
    displayDescription: '造成火属性伤害，高品质时增加持续灼烧',
    category: 'core',
    tagQuery: [CreationTags.MATERIAL.SEMANTIC_FLAME, ELEMENT_TO_MATERIAL_TAG['火']],
    exclusiveGroup: 'skill-core-damage-type',
    weight: 85,
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
    displayDescription: '造成冰属性伤害，可冻结目标',
    category: 'core',
    tagQuery: [CreationTags.MATERIAL.SEMANTIC_FREEZE, ELEMENT_TO_MATERIAL_TAG['冰']],
    exclusiveGroup: 'skill-core-damage-type',
    weight: 80,
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
    id: 'skill-core-damage-thunder',
    displayName: '天雷贯打',
    displayDescription: '造成雷属性伤害，连锁目标身边敌手',
    category: 'core',
    tagQuery: [
      CreationTags.MATERIAL.SEMANTIC_THUNDER,
      ELEMENT_TO_MATERIAL_TAG['雷'],
      CreationTags.MATERIAL.SEMANTIC_BURST,
    ],
    exclusiveGroup: 'skill-core-damage-type',
    weight: 75,
    energyCost: 11,
    applicableTo: ['skill'],
    effectTemplate: {
      type: 'damage',
      params: {
        value: {
          base: { base: 24, scale: 'quality', coefficient: 9 },
          attribute: AttributeType.MAGIC_ATK,
          coefficient: 0.52,
        },
      },
    },
  },
  {
    id: 'skill-core-damage-wind',
    displayName: '风刃裂天',
    displayDescription: '造成风属性伤害，忽视部分防御',
    category: 'core',
    tagQuery: [CreationTags.MATERIAL.SEMANTIC_WIND, ELEMENT_TO_MATERIAL_TAG['风']],
    exclusiveGroup: 'skill-core-damage-type',
    weight: 72,
    energyCost: 10,
    applicableTo: ['skill'],
    effectTemplate: {
      type: 'damage',
      params: {
        value: {
          base: { base: 18, scale: 'quality', coefficient: 8 },
          attribute: AttributeType.ATK,
          coefficient: 0.4,
        },
      },
    },
  },
  {
    id: 'skill-core-heal',
    displayName: '愈合光芒',
    displayDescription: '恢复目标大量气血',
    category: 'core',
    tagQuery: [CreationTags.MATERIAL.SEMANTIC_SUSTAIN, CreationTags.MATERIAL.TYPE_HERB],
    exclusiveGroup: 'skill-core-damage-type',
    weight: 75,
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
    displayDescription: '灼烧目标灵力，高品质时造成额外爆发',
    category: 'core',
    tagQuery: [
      CreationTags.MATERIAL.SEMANTIC_THUNDER,
      CreationTags.MATERIAL.SEMANTIC_BURST,
      CreationTags.MATERIAL.SEMANTIC_SPIRIT,
    ],
    exclusiveGroup: 'skill-core-damage-type',
    weight: 68,
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
    id: 'skill-core-control-stun',
    displayName: '脑海震颤',
    displayDescription: '眩晕目标，使其无法思考',
    category: 'core',
    tagQuery: [CreationTags.MATERIAL.SEMANTIC_FREEZE, CreationTags.MATERIAL.SEMANTIC_THUNDER],
    exclusiveGroup: 'skill-core-damage-type',
    weight: 50,
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
  {
    id: 'skill-core-damage-multi',
    displayName: '连击纷飞',
    displayDescription: '连续斩击，每次伤害递增',
    category: 'core',
    tagQuery: [CreationTags.MATERIAL.SEMANTIC_BLADE, CreationTags.MATERIAL.TYPE_MONSTER],
    exclusiveGroup: 'skill-core-damage-type',
    weight: 65,
    energyCost: 11,
    applicableTo: ['skill'],
    effectTemplate: {
      type: 'damage',
      params: {
        value: {
          base: { base: 16, scale: 'quality', coefficient: 7 },
          attribute: AttributeType.MAGIC_ATK,
          coefficient: 0.42,
        },
      },
    },
  },
  {
    id: 'skill-core-cull-of-weak',
    displayName: '断岳裁锋',
    displayDescription: '仅在目标血线偏低时触发的斩杀打击',
    category: 'core',
    tagQuery: [
      CreationTags.MATERIAL.SEMANTIC_BLADE,
      CreationTags.MATERIAL.SEMANTIC_BURST,
      CreationTags.SCENARIO.TARGET_LOW_HP,
    ],
    exclusiveGroup: 'skill-core-damage-type',
    weight: 46,
    energyCost: 12,
    minQuality: '灵品',
    applicableTo: ['skill'],
    effectTemplate: {
      type: 'damage',
      conditions: [{ type: 'hp_below', params: { value: 0.3 } }],
      params: {
        value: {
          base: { base: 28, scale: 'quality', coefficient: 10 },
          attribute: AttributeType.MAGIC_ATK,
          coefficient: 0.5,
        },
      },
    },
  },

  // ========================
  // ===== PREFIX 词缀 (13 种)
  // ========================
  {
    id: 'skill-prefix-crit-boost',
    displayName: '锋锐之势',
    displayDescription: '提升本次技能伤害',
    category: 'prefix',
    tagQuery: [CreationTags.MATERIAL.SEMANTIC_BLADE, CreationTags.MATERIAL.TYPE_ORE],
    weight: 95,
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
    displayName: '法脉破壁',
    displayDescription: '临时提升施法者法术穿透',
    category: 'prefix',
    tagQuery: [CreationTags.MATERIAL.SEMANTIC_SPIRIT, CreationTags.MATERIAL.TYPE_MONSTER],
    weight: 80,
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
    displayName: '灵机聚集',
    displayDescription: '施放时临时提升施法者灵力',
    category: 'prefix',
    tagQuery: [CreationTags.MATERIAL.SEMANTIC_SPIRIT, CreationTags.MATERIAL.TYPE_HERB],
    weight: 75,
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
    id: 'skill-prefix-cooldown-reduce',
    displayName: '回环诀',
    displayDescription: '命中后扰动目标术法节律',
    category: 'prefix',
    tagQuery: [
      CreationTags.MATERIAL.SEMANTIC_MANUAL,
      CreationTags.MATERIAL.SEMANTIC_SPIRIT,
      CreationTags.MATERIAL.TYPE_MANUAL,
    ],
    weight: 68,
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
    displayName: '流光回息',
    displayDescription: '施放后缩短自身其他技能冷却',
    category: 'prefix',
    tagQuery: [CreationTags.MATERIAL.SEMANTIC_WIND, CreationTags.MATERIAL.SEMANTIC_SPIRIT],
    weight: 65,
    energyCost: 7,
    applicableTo: ['skill'],
    effectTemplate: {
      type: 'cooldown_modify',
      params: {
        cdModifyValue: { base: -0.8, scale: 'quality', coefficient: -0.2 },
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
    id: 'skill-prefix-shield-grant',
    displayName: '防御屏障',
    displayDescription: '施放后为自身生成护盾',
    category: 'prefix',
    tagQuery: [CreationTags.MATERIAL.SEMANTIC_GUARD, CreationTags.MATERIAL.TYPE_ORE],
    weight: 58,
    energyCost: 7,
    applicableTo: ['skill'],
    effectTemplate: {
      type: 'shield',
      params: {
        value: {
          base: { base: 10, scale: 'quality', coefficient: 4 },
          attribute: AttributeType.SPIRIT,
          coefficient: 0.25,
        },
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
    id: 'skill-prefix-healing-amp',
    displayName: '治疗增幅',
    displayDescription: '临时提升施法者治疗效果',
    category: 'prefix',
    tagQuery: [CreationTags.MATERIAL.SEMANTIC_SUSTAIN, CreationTags.MATERIAL.SEMANTIC_SPIRIT],
    weight: 50,
    energyCost: 6,
    applicableTo: ['skill'],
    effectTemplate: {
      type: 'attribute_stat_buff',
      params: {
        attrType: AttributeType.HEAL_AMPLIFY,
        modType: ModifierType.ADD,
        value: { base: 0.1, scale: 'quality', coefficient: 0.02 },
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
    id: 'skill-prefix-evasion-boost',
    displayName: '身法轻灵',
    displayDescription: '施放后临时提升闪避率',
    category: 'prefix',
    tagQuery: [CreationTags.MATERIAL.SEMANTIC_WIND, CreationTags.MATERIAL.SEMANTIC_BLADE],
    weight: 52,
    energyCost: 6,
    applicableTo: ['skill'],
    effectTemplate: {
      type: 'attribute_stat_buff',
      params: {
        attrType: AttributeType.EVASION_RATE,
        modType: ModifierType.FIXED,
        value: { base: 0.04, scale: 'quality', coefficient: 0.01 },
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
    id: 'skill-prefix-crit-damage-boost',
    displayName: '暴击深化',
    displayDescription: '临时提升暴击伤害倍数',
    category: 'prefix',
    tagQuery: [CreationTags.MATERIAL.SEMANTIC_BURST, CreationTags.MATERIAL.TYPE_ORE],
    weight: 48,
    energyCost: 7,
    applicableTo: ['skill'],
    effectTemplate: {
      type: 'attribute_stat_buff',
      params: {
        attrType: AttributeType.CRIT_DAMAGE_MULT,
        modType: ModifierType.ADD,
        value: { base: 0.15, scale: 'quality', coefficient: 0.03 },
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
    id: 'skill-prefix-execute-power',
    displayName: '制裁诀',
    displayDescription: '对低血量目标造成额外伤害',
    category: 'prefix',
    tagQuery: [CreationTags.MATERIAL.SEMANTIC_BURST, CreationTags.MATERIAL.SEMANTIC_BLADE],
    weight: 44,
    energyCost: 8,
    applicableTo: ['skill'],
    effectTemplate: {
      type: 'percent_damage_modifier',
      params: {
        mode: 'increase',
        value: { base: 0.15, scale: 'quality', coefficient: 0.03 },
        cap: 0.8,
      },
    },
    listenerSpec: {
      eventType: CreationTags.BATTLE_EVENT.DAMAGE_REQUEST,
      scope: CreationTags.LISTENER_SCOPE.OWNER_AS_CASTER,
      priority: CREATION_LISTENER_PRIORITIES.damageRequest,
      guard: {
        requireOwnerAlive: true,
      },
    },
  },
  {
    id: 'skill-prefix-overflow-punish',
    displayName: '溢灵破阵',
    displayDescription: '仅在目标灵力充盈时触发额外增伤',
    category: 'prefix',
    tagQuery: [
      CreationTags.MATERIAL.SEMANTIC_THUNDER,
      CreationTags.MATERIAL.SEMANTIC_SPIRIT,
      CreationTags.SCENARIO.TARGET_HIGH_MP,
    ],
    weight: 40,
    energyCost: 7,
    applicableTo: ['skill'],
    effectTemplate: {
      type: 'percent_damage_modifier',
      conditions: [{ type: 'mp_above', params: { value: 0.7 } }],
      params: {
        mode: 'increase',
        value: { base: 0.14, scale: 'quality', coefficient: 0.03 },
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
  // ===== SUFFIX 词缀 (16 种)
  // ========================
  {
    id: 'skill-suffix-burn-dot',
    displayName: '灼烧mark',
    displayDescription: '命中时附加灼烧debuff，每回合造成伤害',
    category: 'suffix',
    tagQuery: [CreationTags.MATERIAL.SEMANTIC_FLAME, ELEMENT_TO_MATERIAL_TAG['火']],
    weight: 80,
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
                    value: {
                      base: 8,
                      attribute: AttributeType.MAGIC_ATK,
                      coefficient: 0.15,
                    },
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
    id: 'skill-suffix-freeze-slow',
    displayName: '冰缓节',
    displayDescription: '命中时附加减速，降低目标身法',
    category: 'suffix',
    tagQuery: [CreationTags.MATERIAL.SEMANTIC_FREEZE, ELEMENT_TO_MATERIAL_TAG['冰']],
    weight: 78,
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
    id: 'skill-suffix-dispel-buff',
    displayName: '驱散术',
    displayDescription: '命中时消除目标一层buff',
    category: 'suffix',
    tagQuery: [CreationTags.MATERIAL.SEMANTIC_SPIRIT, CreationTags.MATERIAL.SEMANTIC_MANUAL],
    weight: 60,
    energyCost: 6,
    applicableTo: ['skill'],
    effectTemplate: {
      type: 'dispel',
      params: {
        maxCount: 1,
      },
    },
  },
  {
    id: 'skill-suffix-life-siphon',
    displayName: '噬元归生',
    displayDescription: '造成伤害时回复部分气血',
    category: 'suffix',
    tagQuery: [CreationTags.MATERIAL.SEMANTIC_BURST, CreationTags.MATERIAL.SEMANTIC_SUSTAIN],
    weight: 72,
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
    displayName: '灵力夺取',
    displayDescription: '造成伤害后恢复灵力',
    category: 'suffix',
    tagQuery: [CreationTags.MATERIAL.SEMANTIC_SPIRIT, CreationTags.MATERIAL.SEMANTIC_BURST],
    weight: 65,
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
    id: 'skill-suffix-burn-trigger',
    displayName: '焰痕引爆',
    displayDescription: '若目标带有灼烧，触发额外爆裂伤害',
    category: 'suffix',
    tagQuery: [CreationTags.MATERIAL.SEMANTIC_FLAME, CreationTags.MATERIAL.SEMANTIC_BURST],
    weight: 58,
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
  {
    id: 'skill-suffix-freeze-trigger',
    displayName: '冰封触发',
    displayDescription: '若目标被冰缓，释放冰锥追加伤害',
    category: 'suffix',
    tagQuery: [CreationTags.MATERIAL.SEMANTIC_FREEZE, CreationTags.MATERIAL.SEMANTIC_BURST],
    weight: 56,
    energyCost: 9,
    applicableTo: ['skill'],
    effectTemplate: {
      type: 'tag_trigger',
      params: {
        triggerTag: 'Status.Chill',
        damageRatio: { base: 0.8, scale: 'quality', coefficient: 0.15 },
        removeOnTrigger: false,
      },
    },
    listenerSpec: {
      eventType: CreationTags.BATTLE_EVENT.SKILL_CAST,
      scope: CreationTags.LISTENER_SCOPE.OWNER_AS_CASTER,
      priority: CREATION_LISTENER_PRIORITIES.skillCast,
    },
  },
  {
    id: 'skill-suffix-shield-on-cast',
    displayName: '护盾激发',
    displayDescription: '施放时为目标生成护盾',
    category: 'suffix',
    tagQuery: [CreationTags.MATERIAL.SEMANTIC_GUARD, CreationTags.MATERIAL.TYPE_ORE],
    weight: 55,
    energyCost: 8,
    applicableTo: ['skill'],
    effectTemplate: {
      type: 'shield',
      params: {
        value: {
          base: { base: 8, scale: 'quality', coefficient: 3 },
          attribute: AttributeType.SPIRIT,
          coefficient: 0.2,
        },
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
    id: 'skill-suffix-empower-buff',
    displayName: '强化符记',
    displayDescription: '为目标增加攻击力buff',
    category: 'suffix',
    tagQuery: [CreationTags.MATERIAL.SEMANTIC_BURST, CreationTags.MATERIAL.TYPE_MONSTER],
    weight: 52,
    energyCost: 7,
    applicableTo: ['skill'],
    effectTemplate: {
      type: 'apply_buff',
      params: {
        buffConfig: {
          id: 'craft-atk-buff',
          name: '力量强化',
          type: BuffType.BUFF,
          duration: 2,
          stackRule: StackRule.REFRESH_DURATION,
          tags: ['Status.Buff'],
          modifiers: [
            {
              attrType: AttributeType.MAGIC_ATK,
              type: ModifierType.FIXED,
              value: 4,
            },
          ],
        },
        chance: { base: 0.8, scale: 'quality', coefficient: 0.05 },
      },
    },
  },
  {
    id: 'skill-suffix-def-reduce',
    displayName: '破防标记',
    displayDescription: '命中时降低目标防御',
    category: 'suffix',
    tagQuery: [CreationTags.MATERIAL.SEMANTIC_BLADE, CreationTags.MATERIAL.SEMANTIC_BURST],
    weight: 50,
    energyCost: 7,
    applicableTo: ['skill'],
    effectTemplate: {
      type: 'apply_buff',
      params: {
        buffConfig: {
          id: 'craft-def-debuff',
          name: '防御削弱',
          type: BuffType.DEBUFF,
          duration: 2,
          stackRule: StackRule.REFRESH_DURATION,
          tags: ['Status.DefDebuff'],
          modifiers: [
            {
              attrType: AttributeType.DEF,
              type: ModifierType.FIXED,
              value: -3,
            },
          ],
        },
        chance: { base: 0.7, scale: 'quality', coefficient: 0.04 },
      },
    },
  },
  {
    id: 'skill-suffix-crit-passive',
    displayName: '暴击之舞',
    displayDescription: '命中时增加下一次暴击率',
    category: 'suffix',
    tagQuery: [CreationTags.MATERIAL.SEMANTIC_BLADE, CreationTags.MATERIAL.TYPE_MONSTER],
    weight: 47,
    energyCost: 7,
    applicableTo: ['skill'],
    effectTemplate: {
      type: 'apply_buff',
      params: {
        buffConfig: {
          id: 'craft-crit-buff',
          name: '暴击预兆',
          type: BuffType.BUFF,
          duration: 1,
          stackRule: StackRule.STACK_LAYER,
          tags: ['Status.Buff'],
          modifiers: [
            {
              attrType: AttributeType.CRIT_RATE,
              type: ModifierType.FIXED,
              value: 0.08,
            },
          ],
        },
        chance: { base: 0.6, scale: 'quality', coefficient: 0.05 },
      },
    },
  },
  {
    id: 'skill-suffix-low-hp-dmg',
    displayName: '危机爆发',
    displayDescription: '当目标低血量时造成额外伤害',
    category: 'suffix',
    tagQuery: [CreationTags.MATERIAL.SEMANTIC_BURST, CreationTags.SCENARIO.LOW_HP],
    weight: 45,
    energyCost: 9,
    applicableTo: ['skill'],
    effectTemplate: {
      type: 'percent_damage_modifier',
      params: {
        mode: 'increase',
        value: { base: 0.18, scale: 'quality', coefficient: 0.04 },
        cap: 0.9,
      },
    },
    listenerSpec: {
      eventType: CreationTags.BATTLE_EVENT.DAMAGE_REQUEST,
      scope: CreationTags.LISTENER_SCOPE.OWNER_AS_CASTER,
      priority: CREATION_LISTENER_PRIORITIES.damageRequest,
    },
  },
  {
    id: 'skill-suffix-burning-finish',
    displayName: '焚脉终式',
    displayDescription: '仅对带灼烧目标触发的终结增伤',
    category: 'suffix',
    tagQuery: [
      CreationTags.MATERIAL.SEMANTIC_FLAME,
      CreationTags.SCENARIO.TARGET_HAS_BURN,
      CreationTags.MATERIAL.SEMANTIC_BURST,
    ],
    weight: 34,
    energyCost: 9,
    applicableTo: ['skill'],
    effectTemplate: {
      type: 'percent_damage_modifier',
      conditions: [{ type: 'has_tag', params: { tag: 'Status.Burn' } }],
      params: {
        mode: 'increase',
        value: { base: 0.16, scale: 'quality', coefficient: 0.03 },
        cap: 0.85,
      },
    },
    listenerSpec: {
      eventType: CreationTags.BATTLE_EVENT.DAMAGE_REQUEST,
      scope: CreationTags.LISTENER_SCOPE.OWNER_AS_CASTER,
      priority: CREATION_LISTENER_PRIORITIES.damageRequest,
    },
  },

  // ========================
  // ===== RESONANCE 词缀 (6 种)
  // ========================
  {
    id: 'skill-resonance-element-chain',
    displayName: '元素连锁',
    displayDescription: '同元素伤害在战斗中不断增幅',
    category: 'resonance',
    tagQuery: [
      CreationTags.MATERIAL.SEMANTIC_FLAME,
      CreationTags.MATERIAL.SEMANTIC_FREEZE,
      CreationTags.MATERIAL.SEMANTIC_THUNDER,
    ],
    weight: 60,
    energyCost: 10,
    applicableTo: ['skill'],
    effectTemplate: {
      type: 'percent_damage_modifier',
      params: {
        mode: 'increase',
        value: { base: 0.08, scale: 'quality', coefficient: 0.02 },
        cap: 0.5,
      },
    },
  },
  {
    id: 'skill-resonance-combo-power',
    displayName: '连招共鸣',
    displayDescription: '连续施放提升伤害',
    category: 'resonance',
    tagQuery: [CreationTags.MATERIAL.SEMANTIC_BLADE, CreationTags.MATERIAL.SEMANTIC_BURST],
    weight: 55,
    energyCost: 11,
    applicableTo: ['skill'],
    effectTemplate: {
      type: 'apply_buff',
      params: {
        buffConfig: {
          id: 'craft-combo-stack',
          name: '连击层数',
          type: BuffType.BUFF,
          duration: 2,
          stackRule: StackRule.STACK_LAYER,
          tags: ['Status.Combo'],
          modifiers: [
            {
              attrType: AttributeType.MAGIC_ATK,
              type: ModifierType.ADD,
              value: 0.05,
            },
          ],
        },
        chance: 1,
      },
    },
  },
  {
    id: 'skill-resonance-spirit-echo',
    displayName: '灵识回响',
    displayDescription: '多次施放法术时灵力消耗递减',
    category: 'resonance',
    tagQuery: [CreationTags.MATERIAL.SEMANTIC_SPIRIT, CreationTags.MATERIAL.TYPE_HERB],
    weight: 52,
    energyCost: 10,
    applicableTo: ['skill'],
    effectTemplate: {
      type: 'apply_buff',
      params: {
        buffConfig: {
          id: 'craft-mana-efficiency',
          name: '灵力高效',
          type: BuffType.BUFF,
          duration: 2,
          stackRule: StackRule.STACK_LAYER,
          tags: ['Status.ManaEff'],
        },
        chance: 1,
      },
    },
  },
  {
    id: 'skill-resonance-sustain-flow',
    displayName: '生命流转',
    displayDescription: '治疗技能增幅自身防御',
    category: 'resonance',
    tagQuery: [CreationTags.MATERIAL.SEMANTIC_SUSTAIN, CreationTags.MATERIAL.SEMANTIC_GUARD],
    weight: 48,
    energyCost: 10,
    applicableTo: ['skill'],
    effectTemplate: {
      type: 'apply_buff',
      params: {
        buffConfig: {
          id: 'craft-heal-shield',
          name: '治愈屏障',
          type: BuffType.BUFF,
          duration: 1,
          stackRule: StackRule.OVERRIDE,
          tags: ['Status.Buff'],
          modifiers: [
            {
              attrType: AttributeType.DEF,
              type: ModifierType.ADD,
              value: 0.12,
            },
          ],
        },
        chance: 1,
      },
    },
  },
  {
    id: 'skill-resonance-control-mastery',
    displayName: '控制精通',
    displayDescription: '控制技能增加命中率',
    category: 'resonance',
    tagQuery: [
      CreationTags.MATERIAL.SEMANTIC_FREEZE,
      CreationTags.MATERIAL.SEMANTIC_THUNDER,
      CreationTags.EFFECT.CONTROL,
    ],
    weight: 44,
    energyCost: 10,
    applicableTo: ['skill'],
    effectTemplate: {
      type: 'apply_buff',
      params: {
        buffConfig: {
          id: 'craft-control-precision',
          name: '控制精准',
          type: BuffType.BUFF,
          duration: 2,
          stackRule: StackRule.OVERRIDE,
          tags: ['Status.Buff'],
        },
        chance: 1,
      },
    },
  },
  {
    id: 'skill-resonance-calm-compression',
    displayName: '静域凝锋',
    displayDescription: '仅在目标高血时触发开局压制增伤',
    category: 'resonance',
    tagQuery: [
      CreationTags.MATERIAL.SEMANTIC_BURST,
      CreationTags.MATERIAL.SEMANTIC_MANUAL,
      CreationTags.SCENARIO.TARGET_HIGH_HP,
    ],
    weight: 38,
    energyCost: 11,
    applicableTo: ['skill'],
    effectTemplate: {
      type: 'percent_damage_modifier',
      conditions: [{ type: 'hp_above', params: { value: 0.75 } }],
      params: {
        mode: 'increase',
        value: { base: 0.12, scale: 'quality', coefficient: 0.02 },
        cap: 0.6,
      },
    },
  },

  // ========================
  // ===== SYNERGY 词缀 (7 种)
  // ========================
  {
    id: 'skill-synergy-damage-heal',
    displayName: '伤治同轨',
    displayDescription: '伤害技能也能治疗友军',
    category: 'synergy',
    tagQuery: [CreationTags.MATERIAL.SEMANTIC_BURST, CreationTags.MATERIAL.SEMANTIC_SUSTAIN],
    weight: 50,
    energyCost: 11,
    applicableTo: ['skill'],
    effectTemplate: {
      type: 'heal',
      params: {
        value: {
          base: { base: 6, scale: 'quality', coefficient: 2 },
          attribute: AttributeType.MAGIC_ATK,
          coefficient: 0.12,
        },
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
    id: 'skill-synergy-control-damage',
    displayName: '制局强杀',
    displayDescription: '控制受效目标时造成额外伤害',
    category: 'synergy',
    tagQuery: [
      CreationTags.MATERIAL.SEMANTIC_FREEZE,
      CreationTags.MATERIAL.SEMANTIC_BURST,
      CreationTags.EFFECT.CONTROL,
    ],
    weight: 46,
    energyCost: 12,
    applicableTo: ['skill'],
    effectTemplate: {
      type: 'percent_damage_modifier',
      params: {
        mode: 'increase',
        value: { base: 0.25, scale: 'quality', coefficient: 0.05 },
        cap: 1.2,
      },
    },
  },
  {
    id: 'skill-synergy-shield-damage',
    displayName: '盾杀合一',
    displayDescription: '护盾吸收伤害时释放反击',
    category: 'synergy',
    tagQuery: [CreationTags.MATERIAL.SEMANTIC_GUARD, CreationTags.MATERIAL.SEMANTIC_BURST],
    weight: 44,
    energyCost: 12,
    applicableTo: ['skill'],
    effectTemplate: {
      type: 'reflect',
      params: {
        ratio: { base: 0.15, scale: 'quality', coefficient: 0.03 },
      },
    },
  },
  {
    id: 'skill-synergy-debuff-stack',
    displayName: '叠层诅咒',
    displayDescription: '多个debuff相互增幅效果',
    category: 'synergy',
    tagQuery: [
      CreationTags.MATERIAL.SEMANTIC_POISON,
      CreationTags.MATERIAL.SEMANTIC_THUNDER,
      CreationTags.SCENARIO.MANY_DEBUFFS,
    ],
    weight: 42,
    energyCost: 11,
    applicableTo: ['skill'],
    effectTemplate: {
      type: 'percent_damage_modifier',
      params: {
        mode: 'increase',
        value: { base: 0.1, scale: 'quality', coefficient: 0.025 },
        cap: 0.7,
      },
    },
  },
  {
    id: 'skill-synergy-recovery-vortex',
    displayName: '恢复漩涡',
    displayDescription: '治疗和吸取能相互强化',
    category: 'synergy',
    tagQuery: [CreationTags.MATERIAL.SEMANTIC_SUSTAIN, CreationTags.MATERIAL.SEMANTIC_SPIRIT],
    weight: 40,
    energyCost: 12,
    applicableTo: ['skill'],
    effectTemplate: {
      type: 'heal',
      params: {
        value: {
          base: { base: 8, scale: 'quality', coefficient: 3 },
          attribute: AttributeType.MAGIC_ATK,
          coefficient: 0.18,
        },
      },
    },
  },
  {
    id: 'skill-synergy-execute-instinct',
    displayName: '斩命本能',
    displayDescription: '仅在目标低血时触发的高额增伤',
    category: 'synergy',
    tagQuery: [
      CreationTags.MATERIAL.SEMANTIC_BURST,
      CreationTags.MATERIAL.SEMANTIC_BLADE,
      CreationTags.SCENARIO.TARGET_LOW_HP,
    ],
    weight: 38,
    energyCost: 12,
    applicableTo: ['skill'],
    effectTemplate: {
      type: 'percent_damage_modifier',
      conditions: [{ type: 'hp_below', params: { value: 0.35 } }],
      params: {
        mode: 'increase',
        value: { base: 0.22, scale: 'quality', coefficient: 0.04 },
        cap: 1,
      },
    },
  },
  {
    id: 'skill-synergy-empty-mana-pierce',
    displayName: '枯海破灵',
    displayDescription: '仅在目标灵力偏低时触发破灵增伤',
    category: 'synergy',
    tagQuery: [
      CreationTags.MATERIAL.SEMANTIC_THUNDER,
      CreationTags.MATERIAL.SEMANTIC_SPIRIT,
      CreationTags.SCENARIO.TARGET_LOW_MP,
    ],
    weight: 36,
    energyCost: 11,
    applicableTo: ['skill'],
    effectTemplate: {
      type: 'mana_burn',
      conditions: [{ type: 'mp_below', params: { value: 0.4 } }],
      params: {
        value: {
          base: { base: 16, scale: 'quality', coefficient: 5 },
          attribute: AttributeType.MAGIC_ATK,
          coefficient: 0.24,
        },
      },
    },
  },

  // ========================
  // ===== SIGNATURE 词缀 (1 种)
  // ========================
  {
    id: 'skill-signature-crimson-sentence',
    displayName: '赤狱断章',
    displayDescription: '仅在目标带灼烧时触发的签名终结技',
    category: 'signature',
    tagQuery: [
      CreationTags.MATERIAL.SEMANTIC_FLAME,
      CreationTags.MATERIAL.SEMANTIC_BURST,
      CreationTags.SCENARIO.TARGET_HAS_BURN,
    ],
    exclusiveGroup: 'skill-signature-ultimate',
    weight: 20,
    energyCost: 14,
    minQuality: '真品',
    applicableTo: ['skill'],
    effectTemplate: {
      type: 'damage',
      conditions: [{ type: 'has_tag', params: { tag: 'Status.Burn' } }],
      params: {
        value: {
          base: { base: 30, scale: 'quality', coefficient: 11 },
          attribute: AttributeType.MAGIC_ATK,
          coefficient: 0.62,
        },
      },
    },
  },

  // ========================
  // ===== MYTHIC 词缀 (3 种)
  // ========================
  {
    id: 'skill-mythic-shatter-realm',
    displayName: '碎裂天地',
    displayDescription: '超强伤害技能，摧毁一切障碍',
    category: 'mythic',
    tagQuery: [
      CreationTags.MATERIAL.SEMANTIC_BURST,
      CreationTags.MATERIAL.SEMANTIC_BLADE,
      CreationTags.MATERIAL.TYPE_SPECIAL,
    ],
    exclusiveGroup: 'skill-mythic-ultimate',
    weight: 15,
    energyCost: 16,
    minQuality: '玄品',
    applicableTo: ['skill'],
    effectTemplate: {
      type: 'damage',
      conditions: [
        { type: 'hp_above', params: { value: 0.7 } },
        { type: 'chance', params: { value: 0.85 } },
      ],
      params: {
        value: {
          base: { base: 40, scale: 'quality', coefficient: 15 },
          attribute: AttributeType.MAGIC_ATK,
          coefficient: 0.75,
        },
      },
    },
  },
  {
    id: 'skill-mythic-eternal-echo',
    displayName: '永恒回声',
    displayDescription: '技能产生无限回响，每次战斗增幅',
    category: 'mythic',
    tagQuery: [
      CreationTags.MATERIAL.SEMANTIC_MANUAL,
      CreationTags.MATERIAL.SEMANTIC_SPIRIT,
      CreationTags.MATERIAL.TYPE_SPECIAL,
    ],
    exclusiveGroup: 'skill-mythic-ultimate',
    weight: 12,
    energyCost: 15,
    minQuality: '真品',
    applicableTo: ['skill'],
    effectTemplate: {
      type: 'apply_buff',
      params: {
        buffConfig: {
          id: 'craft-eternal-echo',
          name: '永恒回声',
          type: BuffType.BUFF,
          duration: -1,
          stackRule: StackRule.STACK_LAYER,
          tags: ['Status.Mythic'],
          modifiers: [
            {
              attrType: AttributeType.MAGIC_ATK,
              type: ModifierType.ADD,
              value: 0.05,
            },
          ],
        },
        chance: 1,
      },
    },
  },
  {
    id: 'skill-mythic-divine-intervention',
    displayName: '神圣干预',
    displayDescription: '战斗中多次触发治疗和保护',
    category: 'mythic',
    tagQuery: [
      CreationTags.MATERIAL.SEMANTIC_SUSTAIN,
      CreationTags.MATERIAL.SEMANTIC_DIVINE,
      CreationTags.MATERIAL.TYPE_SPECIAL,
    ],
    exclusiveGroup: 'skill-mythic-ultimate',
    weight: 10,
    energyCost: 14,
    minQuality: '真品',
    applicableTo: ['skill'],
    effectTemplate: {
      type: 'heal',
      params: {
        value: {
          base: { base: 25, scale: 'quality', coefficient: 8 },
          attribute: AttributeType.MAGIC_ATK,
          coefficient: 0.5,
        },
      },
    },
  },
];
