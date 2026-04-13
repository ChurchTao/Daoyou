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
import {
  CREATION_DURATION_POLICY,
  CREATION_LISTENER_PRIORITIES,
} from '../../config/CreationBalance';
import { ELEMENT_TO_MATERIAL_TAG } from '../../config/CreationMappings';
import { CreationTags, GameplayTags } from '@/engine/shared/tag-domain';
import { AffixDefinition, matchAll } from '../types';

export const SKILL_AFFIXES: AffixDefinition[] = [
  // ========================
  // ===== CORE 词缀 (9 种)
  // ========================
  {
    id: 'skill-core-damage',
    displayName: '斩击',
    displayDescription: '施放时造成一次基础伤害',
    category: 'core',
    match: matchAll([
      CreationTags.MATERIAL.SEMANTIC_BLADE,
      CreationTags.MATERIAL.SEMANTIC_BURST,
      CreationTags.RECIPE.PRODUCT_BIAS_SKILL,
    ]),
    exclusiveGroup: 'skill-core-damage-type',
    weight: 100,
    energyCost: 8,
    applicableTo: ['skill'],
    grantedAbilityTags: [
      GameplayTags.ABILITY.FUNCTION.DAMAGE,
      GameplayTags.ABILITY.CHANNEL.MAGIC,
    ],
    effectTemplate: {
      type: 'damage',
      params: {
        value: {
          base: { base: 80, scale: 'quality', coefficient: 14 },
          attribute: AttributeType.MAGIC_ATK,
          coefficient: 0.9,
        },
      },
    },
  },
  {
    id: 'skill-core-control-stun-t2',
    displayName: '镇魂雷缚',
    displayDescription: '玄品控制核心，以雷意震魂并短暂封禁行动',
    category: 'core',
    match: matchAll([
      CreationTags.MATERIAL.SEMANTIC_FREEZE,
      CreationTags.MATERIAL.SEMANTIC_THUNDER,
      CreationTags.MATERIAL.SEMANTIC_SPIRIT,
    ]),
    exclusiveGroup: 'skill-core-damage-type',
    weight: 26,
    energyCost: 13,
    minQuality: '玄品',
    applicableTo: ['skill'],
    grantedAbilityTags: [GameplayTags.ABILITY.FUNCTION.CONTROL],
    effectTemplate: {
      type: 'apply_buff',
      params: {
        buffConfig: {
          id: 'craft-stun-t2',
          name: '镇魂',
          type: BuffType.CONTROL,
          duration: CREATION_DURATION_POLICY.control.default,
          stackRule: StackRule.IGNORE,
          tags: [GameplayTags.BUFF.TYPE.DEBUFF, GameplayTags.BUFF.TYPE.CONTROL],
          statusTags: [GameplayTags.STATUS.CATEGORY.DEBUFF, GameplayTags.STATUS.CONTROL.ROOT, GameplayTags.STATUS.CONTROL.STUNNED, GameplayTags.STATUS.CONTROL.NO_ACTION],
        },
        chance: 0.85,
      },
    },
  },
  {
    id: 'skill-core-control-stun-t3',
    displayName: '天心禁咒',
    displayDescription: '真品控制核心，禁咒成形后可稳定夺走敌方回合',
    category: 'core',
    match: matchAll([
      CreationTags.MATERIAL.SEMANTIC_FREEZE,
      CreationTags.MATERIAL.SEMANTIC_THUNDER,
      CreationTags.MATERIAL.TYPE_SPECIAL,
    ]),
    exclusiveGroup: 'skill-core-damage-type',
    weight: 11,
    energyCost: 14,
    minQuality: '真品',
    applicableTo: ['skill'],
    grantedAbilityTags: [GameplayTags.ABILITY.FUNCTION.CONTROL],
    effectTemplate: {
      type: 'apply_buff',
      params: {
        buffConfig: {
          id: 'craft-stun-t3',
          name: '禁咒',
          type: BuffType.CONTROL,
          duration: CREATION_DURATION_POLICY.control.elite,
          stackRule: StackRule.IGNORE,
          tags: [GameplayTags.BUFF.TYPE.DEBUFF, GameplayTags.BUFF.TYPE.CONTROL],
          statusTags: [GameplayTags.STATUS.CATEGORY.DEBUFF, GameplayTags.STATUS.CONTROL.ROOT, GameplayTags.STATUS.CONTROL.STUNNED, GameplayTags.STATUS.CONTROL.NO_ACTION],
        },
        chance: 0.9,
      },
    },
  },
  {
    id: 'skill-core-control-stun-t4',
    displayName: '太上绝识',
    displayDescription: '地品控制核心，以绝识之法强压目标行动能力',
    category: 'core',
    match: matchAll([
      CreationTags.MATERIAL.SEMANTIC_FREEZE,
      CreationTags.MATERIAL.SEMANTIC_THUNDER,
      CreationTags.MATERIAL.TYPE_SPECIAL,
    ]),
    exclusiveGroup: 'skill-core-damage-type',
    weight: 4,
    energyCost: 15,
    minQuality: '地品',
    applicableTo: ['skill'],
    grantedAbilityTags: [GameplayTags.ABILITY.FUNCTION.CONTROL],
    effectTemplate: {
      type: 'apply_buff',
      params: {
        buffConfig: {
          id: 'craft-stun-t4',
          name: '绝识',
          type: BuffType.CONTROL,
          duration: CREATION_DURATION_POLICY.control.elite,
          stackRule: StackRule.IGNORE,
          tags: [GameplayTags.BUFF.TYPE.DEBUFF, GameplayTags.BUFF.TYPE.CONTROL],
          statusTags: [GameplayTags.STATUS.CATEGORY.DEBUFF, GameplayTags.STATUS.CONTROL.ROOT, GameplayTags.STATUS.CONTROL.STUNNED, GameplayTags.STATUS.CONTROL.NO_ACTION],
        },
        chance: 0.95,
      },
    },
  },
  {
    id: 'skill-core-damage-fire',
    displayName: '焚岳斩',
    displayDescription: '造成火属性伤害，高品质时增加持续灼烧',
    category: 'core',
    match: matchAll([CreationTags.MATERIAL.SEMANTIC_FLAME, ELEMENT_TO_MATERIAL_TAG['火']]),
    exclusiveGroup: 'skill-core-damage-type',
    weight: 85,
    energyCost: 10,
    applicableTo: ['skill'],
    grantedAbilityTags: [
      GameplayTags.ABILITY.FUNCTION.DAMAGE,
      GameplayTags.ABILITY.CHANNEL.MAGIC,
    ],
    effectTemplate: {
      type: 'damage',
      params: {
        value: {
          base: { base: 86, scale: 'quality', coefficient: 15 },
          attribute: AttributeType.MAGIC_ATK,
          coefficient: 0.92,
        },
      },
    },
  },
  {
    id: 'skill-core-damage-ice',
    displayName: '玄冰斩',
    displayDescription: '造成冰属性伤害，可冻结目标',
    category: 'core',
    match: matchAll([CreationTags.MATERIAL.SEMANTIC_FREEZE, ELEMENT_TO_MATERIAL_TAG['冰']]),
    exclusiveGroup: 'skill-core-damage-type',
    weight: 80,
    energyCost: 10,
    applicableTo: ['skill'],
    grantedAbilityTags: [
      GameplayTags.ABILITY.FUNCTION.DAMAGE,
      GameplayTags.ABILITY.CHANNEL.MAGIC,
    ],
    effectTemplate: {
      type: 'damage',
      params: {
        value: {
          base: { base: 78, scale: 'quality', coefficient: 14 },
          attribute: AttributeType.MAGIC_ATK,
          coefficient: 0.86,
        },
      },
    },
  },
  {
    id: 'skill-core-damage-thunder',
    displayName: '天雷贯打',
    displayDescription: '造成雷属性伤害，连锁目标身边敌手',
    category: 'core',
    match: matchAll([
      CreationTags.MATERIAL.SEMANTIC_THUNDER,
      ELEMENT_TO_MATERIAL_TAG['雷'],
      CreationTags.MATERIAL.SEMANTIC_BURST,
    ]),
    exclusiveGroup: 'skill-core-damage-type',
    weight: 75,
    energyCost: 11,
    applicableTo: ['skill'],
    grantedAbilityTags: [
      GameplayTags.ABILITY.FUNCTION.DAMAGE,
      GameplayTags.ABILITY.CHANNEL.MAGIC,
    ],
    effectTemplate: {
      type: 'damage',
      params: {
        value: {
          base: { base: 92, scale: 'quality', coefficient: 15 },
          attribute: AttributeType.MAGIC_ATK,
          coefficient: 0.94,
        },
      },
    },
  },
  {
    id: 'skill-core-damage-wind',
    displayName: '风刃裂天',
    displayDescription: '造成风属性伤害，忽视部分防御',
    category: 'core',
    match: matchAll([CreationTags.MATERIAL.SEMANTIC_WIND, ELEMENT_TO_MATERIAL_TAG['风']]),
    exclusiveGroup: 'skill-core-damage-type',
    weight: 72,
    energyCost: 10,
    applicableTo: ['skill'],
    grantedAbilityTags: [
      GameplayTags.ABILITY.FUNCTION.DAMAGE,
      GameplayTags.ABILITY.CHANNEL.PHYSICAL,
    ],
    effectTemplate: {
      type: 'damage',
      params: {
        value: {
          base: { base: 60, scale: 'quality', coefficient: 12 },
          attribute: AttributeType.ATK,
          coefficient: 0.72,
        },
      },
    },
  },
  {
    id: 'skill-core-heal',
    displayName: '愈合光芒',
    displayDescription: '恢复目标大量气血',
    category: 'core',
    match: matchAll([CreationTags.MATERIAL.SEMANTIC_SUSTAIN, CreationTags.MATERIAL.TYPE_HERB]),
    exclusiveGroup: 'skill-core-damage-type',
    weight: 75,
    energyCost: 8,
    applicableTo: ['skill'],
    grantedAbilityTags: [GameplayTags.ABILITY.FUNCTION.HEAL],
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
    id: 'skill-core-control-stun',
    displayName: '脑海震颤',
    displayDescription: '眩晕目标，使其无法思考',
    category: 'core',
    match: matchAll([CreationTags.MATERIAL.SEMANTIC_FREEZE, CreationTags.MATERIAL.SEMANTIC_THUNDER]),
    exclusiveGroup: 'skill-core-damage-type',
    weight: 50,
    energyCost: 12,
    minQuality: '灵品',
    applicableTo: ['skill'],
    grantedAbilityTags: [GameplayTags.ABILITY.FUNCTION.CONTROL],
    effectTemplate: {
      type: 'apply_buff',
      params: {
        buffConfig: {
          id: 'craft-stun',
          name: '眩晕',
          type: BuffType.CONTROL,
          duration: CREATION_DURATION_POLICY.control.default,
          stackRule: StackRule.IGNORE,
          tags: [GameplayTags.BUFF.TYPE.DEBUFF, GameplayTags.BUFF.TYPE.CONTROL],
          statusTags: [GameplayTags.STATUS.CATEGORY.DEBUFF, GameplayTags.STATUS.CONTROL.ROOT, GameplayTags.STATUS.CONTROL.STUNNED, GameplayTags.STATUS.CONTROL.NO_ACTION],
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
    match: matchAll([CreationTags.MATERIAL.SEMANTIC_BLADE, CreationTags.MATERIAL.TYPE_MONSTER]),
    exclusiveGroup: 'skill-core-damage-type',
    weight: 65,
    energyCost: 11,
    applicableTo: ['skill'],
    grantedAbilityTags: [
      GameplayTags.ABILITY.FUNCTION.DAMAGE,
      GameplayTags.ABILITY.CHANNEL.MAGIC,
    ],
    effectTemplate: {
      type: 'damage',
      params: {
        value: {
          base: { base: 88, scale: 'quality', coefficient: 14 },
          attribute: AttributeType.MAGIC_ATK,
          coefficient: 0.9,
        },
      },
    },
  },
  {
    id: 'skill-core-cull-of-weak',
    displayName: '断岳裁锋',
    displayDescription: '仅在目标血线偏低时触发的斩杀打击',
    category: 'core',
    match: matchAll([
      CreationTags.MATERIAL.SEMANTIC_BLADE,
      CreationTags.MATERIAL.SEMANTIC_BURST,
    ]),
    exclusiveGroup: 'skill-core-damage-type',
    weight: 46,
    energyCost: 12,
    minQuality: '灵品',
    applicableTo: ['skill'],
    grantedAbilityTags: [
      GameplayTags.ABILITY.FUNCTION.DAMAGE,
      GameplayTags.ABILITY.CHANNEL.MAGIC,
      GameplayTags.TRAIT.EXECUTE,
    ],
    effectTemplate: {
      type: 'damage',
      conditions: [{ type: 'hp_below', params: { value: 0.3 } }],
      params: {
        value: {
          base: { base: 96, scale: 'quality', coefficient: 16 },
          attribute: AttributeType.MAGIC_ATK,
          coefficient: 1.02,
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
    match: matchAll([CreationTags.MATERIAL.SEMANTIC_BLADE, CreationTags.MATERIAL.TYPE_ORE]),
    exclusiveGroup: 'skill-prefix-damage-boost-tier',
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
      eventType: GameplayTags.EVENT.DAMAGE_REQUEST,
      scope: GameplayTags.SCOPE.OWNER_AS_CASTER,
      priority: CREATION_LISTENER_PRIORITIES.damageRequest,
    },
  },
  {
    id: 'skill-prefix-magic-pen',
    displayName: '法脉破壁',
    displayDescription: '临时提升施法者法术穿透',
    category: 'prefix',
    match: matchAll([CreationTags.MATERIAL.SEMANTIC_SPIRIT, CreationTags.MATERIAL.TYPE_MONSTER]),
    weight: 80,
    energyCost: 6,
    applicableTo: ['skill'],
    effectTemplate: {
      type: 'attribute_stat_buff',
      params: {
        attrType: AttributeType.MAGIC_PENETRATION,
        modType: ModifierType.FIXED,
        value: { base: 0.06, scale: 'quality', coefficient: 0.02 },
        duration: CREATION_DURATION_POLICY.buffDebuff.short,
        stackRule: StackRule.OVERRIDE,
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
    id: 'skill-prefix-spirit-boost',
    displayName: '灵机聚集',
    displayDescription: '施放时临时提升施法者灵力',
    category: 'prefix',
    match: matchAll([CreationTags.MATERIAL.SEMANTIC_SPIRIT, CreationTags.MATERIAL.TYPE_HERB]),
    weight: 75,
    energyCost: 6,
    applicableTo: ['skill'],
    effectTemplate: {
      type: 'attribute_stat_buff',
      params: {
        attrType: AttributeType.SPIRIT,
        modType: ModifierType.FIXED,
        value: { base: 3, scale: 'quality', coefficient: 1 },
        duration: CREATION_DURATION_POLICY.buffDebuff.short,
        stackRule: StackRule.OVERRIDE,
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
    id: 'skill-prefix-cooldown-reduce',
    displayName: '回环诀',
    displayDescription: '命中后扰动目标术法节律',
    category: 'prefix',
    match: matchAll([
      CreationTags.MATERIAL.SEMANTIC_MANUAL,
      CreationTags.MATERIAL.SEMANTIC_SPIRIT,
      CreationTags.MATERIAL.TYPE_MANUAL,
    ]),
    weight: 68,
    energyCost: 7,
    applicableTo: ['skill'],
    grantedAbilityTags: [GameplayTags.TRAIT.COOLDOWN],
    effectTemplate: {
      type: 'cooldown_modify',
      params: {
        cdModifyValue: { base: 1, scale: 'quality', coefficient: 0.25 },
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
    id: 'skill-prefix-self-haste',
    displayName: '流光回息',
    displayDescription: '施放后缩短自身其他技能冷却',
    category: 'prefix',
    match: matchAll([CreationTags.MATERIAL.SEMANTIC_WIND, CreationTags.MATERIAL.SEMANTIC_SPIRIT]),
    weight: 65,
    energyCost: 7,
    applicableTo: ['skill'],
    grantedAbilityTags: [GameplayTags.TRAIT.COOLDOWN],
    effectTemplate: {
      type: 'cooldown_modify',
      params: {
        cdModifyValue: { base: -0.8, scale: 'quality', coefficient: -0.2 },
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
    id: 'skill-prefix-shield-grant',
    displayName: '防御屏障',
    displayDescription: '施放后为自身生成护盾',
    category: 'prefix',
    match: matchAll([CreationTags.MATERIAL.SEMANTIC_GUARD, CreationTags.MATERIAL.TYPE_ORE]),
    weight: 58,
    energyCost: 7,
    applicableTo: ['skill'],
    grantedAbilityTags: [GameplayTags.TRAIT.SHIELD_MASTER],
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
    id: 'skill-prefix-healing-amp',
    displayName: '治疗增幅',
    displayDescription: '临时提升施法者治疗效果',
    category: 'prefix',
    match: matchAll([CreationTags.MATERIAL.SEMANTIC_SUSTAIN, CreationTags.MATERIAL.SEMANTIC_SPIRIT]),
    weight: 50,
    energyCost: 6,
    applicableTo: ['skill'],
    effectTemplate: {
      type: 'attribute_stat_buff',
      params: {
        attrType: AttributeType.HEAL_AMPLIFY,
        modType: ModifierType.ADD,
        value: { base: 0.1, scale: 'quality', coefficient: 0.02 },
        duration: CREATION_DURATION_POLICY.buffDebuff.short,
        stackRule: StackRule.OVERRIDE,
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
    id: 'skill-prefix-evasion-boost',
    displayName: '身法轻灵',
    displayDescription: '施放后临时提升闪避率',
    category: 'prefix',
    match: matchAll([CreationTags.MATERIAL.SEMANTIC_WIND, CreationTags.MATERIAL.SEMANTIC_BLADE]),
    weight: 52,
    energyCost: 6,
    applicableTo: ['skill'],
    effectTemplate: {
      type: 'attribute_stat_buff',
      params: {
        attrType: AttributeType.EVASION_RATE,
        modType: ModifierType.FIXED,
        value: { base: 0.04, scale: 'quality', coefficient: 0.01 },
        duration: CREATION_DURATION_POLICY.buffDebuff.short,
        stackRule: StackRule.OVERRIDE,
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
    id: 'skill-prefix-crit-damage-boost',
    displayName: '暴击深化',
    displayDescription: '临时提升暴击伤害倍数',
    category: 'prefix',
    match: matchAll([CreationTags.MATERIAL.SEMANTIC_BURST, CreationTags.MATERIAL.TYPE_ORE]),
    weight: 48,
    energyCost: 7,
    applicableTo: ['skill'],
    effectTemplate: {
      type: 'attribute_stat_buff',
      params: {
        attrType: AttributeType.CRIT_DAMAGE_MULT,
        modType: ModifierType.ADD,
        value: { base: 0.15, scale: 'quality', coefficient: 0.03 },
        duration: CREATION_DURATION_POLICY.buffDebuff.short,
        stackRule: StackRule.OVERRIDE,
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
    id: 'skill-prefix-execute-power',
    displayName: '制裁诀',
    displayDescription: '对低血量目标造成额外伤害',
    category: 'prefix',
    match: matchAll([CreationTags.MATERIAL.SEMANTIC_BURST, CreationTags.MATERIAL.SEMANTIC_BLADE]),
    weight: 44,
    energyCost: 8,
    applicableTo: ['skill'],
    grantedAbilityTags: [GameplayTags.TRAIT.EXECUTE],
    effectTemplate: {
      type: 'percent_damage_modifier',
      conditions: [{ type: 'hp_below', params: { value: 0.35 } }],
      params: {
        mode: 'increase',
        value: { base: 0.15, scale: 'quality', coefficient: 0.03 },
        cap: 0.8,
      },
    },
    listenerSpec: {
      eventType: GameplayTags.EVENT.DAMAGE_REQUEST,
      scope: GameplayTags.SCOPE.OWNER_AS_CASTER,
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
    match: matchAll([
      CreationTags.MATERIAL.SEMANTIC_THUNDER,
      CreationTags.MATERIAL.SEMANTIC_SPIRIT,
    ]),
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
      eventType: GameplayTags.EVENT.DAMAGE_REQUEST,
      scope: GameplayTags.SCOPE.OWNER_AS_CASTER,
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
    match: matchAll([CreationTags.MATERIAL.SEMANTIC_FLAME, ELEMENT_TO_MATERIAL_TAG['火']]),
    exclusiveGroup: 'skill-suffix-burn-tier',
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
          duration: CREATION_DURATION_POLICY.buffDebuff.short,
          stackRule: StackRule.REFRESH_DURATION,
          tags: [GameplayTags.BUFF.TYPE.DEBUFF, GameplayTags.BUFF.DOT.ROOT, GameplayTags.BUFF.DOT.BURN],
          statusTags: [GameplayTags.STATUS.CATEGORY.DEBUFF, GameplayTags.STATUS.STATE.BURNED, GameplayTags.STATUS.CATEGORY.DOT],
          listeners: [
            {
              eventType: GameplayTags.EVENT.ROUND_PRE,
              scope: GameplayTags.SCOPE.OWNER_AS_TARGET,
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
    match: matchAll([CreationTags.MATERIAL.SEMANTIC_FREEZE, ELEMENT_TO_MATERIAL_TAG['冰']]),
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
          duration: CREATION_DURATION_POLICY.buffDebuff.short,
          stackRule: StackRule.REFRESH_DURATION,
          tags: [GameplayTags.BUFF.TYPE.DEBUFF],
          statusTags: [GameplayTags.STATUS.CATEGORY.DEBUFF, GameplayTags.STATUS.STATE.CHILLED],
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
    match: matchAll([CreationTags.MATERIAL.SEMANTIC_SPIRIT, CreationTags.MATERIAL.SEMANTIC_MANUAL]),
    weight: 60,
    energyCost: 6,
    applicableTo: ['skill'],
    effectTemplate: {
      type: 'dispel',
      params: {
        targetTag: GameplayTags.BUFF.TYPE.BUFF,
        maxCount: 1,
      },
    },
  },
  {
    id: 'skill-suffix-life-siphon',
    displayName: '噬元归生',
    displayDescription: '造成伤害时回复部分气血',
    category: 'suffix',
    match: matchAll([CreationTags.MATERIAL.SEMANTIC_BURST, CreationTags.MATERIAL.SEMANTIC_SUSTAIN]),
    exclusiveGroup: 'skill-suffix-lifesteal-tier',
    weight: 72,
    energyCost: 9,
    applicableTo: ['skill'],
    grantedAbilityTags: [GameplayTags.TRAIT.LIFESTEAL],
    effectTemplate: {
      type: 'resource_drain',
      params: {
        sourceType: 'hp',
        targetType: 'hp',
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
    id: 'skill-suffix-mana-siphon',
    displayName: '灵力夺取',
    displayDescription: '造成伤害后恢复灵力',
    category: 'suffix',
    match: matchAll([CreationTags.MATERIAL.SEMANTIC_SPIRIT, CreationTags.MATERIAL.SEMANTIC_BURST]),
    weight: 65,
    energyCost: 8,
    applicableTo: ['skill'],
    grantedAbilityTags: [GameplayTags.TRAIT.MANA_THIEF],
    effectTemplate: {
      type: 'resource_drain',
      params: {
        sourceType: 'hp',
        targetType: 'mp',
        ratio: { base: 0.1, scale: 'quality', coefficient: 0.025 },
      },
    },
    listenerSpec: {
      eventType: GameplayTags.EVENT.DAMAGE_TAKEN,
      scope: GameplayTags.SCOPE.OWNER_AS_CASTER,
      priority: CREATION_LISTENER_PRIORITIES.damageTaken,
    },
  },
  {
    id: 'skill-suffix-burn-trigger',
    displayName: '焰痕引爆',
    displayDescription: '若目标带有灼烧，触发额外爆裂伤害',
    category: 'suffix',
    match: matchAll([CreationTags.MATERIAL.SEMANTIC_FLAME, CreationTags.MATERIAL.SEMANTIC_BURST]),
    weight: 58,
    energyCost: 9,
    applicableTo: ['skill'],
    effectTemplate: {
      type: 'tag_trigger',
      params: {
        triggerTag: GameplayTags.STATUS.STATE.BURNED,
        damageRatio: { base: 1.2, scale: 'quality', coefficient: 0.2 },
        removeOnTrigger: false,
      },
    },
    listenerSpec: {
      eventType: GameplayTags.EVENT.SKILL_CAST,
      scope: GameplayTags.SCOPE.OWNER_AS_CASTER,
      priority: CREATION_LISTENER_PRIORITIES.skillCast,
    },
  },
  {
    id: 'skill-suffix-freeze-trigger',
    displayName: '冰封触发',
    displayDescription: '若目标被冰缓，释放冰锥追加伤害',
    category: 'suffix',
    match: matchAll([CreationTags.MATERIAL.SEMANTIC_FREEZE, CreationTags.MATERIAL.SEMANTIC_BURST]),
    weight: 56,
    energyCost: 9,
    applicableTo: ['skill'],
    effectTemplate: {
      type: 'tag_trigger',
      params: {
        triggerTag: GameplayTags.STATUS.STATE.CHILLED,
        damageRatio: { base: 0.8, scale: 'quality', coefficient: 0.15 },
        removeOnTrigger: false,
      },
    },
    listenerSpec: {
      eventType: GameplayTags.EVENT.SKILL_CAST,
      scope: GameplayTags.SCOPE.OWNER_AS_CASTER,
      priority: CREATION_LISTENER_PRIORITIES.skillCast,
    },
  },
  {
    id: 'skill-suffix-shield-on-cast',
    displayName: '护盾激发',
    displayDescription: '施放时为目标生成护盾',
    category: 'suffix',
    match: matchAll([CreationTags.MATERIAL.SEMANTIC_GUARD, CreationTags.MATERIAL.TYPE_ORE]),
    weight: 55,
    energyCost: 8,
    applicableTo: ['skill'],
    grantedAbilityTags: [GameplayTags.TRAIT.SHIELD_MASTER],
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
    id: 'skill-suffix-empower-buff',
    displayName: '强化符记',
    displayDescription: '为目标增加攻击力buff',
    category: 'suffix',
    match: matchAll([CreationTags.MATERIAL.SEMANTIC_BURST, CreationTags.MATERIAL.TYPE_MONSTER]),
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
          duration: CREATION_DURATION_POLICY.buffDebuff.short,
          stackRule: StackRule.REFRESH_DURATION,
          tags: [GameplayTags.BUFF.TYPE.BUFF],
          statusTags: [GameplayTags.STATUS.CATEGORY.BUFF],
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
    match: matchAll([CreationTags.MATERIAL.SEMANTIC_BLADE, CreationTags.MATERIAL.SEMANTIC_BURST]),
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
          duration: CREATION_DURATION_POLICY.buffDebuff.short,
          stackRule: StackRule.REFRESH_DURATION,
          tags: [GameplayTags.BUFF.TYPE.DEBUFF],
          statusTags: [GameplayTags.STATUS.CATEGORY.DEBUFF, GameplayTags.STATUS.CATEGORY.DEF_DEBUFF],
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
    displayDescription: '命中后短时间内增加暴击率',
    category: 'suffix',
    match: matchAll([CreationTags.MATERIAL.SEMANTIC_BLADE, CreationTags.MATERIAL.TYPE_MONSTER]),
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
          duration: CREATION_DURATION_POLICY.buffDebuff.short,
          stackRule: StackRule.STACK_LAYER,
          tags: [GameplayTags.BUFF.TYPE.BUFF],
          statusTags: [GameplayTags.STATUS.CATEGORY.BUFF],
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
    match: matchAll([CreationTags.MATERIAL.SEMANTIC_BURST]),
    weight: 45,
    energyCost: 9,
    applicableTo: ['skill'],
    grantedAbilityTags: [GameplayTags.TRAIT.EXECUTE],
    effectTemplate: {
      type: 'percent_damage_modifier',
      conditions: [{ type: 'hp_below', params: { value: 0.35 } }],
      params: {
        mode: 'increase',
        value: { base: 0.18, scale: 'quality', coefficient: 0.04 },
        cap: 0.9,
      },
    },
    listenerSpec: {
      eventType: GameplayTags.EVENT.DAMAGE_REQUEST,
      scope: GameplayTags.SCOPE.OWNER_AS_CASTER,
      priority: CREATION_LISTENER_PRIORITIES.damageRequest,
    },
  },
  {
    id: 'skill-suffix-burning-finish',
    displayName: '焚脉终式',
    displayDescription: '仅对带灼烧目标触发的终结增伤',
    category: 'suffix',
    match: matchAll([
      CreationTags.MATERIAL.SEMANTIC_FLAME,
      CreationTags.MATERIAL.SEMANTIC_BURST,
    ]),
    weight: 34,
    energyCost: 9,
    applicableTo: ['skill'],
    effectTemplate: {
      type: 'percent_damage_modifier',
      conditions: [
        { type: 'has_tag', params: { tag: GameplayTags.STATUS.STATE.BURNED } },
      ],
      params: {
        mode: 'increase',
        value: { base: 0.16, scale: 'quality', coefficient: 0.03 },
        cap: 0.85,
      },
    },
    listenerSpec: {
      eventType: GameplayTags.EVENT.DAMAGE_REQUEST,
      scope: GameplayTags.SCOPE.OWNER_AS_CASTER,
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
    match: matchAll([
      CreationTags.MATERIAL.SEMANTIC_FLAME,
      CreationTags.MATERIAL.SEMANTIC_FREEZE,
      CreationTags.MATERIAL.SEMANTIC_THUNDER,
    ]),
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
    listenerSpec: {
      eventType: GameplayTags.EVENT.DAMAGE_REQUEST,
      scope: GameplayTags.SCOPE.OWNER_AS_CASTER,
      priority: CREATION_LISTENER_PRIORITIES.damageRequest,
    },
  },
  {
    id: 'skill-resonance-combo-power',
    displayName: '连招共鸣',
    displayDescription: '连续施放提升伤害',
    category: 'resonance',
    match: matchAll([CreationTags.MATERIAL.SEMANTIC_BLADE, CreationTags.MATERIAL.SEMANTIC_BURST]),
    weight: 55,
    energyCost: 11,
    applicableTo: ['skill'],
    grantedAbilityTags: [GameplayTags.ABILITY.FUNCTION.HEAL],
    effectTemplate: {
      type: 'apply_buff',
      params: {
        buffConfig: {
          id: 'craft-combo-stack',
          name: '连击层数',
          type: BuffType.BUFF,
          duration: CREATION_DURATION_POLICY.buffDebuff.standard,
          stackRule: StackRule.STACK_LAYER,
          tags: [GameplayTags.BUFF.TYPE.BUFF],
          statusTags: [GameplayTags.STATUS.CATEGORY.COMBO],
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
    match: matchAll([CreationTags.MATERIAL.SEMANTIC_SPIRIT, CreationTags.MATERIAL.TYPE_HERB]),
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
          duration: CREATION_DURATION_POLICY.buffDebuff.standard,
          stackRule: StackRule.REFRESH_DURATION,
          tags: [GameplayTags.BUFF.TYPE.BUFF],
          statusTags: [GameplayTags.STATUS.CATEGORY.MANA_EFF],
          listeners: [
            {
              eventType: GameplayTags.EVENT.SKILL_CAST,
              scope: GameplayTags.SCOPE.OWNER_AS_CASTER,
              priority: CREATION_LISTENER_PRIORITIES.skillCast,
              mapping: {
                caster: 'owner',
                target: 'owner',
              },
              effects: [
                {
                  type: 'heal',
                  conditions: [
                    {
                      type: 'ability_has_tag',
                      params: {
                        tag: GameplayTags.ABILITY.CHANNEL.MAGIC,
                      },
                    },
                  ],
                  params: {
                    target: 'mp',
                    value: {
                      base: 10,
                      attribute: AttributeType.SPIRIT,
                      coefficient: 0.06,
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
    id: 'skill-resonance-sustain-flow',
    displayName: '生命流转',
    displayDescription: '治疗技能增幅自身防御',
    category: 'resonance',
    match: matchAll([CreationTags.MATERIAL.SEMANTIC_SUSTAIN, CreationTags.MATERIAL.SEMANTIC_GUARD]),
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
          duration: CREATION_DURATION_POLICY.buffDebuff.standard,
          stackRule: StackRule.OVERRIDE,
          tags: [GameplayTags.BUFF.TYPE.BUFF],
          statusTags: [GameplayTags.STATUS.CATEGORY.BUFF],
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
    match: matchAll([
      CreationTags.MATERIAL.SEMANTIC_FREEZE,
      CreationTags.MATERIAL.SEMANTIC_THUNDER,
    ]),
    weight: 44,
    energyCost: 10,
    applicableTo: ['skill'],
    effectTemplate: {
      type: 'apply_buff',
      conditions: [
        {
          type: 'ability_has_tag',
          params: { tag: GameplayTags.ABILITY.FUNCTION.CONTROL },
        },
      ],
      params: {
        buffConfig: {
          id: 'craft-control-precision',
          name: '控制精准',
          type: BuffType.BUFF,
          duration: CREATION_DURATION_POLICY.buffDebuff.standard,
          stackRule: StackRule.OVERRIDE,
          tags: [GameplayTags.BUFF.TYPE.BUFF],
          statusTags: [GameplayTags.STATUS.CATEGORY.BUFF],
          modifiers: [
            {
              attrType: AttributeType.CONTROL_HIT,
              type: ModifierType.FIXED,
              value: 0.08,
            },
          ],
        },
        chance: 1,
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
    id: 'skill-resonance-calm-compression',
    displayName: '静域凝锋',
    displayDescription: '仅在目标高血时触发开局压制增伤',
    category: 'resonance',
    match: matchAll([
      CreationTags.MATERIAL.SEMANTIC_BURST,
      CreationTags.MATERIAL.SEMANTIC_MANUAL,
    ]),
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
    listenerSpec: {
      eventType: GameplayTags.EVENT.DAMAGE_REQUEST,
      scope: GameplayTags.SCOPE.OWNER_AS_CASTER,
      priority: CREATION_LISTENER_PRIORITIES.damageRequest,
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
    match: matchAll([CreationTags.MATERIAL.SEMANTIC_BURST, CreationTags.MATERIAL.SEMANTIC_SUSTAIN]),
    weight: 50,
    energyCost: 11,
    applicableTo: ['skill'],
    grantedAbilityTags: [GameplayTags.ABILITY.FUNCTION.HEAL],
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
    id: 'skill-synergy-control-damage',
    displayName: '制局强杀',
    displayDescription: '控制受效目标时造成额外伤害',
    category: 'synergy',
    match: matchAll([
      CreationTags.MATERIAL.SEMANTIC_FREEZE,
      CreationTags.MATERIAL.SEMANTIC_BURST,
    ]),
    weight: 46,
    energyCost: 12,
    applicableTo: ['skill'],
    effectTemplate: {
      type: 'percent_damage_modifier',
      conditions: [
        {
          type: 'ability_has_tag',
          params: { tag: GameplayTags.ABILITY.FUNCTION.CONTROL },
        },
        {
          type: 'has_tag',
          params: { tag: GameplayTags.STATUS.CONTROL.ROOT },
        },
      ],
      params: {
        mode: 'increase',
        value: { base: 0.25, scale: 'quality', coefficient: 0.05 },
        cap: 1.2,
      },
    },
    listenerSpec: {
      eventType: GameplayTags.EVENT.DAMAGE_REQUEST,
      scope: GameplayTags.SCOPE.OWNER_AS_CASTER,
      priority: CREATION_LISTENER_PRIORITIES.damageRequest,
    },
  },
  {
    id: 'skill-synergy-shield-damage',
    displayName: '盾杀合一',
    displayDescription: '护盾吸收伤害时释放反击',
    category: 'synergy',
    match: matchAll([CreationTags.MATERIAL.SEMANTIC_GUARD, CreationTags.MATERIAL.SEMANTIC_BURST]),
    weight: 44,
    energyCost: 12,
    applicableTo: ['skill'],
    effectTemplate: {
      type: 'apply_buff',
      params: {
        buffConfig: {
          id: 'craft-shield-retaliation',
          name: '护盾反震',
          type: BuffType.BUFF,
          duration: CREATION_DURATION_POLICY.buffDebuff.short,
          stackRule: StackRule.OVERRIDE,
          tags: [GameplayTags.BUFF.TYPE.BUFF],
          statusTags: [GameplayTags.STATUS.CATEGORY.BUFF],
          listeners: [
            {
              eventType: GameplayTags.EVENT.DAMAGE_TAKEN,
              scope: GameplayTags.SCOPE.OWNER_AS_TARGET,
              priority: CREATION_LISTENER_PRIORITIES.damageTaken,
              guard: {
                skipReflectSource: true,
              },
              effects: [
                {
                  type: 'reflect',
                  conditions: [
                    {
                      type: 'shield_absorbed_at_least',
                      params: { value: 1 },
                    },
                  ],
                  params: {
                    ratio: 0.18,
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
    id: 'skill-synergy-debuff-stack',
    displayName: '叠层诅咒',
    displayDescription: '多个debuff相互增幅效果',
    category: 'synergy',
    match: matchAll([
      CreationTags.MATERIAL.SEMANTIC_POISON,
      CreationTags.MATERIAL.SEMANTIC_THUNDER,
    ]),
    weight: 42,
    energyCost: 11,
    applicableTo: ['skill'],
    effectTemplate: {
      type: 'percent_damage_modifier',
      conditions: [
        {
          type: 'debuff_count_at_least',
          params: { value: 2 },
        },
      ],
      params: {
        mode: 'increase',
        value: { base: 0.1, scale: 'quality', coefficient: 0.025 },
        cap: 0.7,
      },
    },
    listenerSpec: {
      eventType: GameplayTags.EVENT.DAMAGE_REQUEST,
      scope: GameplayTags.SCOPE.OWNER_AS_CASTER,
      priority: CREATION_LISTENER_PRIORITIES.damageRequest,
    },
  },
  {
    id: 'skill-synergy-recovery-vortex',
    displayName: '恢复漩涡',
    displayDescription: '治疗和吸取能相互强化',
    category: 'synergy',
    match: matchAll([CreationTags.MATERIAL.SEMANTIC_SUSTAIN, CreationTags.MATERIAL.SEMANTIC_SPIRIT]),
    weight: 40,
    energyCost: 12,
    applicableTo: ['skill'],
    grantedAbilityTags: [GameplayTags.ABILITY.FUNCTION.HEAL],
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
    match: matchAll([
      CreationTags.MATERIAL.SEMANTIC_BURST,
      CreationTags.MATERIAL.SEMANTIC_BLADE,
    ]),
    weight: 38,
    energyCost: 12,
    applicableTo: ['skill'],
    grantedAbilityTags: [GameplayTags.TRAIT.EXECUTE],
    effectTemplate: {
      type: 'percent_damage_modifier',
      conditions: [{ type: 'hp_below', params: { value: 0.35 } }],
      params: {
        mode: 'increase',
        value: { base: 0.22, scale: 'quality', coefficient: 0.04 },
        cap: 1,
      },
    },
    listenerSpec: {
      eventType: GameplayTags.EVENT.DAMAGE_REQUEST,
      scope: GameplayTags.SCOPE.OWNER_AS_CASTER,
      priority: CREATION_LISTENER_PRIORITIES.damageRequest,
    },
  },
  {
    id: 'skill-synergy-empty-mana-pierce',
    displayName: '枯海破灵',
    displayDescription: '仅在目标灵力偏低时触发破灵增伤',
    category: 'synergy',
    match: matchAll([
      CreationTags.MATERIAL.SEMANTIC_THUNDER,
      CreationTags.MATERIAL.SEMANTIC_SPIRIT,
    ]),
    weight: 36,
    energyCost: 11,
    applicableTo: ['skill'],
    grantedAbilityTags: [GameplayTags.TRAIT.MANA_THIEF],
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
    match: matchAll([
      CreationTags.MATERIAL.SEMANTIC_FLAME,
      CreationTags.MATERIAL.SEMANTIC_BURST,
    ]),
    exclusiveGroup: 'skill-signature-ultimate',
    weight: 20,
    energyCost: 14,
    minQuality: '真品',
    applicableTo: ['skill'],
    grantedAbilityTags: [
      GameplayTags.ABILITY.FUNCTION.DAMAGE,
      GameplayTags.ABILITY.CHANNEL.MAGIC,
    ],
    effectTemplate: {
      type: 'damage',
      conditions: [
        { type: 'has_tag', params: { tag: GameplayTags.STATUS.STATE.BURNED } },
      ],
      params: {
        value: {
          base: { base: 110, scale: 'quality', coefficient: 22 },
          attribute: AttributeType.MAGIC_ATK,
          coefficient: 1.04,
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
    match: matchAll([
      CreationTags.MATERIAL.SEMANTIC_BURST,
      CreationTags.MATERIAL.SEMANTIC_BLADE,
      CreationTags.MATERIAL.TYPE_SPECIAL,
    ]),
    exclusiveGroup: 'skill-mythic-ultimate',
    weight: 5,
    energyCost: 16,
    minQuality: '玄品',
    applicableTo: ['skill'],
    grantedAbilityTags: [
      GameplayTags.ABILITY.FUNCTION.DAMAGE,
      GameplayTags.ABILITY.CHANNEL.MAGIC,
    ],
    effectTemplate: {
      type: 'damage',
      conditions: [
        { type: 'hp_above', params: { value: 0.7 } },
        { type: 'chance', params: { value: 0.85 } },
      ],
      params: {
        value: {
          base: { base: 128, scale: 'quality', coefficient: 24 },
          attribute: AttributeType.MAGIC_ATK,
          coefficient: 1.12,
        },
      },
    },
  },
  {
    id: 'skill-mythic-eternal-echo',
    displayName: '永恒回声',
    displayDescription: '技能产生无限回响，每次战斗增幅',
    category: 'mythic',
    match: matchAll([
      CreationTags.MATERIAL.SEMANTIC_MANUAL,
      CreationTags.MATERIAL.SEMANTIC_SPIRIT,
      CreationTags.MATERIAL.TYPE_SPECIAL,
    ]),
    exclusiveGroup: 'skill-mythic-ultimate',
    weight: 4,
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
          duration: CREATION_DURATION_POLICY.buffDebuff.persistentException,
          stackRule: StackRule.STACK_LAYER,
          tags: [GameplayTags.BUFF.TYPE.BUFF],
          statusTags: [GameplayTags.STATUS.CATEGORY.MYTHIC],
          modifiers: [
            {
              attrType: AttributeType.MAGIC_ATK,
              type: ModifierType.ADD,
              value: 0.01,
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
    match: matchAll([
      CreationTags.MATERIAL.SEMANTIC_SUSTAIN,
      CreationTags.MATERIAL.SEMANTIC_DIVINE,
      CreationTags.MATERIAL.TYPE_SPECIAL,
    ]),
    exclusiveGroup: 'skill-mythic-ultimate',
    weight: 3,
    energyCost: 14,
    minQuality: '真品',
    applicableTo: ['skill'],
    grantedAbilityTags: [GameplayTags.ABILITY.FUNCTION.HEAL],
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
  // ========================
  // ===== 强度分层扩充 T2 / T3 / T4 + 天品仙品专属
  // ========================

  // --- 核心伤害 T2（玄品+，exclusiveGroup: skill-core-damage-type）---
  {
    id: 'skill-core-damage-t2',
    displayName: '碎岳斩',
    displayDescription: '玄气凝聚重斩，伤害大幅提升',
    category: 'core',
    match: matchAll([CreationTags.MATERIAL.SEMANTIC_BLADE, CreationTags.MATERIAL.SEMANTIC_BURST]),
    exclusiveGroup: 'skill-core-damage-type',
    weight: 50,
    energyCost: 10,
    minQuality: '玄品',
    applicableTo: ['skill'],
    grantedAbilityTags: [
      GameplayTags.ABILITY.FUNCTION.DAMAGE,
      GameplayTags.ABILITY.CHANNEL.MAGIC,
    ],
    effectTemplate: {
      type: 'damage',
      params: {
        value: {
          base: { base: 86, scale: 'quality', coefficient: 18 },
          attribute: AttributeType.MAGIC_ATK,
          coefficient: 1,
        },
      },
    },
  },

  // --- 核心伤害 T3（真品+，exclusiveGroup: skill-core-damage-type）---
  {
    id: 'skill-core-damage-t3',
    displayName: '诛仙斩',
    displayDescription: '破空斩击，威力撼天摇地，令鬼神胆寒',
    category: 'core',
    match: matchAll([
      CreationTags.MATERIAL.SEMANTIC_BLADE,
      CreationTags.MATERIAL.SEMANTIC_BURST,
      CreationTags.MATERIAL.TYPE_SPECIAL,
    ]),
    exclusiveGroup: 'skill-core-damage-type',
    weight: 20,
    energyCost: 12,
    minQuality: '真品',
    applicableTo: ['skill'],
    grantedAbilityTags: [
      GameplayTags.ABILITY.FUNCTION.DAMAGE,
      GameplayTags.ABILITY.CHANNEL.MAGIC,
    ],
    effectTemplate: {
      type: 'damage',
      params: {
        value: {
          base: { base: 100, scale: 'quality', coefficient: 20 },
          attribute: AttributeType.MAGIC_ATK,
          coefficient: 1.02,
        },
      },
    },
  },

  // --- 核心伤害 T4（地品+，exclusiveGroup: skill-core-damage-type）---
  {
    id: 'skill-core-damage-t4',
    displayName: '万法殒灭',
    displayDescription: '道法极境之斩，此击过后万物虚无',
    category: 'core',
    match: matchAll([
      CreationTags.MATERIAL.SEMANTIC_BLADE,
      CreationTags.MATERIAL.SEMANTIC_BURST,
      CreationTags.MATERIAL.TYPE_SPECIAL,
    ]),
    exclusiveGroup: 'skill-core-damage-type',
    weight: 6,
    energyCost: 14,
    minQuality: '地品',
    applicableTo: ['skill'],
    grantedAbilityTags: [
      GameplayTags.ABILITY.FUNCTION.DAMAGE,
      GameplayTags.ABILITY.CHANNEL.MAGIC,
    ],
    effectTemplate: {
      type: 'damage',
      params: {
        value: {
          base: { base: 78, scale: 'quality', coefficient: 22 },
          attribute: AttributeType.MAGIC_ATK,
          coefficient: 1.20,
        },
      },
    },
  },

  // --- 核心治疗 T2（玄品+，exclusiveGroup: skill-core-damage-type）---
  {
    id: 'skill-core-heal-t2',
    displayName: '洗髓归元',
    displayDescription: '洗髓炼骨，深度恢复气血',
    category: 'core',
    match: matchAll([
      CreationTags.MATERIAL.SEMANTIC_SUSTAIN,
      CreationTags.MATERIAL.TYPE_HERB,
      CreationTags.MATERIAL.SEMANTIC_SPIRIT,
    ]),
    exclusiveGroup: 'skill-core-damage-type',
    weight: 42,
    energyCost: 10,
    minQuality: '玄品',
    applicableTo: ['skill'],
    grantedAbilityTags: [GameplayTags.ABILITY.FUNCTION.HEAL],
    effectTemplate: {
      type: 'heal',
      params: {
        value: {
          base: { base: 28, scale: 'quality', coefficient: 10 },
          attribute: AttributeType.MAGIC_ATK,
          coefficient: 0.55,
        },
      },
    },
  },

  // --- 核心治疗 T3（真品+，exclusiveGroup: skill-core-damage-type）---
  {
    id: 'skill-core-heal-t3',
    displayName: '起死回春',
    displayDescription: '仙草灵气令垂死者重生，气血大量恢复',
    category: 'core',
    match: matchAll([
      CreationTags.MATERIAL.SEMANTIC_SUSTAIN,
      CreationTags.MATERIAL.SEMANTIC_SPIRIT,
      CreationTags.MATERIAL.TYPE_SPECIAL,
    ]),
    exclusiveGroup: 'skill-core-damage-type',
    weight: 16,
    energyCost: 12,
    minQuality: '真品',
    applicableTo: ['skill'],
    grantedAbilityTags: [GameplayTags.ABILITY.FUNCTION.HEAL],
    effectTemplate: {
      type: 'heal',
      params: {
        value: {
          base: { base: 44, scale: 'quality', coefficient: 15 },
          attribute: AttributeType.MAGIC_ATK,
          coefficient: 0.72,
        },
      },
    },
  },

  // --- 前缀增伤 T2（玄品+，exclusiveGroup: skill-prefix-damage-boost-tier）---
  {
    id: 'skill-prefix-damage-boost-t2',
    displayName: '凌厉之威',
    displayDescription: '玄气凝聚提升技能伤害，威力大增',
    category: 'prefix',
    match: matchAll([CreationTags.MATERIAL.SEMANTIC_BLADE, CreationTags.MATERIAL.SEMANTIC_BURST]),
    exclusiveGroup: 'skill-prefix-damage-boost-tier',
    weight: 48,
    energyCost: 8,
    minQuality: '玄品',
    applicableTo: ['skill'],
    effectTemplate: {
      type: 'percent_damage_modifier',
      params: {
        mode: 'increase',
        value: { base: 0.22, scale: 'quality', coefficient: 0.04 },
        cap: 0.75,
      },
    },
    listenerSpec: {
      eventType: GameplayTags.EVENT.DAMAGE_REQUEST,
      scope: GameplayTags.SCOPE.OWNER_AS_CASTER,
      priority: CREATION_LISTENER_PRIORITIES.damageRequest,
    },
  },

  // --- 前缀增伤 T3（真品+，exclusiveGroup: skill-prefix-damage-boost-tier）---
  {
    id: 'skill-prefix-damage-boost-t3',
    displayName: '破苍穹势',
    displayDescription: '真灵之力绽放，技能伤害突破一切极限',
    category: 'prefix',
    match: matchAll([
      CreationTags.MATERIAL.SEMANTIC_BLADE,
      CreationTags.MATERIAL.SEMANTIC_BURST,
      CreationTags.MATERIAL.TYPE_SPECIAL,
    ]),
    exclusiveGroup: 'skill-prefix-damage-boost-tier',
    weight: 18,
    energyCost: 10,
    minQuality: '真品',
    applicableTo: ['skill'],
    effectTemplate: {
      type: 'percent_damage_modifier',
      params: {
        mode: 'increase',
        value: { base: 0.36, scale: 'quality', coefficient: 0.05 },
        cap: 0.95,
      },
    },
    listenerSpec: {
      eventType: GameplayTags.EVENT.DAMAGE_REQUEST,
      scope: GameplayTags.SCOPE.OWNER_AS_CASTER,
      priority: CREATION_LISTENER_PRIORITIES.damageRequest,
    },
  },

  // --- 前缀增伤 T4（地品+，exclusiveGroup: skill-prefix-damage-boost-tier）---
  {
    id: 'skill-prefix-damage-boost-t4',
    displayName: '万界破灭印',
    displayDescription: '地阶神印，每击皆如天道降临，杀意无穷',
    category: 'prefix',
    match: matchAll([
      CreationTags.MATERIAL.SEMANTIC_BLADE,
      CreationTags.MATERIAL.SEMANTIC_BURST,
      CreationTags.MATERIAL.TYPE_SPECIAL,
    ]),
    exclusiveGroup: 'skill-prefix-damage-boost-tier',
    weight: 5,
    energyCost: 12,
    minQuality: '地品',
    applicableTo: ['skill'],
    effectTemplate: {
      type: 'percent_damage_modifier',
      params: {
        mode: 'increase',
        value: { base: 0.56, scale: 'quality', coefficient: 0.07 },
        cap: 1.30,
      },
    },
    listenerSpec: {
      eventType: GameplayTags.EVENT.DAMAGE_REQUEST,
      scope: GameplayTags.SCOPE.OWNER_AS_CASTER,
      priority: CREATION_LISTENER_PRIORITIES.damageRequest,
    },
  },

  // --- 后缀灼烧 DOT T2（玄品+，exclusiveGroup: skill-suffix-burn-tier）---
  {
    id: 'skill-suffix-burn-dot-t2',
    displayName: '炽炎魂焚',
    displayDescription: '玄火炼魂，灼烧更深更久，每回合伤害倍增',
    category: 'suffix',
    match: matchAll([
      CreationTags.MATERIAL.SEMANTIC_FLAME,
      ELEMENT_TO_MATERIAL_TAG['火'],
      CreationTags.MATERIAL.SEMANTIC_BURST,
    ]),
    exclusiveGroup: 'skill-suffix-burn-tier',
    weight: 45,
    energyCost: 10,
    minQuality: '玄品',
    applicableTo: ['skill'],
    effectTemplate: {
      type: 'apply_buff',
      params: {
        buffConfig: {
          id: 'craft-burn-t2',
          name: '玄焰灼魂',
          type: BuffType.DEBUFF,
          duration: CREATION_DURATION_POLICY.buffDebuff.standard,
          stackRule: StackRule.REFRESH_DURATION,
          tags: [GameplayTags.BUFF.TYPE.DEBUFF, GameplayTags.BUFF.DOT.ROOT, GameplayTags.BUFF.DOT.BURN],
          statusTags: [GameplayTags.STATUS.CATEGORY.DEBUFF, GameplayTags.STATUS.STATE.BURNED, GameplayTags.STATUS.CATEGORY.DOT],
          listeners: [
            {
              eventType: GameplayTags.EVENT.ROUND_PRE,
              scope: GameplayTags.SCOPE.OWNER_AS_TARGET,
              priority: 20,
              effects: [
                {
                  type: 'damage',
                  params: {
                    value: {
                      base: 16,
                      attribute: AttributeType.MAGIC_ATK,
                      coefficient: 0.28,
                    },
                  },
                },
              ],
            },
          ],
        },
        chance: { base: 0.75, scale: 'quality', coefficient: 0.04 },
      },
    },
  },

  // --- 后缀灼烧 DOT T3（真品+，exclusiveGroup: skill-suffix-burn-tier）---
  {
    id: 'skill-suffix-burn-dot-t3',
    displayName: '狱焰灼世',
    displayDescription: '真火覆地，灼烧必定触发，每回合造成重创',
    category: 'suffix',
    match: matchAll([
      CreationTags.MATERIAL.SEMANTIC_FLAME,
      ELEMENT_TO_MATERIAL_TAG['火'],
      CreationTags.MATERIAL.SEMANTIC_BURST,
      CreationTags.MATERIAL.TYPE_SPECIAL,
    ]),
    exclusiveGroup: 'skill-suffix-burn-tier',
    weight: 16,
    energyCost: 12,
    minQuality: '真品',
    applicableTo: ['skill'],
    effectTemplate: {
      type: 'apply_buff',
      params: {
        buffConfig: {
          id: 'craft-burn-t3',
          name: '狱焰灼世',
          type: BuffType.DEBUFF,
          duration: CREATION_DURATION_POLICY.buffDebuff.long,
          stackRule: StackRule.REFRESH_DURATION,
          tags: [GameplayTags.BUFF.TYPE.DEBUFF, GameplayTags.BUFF.DOT.ROOT, GameplayTags.BUFF.DOT.BURN],
          statusTags: [GameplayTags.STATUS.CATEGORY.DEBUFF, GameplayTags.STATUS.STATE.BURNED, GameplayTags.STATUS.CATEGORY.DOT],
          listeners: [
            {
              eventType: GameplayTags.EVENT.ROUND_PRE,
              scope: GameplayTags.SCOPE.OWNER_AS_TARGET,
              priority: 20,
              effects: [
                {
                  type: 'damage',
                  params: {
                    value: {
                      base: 26,
                      attribute: AttributeType.MAGIC_ATK,
                      coefficient: 0.46,
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
  },

  // --- 后缀吸血 T2（玄品+，exclusiveGroup: skill-suffix-lifesteal-tier）---
  {
    id: 'skill-suffix-lifesteal-t2',
    displayName: '魂噬吸元',
    displayDescription: '玄级生命汲取，命中后大量回复己身气血',
    category: 'suffix',
    match: matchAll([
      CreationTags.MATERIAL.SEMANTIC_BURST,
      CreationTags.MATERIAL.SEMANTIC_SUSTAIN,
      CreationTags.MATERIAL.TYPE_MONSTER,
    ]),
    exclusiveGroup: 'skill-suffix-lifesteal-tier',
    weight: 42,
    energyCost: 11,
    minQuality: '玄品',
    applicableTo: ['skill'],
    grantedAbilityTags: [GameplayTags.TRAIT.LIFESTEAL],
    effectTemplate: {
      type: 'resource_drain',
      params: {
        sourceType: 'hp',
        targetType: 'hp',
        ratio: { base: 0.22, scale: 'quality', coefficient: 0.04 },
      },
    },
    listenerSpec: {
      eventType: GameplayTags.EVENT.DAMAGE_TAKEN,
      scope: GameplayTags.SCOPE.OWNER_AS_CASTER,
      priority: CREATION_LISTENER_PRIORITIES.damageTaken,
    },
  },

  // --- 后缀吸血 T3（真品+，exclusiveGroup: skill-suffix-lifesteal-tier）---
  {
    id: 'skill-suffix-lifesteal-t3',
    displayName: '轮回汲魂',
    displayDescription: '真级逆天汲取，每次出手都能大量回复气血',
    category: 'suffix',
    match: matchAll([
      CreationTags.MATERIAL.SEMANTIC_BURST,
      CreationTags.MATERIAL.SEMANTIC_SUSTAIN,
      CreationTags.MATERIAL.TYPE_SPECIAL,
    ]),
    exclusiveGroup: 'skill-suffix-lifesteal-tier',
    weight: 16,
    energyCost: 13,
    minQuality: '真品',
    applicableTo: ['skill'],
    grantedAbilityTags: [GameplayTags.TRAIT.LIFESTEAL],
    effectTemplate: {
      type: 'resource_drain',
      params: {
        sourceType: 'hp',
        targetType: 'hp',
        ratio: { base: 0.34, scale: 'quality', coefficient: 0.05 },
      },
    },
    listenerSpec: {
      eventType: GameplayTags.EVENT.DAMAGE_TAKEN,
      scope: GameplayTags.SCOPE.OWNER_AS_CASTER,
      priority: CREATION_LISTENER_PRIORITIES.damageTaken,
    },
  },

  // --- 天品专属：绝望诅咒（天品+）---
  {
    id: 'skill-heaven-annihilation',
    displayName: '天罚湮灭',
    displayDescription: '天道降罚，伤害后概率使目标进入绝望，大幅削弱全属性',
    category: 'signature',
    match: matchAll([
      CreationTags.MATERIAL.SEMANTIC_THUNDER,
      CreationTags.MATERIAL.SEMANTIC_BURST,
      CreationTags.MATERIAL.TYPE_SPECIAL,
    ]),
    exclusiveGroup: 'skill-heaven-tier',
    weight: 3,
    energyCost: 15,
    minQuality: '天品',
    applicableTo: ['skill'],
    effectTemplate: {
      type: 'apply_buff',
      params: {
        buffConfig: {
          id: 'craft-despair',
          name: '绝望',
          type: BuffType.DEBUFF,
          duration: CREATION_DURATION_POLICY.buffDebuff.standard,
          stackRule: StackRule.IGNORE,
          tags: [GameplayTags.BUFF.TYPE.DEBUFF],
          statusTags: [GameplayTags.STATUS.CATEGORY.DEBUFF],
          modifiers: [
            { attrType: AttributeType.ATK, type: ModifierType.ADD, value: -0.30 },
            { attrType: AttributeType.MAGIC_ATK, type: ModifierType.ADD, value: -0.30 },
            { attrType: AttributeType.DEF, type: ModifierType.ADD, value: -0.25 },
          ],
        },
        chance: { base: 0.50, scale: 'quality', coefficient: 0.06 },
      },
    },
  },

  // --- 天品专属：虚空碎星（天品+）---
  {
    id: 'skill-heaven-void-shatter',
    displayName: '虚空碎星',
    displayDescription: '天品法术共鸣，造成极高伤害',
    category: 'signature',
    match: matchAll([
      CreationTags.MATERIAL.SEMANTIC_SPACE,
      CreationTags.MATERIAL.SEMANTIC_BURST,
      CreationTags.MATERIAL.TYPE_SPECIAL,
    ]),
    exclusiveGroup: 'skill-heaven-tier',
    weight: 2,
    energyCost: 16,
    minQuality: '天品',
    applicableTo: ['skill'],
    grantedAbilityTags: [
      GameplayTags.ABILITY.FUNCTION.DAMAGE,
      GameplayTags.ABILITY.CHANNEL.MAGIC,
    ],
    effectTemplate: {
      type: 'damage',
      params: {
        value: {
          base: { base: 90, scale: 'quality', coefficient: 25 },
          attribute: AttributeType.MAGIC_ATK,
          coefficient: 1.40,
        },
      },
    },
  },

  // --- 仙品专属：仙诀·涅槃（仙品+）---
  {
    id: 'skill-immortal-nirvana',
    displayName: '仙诀·涅槃',
    displayDescription: '仙道极意，技能造成伤害的同时为自身恢复等量气血',
    category: 'mythic',
    match: matchAll([
      CreationTags.MATERIAL.SEMANTIC_DIVINE,
      CreationTags.MATERIAL.SEMANTIC_BURST,
      CreationTags.MATERIAL.TYPE_SPECIAL,
    ]),
    exclusiveGroup: 'skill-immortal-tier',
    weight: 1,
    energyCost: 18,
    minQuality: '仙品',
    applicableTo: ['skill'],
    grantedAbilityTags: [GameplayTags.TRAIT.LIFESTEAL],
    effectTemplate: {
      type: 'resource_drain',
      params: {
        sourceType: 'hp',
        targetType: 'hp',
        ratio: { base: 0.80, scale: 'quality', coefficient: 0.05 },
      },
    },
    listenerSpec: {
      eventType: GameplayTags.EVENT.DAMAGE_TAKEN,
      scope: GameplayTags.SCOPE.OWNER_AS_CASTER,
      priority: CREATION_LISTENER_PRIORITIES.damageTaken,
    },
  },
  // --- 核心治疗 T4（地品+）---
  {
    id: 'skill-core-heal-t4',
    displayName: '仙泉渡厄',
    displayDescription: '地阶仙草凝聚，恢复量撼天动地，令垂死者瞬间满血',
    category: 'core',
    match: matchAll([
      CreationTags.MATERIAL.SEMANTIC_SUSTAIN,
      CreationTags.MATERIAL.SEMANTIC_SPIRIT,
      CreationTags.MATERIAL.TYPE_SPECIAL,
    ]),
    exclusiveGroup: 'skill-core-damage-type',
    weight: 5,
    energyCost: 14,
    minQuality: '地品',
    applicableTo: ['skill'],
    grantedAbilityTags: [GameplayTags.ABILITY.FUNCTION.HEAL],
    effectTemplate: {
      type: 'heal',
      params: {
        value: {
          base: { base: 65, scale: 'quality', coefficient: 20 },
          attribute: AttributeType.MAGIC_ATK,
          coefficient: 1.00,
        },
      },
    },
  },

  // --- 后缀灼烧 DOT T4（地品+）---
  {
    id: 'skill-suffix-burn-dot-t4',
    displayName: '冥火焚天',
    displayDescription: '地阶冥火，长时间灼烧并造成极高伤害',
    category: 'suffix',
    match: matchAll([
      CreationTags.MATERIAL.SEMANTIC_FLAME,
      ELEMENT_TO_MATERIAL_TAG['火'],
      CreationTags.MATERIAL.TYPE_SPECIAL,
    ]),
    exclusiveGroup: 'skill-suffix-burn-tier',
    weight: 4,
    energyCost: 14,
    minQuality: '地品',
    applicableTo: ['skill'],
    effectTemplate: {
      type: 'apply_buff',
      params: {
        buffConfig: {
          id: 'craft-burn-t4',
          name: '冥火焚天',
          type: BuffType.DEBUFF,
          duration: CREATION_DURATION_POLICY.buffDebuff.extended,
          stackRule: StackRule.IGNORE,
          tags: [GameplayTags.BUFF.TYPE.DEBUFF, GameplayTags.BUFF.DOT.ROOT, GameplayTags.BUFF.DOT.BURN],
          statusTags: [GameplayTags.STATUS.CATEGORY.DEBUFF, GameplayTags.STATUS.STATE.BURNED, GameplayTags.STATUS.CATEGORY.DOT],
          listeners: [
            {
              eventType: GameplayTags.EVENT.ROUND_PRE,
              scope: GameplayTags.SCOPE.OWNER_AS_TARGET,
              priority: 20,
              effects: [
                {
                  type: 'damage',
                  params: {
                    value: {
                      base: 38,
                      attribute: AttributeType.MAGIC_ATK,
                      coefficient: 0.65,
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
  },

  // --- 后缀吸血 T4（地品+）---
  {
    id: 'skill-suffix-lifesteal-t4',
    displayName: '乾坤汲魂',
    displayDescription: '地阶功法极意，每次出手吸收目标大量气血',
    category: 'suffix',
    match: matchAll([
      CreationTags.MATERIAL.SEMANTIC_BURST,
      CreationTags.MATERIAL.SEMANTIC_SUSTAIN,
      CreationTags.MATERIAL.TYPE_SPECIAL,
    ]),
    exclusiveGroup: 'skill-suffix-lifesteal-tier',
    weight: 4,
    energyCost: 15,
    minQuality: '地品',
    applicableTo: ['skill'],
    grantedAbilityTags: [GameplayTags.TRAIT.LIFESTEAL],
    effectTemplate: {
      type: 'resource_drain',
      params: {
        sourceType: 'hp',
        targetType: 'hp',
        ratio: { base: 0.50, scale: 'quality', coefficient: 0.06 },
      },
    },
    listenerSpec: {
      eventType: GameplayTags.EVENT.DAMAGE_TAKEN,
      scope: GameplayTags.SCOPE.OWNER_AS_CASTER,
      priority: CREATION_LISTENER_PRIORITIES.damageTaken,
    },
  },
];
