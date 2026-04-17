/*
 * skillAffixes: 技能词缀定义（梦幻西游风格三角重构）
 *
 * 技能定位："招" — 负责"出手惊艳感"，词条价值集中在本次施法。
 *
 * 池结构：
 *   skill_core    (~50%) — 保证技能不废，专注本次施法直接成立
 *   skill_variant (~35%) — 让同一技能长出不同战术身份
 *   skill_rare    (~15%) — 制造"神技感"，每 Skill 最多 1 条
 *
 * 硬边界（Section 2.3 + Section 6.1）：
 *   - 禁止 attribute_modifier（常驻属性归 gongfa/artifact）
 *   - 禁止通过长时 apply_buff + nested OWNER_AS_CASTER listener 模拟长期被动
 *   - 顶层效果以即时 GE 为主
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
import { AffixDefinition, matchAll } from '../types';

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
    match: matchAll([
      CreationTags.MATERIAL.SEMANTIC_BLADE,
      CreationTags.MATERIAL.SEMANTIC_BURST,
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

  // --- 8 种元素伤害 ---
  {
    id: 'skill-core-damage-fire',
    displayName: '火系伤害',
    displayDescription: '造成一次火系法术伤害，与灼烧状态联动可爆发更高输出',
    category: 'skill_core',
    rarity: 'common',
    match: matchAll([
      CreationTags.MATERIAL.SEMANTIC_FLAME,
      ELEMENT_TO_MATERIAL_TAG['火'],
    ]),
    exclusiveGroup: EXCLUSIVE_GROUP.SKILL.CORE_DAMAGE_TYPE,
    weight: 85,
    energyCost: 10,
    applicableTo: ['skill'],
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
          coefficient: 0.92,
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
    match: matchAll([
      CreationTags.MATERIAL.SEMANTIC_FREEZE,
      ELEMENT_TO_MATERIAL_TAG['冰'],
    ]),
    exclusiveGroup: EXCLUSIVE_GROUP.SKILL.CORE_DAMAGE_TYPE,
    weight: 80,
    energyCost: 10,
    applicableTo: ['skill'],
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
          coefficient: 0.86,
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
    match: matchAll([
      CreationTags.MATERIAL.SEMANTIC_WIND,
      ELEMENT_TO_MATERIAL_TAG['风'],
    ]),
    exclusiveGroup: EXCLUSIVE_GROUP.SKILL.CORE_DAMAGE_TYPE,
    weight: 72,
    energyCost: 10,
    applicableTo: ['skill'],
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
    match: matchAll([
      CreationTags.MATERIAL.SEMANTIC_METAL,
      ELEMENT_TO_MATERIAL_TAG['金'],
    ]),
    exclusiveGroup: EXCLUSIVE_GROUP.SKILL.CORE_DAMAGE_TYPE,
    weight: 70,
    energyCost: 10,
    applicableTo: ['skill'],
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
    match: matchAll([
      CreationTags.MATERIAL.SEMANTIC_WATER,
      ELEMENT_TO_MATERIAL_TAG['水'],
    ]),
    exclusiveGroup: EXCLUSIVE_GROUP.SKILL.CORE_DAMAGE_TYPE,
    weight: 68,
    energyCost: 10,
    applicableTo: ['skill'],
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
    match: matchAll([
      CreationTags.MATERIAL.SEMANTIC_WOOD,
      ELEMENT_TO_MATERIAL_TAG['木'],
    ]),
    exclusiveGroup: EXCLUSIVE_GROUP.SKILL.CORE_DAMAGE_TYPE,
    weight: 65,
    energyCost: 10,
    applicableTo: ['skill'],
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
    match: matchAll([
      CreationTags.MATERIAL.SEMANTIC_EARTH,
      ELEMENT_TO_MATERIAL_TAG['土'],
    ]),
    exclusiveGroup: EXCLUSIVE_GROUP.SKILL.CORE_DAMAGE_TYPE,
    weight: 67,
    energyCost: 10,
    applicableTo: ['skill'],
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
    displayDescription: '恢复目标大量气血',
    category: 'skill_core',
    rarity: 'common',
    match: matchAll([
      CreationTags.MATERIAL.SEMANTIC_SUSTAIN,
      CreationTags.MATERIAL.TYPE_HERB,
    ]),
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

  // --- 控制 ---
  {
    id: 'skill-core-control-stun',
    displayName: '眩晕控制',
    displayDescription: '眩晕目标，使其短时间无法行动',
    category: 'skill_core',
    rarity: 'uncommon',
    match: matchAll([
      CreationTags.MATERIAL.SEMANTIC_FREEZE,
      CreationTags.MATERIAL.SEMANTIC_THUNDER,
    ]),
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

  // --- MP 消耗降低 ---
  {
    id: 'skill-core-mp-cost-reduce',
    displayName: '法力节省',
    displayDescription: '降低本技能施法灵力消耗，便于频繁施放',
    category: 'skill_core',
    rarity: 'common',
    match: matchAll([
      CreationTags.MATERIAL.SEMANTIC_SPIRIT,
      CreationTags.MATERIAL.TYPE_HERB,
    ]),
    weight: 60,
    energyCost: 6,
    applicableTo: ['skill'],
    effectTemplate: {
      type: 'cooldown_modify',
      params: {
        cdModifyValue: { base: -1, scale: 'quality', coefficient: -0.2 },
      },
    },
  },

  // --- 命中提高 ---
  {
    id: 'skill-core-accuracy-boost',
    displayName: '精准制导',
    displayDescription: '提高本次施法命中率，减少落空风险',
    category: 'skill_core',
    rarity: 'common',
    match: matchAll([
      CreationTags.MATERIAL.SEMANTIC_BLADE,
      CreationTags.MATERIAL.SEMANTIC_WIND,
    ]),
    weight: 55,
    energyCost: 6,
    applicableTo: ['skill'],
    effectTemplate: {
      type: 'apply_buff',
      params: {
        buffConfig: {
          id: 'craft-accuracy-boost',
          name: '锁定',
          type: BuffType.BUFF,
          duration: 1,
          stackRule: StackRule.OVERRIDE,
          tags: [GameplayTags.BUFF.TYPE.BUFF],
          statusTags: [GameplayTags.STATUS.CATEGORY.BUFF],
          modifiers: [
            {
              attrType: AttributeType.ACCURACY,
              type: ModifierType.FIXED,
              value: 0.12,
            },
          ],
        },
        chance: 1,
      },
    },
  },

  // ================================================================
  // ===== SKILL_VARIANT 池 (12 种) — 让同一技能长出不同战术身份
  // ================================================================

  // --- 灼烧 DOT ---
  {
    id: 'skill-variant-burn-dot',
    displayName: '灼烧持续伤害',
    displayDescription: '命中时附加灼烧，每回合造成持续伤害',
    category: 'skill_variant',
    rarity: 'common',
    match: matchAll([
      CreationTags.MATERIAL.SEMANTIC_FLAME,
      ELEMENT_TO_MATERIAL_TAG['火'],
    ]),
    exclusiveGroup: EXCLUSIVE_GROUP.SKILL.VARIANT_BURN,
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
    displayName: '冰缓节',
    displayDescription: '命中时附加减速，降低目标身法',
    category: 'skill_variant',
    rarity: 'common',
    match: matchAll([
      CreationTags.MATERIAL.SEMANTIC_FREEZE,
      ELEMENT_TO_MATERIAL_TAG['冰'],
    ]),
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
    displayName: '毒素侵染',
    displayDescription: '命中时附加毒素，每回合造成持续伤害且可叠层',
    category: 'skill_variant',
    rarity: 'common',
    match: matchAll([CreationTags.MATERIAL.SEMANTIC_POISON]),
    weight: 68,
    energyCost: 9,
    applicableTo: ['skill'],
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
    displayName: '破防标记',
    displayDescription: '命中时降低目标防御，使后续攻击更具穿透力',
    category: 'skill_variant',
    rarity: 'common',
    match: matchAll([
      CreationTags.MATERIAL.SEMANTIC_BLADE,
      CreationTags.MATERIAL.SEMANTIC_BURST,
    ]),
    weight: 55,
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
    displayName: '命中驱散',
    displayDescription: '命中时消除目标一层 buff，破除敌方增益',
    category: 'skill_variant',
    rarity: 'common',
    match: matchAll([
      CreationTags.MATERIAL.SEMANTIC_SPIRIT,
      CreationTags.MATERIAL.SEMANTIC_MANUAL,
    ]),
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

  // --- 治疗附带净化 ---
  {
    id: 'skill-variant-heal-cleanse',
    displayName: '净心吐纳',
    displayDescription: '治疗时同时驱散目标一层负面效果',
    category: 'skill_variant',
    rarity: 'uncommon',
    match: matchAll([
      CreationTags.MATERIAL.SEMANTIC_SUSTAIN,
      CreationTags.MATERIAL.SEMANTIC_SPIRIT,
    ]),
    weight: 45,
    energyCost: 8,
    applicableTo: ['skill'],
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
    displayName: '命中吸血',
    displayDescription: '施放后即时回复部分气血，攻守兼备',
    category: 'skill_variant',
    rarity: 'common',
    match: matchAll([
      CreationTags.MATERIAL.SEMANTIC_BURST,
      CreationTags.MATERIAL.SEMANTIC_SUSTAIN,
    ]),
    exclusiveGroup: EXCLUSIVE_GROUP.SKILL.VARIANT_LIFESTEAL,
    weight: 72,
    energyCost: 9,
    applicableTo: ['skill'],
    grantedAbilityTags: [GameplayTags.TRAIT.LIFESTEAL],
    effectTemplate: {
      type: 'heal',
      params: {
        value: {
          base: { base: 12, scale: 'quality', coefficient: 4 },
          attribute: AttributeType.MAGIC_ATK,
          coefficient: 0.18,
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

  // --- 回蓝 ---
  {
    id: 'skill-variant-mp-on-cast',
    displayName: '灵泉回涌',
    displayDescription: '施放后即时回复法力，维持连续施法的灵力充盈',
    category: 'skill_variant',
    rarity: 'common',
    match: matchAll([
      CreationTags.MATERIAL.SEMANTIC_SPIRIT,
      CreationTags.MATERIAL.TYPE_HERB,
    ]),
    weight: 75,
    energyCost: 6,
    applicableTo: ['skill'],
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
    displayName: '防御屏障',
    displayDescription: '施放后为自身生成护盾，增加容错空间',
    category: 'skill_variant',
    rarity: 'common',
    match: matchAll([
      CreationTags.MATERIAL.SEMANTIC_GUARD,
      CreationTags.MATERIAL.TYPE_ORE,
    ]),
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

  // --- 技能增伤 ---
  {
    id: 'skill-variant-damage-boost',
    displayName: '技能增伤',
    displayDescription: '施放时提升本次技能伤害',
    category: 'skill_variant',
    rarity: 'uncommon',
    match: matchAll([
      CreationTags.MATERIAL.SEMANTIC_BLADE,
      CreationTags.MATERIAL.TYPE_ORE,
    ]),
    exclusiveGroup: EXCLUSIVE_GROUP.SKILL.VARIANT_DAMAGE_BOOST,
    weight: 65,
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

  // --- 低血斩杀增伤 ---
  {
    id: 'skill-variant-execute-boost',
    displayName: '斩杀嗅觉',
    displayDescription: '目标低血时本次施法伤害提高',
    category: 'skill_variant',
    rarity: 'uncommon',
    match: matchAll([
      CreationTags.MATERIAL.SEMANTIC_BLADE,
      CreationTags.MATERIAL.SEMANTIC_BURST,
    ]),
    weight: 50,
    energyCost: 7,
    applicableTo: ['skill'],
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
    displayName: '神识贯穿',
    displayDescription: '本次施法的控制效果命中提高',
    category: 'skill_variant',
    rarity: 'uncommon',
    match: matchAll([
      CreationTags.MATERIAL.SEMANTIC_MANUAL,
      CreationTags.MATERIAL.SEMANTIC_SPIRIT,
    ]),
    weight: 48,
    energyCost: 7,
    applicableTo: ['skill'],
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
    displayDescription: '命中带灼烧目标时，立即引爆灼烧造成额外伤害',
    category: 'skill_rare',
    rarity: 'legendary',
    match: matchAll([
      CreationTags.MATERIAL.SEMANTIC_FLAME,
      CreationTags.MATERIAL.SEMANTIC_BURST,
      CreationTags.MATERIAL.TYPE_SPECIAL,
    ]),
    exclusiveGroup: EXCLUSIVE_GROUP.SKILL.RARE_ULTIMATE,
    weight: 5,
    energyCost: 16,
    minQuality: '玄品',
    applicableTo: ['skill'],
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
    displayDescription: '目标处于控制状态时，本次施法伤害大幅提升',
    category: 'skill_rare',
    rarity: 'rare',
    match: matchAll([
      CreationTags.MATERIAL.SEMANTIC_FREEZE,
      CreationTags.MATERIAL.SEMANTIC_BURST,
    ]),
    exclusiveGroup: EXCLUSIVE_GROUP.SKILL.RARE_ULTIMATE,
    weight: 8,
    energyCost: 14,
    minQuality: '灵品',
    applicableTo: ['skill'],
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
    displayDescription: '命中后有概率大幅延长目标所有技能冷却',
    category: 'skill_rare',
    rarity: 'rare',
    match: matchAll([
      CreationTags.MATERIAL.SEMANTIC_MANUAL,
      CreationTags.MATERIAL.SEMANTIC_THUNDER,
      CreationTags.MATERIAL.TYPE_SPECIAL,
    ]),
    exclusiveGroup: EXCLUSIVE_GROUP.SKILL.RARE_ULTIMATE,
    weight: 6,
    energyCost: 13,
    minQuality: '灵品',
    applicableTo: ['skill'],
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
    displayDescription: '造成一次无视防御的真实伤害，直击灵魂',
    category: 'skill_rare',
    rarity: 'legendary',
    match: matchAll([
      CreationTags.MATERIAL.SEMANTIC_SPIRIT,
      CreationTags.MATERIAL.SEMANTIC_BURST,
      CreationTags.MATERIAL.TYPE_SPECIAL,
    ]),
    exclusiveGroup: EXCLUSIVE_GROUP.SKILL.RARE_ULTIMATE,
    weight: 4,
    energyCost: 15,
    minQuality: '真品',
    applicableTo: ['skill'],
    grantedAbilityTags: [
      GameplayTags.ABILITY.FUNCTION.DAMAGE,
      GameplayTags.ABILITY.CHANNEL.TRUE,
    ],
    effectTemplate: {
      type: 'damage',
      params: {
        value: {
          base: { base: 60, scale: 'quality', coefficient: 18 },
          attribute: AttributeType.SPIRIT,
          coefficient: 0.8,
        },
      },
    },
  },
];
