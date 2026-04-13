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
import { EXCLUSIVE_GROUP } from '../exclusiveGroups';
import { AffixDefinition, matchAll } from '../types';

export const SKILL_AFFIXES: AffixDefinition[] = [
  // ========================
  // ===== CORE 词缀 (9 种)
  // ========================
  {
    id: 'skill-core-damage',
    displayName: '基础伤害',
    displayDescription: '施放时造成一次基础伤害，通用输出核心',
    category: 'core',
    match: matchAll([
      CreationTags.MATERIAL.SEMANTIC_BLADE,
      CreationTags.MATERIAL.SEMANTIC_BURST,
      CreationTags.RECIPE.PRODUCT_BIAS_SKILL,
    ]),
    exclusiveGroup: EXCLUSIVE_GROUP.SKILL.CORE_DAMAGE_TYPE,
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
    id: 'skill-core-damage-fire',
    displayName: '火系伤害',
    displayDescription: '造成火属性伤害，适合灼烧流派',
    category: 'core',
    match: matchAll([CreationTags.MATERIAL.SEMANTIC_FLAME, ELEMENT_TO_MATERIAL_TAG['火']]),
    exclusiveGroup: EXCLUSIVE_GROUP.SKILL.CORE_DAMAGE_TYPE,
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
    displayName: '冰系伤害',
    displayDescription: '造成冰属性伤害，偏控制节奏',
    category: 'core',
    match: matchAll([CreationTags.MATERIAL.SEMANTIC_FREEZE, ELEMENT_TO_MATERIAL_TAG['冰']]),
    exclusiveGroup: EXCLUSIVE_GROUP.SKILL.CORE_DAMAGE_TYPE,
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
    displayName: '雷系伤害',
    displayDescription: '造成雷属性伤害，偏爆发压制',
    category: 'core',
    match: matchAll([
      CreationTags.MATERIAL.SEMANTIC_THUNDER,
      ELEMENT_TO_MATERIAL_TAG['雷'],
      CreationTags.MATERIAL.SEMANTIC_BURST,
    ]),
    exclusiveGroup: EXCLUSIVE_GROUP.SKILL.CORE_DAMAGE_TYPE,
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
    displayName: '风系伤害',
    displayDescription: '造成风属性伤害，偏机动与穿透',
    category: 'core',
    match: matchAll([CreationTags.MATERIAL.SEMANTIC_WIND, ELEMENT_TO_MATERIAL_TAG['风']]),
    exclusiveGroup: EXCLUSIVE_GROUP.SKILL.CORE_DAMAGE_TYPE,
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
    displayName: '基础治疗',
    displayDescription: '恢复目标大量气血',
    category: 'core',
    match: matchAll([CreationTags.MATERIAL.SEMANTIC_SUSTAIN, CreationTags.MATERIAL.TYPE_HERB]),
    exclusiveGroup: EXCLUSIVE_GROUP.SKILL.CORE_DAMAGE_TYPE,
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
    displayName: '眩晕控制',
    displayDescription: '眩晕目标，使其短时间无法行动',
    category: 'core',
    match: matchAll([CreationTags.MATERIAL.SEMANTIC_FREEZE, CreationTags.MATERIAL.SEMANTIC_THUNDER]),
    exclusiveGroup: EXCLUSIVE_GROUP.SKILL.CORE_DAMAGE_TYPE,
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
    displayName: '连击伤害',
    displayDescription: '连续斩击，每次伤害递增',
    category: 'core',
    match: matchAll([CreationTags.MATERIAL.SEMANTIC_BLADE, CreationTags.MATERIAL.TYPE_MONSTER]),
    exclusiveGroup: EXCLUSIVE_GROUP.SKILL.CORE_DAMAGE_TYPE,
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
    displayName: '低血斩杀',
    displayDescription: '仅在目标低血时触发斩杀伤害',
    category: 'core',
    match: matchAll([
      CreationTags.MATERIAL.SEMANTIC_BLADE,
      CreationTags.MATERIAL.SEMANTIC_BURST,
    ]),
    exclusiveGroup: EXCLUSIVE_GROUP.SKILL.CORE_DAMAGE_TYPE,
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
    displayName: '技能增伤',
    displayDescription: '提升本次技能伤害',
    category: 'prefix',
    match: matchAll([CreationTags.MATERIAL.SEMANTIC_BLADE, CreationTags.MATERIAL.TYPE_ORE]),
    exclusiveGroup: EXCLUSIVE_GROUP.SKILL.PREFIX_DAMAGE_BOOST,
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
    displayName: '冷却压制',
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
    displayName: '自我减冷却',
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
    displayName: '斩杀加成',
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
    displayName: '高蓝压制',
    displayDescription: '仅在目标高法力时触发额外增伤',
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
    displayName: '灼烧持续伤害',
    displayDescription: '命中时附加灼烧减益，每回合造成持续伤害',
    category: 'suffix',
    match: matchAll([CreationTags.MATERIAL.SEMANTIC_FLAME, ELEMENT_TO_MATERIAL_TAG['火']]),
    exclusiveGroup: EXCLUSIVE_GROUP.SKILL.SUFFIX_BURN,
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
    displayName: '命中驱散',
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
    displayName: '命中吸血',
    displayDescription: '造成伤害时回复部分气血',
    category: 'suffix',
    match: matchAll([CreationTags.MATERIAL.SEMANTIC_BURST, CreationTags.MATERIAL.SEMANTIC_SUSTAIN]),
    exclusiveGroup: EXCLUSIVE_GROUP.SKILL.SUFFIX_LIFESTEAL,
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
    displayName: '命中回蓝',
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
    displayName: '灼烧引爆',
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
    displayName: '低血增伤',
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
    displayName: '灼烧终结',
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
    displayName: '元素共鸣',
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
    displayName: '连招增幅',
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
    displayName: '开局压制',
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
    displayName: '伤害转治疗',
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
    displayName: '控场增伤',
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
    displayName: '减益叠层增伤',
    displayDescription: '多个减益叠层时触发额外增伤',
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
    displayName: '斩杀联动',
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
    displayName: '灼烧签名技',
    displayDescription: '仅在目标带灼烧时触发的签名终结技',
    category: 'signature',
    match: matchAll([
      CreationTags.MATERIAL.SEMANTIC_FLAME,
      CreationTags.MATERIAL.SEMANTIC_BURST,
    ]),
    exclusiveGroup: EXCLUSIVE_GROUP.SKILL.SIGNATURE_ULTIMATE,
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
    displayName: '神话爆发',
    displayDescription: '高阶爆发技能，伤害极高',
    category: 'mythic',
    match: matchAll([
      CreationTags.MATERIAL.SEMANTIC_BURST,
      CreationTags.MATERIAL.SEMANTIC_BLADE,
      CreationTags.MATERIAL.TYPE_SPECIAL,
    ]),
    exclusiveGroup: EXCLUSIVE_GROUP.SKILL.MYTHIC_ULTIMATE,
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
    displayName: '神话回响',
    displayDescription: '技能产生无限回响，每次战斗增幅',
    category: 'mythic',
    match: matchAll([
      CreationTags.MATERIAL.SEMANTIC_MANUAL,
      CreationTags.MATERIAL.SEMANTIC_SPIRIT,
      CreationTags.MATERIAL.TYPE_SPECIAL,
    ]),
    exclusiveGroup: EXCLUSIVE_GROUP.SKILL.MYTHIC_ULTIMATE,
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
    displayName: '神话治疗',
    displayDescription: '战斗中多次触发治疗和保护',
    category: 'mythic',
    match: matchAll([
      CreationTags.MATERIAL.SEMANTIC_SUSTAIN,
      CreationTags.MATERIAL.SEMANTIC_DIVINE,
      CreationTags.MATERIAL.TYPE_SPECIAL,
    ]),
    exclusiveGroup: EXCLUSIVE_GROUP.SKILL.MYTHIC_ULTIMATE,
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
];
