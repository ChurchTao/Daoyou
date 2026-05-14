/*
 * 灵能消耗平衡规则 (Energy Cost Balance Rule - V2):
 * 1. 核心池 (Core/Panel): 8 ~ 15 点。作为基础底盘，保证产物基本强度。
 * 2. 变体池 (Variant/School/Defense): 12 ~ 20 点。主要能量吸收点，定义流派特色。
 * 3. 稀有池 (Rare/Secret/Treasure): 35 ~ 55 点。顶级消耗项，吸收神品材料溢出能量，产出质变效果。
 *
 * PBU 换算逻辑：PBU = (∑词缀消耗 * 类别系数 * 效率加成) * 品质乘数 + 极品奖励。
 */
import { CreationTags, GameplayTags } from '@shared/engine/shared/tag-domain';
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

const DOT_TICK_LISTENER = {
  eventType: GameplayTags.EVENT.ACTION_PRE,
  scope: GameplayTags.SCOPE.OWNER_AS_ACTOR,
  priority: CREATION_LISTENER_PRIORITIES.dotTick,
} as const;

export const SKILL_AFFIXES: AffixDefinition[] = [
  // ================================================================
  // ===== SKILL_CORE 池 (20 种) — 保证技能不废，专注本次施法
  // ================================================================

  // --- 基础伤害 ---
  {
    id: 'skill-core-damage',
    displayName: '基础伤害',
    displayDescription: '施放时造成一次基础法术伤害',
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
    displayDescription: '施放时造成一次火系法术伤害',
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
          coefficient: 1.2,
        },
      },
    },
  },
  {
    id: 'skill-core-damage-ice',
    displayName: '冰系伤害',
    displayDescription: '施放时造成一次冰系法术伤害',
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
    displayDescription: '施放时造成一次雷系法术伤害',
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
    weight: 65,
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
    displayDescription: '施放时造成一次风系物理伤害',
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
    displayDescription: '施放时造成一次金系物理伤害',
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
    displayDescription: '施放时造成一次水系法术伤害',
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
    displayDescription: '施放时造成一次木系法术伤害',
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
    displayDescription: '施放时造成一次土系物理伤害',
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
    displayDescription: '施放时恢复目标气血',
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

  // --- 罡气护体 ---
  {
    id: 'skill-core-guard-aura',
    displayName: '罡气',
    displayDescription: '施放时为自身生成护盾',
    category: 'skill_core',
    rarity: 'common',
    match: {
      all: [ELEMENT_TO_MATERIAL_TAG['土']],
      any: [
        CreationTags.MATERIAL.SEMANTIC_GUARD,
        CreationTags.MATERIAL.SEMANTIC_EARTH,
        CreationTags.MATERIAL.TYPE_ORE,
      ],
    },
    exclusiveGroup: EXCLUSIVE_GROUP.SKILL.CORE_DAMAGE_TYPE,
    weight: 72,
    energyCost: 12,
    applicableTo: ['skill'],
    targetPolicyConstraint: { team: 'self' },
    grantedAbilityTags: [GameplayTags.ABILITY.FUNCTION.BUFF],
    effectTemplate: {
      type: 'shield',
      params: {
        value: {
          base: { base: 12, scale: 'quality', coefficient: 4 },
          attribute: AttributeType.SPIRIT,
          coefficient: 0.25,
        },
      },
    },
  },

  // --- 风行疾身 ---
  {
    id: 'skill-core-wind-haste',
    displayName: '疾行',
    displayDescription: '施放时提升自身速度',
    category: 'skill_core',
    rarity: 'uncommon',
    match: {
      all: [ELEMENT_TO_MATERIAL_TAG['风']],
      any: [
        CreationTags.MATERIAL.SEMANTIC_WIND,
        CreationTags.MATERIAL.SEMANTIC_SPACE,
      ],
    },
    exclusiveGroup: EXCLUSIVE_GROUP.SKILL.CORE_DAMAGE_TYPE,
    weight: 58,
    energyCost: 12,
    applicableTo: ['skill'],
    targetPolicyConstraint: { team: 'self' },
    grantedAbilityTags: [GameplayTags.ABILITY.FUNCTION.BUFF],
    effectTemplate: {
      type: 'apply_buff',
      params: {
        buffConfig: {
          id: 'craft-wind-haste',
          name: '疾行',
          type: BuffType.BUFF,
          duration: CREATION_DURATION_POLICY.buffDebuff.short,
          stackRule: StackRule.REFRESH_DURATION,
          tags: [GameplayTags.BUFF.TYPE.BUFF],
          statusTags: [GameplayTags.STATUS.CATEGORY.BUFF],
          modifiers: [
            {
              attrType: AttributeType.SPEED,
              type: ModifierType.ADD,
              value: 0.2,
            },
          ],
        },
        chance: 1,
      },
    },
  },

  // --- 焰息聚元 ---
  {
    id: 'skill-core-fire-channeling',
    displayName: '焰息',
    displayDescription: '施放时提升自身法术攻击',
    category: 'skill_core',
    rarity: 'uncommon',
    match: {
      all: [ELEMENT_TO_MATERIAL_TAG['火']],
      any: [
        CreationTags.MATERIAL.SEMANTIC_FLAME,
        CreationTags.MATERIAL.SEMANTIC_BURST,
      ],
    },
    exclusiveGroup: EXCLUSIVE_GROUP.SKILL.CORE_DAMAGE_TYPE,
    weight: 56,
    energyCost: 13,
    applicableTo: ['skill'],
    targetPolicyConstraint: { team: 'self' },
    grantedAbilityTags: [GameplayTags.ABILITY.FUNCTION.BUFF],
    effectTemplate: {
      type: 'apply_buff',
      params: {
        buffConfig: {
          id: 'craft-fire-channeling',
          name: '焰息',
          type: BuffType.BUFF,
          duration: CREATION_DURATION_POLICY.buffDebuff.short,
          stackRule: StackRule.REFRESH_DURATION,
          tags: [GameplayTags.BUFF.TYPE.BUFF],
          statusTags: [GameplayTags.STATUS.CATEGORY.BUFF],
          modifiers: [
            {
              attrType: AttributeType.MAGIC_ATK,
              type: ModifierType.ADD,
              value: 0.15,
            },
          ],
        },
        chance: 1,
      },
    },
  },

  // --- 雷印凝神 ---
  {
    id: 'skill-core-thunder-focus',
    displayName: '雷印',
    displayDescription: '施放时提升自身控制命中',
    category: 'skill_core',
    rarity: 'uncommon',
    match: {
      all: [ELEMENT_TO_MATERIAL_TAG['雷']],
      any: [
        CreationTags.MATERIAL.SEMANTIC_THUNDER,
        CreationTags.MATERIAL.SEMANTIC_SPIRIT,
        CreationTags.MATERIAL.SEMANTIC_ILLUSION,
      ],
    },
    exclusiveGroup: EXCLUSIVE_GROUP.SKILL.CORE_DAMAGE_TYPE,
    weight: 52,
    energyCost: 12,
    applicableTo: ['skill'],
    targetPolicyConstraint: { team: 'self' },
    grantedAbilityTags: [GameplayTags.ABILITY.FUNCTION.BUFF],
    effectTemplate: {
      type: 'apply_buff',
      params: {
        buffConfig: {
          id: 'craft-thunder-focus',
          name: '雷印',
          type: BuffType.BUFF,
          duration: CREATION_DURATION_POLICY.buffDebuff.short,
          stackRule: StackRule.REFRESH_DURATION,
          tags: [GameplayTags.BUFF.TYPE.BUFF],
          statusTags: [GameplayTags.STATUS.CATEGORY.BUFF],
          modifiers: [
            {
              attrType: AttributeType.CONTROL_HIT,
              type: ModifierType.FIXED,
              value: 0.18,
            },
          ],
        },
        chance: 1,
      },
    },
  },

  // --- 冰魄护心 ---
  {
    id: 'skill-core-ice-frost-guard',
    displayName: '冰魄',
    displayDescription: '施放时提升自身法术防御与控制抗性',
    category: 'skill_core',
    rarity: 'uncommon',
    match: {
      all: [ELEMENT_TO_MATERIAL_TAG['冰']],
      any: [
        CreationTags.MATERIAL.SEMANTIC_FREEZE,
        CreationTags.MATERIAL.SEMANTIC_SPIRIT,
        CreationTags.MATERIAL.SEMANTIC_GUARD,
      ],
    },
    exclusiveGroup: EXCLUSIVE_GROUP.SKILL.CORE_DAMAGE_TYPE,
    weight: 50,
    energyCost: 13,
    applicableTo: ['skill'],
    targetPolicyConstraint: { team: 'self' },
    grantedAbilityTags: [GameplayTags.ABILITY.FUNCTION.BUFF],
    effectTemplate: {
      type: 'apply_buff',
      params: {
        buffConfig: {
          id: 'craft-ice-frost-guard',
          name: '冰魄',
          type: BuffType.BUFF,
          duration: CREATION_DURATION_POLICY.buffDebuff.standard,
          stackRule: StackRule.REFRESH_DURATION,
          tags: [GameplayTags.BUFF.TYPE.BUFF],
          statusTags: [GameplayTags.STATUS.CATEGORY.BUFF],
          modifiers: [
            {
              attrType: AttributeType.MAGIC_DEF,
              type: ModifierType.ADD,
              value: 0.16,
            },
            {
              attrType: AttributeType.CONTROL_RESISTANCE,
              type: ModifierType.FIXED,
              value: 0.12,
            },
          ],
        },
        chance: 1,
      },
    },
  },

  // --- 潮生回澜 ---
  {
    id: 'skill-core-water-tide-surge',
    displayName: '潮生',
    displayDescription: '施放时提升自身灵力与法术防御',
    category: 'skill_core',
    rarity: 'uncommon',
    match: {
      all: [ELEMENT_TO_MATERIAL_TAG['水']],
      any: [
        CreationTags.MATERIAL.SEMANTIC_WATER,
        CreationTags.MATERIAL.SEMANTIC_SPIRIT,
        CreationTags.MATERIAL.SEMANTIC_QI,
      ],
    },
    exclusiveGroup: EXCLUSIVE_GROUP.SKILL.CORE_DAMAGE_TYPE,
    weight: 44,
    energyCost: 14,
    applicableTo: ['skill'],
    targetPolicyConstraint: { team: 'self' },
    grantedAbilityTags: [GameplayTags.ABILITY.FUNCTION.BUFF],
    effectTemplate: {
      type: 'apply_buff',
      params: {
        buffConfig: {
          id: 'craft-water-tide-surge',
          name: '潮生',
          type: BuffType.BUFF,
          duration: CREATION_DURATION_POLICY.buffDebuff.standard,
          stackRule: StackRule.REFRESH_DURATION,
          tags: [GameplayTags.BUFF.TYPE.BUFF],
          statusTags: [GameplayTags.STATUS.CATEGORY.BUFF],
          modifiers: [
            {
              attrType: AttributeType.SPIRIT,
              type: ModifierType.ADD,
              value: 0.18,
            },
            {
              attrType: AttributeType.MAGIC_DEF,
              type: ModifierType.ADD,
              value: 0.12,
            },
          ],
        },
        chance: 1,
      },
    },
  },

  // --- 金锋砺身 ---
  {
    id: 'skill-core-metal-honed-edge',
    displayName: '砺锋',
    displayDescription: '施放时提升自身攻击与护甲穿透',
    category: 'skill_core',
    rarity: 'uncommon',
    match: {
      all: [ELEMENT_TO_MATERIAL_TAG['金']],
      any: [
        CreationTags.MATERIAL.SEMANTIC_METAL,
        CreationTags.MATERIAL.SEMANTIC_BLADE,
      ],
    },
    exclusiveGroup: EXCLUSIVE_GROUP.SKILL.CORE_DAMAGE_TYPE,
    weight: 46,
    energyCost: 12,
    applicableTo: ['skill'],
    targetPolicyConstraint: { team: 'self' },
    grantedAbilityTags: [GameplayTags.ABILITY.FUNCTION.BUFF],
    effectTemplate: {
      type: 'apply_buff',
      params: {
        buffConfig: {
          id: 'craft-metal-honed-edge',
          name: '砺锋',
          type: BuffType.BUFF,
          duration: CREATION_DURATION_POLICY.buffDebuff.short,
          stackRule: StackRule.REFRESH_DURATION,
          tags: [GameplayTags.BUFF.TYPE.BUFF],
          statusTags: [GameplayTags.STATUS.CATEGORY.BUFF],
          modifiers: [
            {
              attrType: AttributeType.ATK,
              type: ModifierType.ADD,
              value: 0.16,
            },
            {
              attrType: AttributeType.ARMOR_PENETRATION,
              type: ModifierType.FIXED,
              value: 0.08,
            },
          ],
        },
        chance: 1,
      },
    },
  },

  // --- 木灵回荣 ---
  {
    id: 'skill-core-wood-regrowth',
    displayName: '回荣',
    displayDescription: '施放时提升自身体魄与灵力',
    category: 'skill_core',
    rarity: 'uncommon',
    match: {
      all: [ELEMENT_TO_MATERIAL_TAG['木']],
      any: [
        CreationTags.MATERIAL.SEMANTIC_WOOD,
        CreationTags.MATERIAL.SEMANTIC_LIFE,
        CreationTags.MATERIAL.TYPE_HERB,
      ],
    },
    exclusiveGroup: EXCLUSIVE_GROUP.SKILL.CORE_DAMAGE_TYPE,
    weight: 44,
    energyCost: 12,
    applicableTo: ['skill'],
    targetPolicyConstraint: { team: 'self' },
    grantedAbilityTags: [GameplayTags.ABILITY.FUNCTION.BUFF],
    effectTemplate: {
      type: 'apply_buff',
      params: {
        buffConfig: {
          id: 'craft-wood-regrowth',
          name: '回荣',
          type: BuffType.BUFF,
          duration: CREATION_DURATION_POLICY.buffDebuff.standard,
          stackRule: StackRule.REFRESH_DURATION,
          tags: [GameplayTags.BUFF.TYPE.BUFF],
          statusTags: [GameplayTags.STATUS.CATEGORY.BUFF],
          modifiers: [
            {
              attrType: AttributeType.VITALITY,
              type: ModifierType.ADD,
              value: 0.12,
            },
            {
              attrType: AttributeType.SPIRIT,
              type: ModifierType.ADD,
              value: 0.1,
            },
          ],
        },
        chance: 1,
      },
    },
  },

  // --- 金芒裂甲 ---
  {
    id: 'skill-core-metal-edge',
    displayName: '金芒',
    displayDescription: '施放时提升自身护甲穿透',
    category: 'skill_core',
    rarity: 'rare',
    match: {
      all: [ELEMENT_TO_MATERIAL_TAG['金']],
      any: [
        CreationTags.MATERIAL.SEMANTIC_BLADE,
        CreationTags.MATERIAL.SEMANTIC_METAL,
      ],
    },
    exclusiveGroup: EXCLUSIVE_GROUP.SKILL.CORE_DAMAGE_TYPE,
    weight: 28,
    energyCost: 14,
    applicableTo: ['skill'],
    targetPolicyConstraint: { team: 'self' },
    grantedAbilityTags: [GameplayTags.ABILITY.FUNCTION.BUFF],
    effectTemplate: {
      type: 'apply_buff',
      params: {
        buffConfig: {
          id: 'craft-metal-edge',
          name: '金芒',
          type: BuffType.BUFF,
          duration: CREATION_DURATION_POLICY.buffDebuff.short,
          stackRule: StackRule.REFRESH_DURATION,
          tags: [GameplayTags.BUFF.TYPE.BUFF],
          statusTags: [GameplayTags.STATUS.CATEGORY.BUFF],
          modifiers: [
            {
              attrType: AttributeType.ARMOR_PENETRATION,
              type: ModifierType.FIXED,
              value: 0.18,
            },
          ],
        },
        chance: 1,
      },
    },
  },

  // --- 长青回生 ---
  {
    id: 'skill-core-wood-evergreen',
    displayName: '长青',
    displayDescription: '施放时提升自身体魄与治疗加成',
    category: 'skill_core',
    rarity: 'rare',
    match: {
      all: [ELEMENT_TO_MATERIAL_TAG['木']],
      any: [
        CreationTags.MATERIAL.SEMANTIC_WOOD,
        CreationTags.MATERIAL.SEMANTIC_LIFE,
        CreationTags.MATERIAL.TYPE_HERB,
      ],
    },
    exclusiveGroup: EXCLUSIVE_GROUP.SKILL.CORE_DAMAGE_TYPE,
    weight: 22,
    energyCost: 15,
    applicableTo: ['skill'],
    targetPolicyConstraint: { team: 'self' },
    grantedAbilityTags: [GameplayTags.ABILITY.FUNCTION.BUFF],
    effectTemplate: {
      type: 'apply_buff',
      params: {
        buffConfig: {
          id: 'craft-wood-evergreen',
          name: '长青',
          type: BuffType.BUFF,
          duration: CREATION_DURATION_POLICY.buffDebuff.standard,
          stackRule: StackRule.REFRESH_DURATION,
          tags: [GameplayTags.BUFF.TYPE.BUFF],
          statusTags: [GameplayTags.STATUS.CATEGORY.BUFF],
          modifiers: [
            {
              attrType: AttributeType.VITALITY,
              type: ModifierType.ADD,
              value: 0.15,
            },
            {
              attrType: AttributeType.HEAL_AMPLIFY,
              type: ModifierType.FIXED,
              value: 0.12,
            },
          ],
        },
        chance: 1,
      },
    },
  },

  // --- 焚阳耀心 ---
  {
    id: 'skill-core-fire-solarflare',
    displayName: '焚阳',
    displayDescription: '施放时提升自身法术攻击与暴击伤害',
    category: 'skill_core',
    rarity: 'legendary',
    match: {
      all: [
        ELEMENT_TO_MATERIAL_TAG['火'],
        CreationTags.MATERIAL.TYPE_SPECIAL,
      ],
      any: [
        CreationTags.MATERIAL.SEMANTIC_FLAME,
        CreationTags.MATERIAL.SEMANTIC_BURST,
      ],
    },
    exclusiveGroup: EXCLUSIVE_GROUP.SKILL.CORE_DAMAGE_TYPE,
    weight: 8,
    energyCost: 15,
    applicableTo: ['skill'],
    targetPolicyConstraint: { team: 'self' },
    grantedAbilityTags: [GameplayTags.ABILITY.FUNCTION.BUFF],
    effectTemplate: {
      type: 'apply_buff',
      params: {
        buffConfig: {
          id: 'craft-fire-solarflare',
          name: '焚阳',
          type: BuffType.BUFF,
          duration: CREATION_DURATION_POLICY.buffDebuff.short,
          stackRule: StackRule.REFRESH_DURATION,
          tags: [GameplayTags.BUFF.TYPE.BUFF],
          statusTags: [GameplayTags.STATUS.CATEGORY.BUFF],
          modifiers: [
            {
              attrType: AttributeType.MAGIC_ATK,
              type: ModifierType.ADD,
              value: 0.2,
            },
            {
              attrType: AttributeType.CRIT_DAMAGE_MULT,
              type: ModifierType.FIXED,
              value: 0.25,
            },
          ],
        },
        chance: 1,
      },
    },
  },

  // --- 御风踏虚 ---
  {
    id: 'skill-core-wind-voidstep',
    displayName: '踏虚',
    displayDescription: '施放时提升自身速度与闪避',
    category: 'skill_core',
    rarity: 'legendary',
    match: {
      all: [
        ELEMENT_TO_MATERIAL_TAG['风'],
        CreationTags.MATERIAL.TYPE_SPECIAL,
      ],
      any: [
        CreationTags.MATERIAL.SEMANTIC_WIND,
        CreationTags.MATERIAL.SEMANTIC_SPACE,
        CreationTags.MATERIAL.SEMANTIC_ILLUSION,
      ],
    },
    exclusiveGroup: EXCLUSIVE_GROUP.SKILL.CORE_DAMAGE_TYPE,
    weight: 6,
    energyCost: 15,
    applicableTo: ['skill'],
    targetPolicyConstraint: { team: 'self' },
    grantedAbilityTags: [GameplayTags.ABILITY.FUNCTION.BUFF],
    effectTemplate: {
      type: 'apply_buff',
      params: {
        buffConfig: {
          id: 'craft-wind-voidstep',
          name: '踏虚',
          type: BuffType.BUFF,
          duration: CREATION_DURATION_POLICY.buffDebuff.short,
          stackRule: StackRule.REFRESH_DURATION,
          tags: [GameplayTags.BUFF.TYPE.BUFF],
          statusTags: [GameplayTags.STATUS.CATEGORY.BUFF],
          modifiers: [
            {
              attrType: AttributeType.SPEED,
              type: ModifierType.ADD,
              value: 0.25,
            },
            {
              attrType: AttributeType.EVASION_RATE,
              type: ModifierType.FIXED,
              value: 0.12,
            },
          ],
        },
        chance: 1,
      },
    },
  },

  // --- 镇岳不移 ---
  {
    id: 'skill-core-earth-immovable',
    displayName: '镇岳',
    displayDescription: '施放时提升自身防御与控制抗性',
    category: 'skill_core',
    rarity: 'legendary',
    match: {
      all: [
        ELEMENT_TO_MATERIAL_TAG['土'],
        CreationTags.MATERIAL.TYPE_SPECIAL,
      ],
      any: [
        CreationTags.MATERIAL.SEMANTIC_EARTH,
        CreationTags.MATERIAL.SEMANTIC_GUARD,
        CreationTags.MATERIAL.TYPE_ORE,
      ],
    },
    exclusiveGroup: EXCLUSIVE_GROUP.SKILL.CORE_DAMAGE_TYPE,
    weight: 5,
    energyCost: 15,
    applicableTo: ['skill'],
    targetPolicyConstraint: { team: 'self' },
    grantedAbilityTags: [GameplayTags.ABILITY.FUNCTION.BUFF],
    effectTemplate: {
      type: 'apply_buff',
      params: {
        buffConfig: {
          id: 'craft-earth-immovable',
          name: '镇岳',
          type: BuffType.BUFF,
          duration: CREATION_DURATION_POLICY.buffDebuff.standard,
          stackRule: StackRule.REFRESH_DURATION,
          tags: [GameplayTags.BUFF.TYPE.BUFF],
          statusTags: [GameplayTags.STATUS.CATEGORY.BUFF],
          modifiers: [
            {
              attrType: AttributeType.DEF,
              type: ModifierType.ADD,
              value: 0.2,
            },
            {
              attrType: AttributeType.CONTROL_RESISTANCE,
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
  // ===== SKILL_VARIANT 池 (11 种) — 只保留直接结算的附加战术层
  // ================================================================

  // --- 短时控制 ---
  {
    id: 'skill-variant-control-stun',
    displayName: '眩晕',
    displayDescription: '命中时有概率使目标眩晕，短时间无法行动',
    category: 'skill_variant',
    rarity: 'uncommon',
    match: {
      any: [
        CreationTags.MATERIAL.SEMANTIC_FREEZE,
        CreationTags.MATERIAL.SEMANTIC_THUNDER,
        CreationTags.MATERIAL.SEMANTIC_ILLUSION,
      ],
    },
    weight: 50,
    energyCost: 20,
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
        chance: 0.75,
      },
    },
  },

  // --- 灼烧 DOT ---
  {
    id: 'skill-variant-burn-dot',
    displayName: '灼烧',
    displayDescription: '命中时有概率附加灼烧，持续造成伤害',
    category: 'skill_variant',
    rarity: 'common',
    match: {
      all: [ELEMENT_TO_MATERIAL_TAG['火']],
      any: [CreationTags.MATERIAL.SEMANTIC_FLAME],
    },
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
          stackRule: StackRule.STACK_LAYER,
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
              ...DOT_TICK_LISTENER,
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
    displayDescription: '命中时有概率附加冰缓，降低目标速度',
    category: 'skill_variant',
    rarity: 'common',
    match: {
      all: [ELEMENT_TO_MATERIAL_TAG['冰']],
      any: [CreationTags.MATERIAL.SEMANTIC_FREEZE],
    },
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
              type: ModifierType.ADD,
              value: -0.3,
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
    displayDescription: '命中时有概率附加中毒，持续造成伤害',
    category: 'skill_variant',
    rarity: 'common',
    match: {
      all: [ELEMENT_TO_MATERIAL_TAG['木']],
      any: [
        CreationTags.MATERIAL.SEMANTIC_POISON,
        CreationTags.MATERIAL.SEMANTIC_WOOD,
      ],
    },
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
          tags: [
            GameplayTags.BUFF.TYPE.DEBUFF,
            GameplayTags.BUFF.DOT.ROOT,
            GameplayTags.BUFF.DOT.POISON,
          ],
          statusTags: [
            GameplayTags.STATUS.CATEGORY.DEBUFF,
            GameplayTags.STATUS.STATE.POISONED,
            GameplayTags.STATUS.CATEGORY.DOT,
          ],
          listeners: [
            {
              ...DOT_TICK_LISTENER,
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

  // --- 流血 DOT ---
  {
    id: 'skill-variant-bleed-dot',
    displayName: '裂创',
    displayDescription: '命中时有概率附加流血，持续造成伤害',
    category: 'skill_variant',
    rarity: 'common',
    match: {
      all: [ELEMENT_TO_MATERIAL_TAG['金']],
      any: [
        CreationTags.MATERIAL.SEMANTIC_BLADE,
        CreationTags.MATERIAL.SEMANTIC_METAL,
      ],
    },
    weight: 70,
    energyCost: 12,
    applicableTo: ['skill'],
    targetPolicyConstraint: { team: 'enemy' },
    effectTemplate: {
      type: 'apply_buff',
      params: {
        buffConfig: {
          id: 'craft-bleed',
          name: '流血',
          type: BuffType.DEBUFF,
          duration: CREATION_DURATION_POLICY.buffDebuff.short,
          stackRule: StackRule.STACK_LAYER,
          tags: [
            GameplayTags.BUFF.TYPE.DEBUFF,
            GameplayTags.BUFF.DOT.ROOT,
            GameplayTags.BUFF.DOT.BLEED,
          ],
          statusTags: [
            GameplayTags.STATUS.CATEGORY.DEBUFF,
            GameplayTags.STATUS.STATE.BLEEDING,
            GameplayTags.STATUS.CATEGORY.DOT,
          ],
          listeners: [
            {
              ...DOT_TICK_LISTENER,
              effects: [
                {
                  type: 'damage',
                  params: {
                    value: {
                      base: 7,
                      attribute: AttributeType.ATK,
                      coefficient: 0.12,
                    },
                  },
                },
              ],
            },
          ],
        },
        chance: { base: 0.62, scale: 'quality', coefficient: 0.05 },
      },
    },
  },

  // --- 感电降抗 ---
  {
    id: 'skill-variant-thunder-shock',
    displayName: '感电',
    displayDescription: '命中时有概率附加感电，降低目标控制抗性',
    category: 'skill_variant',
    rarity: 'uncommon',
    match: {
      all: [ELEMENT_TO_MATERIAL_TAG['雷']],
      any: [
        CreationTags.MATERIAL.SEMANTIC_THUNDER,
        CreationTags.MATERIAL.SEMANTIC_SPIRIT,
      ],
    },
    weight: 60,
    energyCost: 14,
    applicableTo: ['skill'],
    targetPolicyConstraint: { team: 'enemy' },
    effectTemplate: {
      type: 'apply_buff',
      params: {
        buffConfig: {
          id: 'craft-shocked',
          name: '感电',
          type: BuffType.DEBUFF,
          duration: CREATION_DURATION_POLICY.buffDebuff.short,
          stackRule: StackRule.REFRESH_DURATION,
          tags: [GameplayTags.BUFF.TYPE.DEBUFF],
          statusTags: [
            GameplayTags.STATUS.CATEGORY.DEBUFF,
            GameplayTags.STATUS.STATE.SHOCKED,
          ],
          modifiers: [
            {
              attrType: AttributeType.CONTROL_RESISTANCE,
              type: ModifierType.FIXED,
              value: -0.15,
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
    displayDescription: '命中时有概率降低目标防御',
    category: 'skill_variant',
    rarity: 'rare',
    match: {
      all: [CreationTags.MATERIAL.SEMANTIC_BLADE],
      any: [
        CreationTags.MATERIAL.SEMANTIC_BONE,
        CreationTags.MATERIAL.SEMANTIC_METAL,
      ],
    },
    weight: 28,
    energyCost: 16,
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
              type: ModifierType.ADD,
              value: -0.18,
            },
          ],
        },
        chance: { base: 0.7, scale: 'quality', coefficient: 0.04 },
      },
    },
  },

  // --- 单体破法 ---
  {
    id: 'skill-variant-dispel',
    displayName: '破法',
    displayDescription: '驱散目标 1 层增益状态',
    category: 'skill_variant',
    rarity: 'rare',
    match: {
      all: [CreationTags.MATERIAL.SEMANTIC_SPIRIT],
      any: [
        CreationTags.MATERIAL.SEMANTIC_DIVINE,
        CreationTags.MATERIAL.SEMANTIC_WATER,
        CreationTags.MATERIAL.SEMANTIC_MANUAL,
      ],
    },
    weight: 24,
    energyCost: 18,
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

  // --- 治疗净化 ---
  {
    id: 'skill-variant-heal-cleanse',
    displayName: '清心',
    displayDescription: '驱散自身最多 3 层负面状态',
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
        maxCount: 3,
      },
    },
  },

  // --- 聚灵回元 ---
  {
    id: 'skill-variant-mana-spring',
    displayName: '聚灵',
    displayDescription: '施放时回复自身灵力',
    category: 'skill_variant',
    rarity: 'uncommon',
    match: {
      all: [CreationTags.MATERIAL.SEMANTIC_SPIRIT],
      any: [
        CreationTags.MATERIAL.SEMANTIC_QI,
        CreationTags.MATERIAL.TYPE_HERB,
        CreationTags.MATERIAL.SEMANTIC_WATER,
      ],
    },
    weight: 48,
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
  },

  // --- 蚀灵燃蓝 ---
  {
    id: 'skill-variant-water-mana-burn',
    displayName: '蚀灵',
    displayDescription: '施放时燃烧目标灵力',
    category: 'skill_variant',
    rarity: 'uncommon',
    match: {
      all: [ELEMENT_TO_MATERIAL_TAG['水']],
      any: [
        CreationTags.MATERIAL.SEMANTIC_WATER,
        CreationTags.MATERIAL.SEMANTIC_SPIRIT,
      ],
    },
    weight: 52,
    energyCost: 14,
    applicableTo: ['skill'],
    targetPolicyConstraint: { team: 'enemy' },
    effectTemplate: {
      type: 'mana_burn',
      params: {
        value: {
          base: { base: 12, scale: 'quality', coefficient: 4 },
          attribute: AttributeType.SPIRIT,
          coefficient: 0.12,
        },
      },
    },
  },

  // ================================================================
  // ===== SKILL_RARE 池 (10 种) — 覆盖敌方压制与自身极致强化
  // ================================================================

  // --- 引燃：命中灼烧目标引爆一次灼烧 ---
  {
    id: 'skill-rare-ignite',
    displayName: '引燃',
    displayDescription: '命中灼烧目标时，额外引爆一次灼烧伤害',
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

  // --- 雷牢封脉 ---
  {
    id: 'skill-rare-thunder-prison',
    displayName: '雷牢',
    displayDescription: '命中时有概率使目标陷入强力控制，短时间无法行动',
    category: 'skill_rare',
    rarity: 'rare',
    match: {
      all: [
        ELEMENT_TO_MATERIAL_TAG['雷'],
        CreationTags.MATERIAL.TYPE_SPECIAL,
      ],
      any: [
        CreationTags.MATERIAL.SEMANTIC_THUNDER,
        CreationTags.MATERIAL.SEMANTIC_ILLUSION,
      ],
    },
    exclusiveGroup: EXCLUSIVE_GROUP.SKILL.RARE_ULTIMATE,
    weight: 20,
    energyCost: 38,
    applicableTo: ['skill'],
    targetPolicyConstraint: { team: 'enemy' },
    grantedAbilityTags: [GameplayTags.ABILITY.FUNCTION.CONTROL],
    effectTemplate: {
      type: 'apply_buff',
      params: {
        buffConfig: {
          id: 'craft-thunder-prison',
          name: '雷牢',
          type: BuffType.CONTROL,
          duration: CREATION_DURATION_POLICY.control.elite,
          stackRule: StackRule.IGNORE,
          tags: [GameplayTags.BUFF.TYPE.DEBUFF, GameplayTags.BUFF.TYPE.CONTROL],
          statusTags: [
            GameplayTags.STATUS.CATEGORY.DEBUFF,
            GameplayTags.STATUS.CONTROL.ROOT,
            GameplayTags.STATUS.CONTROL.STUNNED,
            GameplayTags.STATUS.CONTROL.NO_ACTION,
          ],
        },
        chance: { base: 0.78, scale: 'quality', coefficient: 0.03 },
      },
    },
  },

  // --- 潮崩破法 ---
  {
    id: 'skill-rare-tide-collapse',
    displayName: '潮崩',
    displayDescription: '驱散目标最多 2 层增益状态',
    category: 'skill_rare',
    rarity: 'rare',
    match: {
      all: [
        ELEMENT_TO_MATERIAL_TAG['水'],
        CreationTags.MATERIAL.TYPE_SPECIAL,
      ],
      any: [
        CreationTags.MATERIAL.SEMANTIC_WATER,
        CreationTags.MATERIAL.SEMANTIC_DIVINE,
        CreationTags.MATERIAL.SEMANTIC_SPIRIT,
      ],
    },
    exclusiveGroup: EXCLUSIVE_GROUP.SKILL.RARE_ULTIMATE,
    weight: 18,
    energyCost: 40,
    applicableTo: ['skill'],
    targetPolicyConstraint: { team: 'enemy' },
    effectTemplate: {
      type: 'dispel',
      params: {
        targetTag: GameplayTags.BUFF.TYPE.BUFF,
        maxCount: 2,
      },
    },
  },

  // --- 逆脉封转 ---
  {
    id: 'skill-rare-cd-curse',
    displayName: '逆脉',
    displayDescription: '命中时有概率延长目标技能冷却',
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
    weight: 22,
    energyCost: 45,
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
  },

  // --- 魂伤：真实伤害无视防御 ---
  {
    id: 'skill-rare-soul-rend',
    displayName: '魂伤',
    displayDescription: '施放时造成一次真实伤害',
    category: 'skill_rare',
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

  // --- 冰镜护心 ---
  {
    id: 'skill-rare-ice-mirror-heart',
    displayName: '镜心',
    displayDescription: '施放时提升自身法术防御与暴击抵抗',
    category: 'skill_rare',
    rarity: 'rare',
    match: {
      all: [
        ELEMENT_TO_MATERIAL_TAG['冰'],
        CreationTags.MATERIAL.TYPE_SPECIAL,
      ],
      any: [
        CreationTags.MATERIAL.SEMANTIC_FREEZE,
        CreationTags.MATERIAL.SEMANTIC_SPIRIT,
        CreationTags.MATERIAL.SEMANTIC_GUARD,
      ],
    },
    exclusiveGroup: EXCLUSIVE_GROUP.SKILL.RARE_ULTIMATE,
    weight: 19,
    energyCost: 38,
    applicableTo: ['skill'],
    targetPolicyConstraint: { team: 'self' },
    grantedAbilityTags: [GameplayTags.ABILITY.FUNCTION.BUFF],
    effectTemplate: {
      type: 'apply_buff',
      params: {
        buffConfig: {
          id: 'craft-ice-mirror-heart',
          name: '镜心',
          type: BuffType.BUFF,
          duration: CREATION_DURATION_POLICY.buffDebuff.long,
          stackRule: StackRule.REFRESH_DURATION,
          tags: [GameplayTags.BUFF.TYPE.BUFF],
          statusTags: [GameplayTags.STATUS.CATEGORY.BUFF],
          modifiers: [
            {
              attrType: AttributeType.MAGIC_DEF,
              type: ModifierType.ADD,
              value: 0.24,
            },
            {
              attrType: AttributeType.CRIT_RESIST,
              type: ModifierType.FIXED,
              value: 0.14,
            },
          ],
        },
        chance: 1,
      },
    },
  },

  // --- 金煞战锋 ---
  {
    id: 'skill-rare-metal-warform',
    displayName: '战锋',
    displayDescription: '施放时提升自身攻击与暴击率',
    category: 'skill_rare',
    rarity: 'rare',
    match: {
      all: [
        ELEMENT_TO_MATERIAL_TAG['金'],
        CreationTags.MATERIAL.TYPE_SPECIAL,
      ],
      any: [
        CreationTags.MATERIAL.SEMANTIC_BLADE,
        CreationTags.MATERIAL.SEMANTIC_METAL,
        CreationTags.MATERIAL.SEMANTIC_BURST,
      ],
    },
    exclusiveGroup: EXCLUSIVE_GROUP.SKILL.RARE_ULTIMATE,
    weight: 18,
    energyCost: 40,
    applicableTo: ['skill'],
    targetPolicyConstraint: { team: 'self' },
    grantedAbilityTags: [GameplayTags.ABILITY.FUNCTION.BUFF],
    effectTemplate: {
      type: 'apply_buff',
      params: {
        buffConfig: {
          id: 'craft-metal-warform',
          name: '战锋',
          type: BuffType.BUFF,
          duration: CREATION_DURATION_POLICY.buffDebuff.short,
          stackRule: StackRule.REFRESH_DURATION,
          tags: [GameplayTags.BUFF.TYPE.BUFF],
          statusTags: [GameplayTags.STATUS.CATEGORY.BUFF],
          modifiers: [
            {
              attrType: AttributeType.ATK,
              type: ModifierType.ADD,
              value: 0.2,
            },
            {
              attrType: AttributeType.CRIT_RATE,
              type: ModifierType.FIXED,
              value: 0.12,
            },
          ],
        },
        chance: 1,
      },
    },
  },

  // --- 潮息净身 ---
  {
    id: 'skill-rare-water-purifying-tide',
    displayName: '净潮',
    displayDescription: '驱散自身最多 4 层负面状态',
    category: 'skill_rare',
    rarity: 'rare',
    match: {
      all: [
        ELEMENT_TO_MATERIAL_TAG['水'],
        CreationTags.MATERIAL.TYPE_SPECIAL,
      ],
      any: [
        CreationTags.MATERIAL.SEMANTIC_WATER,
        CreationTags.MATERIAL.SEMANTIC_SPIRIT,
        CreationTags.MATERIAL.SEMANTIC_DIVINE,
        CreationTags.MATERIAL.SEMANTIC_SUSTAIN,
      ],
    },
    exclusiveGroup: EXCLUSIVE_GROUP.SKILL.RARE_ULTIMATE,
    weight: 20,
    energyCost: 39,
    applicableTo: ['skill'],
    targetPolicyConstraint: { team: 'self' },
    effectTemplate: {
      type: 'dispel',
      params: {
        targetTag: GameplayTags.BUFF.TYPE.DEBUFF,
        maxCount: 4,
      },
    },
  },

  // --- 木灵回春 ---
  {
    id: 'skill-rare-wood-spring-return',
    displayName: '回春',
    displayDescription: '施放时大量回复自身气血',
    category: 'skill_rare',
    rarity: 'legendary',
    match: {
      all: [
        ELEMENT_TO_MATERIAL_TAG['木'],
        CreationTags.MATERIAL.TYPE_SPECIAL,
      ],
      any: [
        CreationTags.MATERIAL.SEMANTIC_WOOD,
        CreationTags.MATERIAL.SEMANTIC_LIFE,
        CreationTags.MATERIAL.SEMANTIC_SUSTAIN,
        CreationTags.MATERIAL.TYPE_HERB,
      ],
    },
    exclusiveGroup: EXCLUSIVE_GROUP.SKILL.RARE_ULTIMATE,
    weight: 6,
    energyCost: 46,
    applicableTo: ['skill'],
    targetPolicyConstraint: { team: 'self' },
    grantedAbilityTags: [GameplayTags.ABILITY.FUNCTION.HEAL],
    effectTemplate: {
      type: 'heal',
      params: {
        value: {
          base: { base: 40, scale: 'quality', coefficient: 9 },
          attribute: AttributeType.SPIRIT,
          coefficient: 0.45,
        },
      },
    },
  },

  // --- 镇垒护身 ---
  {
    id: 'skill-rare-earth-rampart',
    displayName: '镇垒',
    displayDescription: '施放时为自身生成高额护盾',
    category: 'skill_rare',
    rarity: 'legendary',
    match: {
      all: [
        ELEMENT_TO_MATERIAL_TAG['土'],
        CreationTags.MATERIAL.TYPE_SPECIAL,
      ],
      any: [
        CreationTags.MATERIAL.SEMANTIC_EARTH,
        CreationTags.MATERIAL.SEMANTIC_GUARD,
        CreationTags.MATERIAL.TYPE_ORE,
      ],
    },
    exclusiveGroup: EXCLUSIVE_GROUP.SKILL.RARE_ULTIMATE,
    weight: 5,
    energyCost: 48,
    applicableTo: ['skill'],
    targetPolicyConstraint: { team: 'self' },
    grantedAbilityTags: [GameplayTags.ABILITY.FUNCTION.BUFF],
    effectTemplate: {
      type: 'shield',
      params: {
        value: {
          base: { base: 28, scale: 'quality', coefficient: 8 },
          attribute: AttributeType.SPIRIT,
          coefficient: 0.55,
        },
      },
    },
  },
];
