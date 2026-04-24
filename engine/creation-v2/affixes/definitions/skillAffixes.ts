/*
 * 灵能消耗平衡规则 (Energy Cost Balance Rule - V2):
 * 1. 核心池 (Core/Panel): 8 ~ 15 点。作为基础底盘，保证产物基本强度。
 * 2. 变体池 (Variant/School/Defense): 12 ~ 20 点。主要能量吸收点，定义流派特色。
 * 3. 稀有池 (Rare/Secret/Treasure): 35 ~ 55 点。顶级消耗项，吸收神品材料溢出能量，产出质变效果。
 * 
 * PBU 换算逻辑：PBU = (∑词缀消耗 * 类别系数 * 效率加成) * 品质乘数 + 极品奖励。
 */
import { CreationTags, GameplayTags } from '@/engine/shared/tag-domain';
import {
  CREATION_DURATION_POLICY,
  CREATION_LISTENER_PRIORITIES,
} from '../../config/CreationBalance';
import { ELEMENT_TO_MATERIAL_TAG } from '../../config/CreationMappings';
import {
  AttributeType,
  BuffType,
  ModifierType,
  StackRule,
} from '../../contracts/battle';
import { EXCLUSIVE_GROUP } from '../exclusiveGroups';
import { AffixDefinition } from '../types';

export const SKILL_AFFIXES: AffixDefinition[] = [
  // ================================================================
  // ===== SKILL_CORE 池 (14 种) — 保证技能不废，专注本次施法
  // ================================================================

  // --- 基础伤害 ---
  {
    id: 'skill-core-damage',
    displayName: '基础伤害',
    displayDescription: '施放时造成一次基础法术伤害，通用输出核心',
    category: 'skill_core',
    rarity: 'common',
    match: {
      any: [
        CreationTags.MATERIAL.SEMANTIC_BLADE,
        CreationTags.MATERIAL.SEMANTIC_BURST,
        CreationTags.MATERIAL.SEMANTIC_METAL,
      ],
    },
    exclusiveGroup: EXCLUSIVE_GROUP.SKILL.CORE_DAMAGE_TYPE,
    weight: 100,
    energyCost: 10,
    applicableTo: ['skill'],
    targetPolicyConstraint: { team: 'enemy' },
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
          coefficient: 1.0,
        },
      },
    },
  },

  // --- 8 种元素伤害 ---
  {
    id: 'skill-core-damage-fire',
    displayName: '火系伤害',
    displayDescription: '造成一次火系法术伤害，与灼烧状态联动可爆发更高输出',
    category: 'skill_core',
    rarity: 'common',
    match: {
      all: [ELEMENT_TO_MATERIAL_TAG['火']],
      any: [
        CreationTags.MATERIAL.SEMANTIC_FLAME,
        CreationTags.MATERIAL.SEMANTIC_BURST,
      ],
    },
    exclusiveGroup: EXCLUSIVE_GROUP.SKILL.CORE_DAMAGE_TYPE,
    weight: 85,
    energyCost: 15,
    applicableTo: ['skill'],
    targetPolicyConstraint: { team: 'enemy' },
    grantedAbilityTags: [
      GameplayTags.ABILITY.FUNCTION.DAMAGE,
      GameplayTags.ABILITY.CHANNEL.MAGIC,
      GameplayTags.ABILITY.ELEMENT.FIRE,
    ],
    effectTemplate: {
      type: 'damage',
      params: {
        value: {
          base: { base: 86, scale: 'quality', coefficient: 15 },
          attribute: AttributeType.MAGIC_ATK,
          coefficient: 1.1,
        },
      },
    },
  },
  {
    id: 'skill-core-damage-ice',
    displayName: '冰系伤害',
    displayDescription: '造成一次冰系法术伤害，与冰缓控制配合可限制目标行动',
    category: 'skill_core',
    rarity: 'common',
    match: {
      all: [ELEMENT_TO_MATERIAL_TAG['冰']],
      any: [
        CreationTags.MATERIAL.SEMANTIC_FREEZE,
        CreationTags.MATERIAL.SEMANTIC_BURST,
      ],
    },
    exclusiveGroup: EXCLUSIVE_GROUP.SKILL.CORE_DAMAGE_TYPE,
    weight: 80,
    energyCost: 15,
    applicableTo: ['skill'],
    targetPolicyConstraint: { team: 'enemy' },
    grantedAbilityTags: [
      GameplayTags.ABILITY.FUNCTION.DAMAGE,
      GameplayTags.ABILITY.CHANNEL.MAGIC,
      GameplayTags.ABILITY.ELEMENT.ICE,
    ],
    effectTemplate: {
      type: 'damage',
      params: {
        value: {
          base: { base: 78, scale: 'quality', coefficient: 14 },
          attribute: AttributeType.MAGIC_ATK,
          coefficient: 1.15,
        },
      },
    },
  },
  {
    id: 'skill-core-damage-thunder',
    displayName: '雷系伤害',
    displayDescription: '造成一次雷系法术伤害，单次爆发强力',
    category: 'skill_core',
    rarity: 'uncommon',
    match: {
      all: [ELEMENT_TO_MATERIAL_TAG['雷']],
      any: [
        CreationTags.MATERIAL.SEMANTIC_THUNDER,
        CreationTags.MATERIAL.SEMANTIC_BURST,
      ],
    },
    exclusiveGroup: EXCLUSIVE_GROUP.SKILL.CORE_DAMAGE_TYPE,
    weight: 75,
    energyCost: 15,
    applicableTo: ['skill'],
    targetPolicyConstraint: { team: 'enemy' },
    grantedAbilityTags: [
      GameplayTags.ABILITY.FUNCTION.DAMAGE,
      GameplayTags.ABILITY.CHANNEL.MAGIC,
      GameplayTags.ABILITY.ELEMENT.THUNDER,
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
    displayDescription: '造成一次风系物理伤害，与风系功法联动增益',
    category: 'skill_core',
    rarity: 'common',
    match: {
      all: [ELEMENT_TO_MATERIAL_TAG['风']],
      any: [
        CreationTags.MATERIAL.SEMANTIC_WIND,
        CreationTags.MATERIAL.SEMANTIC_BURST,
      ],
    },
    exclusiveGroup: EXCLUSIVE_GROUP.SKILL.CORE_DAMAGE_TYPE,
    weight: 72,
    energyCost: 15,
    applicableTo: ['skill'],
    targetPolicyConstraint: { team: 'enemy' },
    grantedAbilityTags: [
      GameplayTags.ABILITY.FUNCTION.DAMAGE,
      GameplayTags.ABILITY.CHANNEL.PHYSICAL,
      GameplayTags.ABILITY.ELEMENT.WIND,
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
    id: 'skill-core-damage-metal',
    displayName: '金系伤害',
    displayDescription: '造成一次金系物理伤害，与破防配合可穿透甲胄',
    category: 'skill_core',
    rarity: 'common',
    match: {
      all: [ELEMENT_TO_MATERIAL_TAG['金']],
      any: [
        CreationTags.MATERIAL.SEMANTIC_METAL,
        CreationTags.MATERIAL.SEMANTIC_BLADE,
      ],
    },
    exclusiveGroup: EXCLUSIVE_GROUP.SKILL.CORE_DAMAGE_TYPE,
    weight: 70,
    energyCost: 15,
    applicableTo: ['skill'],
    targetPolicyConstraint: { team: 'enemy' },
    grantedAbilityTags: [
      GameplayTags.ABILITY.FUNCTION.DAMAGE,
      GameplayTags.ABILITY.CHANNEL.PHYSICAL,
      GameplayTags.ABILITY.ELEMENT.METAL,
    ],
    effectTemplate: {
      type: 'damage',
      params: {
        value: {
          base: { base: 65, scale: 'quality', coefficient: 13 },
          attribute: AttributeType.ATK,
          coefficient: 0.78,
        },
      },
    },
  },
  {
    id: 'skill-core-damage-water',
    displayName: '水系伤害',
    displayDescription: '造成一次水系法术伤害，与燃蓝搭配可压制对手灵力',
    category: 'skill_core',
    rarity: 'common',
    match: {
      all: [ELEMENT_TO_MATERIAL_TAG['水']],
      any: [
        CreationTags.MATERIAL.SEMANTIC_WATER,
        CreationTags.MATERIAL.SEMANTIC_SPIRIT,
      ],
    },
    exclusiveGroup: EXCLUSIVE_GROUP.SKILL.CORE_DAMAGE_TYPE,
    weight: 68,
    energyCost: 15,
    applicableTo: ['skill'],
    targetPolicyConstraint: { team: 'enemy' },
    grantedAbilityTags: [
      GameplayTags.ABILITY.FUNCTION.DAMAGE,
      GameplayTags.ABILITY.CHANNEL.MAGIC,
      GameplayTags.ABILITY.ELEMENT.WATER,
    ],
    effectTemplate: {
      type: 'damage',
      params: {
        value: {
          base: { base: 74, scale: 'quality', coefficient: 13 },
          attribute: AttributeType.MAGIC_ATK,
          coefficient: 0.84,
        },
      },
    },
  },
  {
    id: 'skill-core-damage-wood',
    displayName: '木系伤害',
    displayDescription: '造成一次木系法术伤害，与毒素侵染搭配可形成持续削弱',
    category: 'skill_core',
    rarity: 'common',
    match: {
      all: [ELEMENT_TO_MATERIAL_TAG['木']],
      any: [
        CreationTags.MATERIAL.SEMANTIC_WOOD,
        CreationTags.MATERIAL.SEMANTIC_LIFE,
      ],
    },
    exclusiveGroup: EXCLUSIVE_GROUP.SKILL.CORE_DAMAGE_TYPE,
    weight: 65,
    energyCost: 15,
    applicableTo: ['skill'],
    targetPolicyConstraint: { team: 'enemy' },
    grantedAbilityTags: [
      GameplayTags.ABILITY.FUNCTION.DAMAGE,
      GameplayTags.ABILITY.CHANNEL.MAGIC,
      GameplayTags.ABILITY.ELEMENT.WOOD,
    ],
    effectTemplate: {
      type: 'damage',
      params: {
        value: {
          base: { base: 70, scale: 'quality', coefficient: 12 },
          attribute: AttributeType.MAGIC_ATK,
          coefficient: 0.8,
        },
      },
    },
  },
  {
    id: 'skill-core-damage-earth',
    displayName: '土系伤害',
    displayDescription: '造成一次土系物理伤害，与减速搭配可压制目标行动',
    category: 'skill_core',
    rarity: 'common',
    match: {
      all: [ELEMENT_TO_MATERIAL_TAG['土']],
      any: [
        CreationTags.MATERIAL.SEMANTIC_EARTH,
        CreationTags.MATERIAL.SEMANTIC_GUARD,
      ],
    },
    exclusiveGroup: EXCLUSIVE_GROUP.SKILL.CORE_DAMAGE_TYPE,
    weight: 67,
    energyCost: 15,
    applicableTo: ['skill'],
    targetPolicyConstraint: { team: 'enemy' },
    grantedAbilityTags: [
      GameplayTags.ABILITY.FUNCTION.DAMAGE,
      GameplayTags.ABILITY.CHANNEL.PHYSICAL,
      GameplayTags.ABILITY.ELEMENT.EARTH,
    ],
    effectTemplate: {
      type: 'damage',
      params: {
        value: {
          base: { base: 82, scale: 'quality', coefficient: 14 },
          attribute: AttributeType.ATK,
          coefficient: 0.88,
        },
      },
    },
  },

  // --- 治疗 ---
  {
    id: 'skill-core-heal',
    displayName: '基础治疗',
    displayDescription: '恢复目标气血',
    category: 'skill_core',
    rarity: 'common',
    match: {
      all: [CreationTags.MATERIAL.SEMANTIC_SUSTAIN],
      any: [
        CreationTags.MATERIAL.SEMANTIC_LIFE,
        CreationTags.MATERIAL.TYPE_HERB,
        CreationTags.MATERIAL.SEMANTIC_SPIRIT,
      ],
    },
    exclusiveGroup: EXCLUSIVE_GROUP.SKILL.CORE_DAMAGE_TYPE,
    weight: 75,
    energyCost: 10,
    applicableTo: ['skill'],
    targetPolicyConstraint: { team: 'self' },
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

  // --- 控制 ---
  {
    id: 'skill-core-control-stun',
    displayName: '眩晕',
    displayDescription: '眩晕目标，使其短时间无法行动',
    category: 'skill_core',
    rarity: 'uncommon',
    match: {
      any: [
        CreationTags.MATERIAL.SEMANTIC_FREEZE,
        CreationTags.MATERIAL.SEMANTIC_THUNDER,
        CreationTags.MATERIAL.SEMANTIC_ILLUSION,
      ],
    },
    exclusiveGroup: EXCLUSIVE_GROUP.SKILL.CORE_DAMAGE_TYPE,
    weight: 50,
    energyCost: 20,
    minQuality: '灵品',
    applicableTo: ['skill'],
    targetPolicyConstraint: { team: 'enemy' },
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
          statusTags: [
            GameplayTags.STATUS.CATEGORY.DEBUFF,
            GameplayTags.STATUS.CONTROL.ROOT,
            GameplayTags.STATUS.CONTROL.STUNNED,
            GameplayTags.STATUS.CONTROL.NO_ACTION,
          ],
        },
        chance: 0.8,
      },
    },
  },

  // ================================================================
  // ===== SKILL_VARIANT 池 (12 种) — 让同一技能长出不同战术身份
  // ================================================================

  // --- 灼烧 DOT ---
  {
    id: 'skill-variant-burn-dot',
    displayName: '焚身',
    displayDescription: '命中时附加灼烧，使目标持续受到烈焰吞噬',
    category: 'skill_variant',
    rarity: 'common',
    match: { all: [CreationTags.MATERIAL.SEMANTIC_FLAME] },
    exclusiveGroup: EXCLUSIVE_GROUP.SKILL.VARIANT_BURN,
    weight: 80,
    energyCost: 12,
    applicableTo: ['skill'],
    targetPolicyConstraint: { team: 'enemy' },
    effectTemplate: {
      type: 'apply_buff',
      params: {
        buffConfig: {
          id: 'craft-burn',
          name: '灼烧',
          type: BuffType.DEBUFF,
          duration: CREATION_DURATION_POLICY.buffDebuff.short,
          stackRule: StackRule.REFRESH_DURATION,
          tags: [
            GameplayTags.BUFF.TYPE.DEBUFF,
            GameplayTags.BUFF.DOT.ROOT,
            GameplayTags.BUFF.DOT.BURN,
          ],
          statusTags: [
            GameplayTags.STATUS.CATEGORY.DEBUFF,
            GameplayTags.STATUS.STATE.BURNED,
            GameplayTags.STATUS.CATEGORY.DOT,
          ],
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

  // --- 冰缓减速 ---
  {
    id: 'skill-variant-freeze-slow',
    displayName: '寒霜',
    displayDescription: '携彻骨奇寒，命中后使目标身法运行滞涩',
    category: 'skill_variant',
    rarity: 'common',
    match: { all: [CreationTags.MATERIAL.SEMANTIC_FREEZE] },
    weight: 78,
    energyCost: 12,
    applicableTo: ['skill'],
    targetPolicyConstraint: { team: 'enemy' },
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
          statusTags: [
            GameplayTags.STATUS.CATEGORY.DEBUFF,
            GameplayTags.STATUS.STATE.CHILLED,
          ],
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

  // --- 中毒 DOT ---
  {
    id: 'skill-variant-poison-dot',
    displayName: '蚀骨',
    displayDescription: '携剧毒入体，每次呼吸都会遭到毒液反噬',
    category: 'skill_variant',
    rarity: 'common',
    match: { all: [CreationTags.MATERIAL.SEMANTIC_POISON] },
    weight: 68,
    energyCost: 12,
    applicableTo: ['skill'],
    targetPolicyConstraint: { team: 'enemy' },
    effectTemplate: {
      type: 'apply_buff',
      params: {
        buffConfig: {
          id: 'craft-poison',
          name: '中毒',
          type: BuffType.DEBUFF,
          duration: CREATION_DURATION_POLICY.buffDebuff.standard,
          stackRule: StackRule.STACK_LAYER,
          tags: [GameplayTags.BUFF.TYPE.DEBUFF, GameplayTags.BUFF.DOT.ROOT],
          statusTags: [
            GameplayTags.STATUS.CATEGORY.DEBUFF,
            GameplayTags.STATUS.STATE.POISONED,
            GameplayTags.STATUS.CATEGORY.DOT,
          ],
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
                      base: 5,
                      attribute: AttributeType.MAGIC_ATK,
                      coefficient: 0.08,
                    },
                  },
                },
              ],
            },
          ],
        },
        chance: { base: 0.65, scale: 'quality', coefficient: 0.04 },
      },
    },
  },

  // --- 破防标记 ---
  {
    id: 'skill-variant-def-break',
    displayName: '碎甲',
    displayDescription: '罡劲透体而出，令目标护具瓦解，防御下降',
    category: 'skill_variant',
    rarity: 'common',
    match: {
      all: [CreationTags.MATERIAL.SEMANTIC_BLADE],
      any: [
        CreationTags.MATERIAL.SEMANTIC_BONE,
        CreationTags.MATERIAL.SEMANTIC_METAL,
      ],
    },
    weight: 55,
    energyCost: 12,
    applicableTo: ['skill'],
    targetPolicyConstraint: { team: 'enemy' },
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
          statusTags: [
            GameplayTags.STATUS.CATEGORY.DEBUFF,
            GameplayTags.STATUS.CATEGORY.DEF_DEBUFF,
          ],
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

  // --- 驱散 ---
  {
    id: 'skill-variant-dispel',
    displayName: '破法',
    displayDescription: '术含神威，命中时强行化去敌方身上的增益状态',
    category: 'skill_variant',
    rarity: 'common',
    match: {
      all: [CreationTags.MATERIAL.SEMANTIC_SPIRIT],
      any: [
        CreationTags.MATERIAL.SEMANTIC_DIVINE,
        CreationTags.MATERIAL.SEMANTIC_WATER,
        CreationTags.MATERIAL.SEMANTIC_MANUAL,
      ],
    },
    weight: 60,
    energyCost: 12,
    applicableTo: ['skill'],
    targetPolicyConstraint: { team: 'enemy' },
    effectTemplate: {
      type: 'dispel',
      params: {
        targetTag: GameplayTags.BUFF.TYPE.BUFF,
        maxCount: 1,
      },
    },
  },

  // --- 治疗附带净化 ---
  {
    id: 'skill-variant-heal-cleanse',
    displayName: '清心',
    displayDescription: '灵力运转之间，驱散受术者体内郁结的负面状态',
    category: 'skill_variant',
    rarity: 'uncommon',
    match: {
      all: [CreationTags.MATERIAL.SEMANTIC_SUSTAIN],
      any: [
        CreationTags.MATERIAL.SEMANTIC_SPIRIT,
        CreationTags.MATERIAL.SEMANTIC_DIVINE,
        CreationTags.MATERIAL.SEMANTIC_WATER,
      ],
    },
    weight: 45,
    energyCost: 12,
    applicableTo: ['skill'],
    targetPolicyConstraint: { team: 'self' },
    effectTemplate: {
      type: 'dispel',
      params: {
        targetTag: GameplayTags.BUFF.TYPE.DEBUFF,
        maxCount: 1,
      },
    },
  },

  // --- 命中吸血 ---
  {
    id: 'skill-variant-heal-on-cast',
    displayName: '噬血',
    displayDescription: '妖异奇诡之法，施展时能自虚空中汲气血以反哺己身',
    category: 'skill_variant',
    rarity: 'common',
    match: {
      all: [CreationTags.MATERIAL.SEMANTIC_BLOOD],
      any: [
        CreationTags.MATERIAL.SEMANTIC_BEAST,
        CreationTags.MATERIAL.SEMANTIC_BLADE,
        CreationTags.MATERIAL.SEMANTIC_SUSTAIN,
      ],
    },
    exclusiveGroup: EXCLUSIVE_GROUP.SKILL.VARIANT_LIFESTEAL,
    weight: 72,
    energyCost: 12,
    applicableTo: ['skill'],
    targetPolicyConstraint: { team: 'enemy' },
    grantedAbilityTags: [GameplayTags.TRAIT.LIFESTEAL],
    effectTemplate: {
      type: 'resource_drain',
      params: {
        sourceType: 'hp',
        targetType: 'hp',
        ratio: { base: 0.03, scale: 'quality', coefficient: 0.01 },
      },
    },
    listenerSpec: {
      eventType: GameplayTags.EVENT.DAMAGE_TAKEN,
      scope: GameplayTags.SCOPE.OWNER_AS_CASTER,
      priority: CREATION_LISTENER_PRIORITIES.skillCast,
      guard: {
        skipReflectSource: true,
      }
    },
  },

  // --- 回蓝 ---
  {
    id: 'skill-variant-mp-on-cast',
    displayName: '聚灵',
    displayDescription: '暗合天道，施法之时可引周遭天地灵气入体',
    category: 'skill_variant',
    rarity: 'common',
    match: {
      all: [CreationTags.MATERIAL.SEMANTIC_SPIRIT],
      any: [
        CreationTags.MATERIAL.SEMANTIC_QI,
        CreationTags.MATERIAL.TYPE_HERB,
        CreationTags.MATERIAL.SEMANTIC_WATER,
      ],
    },
    weight: 75,
    energyCost: 12,
    applicableTo: ['skill'],
    targetPolicyConstraint: { team: 'self' },
    effectTemplate: {
      type: 'heal',
      params: {
        target: 'mp',
        value: {
          base: { base: 14, scale: 'quality', coefficient: 5 },
          attribute: AttributeType.SPIRIT,
          coefficient: 0.1,
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

  // --- 施法护盾 ---
  {
    id: 'skill-variant-shield-on-cast',
    displayName: '罡气',
    displayDescription: '术法激发之时，周身凝结出一层真元壁障',
    category: 'skill_variant',
    rarity: 'common',
    match: {
      all: [CreationTags.MATERIAL.SEMANTIC_GUARD],
      any: [
        CreationTags.MATERIAL.SEMANTIC_EARTH,
        CreationTags.MATERIAL.SEMANTIC_METAL,
        CreationTags.MATERIAL.TYPE_ORE,
      ],
    },
    weight: 58,
    energyCost: 12,
    applicableTo: ['skill'],
    targetPolicyConstraint: { team: 'self' },
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

  // --- 技能增伤 ---
  {
    id: 'skill-variant-damage-boost',
    displayName: '聚力',
    displayDescription: '术引灵压共乱，在此击中将天地元气尽数挤压爆出',
    category: 'skill_variant',
    rarity: 'uncommon',
    match: {
      all: [CreationTags.MATERIAL.SEMANTIC_BLADE],
      any: [
        CreationTags.MATERIAL.SEMANTIC_BURST,
        CreationTags.MATERIAL.SEMANTIC_METAL,
        CreationTags.MATERIAL.TYPE_ORE,
      ],
    },
    exclusiveGroup: EXCLUSIVE_GROUP.SKILL.VARIANT_DAMAGE_BOOST,
    weight: 65,
    energyCost: 16,
    applicableTo: ['skill'],
    targetPolicyConstraint: { team: 'enemy' },
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

  // --- 低血斩杀增伤 ---
  {
    id: 'skill-variant-execute-boost',
    displayName: '夺命',
    displayDescription: '术带戾气，专攻命门，生机越弱者越难生还',
    category: 'skill_variant',
    rarity: 'uncommon',
    match: {
      all: [CreationTags.MATERIAL.SEMANTIC_BLADE],
      any: [
        CreationTags.MATERIAL.SEMANTIC_BURST,
        CreationTags.MATERIAL.SEMANTIC_BLOOD,
        CreationTags.MATERIAL.SEMANTIC_BEAST,
      ],
    },
    weight: 50,
    energyCost: 16,
    applicableTo: ['skill'],
    targetPolicyConstraint: { team: 'enemy' },
    grantedAbilityTags: [GameplayTags.TRAIT.EXECUTE],
    effectTemplate: {
      type: 'percent_damage_modifier',
      conditions: [
        { type: 'hp_below', params: { value: 0.35 } },
      ],
      params: {
        mode: 'increase',
        value: { base: 0.2, scale: 'quality', coefficient: 0.04 },
        cap: 0.8,
      },
    },
    listenerSpec: {
      eventType: GameplayTags.EVENT.DAMAGE_REQUEST,
      scope: GameplayTags.SCOPE.OWNER_AS_CASTER,
      priority: CREATION_LISTENER_PRIORITIES.damageRequest,
    },
  },

  // --- 控制命中提高 ---
  {
    id: 'skill-variant-control-accuracy',
    displayName: '锁神',
    displayDescription: '术引磅礴神识，将敌方气机牢牢锁定，令其避无可避',
    category: 'skill_variant',
    rarity: 'uncommon',
    match: {
      all: [CreationTags.MATERIAL.SEMANTIC_SPIRIT],
      any: [
        CreationTags.MATERIAL.SEMANTIC_MANUAL,
        CreationTags.MATERIAL.SEMANTIC_ILLUSION,
        CreationTags.MATERIAL.SEMANTIC_THUNDER,
      ],
    },
    weight: 48,
    energyCost: 16,
    applicableTo: ['skill'],
    targetPolicyConstraint: { team: 'enemy' },
    effectTemplate: {
      type: 'apply_buff',
      params: {
        buffConfig: {
          id: 'craft-control-hit-buff',
          name: '神识聚焦',
          type: BuffType.BUFF,
          duration: 1,
          stackRule: StackRule.OVERRIDE,
          tags: [GameplayTags.BUFF.TYPE.BUFF],
          statusTags: [GameplayTags.STATUS.CATEGORY.BUFF],
          modifiers: [
            {
              attrType: AttributeType.CONTROL_HIT,
              type: ModifierType.FIXED,
              value: 0.15,
            },
          ],
        },
        chance: 1,
      },
    },
  },

  // ================================================================
  // ===== SKILL_RARE 池 (4 种) — 制造"神技感"，每 Skill 最多 1 条
  // ================================================================

  // --- 引燃：命中灼烧目标引爆一次灼烧 ---
  {
    id: 'skill-rare-ignite',
    displayName: '引燃',
    displayDescription: '真阳异火所聚，瞬息点燃敌方护体真气引发爆裂',
    category: 'skill_rare',
    rarity: 'legendary',
    match: {
      all: [
        CreationTags.MATERIAL.SEMANTIC_FLAME,
        CreationTags.MATERIAL.TYPE_SPECIAL,
      ],
      any: [
        CreationTags.MATERIAL.SEMANTIC_BURST,
        CreationTags.MATERIAL.SEMANTIC_BLOOD,
      ],
    },
    exclusiveGroup: EXCLUSIVE_GROUP.SKILL.RARE_ULTIMATE,
    weight: 5,
    energyCost: 50,
    minQuality: '玄品',
    applicableTo: ['skill'],
    targetPolicyConstraint: { team: 'enemy' },
    grantedAbilityTags: [
      GameplayTags.ABILITY.FUNCTION.DAMAGE,
      GameplayTags.ABILITY.CHANNEL.MAGIC,
    ],
    effectTemplate: {
      type: 'tag_trigger',
      params: {
        triggerTag: GameplayTags.STATUS.STATE.BURNED,
        damageRatio: { base: 2.0, scale: 'quality', coefficient: 0.3 },
        removeOnTrigger: false,
      },
    },
  },

  // --- 封喉：目标受控时终结增伤 ---
  {
    id: 'skill-rare-throat-seal',
    displayName: '封喉',
    displayDescription: '杀意内敛，专寻破绽，敌方受制时可一击必定乾坤',
    category: 'skill_rare',
    rarity: 'rare',
    match: {
      all: [CreationTags.MATERIAL.SEMANTIC_BLADE],
      any: [
        CreationTags.MATERIAL.SEMANTIC_FREEZE,
        CreationTags.MATERIAL.SEMANTIC_ILLUSION,
        CreationTags.MATERIAL.SEMANTIC_TIME,
      ],
    },
    exclusiveGroup: EXCLUSIVE_GROUP.SKILL.RARE_ULTIMATE,
    weight: 8,
    energyCost: 40,
    minQuality: '灵品',
    applicableTo: ['skill'],
    targetPolicyConstraint: { team: 'enemy' },
    effectTemplate: {
      type: 'percent_damage_modifier',
      conditions: [
        {
          type: 'has_tag',
          params: { tag: GameplayTags.STATUS.CONTROL.ROOT },
        },
      ],
      params: {
        mode: 'increase',
        value: { base: 0.35, scale: 'quality', coefficient: 0.06 },
        cap: 1.5,
      },
    },
    listenerSpec: {
      eventType: GameplayTags.EVENT.DAMAGE_REQUEST,
      scope: GameplayTags.SCOPE.OWNER_AS_CASTER,
      priority: CREATION_LISTENER_PRIORITIES.damageRequest,
    },
  },

  // --- 逆脉：命中有概率延长对方技能 CD ---
  {
    id: 'skill-rare-cd-curse',
    displayName: '逆脉',
    displayDescription: '携岁月流转之力，命中时概率令敌方经脉逆行、短时内无法施术',
    category: 'skill_rare',
    rarity: 'rare',
    match: {
      all: [
        CreationTags.MATERIAL.SEMANTIC_TIME,
        CreationTags.MATERIAL.TYPE_SPECIAL,
      ],
      any: [
        CreationTags.MATERIAL.SEMANTIC_MANUAL,
        CreationTags.MATERIAL.SEMANTIC_ILLUSION,
        CreationTags.MATERIAL.SEMANTIC_THUNDER,
      ],
    },
    exclusiveGroup: EXCLUSIVE_GROUP.SKILL.RARE_ULTIMATE,
    weight: 6,
    energyCost: 45,
    minQuality: '灵品',
    applicableTo: ['skill'],
    targetPolicyConstraint: { team: 'enemy' },
    grantedAbilityTags: [GameplayTags.TRAIT.COOLDOWN],
    effectTemplate: {
      type: 'cooldown_modify',
      conditions: [{ type: 'chance', params: { value: 0.6 } }],
      params: {
        cdModifyValue: { base: 2, scale: 'quality', coefficient: 0.5 },
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

  // --- 魂伤：真实伤害无视防御 ---
  {
    id: 'skill-rare-soul-rend',
    displayName: '魂伤',
    displayDescription: '斩魂绝灵之一击，穿透一切虚妄与肉身，伤及本源',
    category: 'skill_core',
    rarity: 'legendary',
    match: {
      all: [
        CreationTags.MATERIAL.SEMANTIC_SPIRIT,
        CreationTags.MATERIAL.TYPE_SPECIAL,
      ],
      any: [
        CreationTags.MATERIAL.SEMANTIC_BURST,
        CreationTags.MATERIAL.SEMANTIC_BLOOD,
        CreationTags.MATERIAL.SEMANTIC_DIVINE,
      ],
    },
    exclusiveGroup: EXCLUSIVE_GROUP.SKILL.RARE_ULTIMATE,
    weight: 4,
    energyCost: 55,
    applicableTo: ['skill'],
    targetPolicyConstraint: { team: 'enemy' },
    grantedAbilityTags: [
      GameplayTags.ABILITY.FUNCTION.DAMAGE,
      GameplayTags.ABILITY.CHANNEL.TRUE,
    ],
    effectTemplate: {
      type: 'damage',
      params: {
        value: {
          base: { base: 90, scale: 'quality', coefficient: 18 },
          attribute: AttributeType.WILLPOWER,
          coefficient: 1.5,
        },
      },
    },
  },
];
