/*
 * 灵能消耗平衡规则 (Energy Cost Balance Rule - V2):
 * 1. 核心池 (Core/Panel): 8 ~ 15 点。作为基础底盘，保证产物基本强度。
 * 2. 变体池 (Variant/School/Defense): 12 ~ 20 点。主要能量吸收点，定义流派特色。
 * 3. 稀有池 (Rare/Secret/Treasure): 35 ~ 55 点。顶级消耗项，吸收神品材料溢出能量，产出质变效果。
 *
 * PBU 换算逻辑：PBU = (∑词缀消耗 * 类别系数 * 效率加成) * 品质乘数 + 极品奖励。
 */
import { DamageType } from '@shared/engine/battle-v5/core/types';
import {
  CreationTags,
  ELEMENT_TO_RUNTIME_ABILITY_TAG,
  GameplayTags,
} from '@shared/engine/shared/tag-domain';
import { CREATION_LISTENER_PRIORITIES } from '../../config/CreationBalance';
import { ELEMENT_TO_MATERIAL_TAG } from '../../config/CreationMappings';
import {
  AttributeType,
  BuffType,
  ModifierType,
  StackRule,
} from '../../contracts/battle';
import { EXCLUSIVE_GROUP } from '../exclusiveGroups';
import { AffixDefinition } from '../types';

export const ARTIFACT_AFFIXES: AffixDefinition[] = [
  // ================================================================
  // ===== ARTIFACT_PANEL 池 — 面板属性（装备槽绑定 + 通用固定值）
  // ================================================================

  // --- 3 种装备槽绑定核心 ---
  {
    id: 'artifact-panel-weapon-dual-atk',
    displayName: '基础攻击',
    displayDescription: '提升攻击与法术攻击',
    slot: 'core',
    rarity: 'common',
    match: {},
    exclusiveGroup: EXCLUSIVE_GROUP.ARTIFACT.PANEL_SLOT_WEAPON,
    weight: 100,
    energyCost: 5,
    applicableTo: ['artifact'],
    applicableArtifactSlots: ['weapon'],
    effectTemplate: {
      type: 'attribute_modifier',
      params: {
        modifiers: [
          {
            attrType: AttributeType.ATK,
            modType: ModifierType.FIXED,
            value: { base: 6, scale: 'quality', coefficient: 2.5 },
          },
          {
            attrType: AttributeType.MAGIC_ATK,
            modType: ModifierType.FIXED,
            value: { base: 6, scale: 'quality', coefficient: 2.5 },
          },
        ],
      },
    },
  },
  {
    id: 'artifact-panel-armor-dual-def',
    displayName: '基础防御',
    displayDescription: '提升防御与法术防御',
    slot: 'core',
    rarity: 'common',
    match: {},
    exclusiveGroup: EXCLUSIVE_GROUP.ARTIFACT.PANEL_SLOT_ARMOR,
    weight: 100,
    energyCost: 5,
    applicableTo: ['artifact'],
    applicableArtifactSlots: ['armor'],
    effectTemplate: {
      type: 'attribute_modifier',
      params: {
        modifiers: [
          {
            attrType: AttributeType.DEF,
            modType: ModifierType.FIXED,
            value: { base: 7, scale: 'quality', coefficient: 3 },
          },
          {
            attrType: AttributeType.MAGIC_DEF,
            modType: ModifierType.FIXED,
            value: { base: 7, scale: 'quality', coefficient: 3 },
          },
        ],
      },
    },
  },
  {
    id: 'artifact-panel-accessory-utility',
    displayName: '基础属性',
    displayDescription: '随机提升 2 项基础战斗属性',
    slot: 'core',
    rarity: 'common',
    match: {},
    exclusiveGroup: EXCLUSIVE_GROUP.ARTIFACT.PANEL_SLOT_ACCESSORY,
    weight: 100,
    energyCost: 5,
    applicableTo: ['artifact'],
    applicableArtifactSlots: ['accessory'],
    effectTemplate: {
      type: 'random_attribute_modifier',
      params: {
        pickCount: 2,
        pool: [
          {
            attrType: AttributeType.CRIT_RATE,
            modType: ModifierType.FIXED,
            value: { base: 0.02, scale: 'quality', coefficient: 0.008 },
          },
          {
            attrType: AttributeType.CRIT_DAMAGE_MULT,
            modType: ModifierType.FIXED,
            value: { base: 0.04, scale: 'quality', coefficient: 0.016 },
          },
          {
            attrType: AttributeType.EVASION_RATE,
            modType: ModifierType.FIXED,
            value: { base: 0.02, scale: 'quality', coefficient: 0.008 },
          },
          {
            attrType: AttributeType.CONTROL_HIT,
            modType: ModifierType.FIXED,
            value: { base: 0.02, scale: 'quality', coefficient: 0.008 },
          },
          {
            attrType: AttributeType.CONTROL_RESISTANCE,
            modType: ModifierType.FIXED,
            value: { base: 0.02, scale: 'quality', coefficient: 0.008 },
          },
          {
            attrType: AttributeType.ARMOR_PENETRATION,
            modType: ModifierType.FIXED,
            value: { base: 0.02, scale: 'quality', coefficient: 0.008 },
          },
          {
            attrType: AttributeType.MAGIC_PENETRATION,
            modType: ModifierType.FIXED,
            value: { base: 0.02, scale: 'quality', coefficient: 0.008 },
          },
          {
            attrType: AttributeType.CRIT_RESIST,
            modType: ModifierType.FIXED,
            value: { base: 0.02, scale: 'quality', coefficient: 0.008 },
          },
          {
            attrType: AttributeType.CRIT_DAMAGE_REDUCTION,
            modType: ModifierType.FIXED,
            value: { base: 0.02, scale: 'quality', coefficient: 0.008 },
          },
          {
            attrType: AttributeType.ACCURACY,
            modType: ModifierType.FIXED,
            value: { base: 0.02, scale: 'quality', coefficient: 0.008 },
          },
          {
            attrType: AttributeType.HEAL_AMPLIFY,
            modType: ModifierType.FIXED,
            value: { base: 0.02, scale: 'quality', coefficient: 0.008 },
          },
        ],
      },
    },
  },

  // --- 通用固定值面板（20 种） ---
  {
    id: 'artifact-panel-atk',
    displayName: '锋锐',
    displayDescription: '提升攻击',
    slot: 'identity',
    rarity: 'common',
    match: {
      all: [CreationTags.MATERIAL.SEMANTIC_BLADE],
      any: [
        CreationTags.MATERIAL.SEMANTIC_METAL,
        CreationTags.MATERIAL.SEMANTIC_BEAST,
      ],
    },
    weight: 80,
    energyCost: 10,
    applicableTo: ['artifact'],
    applicableArtifactSlots: ['weapon', 'accessory'],
    effectTemplate: {
      type: 'attribute_modifier',
      params: {
        attrType: AttributeType.ATK,
        modType: ModifierType.FIXED,
        value: { base: 3, scale: 'quality', coefficient: 1.2 },
      },
    },
  },
  {
    id: 'artifact-panel-magic-atk',
    displayName: '聚灵',
    displayDescription: '提升法术攻击',
    slot: 'identity',
    rarity: 'common',
    match: {
      all: [CreationTags.MATERIAL.SEMANTIC_SPIRIT],
      any: [
        CreationTags.MATERIAL.SEMANTIC_QI,
        CreationTags.MATERIAL.SEMANTIC_FORMATION,
      ],
    },
    weight: 80,
    energyCost: 10,
    applicableTo: ['artifact'],
    applicableArtifactSlots: ['weapon', 'accessory'],
    effectTemplate: {
      type: 'attribute_modifier',
      params: {
        attrType: AttributeType.MAGIC_ATK,
        modType: ModifierType.FIXED,
        value: { base: 3, scale: 'quality', coefficient: 1.2 },
      },
    },
  },
  {
    id: 'artifact-panel-def',
    displayName: '铁壁',
    displayDescription: '提升防御',
    slot: 'identity',
    rarity: 'common',
    match: {
      all: [CreationTags.MATERIAL.SEMANTIC_GUARD],
      any: [
        CreationTags.MATERIAL.TYPE_ORE,
        CreationTags.MATERIAL.SEMANTIC_METAL,
      ],
    },
    weight: 65,
    energyCost: 10,
    applicableTo: ['artifact'],
    applicableArtifactSlots: ['armor', 'accessory'],
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
    id: 'artifact-panel-magic-def',
    displayName: '御法',
    displayDescription: '提升法术防御',
    slot: 'identity',
    rarity: 'common',
    match: {
      all: [CreationTags.MATERIAL.SEMANTIC_GUARD],
      any: [
        CreationTags.MATERIAL.SEMANTIC_SPIRIT,
        CreationTags.MATERIAL.SEMANTIC_WATER,
      ],
    },
    weight: 60,
    energyCost: 10,
    applicableTo: ['artifact'],
    applicableArtifactSlots: ['armor', 'accessory'],
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
    id: 'artifact-panel-crit-rate',
    displayName: '会心',
    displayDescription: '提升暴击几率',
    slot: 'identity',
    rarity: 'uncommon',
    match: {
      all: [CreationTags.MATERIAL.SEMANTIC_BURST],
      any: [
        CreationTags.MATERIAL.SEMANTIC_ILLUSION,
        CreationTags.MATERIAL.SEMANTIC_FORMATION,
      ],
    },
    weight: 50,
    energyCost: 16,
    applicableTo: ['artifact'],
    applicableArtifactSlots: ['weapon', 'accessory'],
    effectTemplate: {
      type: 'attribute_modifier',
      params: {
        attrType: AttributeType.CRIT_RATE,
        modType: ModifierType.FIXED,
        value: { base: 0.02, scale: 'quality', coefficient: 0.008 },
      },
    },
  },
  {
    id: 'artifact-panel-crit-dmg',
    displayName: '裂星',
    displayDescription: '提升暴击伤害',
    slot: 'identity',
    rarity: 'uncommon',
    match: {
      all: [CreationTags.MATERIAL.SEMANTIC_BURST],
      any: [
        CreationTags.MATERIAL.SEMANTIC_BLADE,
        CreationTags.MATERIAL.SEMANTIC_BONE,
      ],
    },
    weight: 45,
    energyCost: 16,
    applicableTo: ['artifact'],
    applicableArtifactSlots: ['weapon', 'accessory'],
    effectTemplate: {
      type: 'attribute_modifier',
      params: {
        attrType: AttributeType.CRIT_DAMAGE_MULT,
        modType: ModifierType.FIXED,
        value: { base: 0.04, scale: 'quality', coefficient: 0.015 },
      },
    },
  },
  {
    id: 'artifact-panel-accuracy',
    displayName: '灵瞳',
    displayDescription: '提升命中率',
    slot: 'identity',
    rarity: 'common',
    match: {
      all: [CreationTags.MATERIAL.SEMANTIC_SPIRIT],
      any: [
        CreationTags.MATERIAL.SEMANTIC_WIND,
        CreationTags.MATERIAL.SEMANTIC_FORMATION,
      ],
    },
    weight: 50,
    energyCost: 10,
    applicableTo: ['artifact'],
    applicableArtifactSlots: ['weapon', 'accessory'],
    effectTemplate: {
      type: 'attribute_modifier',
      params: {
        attrType: AttributeType.ACCURACY,
        modType: ModifierType.FIXED,
        value: { base: 0.02, scale: 'quality', coefficient: 0.008 },
      },
    },
  },
  {
    id: 'artifact-panel-dodge',
    displayName: '无影',
    displayDescription: '提升闪避率',
    slot: 'identity',
    rarity: 'common',
    match: {
      all: [CreationTags.MATERIAL.SEMANTIC_ILLUSION],
      any: [
        CreationTags.MATERIAL.SEMANTIC_WIND,
        CreationTags.MATERIAL.SEMANTIC_SPACE,
      ],
    },
    weight: 45,
    energyCost: 10,
    applicableTo: ['artifact'],
    applicableArtifactSlots: ['armor', 'accessory'],
    effectTemplate: {
      type: 'attribute_modifier',
      params: {
        attrType: AttributeType.EVASION_RATE,
        modType: ModifierType.FIXED,
        value: { base: 0.015, scale: 'quality', coefficient: 0.006 },
      },
    },
  },
  {
    id: 'artifact-panel-control-hit',
    displayName: '镇魂',
    displayDescription: '提升控制命中',
    slot: 'identity',
    rarity: 'uncommon',
    match: {
      all: [CreationTags.MATERIAL.SEMANTIC_ILLUSION],
      any: [
        CreationTags.MATERIAL.SEMANTIC_THUNDER,
        CreationTags.MATERIAL.SEMANTIC_FREEZE,
      ],
    },
    weight: 40,
    energyCost: 15,
    applicableTo: ['artifact'],
    applicableArtifactSlots: ['weapon', 'accessory'],
    effectTemplate: {
      type: 'attribute_modifier',
      params: {
        attrType: AttributeType.CONTROL_HIT,
        modType: ModifierType.FIXED,
        value: { base: 0.02, scale: 'quality', coefficient: 0.008 },
      },
    },
  },
  {
    id: 'artifact-panel-control-resistance',
    displayName: '明心',
    displayDescription: '提升控制抗性',
    slot: 'identity',
    rarity: 'uncommon',
    match: {
      all: [CreationTags.MATERIAL.SEMANTIC_DIVINE],
      any: [
        CreationTags.MATERIAL.SEMANTIC_GUARD,
        CreationTags.MATERIAL.SEMANTIC_EARTH,
      ],
    },
    weight: 40,
    energyCost: 15,
    applicableTo: ['artifact'],
    applicableArtifactSlots: ['armor', 'accessory'],
    effectTemplate: {
      type: 'attribute_modifier',
      params: {
        attrType: AttributeType.CONTROL_RESISTANCE,
        modType: ModifierType.FIXED,
        value: { base: 0.02, scale: 'quality', coefficient: 0.008 },
      },
    },
  },
  {
    id: 'artifact-panel-spirit',
    displayName: '蕴灵',
    displayDescription: '提升灵力属性',
    slot: 'identity',
    rarity: 'common',
    match: {
      all: [CreationTags.MATERIAL.SEMANTIC_SPIRIT],
      any: [
        CreationTags.MATERIAL.SEMANTIC_QI,
        CreationTags.MATERIAL.SEMANTIC_LIFE,
      ],
    },
    weight: 55,
    energyCost: 10,
    applicableTo: ['artifact'],
    applicableArtifactSlots: ['weapon', 'armor', 'accessory'],
    effectTemplate: {
      type: 'attribute_modifier',
      params: {
        attrType: AttributeType.SPIRIT,
        modType: ModifierType.FIXED,
        value: { base: 2, scale: 'quality', coefficient: 0.8 },
      },
    },
  },
  {
    id: 'artifact-panel-vitality',
    displayName: '淬体',
    displayDescription: '提升体魄属性',
    slot: 'identity',
    rarity: 'common',
    match: {
      all: [CreationTags.MATERIAL.SEMANTIC_SUSTAIN],
      any: [
        CreationTags.MATERIAL.SEMANTIC_BLOOD,
        CreationTags.MATERIAL.SEMANTIC_LIFE,
      ],
    },
    weight: 55,
    energyCost: 10,
    applicableTo: ['artifact'],
    applicableArtifactSlots: ['armor', 'accessory'],
    effectTemplate: {
      type: 'attribute_modifier',
      params: {
        attrType: AttributeType.VITALITY,
        modType: ModifierType.FIXED,
        value: { base: 2, scale: 'quality', coefficient: 0.8 },
      },
    },
  },
  {
    id: 'artifact-panel-wisdom',
    displayName: '开智',
    displayDescription: '提升悟性属性',
    slot: 'identity',
    rarity: 'common',
    match: {
      all: [CreationTags.MATERIAL.SEMANTIC_MANUAL],
      any: [
        CreationTags.MATERIAL.SEMANTIC_DIVINE,
        CreationTags.MATERIAL.SEMANTIC_FORMATION,
      ],
    },
    weight: 45,
    energyCost: 10,
    applicableTo: ['artifact'],
    applicableArtifactSlots: ['weapon', 'armor', 'accessory'],
    effectTemplate: {
      type: 'attribute_modifier',
      params: {
        attrType: AttributeType.WISDOM,
        modType: ModifierType.FIXED,
        value: { base: 2, scale: 'quality', coefficient: 0.8 },
      },
    },
  },
  {
    id: 'artifact-panel-willpower',
    displayName: '凝神',
    displayDescription: '提升意志属性',
    slot: 'identity',
    rarity: 'common',
    match: {
      all: [CreationTags.MATERIAL.SEMANTIC_DIVINE],
      any: [
        CreationTags.MATERIAL.SEMANTIC_SPIRIT,
        CreationTags.MATERIAL.SEMANTIC_GUARD,
      ],
    },
    weight: 40,
    energyCost: 10,
    applicableTo: ['artifact'],
    applicableArtifactSlots: ['weapon', 'armor', 'accessory'],
    effectTemplate: {
      type: 'attribute_modifier',
      params: {
        attrType: AttributeType.WILLPOWER,
        modType: ModifierType.FIXED,
        value: { base: 2, scale: 'quality', coefficient: 0.8 },
      },
    },
  },
  {
    id: 'artifact-panel-speed',
    displayName: '乘风',
    displayDescription: '提升速度属性',
    slot: 'identity',
    rarity: 'common',
    match: {
      all: [CreationTags.MATERIAL.SEMANTIC_WIND],
      any: [
        CreationTags.MATERIAL.SEMANTIC_SPACE,
        CreationTags.MATERIAL.SEMANTIC_BEAST,
      ],
    },
    weight: 60,
    energyCost: 10,
    applicableTo: ['artifact'],
    applicableArtifactSlots: ['weapon', 'armor', 'accessory'],
    effectTemplate: {
      type: 'attribute_modifier',
      params: {
        attrType: AttributeType.SPEED,
        modType: ModifierType.FIXED,
        value: { base: 2, scale: 'quality', coefficient: 0.8 },
      },
    },
  },

  // ================================================================
  // ===== ARTIFACT_DEFENSE 池 — 防守 / 反制 / 保命
  // ================================================================

  // --- 反伤荆棘 ---
  {
    id: 'artifact-defense-reflect-thorns',
    displayName: '反噬',
    displayDescription: '受击时，有概率反震敌人',
    slot: 'modifier',
    rarity: 'uncommon',
    match: {
      all: [CreationTags.MATERIAL.SEMANTIC_GUARD],
      any: [
        CreationTags.MATERIAL.SEMANTIC_METAL,
        CreationTags.MATERIAL.SEMANTIC_BLADE,
        CreationTags.MATERIAL.SEMANTIC_BONE,
      ],
    },
    weight: 50,
    energyCost: 18,
    applicableTo: ['artifact'],
    applicableArtifactSlots: ['armor'],
    effectTemplate: {
      type: 'reflect',
      conditions: [{ type: 'chance', params: { value: 0.3 } }],
      params: {
        ratio: { base: 0.12, scale: 'quality', coefficient: 0.06 },
      },
    },
    listenerSpec: {
      eventType: GameplayTags.EVENT.DAMAGE_TAKEN,
      scope: GameplayTags.SCOPE.OWNER_AS_TARGET,
      priority: CREATION_LISTENER_PRIORITIES.damageTaken,
    },
  },

  // --- 濒死保命 ---
  {
    id: 'artifact-defense-death-prevent',
    displayName: '替身纸人',
    displayDescription: '受到致命伤害时免于死亡',
    slot: 'modifier',
    rarity: 'rare',
    match: {
      all: [CreationTags.MATERIAL.TYPE_SPECIAL],
      any: [
        CreationTags.MATERIAL.SEMANTIC_SUSTAIN,
        CreationTags.MATERIAL.SEMANTIC_LIFE,
        CreationTags.MATERIAL.SEMANTIC_DIVINE,
      ],
    },
    weight: 20,
    energyCost: 38,
    applicableTo: ['artifact'],
    applicableArtifactSlots: ['armor'],
    effectTemplate: {
      type: 'death_prevent',
      params: {},
    },
    listenerSpec: {
      eventType: GameplayTags.EVENT.DAMAGE_TAKEN,
      scope: GameplayTags.SCOPE.OWNER_AS_TARGET,
      priority: CREATION_LISTENER_PRIORITIES.damageTaken,
    },
  },

  // --- 低血护盾 ---
  {
    id: 'artifact-defense-last-stand-shell',
    displayName: '灵壁',
    displayDescription: '自身气血低于 30% 时，受击有概率生成护盾',
    slot: 'modifier',
    rarity: 'uncommon',
    match: {
      all: [CreationTags.MATERIAL.SEMANTIC_GUARD],
      any: [
        CreationTags.MATERIAL.SEMANTIC_SUSTAIN,
        CreationTags.MATERIAL.SEMANTIC_EARTH,
        CreationTags.MATERIAL.SEMANTIC_LIFE,
      ],
    },
    weight: 40,
    energyCost: 16,
    applicableTo: ['artifact'],
    applicableArtifactSlots: ['armor', 'accessory'],
    effectTemplate: {
      type: 'shield',
      conditions: [
        { type: 'hp_below', params: { value: 0.3 } },
        { type: 'chance', params: { value: 0.3 } },
      ],
      params: {
        value: {
          attribute: AttributeType.SPIRIT,
          coefficient: 1,
        },
      },
    },
    listenerSpec: {
      eventType: GameplayTags.EVENT.DAMAGE_TAKEN,
      scope: GameplayTags.SCOPE.OWNER_AS_TARGET,
      priority: CREATION_LISTENER_PRIORITIES.damageTaken,
    },
  },

  // --- 被动护甲 ---
  {
    id: 'artifact-defense-armor-passive',
    displayName: '坚甲',
    displayDescription: '降低受到的伤害',
    slot: 'modifier',
    rarity: 'common',
    match: {
      all: [CreationTags.MATERIAL.SEMANTIC_GUARD],
      any: [
        CreationTags.MATERIAL.SEMANTIC_METAL,
        CreationTags.MATERIAL.SEMANTIC_EARTH,
        CreationTags.MATERIAL.TYPE_ORE,
      ],
    },
    weight: 55,
    energyCost: 12,
    applicableTo: ['artifact'],
    applicableArtifactSlots: ['armor'],
    effectTemplate: {
      type: 'percent_damage_modifier',
      params: {
        mode: 'reduce',
        value: { base: 0.01, scale: 'quality', coefficient: 0.01 },
        cap: 0.3,
      },
    },
    listenerSpec: {
      eventType: GameplayTags.EVENT.DAMAGE_REQUEST,
      scope: GameplayTags.SCOPE.OWNER_AS_TARGET,
      priority: CREATION_LISTENER_PRIORITIES.damageRequest,
    },
  },

  // --- 回合回蓝 ---
  {
    id: 'artifact-defense-mana-recovery',
    displayName: '灵泉',
    displayDescription: '每回合回复灵力',
    slot: 'modifier',
    rarity: 'uncommon',
    match: {
      all: [CreationTags.MATERIAL.SEMANTIC_SPIRIT],
      any: [
        CreationTags.MATERIAL.SEMANTIC_QI,
        CreationTags.MATERIAL.TYPE_HERB,
        CreationTags.MATERIAL.SEMANTIC_WATER,
      ],
    },
    weight: 33,
    energyCost: 18,
    applicableTo: ['artifact'],
    applicableArtifactSlots: ['weapon', 'accessory'],
    grantedAbilityTags: [GameplayTags.ABILITY.FUNCTION.HEAL],
    effectTemplate: {
      type: 'heal',
      params: {
        target: 'mp',
        value: {
          attribute: AttributeType.SPIRIT,
          coefficient: 0.8,
        },
      },
    },
    listenerSpec: {
      eventType: GameplayTags.EVENT.ROUND_PRE,
      scope: GameplayTags.SCOPE.GLOBAL,
      priority: CREATION_LISTENER_PRIORITIES.roundPre,
    },
  },

  // ================================================================
  // ===== ARTIFACT_WEAPON 池 — 武器专属命中附带 / 器物反应
  // ================================================================

  {
    id: 'artifact-weapon-blood-drinker',
    displayName: '饮血',
    displayDescription: '造成伤害后，将部分伤害转化为气血',
    slot: 'modifier',
    rarity: 'uncommon',
    match: {
      all: [CreationTags.MATERIAL.SEMANTIC_BLADE],
      any: [
        CreationTags.MATERIAL.SEMANTIC_BLOOD,
        CreationTags.MATERIAL.SEMANTIC_BEAST,
        CreationTags.MATERIAL.SEMANTIC_BONE,
      ],
    },
    weight: 34,
    energyCost: 18,
    applicableTo: ['artifact'],
    applicableArtifactSlots: ['weapon'],
    effectTemplate: {
      type: 'resource_drain',
      conditions: [
        {
          type: 'damage_type_is',
          params: { damageType: DamageType.PHYSICAL },
        },
      ],
      params: {
        sourceType: 'hp',
        targetType: 'hp',
        ratio: { base: 0.08, scale: 'quality', coefficient: 0.018, max: 0.22 },
      },
    },
    listenerSpec: {
      eventType: GameplayTags.EVENT.DAMAGE_TAKEN,
      scope: GameplayTags.SCOPE.OWNER_AS_CASTER,
      priority: CREATION_LISTENER_PRIORITIES.damageTaken,
      guard: { skipReflectSource: true },
    },
  },
  {
    id: 'artifact-weapon-soul-siphon',
    displayName: '摄魂',
    displayDescription: '法术造成伤害后，将部分伤害转化为法力',
    slot: 'modifier',
    rarity: 'rare',
    match: {
      all: [CreationTags.MATERIAL.SEMANTIC_SPIRIT],
      any: [
        CreationTags.MATERIAL.SEMANTIC_DIVINE,
        CreationTags.MATERIAL.SEMANTIC_ILLUSION,
        CreationTags.MATERIAL.SEMANTIC_QI,
      ],
    },
    weight: 18,
    energyCost: 26,
    applicableTo: ['artifact'],
    applicableArtifactSlots: ['weapon'],
    grantedAbilityTags: [GameplayTags.TRAIT.MANA_THIEF],
    effectTemplate: {
      type: 'resource_drain',
      conditions: [
        {
          type: 'ability_has_tag',
          params: { tag: GameplayTags.ABILITY.CHANNEL.MAGIC },
        },
      ],
      params: {
        sourceType: 'hp',
        targetType: 'mp',
        ratio: { base: 0.1, scale: 'quality', coefficient: 0.02, max: 0.26 },
      },
    },
    listenerSpec: {
      eventType: GameplayTags.EVENT.DAMAGE_TAKEN,
      scope: GameplayTags.SCOPE.OWNER_AS_CASTER,
      priority: CREATION_LISTENER_PRIORITIES.damageTaken,
      guard: { skipReflectSource: true },
    },
  },
  {
    id: 'artifact-weapon-spirit-breaking-awl',
    displayName: '破灵锥',
    displayDescription: '物理命中后削减目标法力',
    slot: 'modifier',
    rarity: 'uncommon',
    match: {
      all: [CreationTags.MATERIAL.SEMANTIC_METAL],
      any: [
        CreationTags.MATERIAL.SEMANTIC_BLADE,
        CreationTags.MATERIAL.SEMANTIC_SPIRIT,
        CreationTags.MATERIAL.SEMANTIC_REFINING,
      ],
    },
    weight: 26,
    energyCost: 20,
    applicableTo: ['artifact'],
    applicableArtifactSlots: ['weapon'],
    effectTemplate: {
      type: 'mana_burn',
      conditions: [
        {
          type: 'damage_type_is',
          params: { damageType: DamageType.PHYSICAL },
        },
      ],
      params: {
        value: {
          attribute: AttributeType.ATK,
          coefficient: 0.16,
          targetMaxMpRatio: {
            base: 0.02,
            scale: 'quality',
            coefficient: 0.004,
            max: 0.05,
          },
        },
      },
    },
    listenerSpec: {
      eventType: GameplayTags.EVENT.DAMAGE_TAKEN,
      scope: GameplayTags.SCOPE.OWNER_AS_CASTER,
      priority: CREATION_LISTENER_PRIORITIES.damageTaken,
      guard: { skipReflectSource: true },
    },
  },
  {
    id: 'artifact-weapon-ban-breaking-edge',
    displayName: '破禁刃',
    displayDescription: '命中后有概率驱散目标正面状态',
    slot: 'modifier',
    rarity: 'rare',
    match: {
      all: [CreationTags.MATERIAL.SEMANTIC_FORMATION],
      any: [
        CreationTags.MATERIAL.SEMANTIC_BLADE,
        CreationTags.MATERIAL.SEMANTIC_METAL,
        CreationTags.MATERIAL.SEMANTIC_REFINING,
      ],
    },
    weight: 15,
    energyCost: 30,
    applicableTo: ['artifact'],
    applicableArtifactSlots: ['weapon'],
    grantedAbilityTags: [GameplayTags.ABILITY.FUNCTION.BUFF],
    effectTemplate: {
      type: 'dispel',
      conditions: [{ type: 'chance', params: { value: 0.25 } }],
      params: {
        targetTag: GameplayTags.BUFF.TYPE.BUFF,
        maxCount: 1,
      },
    },
    listenerSpec: {
      eventType: GameplayTags.EVENT.DAMAGE_TAKEN,
      scope: GameplayTags.SCOPE.OWNER_AS_CASTER,
      priority: CREATION_LISTENER_PRIORITIES.damageTaken + 1,
      guard: { skipReflectSource: true },
    },
  },
  {
    id: 'artifact-weapon-shield-rending-edge',
    displayName: '裂盾锋',
    displayDescription: '攻击有护盾的目标时，提升本次伤害',
    slot: 'modifier',
    rarity: 'rare',
    match: {
      all: [CreationTags.MATERIAL.SEMANTIC_BLADE],
      any: [
        CreationTags.MATERIAL.SEMANTIC_GUARD,
        CreationTags.MATERIAL.SEMANTIC_METAL,
        CreationTags.MATERIAL.SEMANTIC_BONE,
      ],
    },
    weight: 16,
    energyCost: 30,
    applicableTo: ['artifact'],
    applicableArtifactSlots: ['weapon'],
    effectTemplate: {
      type: 'percent_damage_modifier',
      conditions: [{ type: 'has_shield', params: { scope: 'target' } }],
      params: {
        mode: 'increase',
        value: { base: 0.1, scale: 'quality', coefficient: 0.018 },
        cap: 0.3,
      },
    },
    listenerSpec: {
      eventType: GameplayTags.EVENT.DAMAGE_REQUEST,
      scope: GameplayTags.SCOPE.OWNER_AS_CASTER,
      priority: CREATION_LISTENER_PRIORITIES.damageRequest,
    },
  },
  {
    id: 'artifact-weapon-soul-falling-nail',
    displayName: '落魂钉',
    displayDescription: '暴击命中后，有概率封禁目标神通',
    slot: 'modifier',
    rarity: 'legendary',
    match: {
      all: [CreationTags.MATERIAL.SEMANTIC_SPIRIT],
      any: [
        CreationTags.MATERIAL.SEMANTIC_BONE,
        CreationTags.MATERIAL.SEMANTIC_FORMATION,
        CreationTags.MATERIAL.TYPE_SPECIAL,
      ],
    },
    exclusiveGroup: EXCLUSIVE_GROUP.ARTIFACT.TREASURE_ULTIMATE,
    weight: 6,
    energyCost: 44,
    applicableTo: ['artifact'],
    applicableArtifactSlots: ['weapon'],
    grantedAbilityTags: [GameplayTags.ABILITY.FUNCTION.CONTROL],
    effectTemplate: {
      type: 'ability_lock',
      conditions: [
        { type: 'is_critical', params: { scope: 'caster' } },
        { type: 'chance', params: { value: 0.28 } },
      ],
      params: {
        rounds: { base: 1, scale: 'quality', coefficient: 0, max: 1 },
        maxCount: 1,
      },
    },
    listenerSpec: {
      eventType: GameplayTags.EVENT.DAMAGE_TAKEN,
      scope: GameplayTags.SCOPE.OWNER_AS_CASTER,
      priority: CREATION_LISTENER_PRIORITIES.damageTaken + 2,
      guard: { skipReflectSource: true },
    },
  },

  // --- 法力护盾 ---
  {
    id: 'artifact-defense-magic-shield',
    displayName: '法力护盾',
    displayDescription: '受击时优先以灵力抵挡部分伤害',
    slot: 'modifier',
    rarity: 'rare',
    match: {
      all: [CreationTags.MATERIAL.SEMANTIC_SPIRIT],
      any: [
        CreationTags.MATERIAL.SEMANTIC_GUARD,
        CreationTags.MATERIAL.SEMANTIC_QI,
        CreationTags.MATERIAL.SEMANTIC_WATER,
      ],
    },
    weight: 12,
    energyCost: 35,
    applicableTo: ['artifact'],
    applicableArtifactSlots: ['accessory'],
    effectTemplate: {
      type: 'magic_shield',
      params: {
        absorbRatio: { base: 0.5, scale: 'quality', coefficient: 0.48 / 8 },
      },
    },
    listenerSpec: {
      eventType: GameplayTags.EVENT.DAMAGE,
      scope: GameplayTags.SCOPE.OWNER_AS_TARGET,
      priority: CREATION_LISTENER_PRIORITIES.damageApply,
    },
  },

  // --- 负面清除 ---
  {
    id: 'artifact-defense-debuff-cleanse',
    displayName: '清浊',
    displayDescription: '受到伤害时，有概率清除一个负面状态',
    slot: 'modifier',
    rarity: 'uncommon',
    match: {
      all: [CreationTags.MATERIAL.SEMANTIC_SPIRIT],
      any: [
        CreationTags.MATERIAL.SEMANTIC_WATER,
        CreationTags.MATERIAL.SEMANTIC_DIVINE,
        CreationTags.MATERIAL.SEMANTIC_LIFE,
      ],
    },
    exclusiveGroup: EXCLUSIVE_GROUP.ARTIFACT.DEFENSE_CLEANSE,
    weight: 30,
    energyCost: 22,
    applicableTo: ['artifact'],
    applicableArtifactSlots: ['accessory'],
    effectTemplate: {
      type: 'dispel',
      conditions: [{ type: 'chance', params: { value: 0.25 } }],
      params: {
        targetTag: GameplayTags.BUFF.TYPE.DEBUFF,
        maxCount: 1,
      },
    },
    listenerSpec: {
      eventType: GameplayTags.EVENT.DAMAGE_TAKEN,
      scope: GameplayTags.SCOPE.OWNER_AS_TARGET,
      priority: CREATION_LISTENER_PRIORITIES.damageTaken,
    },
  },
  {
    id: 'artifact-defense-debuff-cleanse-per-round',
    displayName: '七宝玲珑心',
    displayDescription: '每回合有几率自动清除一个负面状态',
    slot: 'modifier',
    rarity: 'rare',
    match: {
      all: [CreationTags.MATERIAL.SEMANTIC_DIVINE],
      any: [
        CreationTags.MATERIAL.SEMANTIC_WATER,
        CreationTags.MATERIAL.SEMANTIC_GUARD,
        CreationTags.MATERIAL.SEMANTIC_LIFE,
      ],
    },
    exclusiveGroup: EXCLUSIVE_GROUP.ARTIFACT.DEFENSE_CLEANSE,
    weight: 20,
    energyCost: 36,
    applicableTo: ['artifact'],
    applicableArtifactSlots: ['accessory'],
    effectTemplate: {
      type: 'dispel',
      conditions: [{ type: 'chance', params: { value: 0.5 } }],
      params: {
        targetTag: GameplayTags.BUFF.TYPE.DEBUFF,
        maxCount: 1,
      },
    },
    listenerSpec: {
      eventType: GameplayTags.EVENT.ROUND_PRE,
      scope: GameplayTags.SCOPE.GLOBAL,
      priority: CREATION_LISTENER_PRIORITIES.roundPre,
    },
  },

  // --- 绝境护甲（低血减伤） ---
  {
    id: 'artifact-defense-desperate-aegis',
    displayName: '临危不惧',
    displayDescription: '自身气血低于 30% 时，降低受到的伤害',
    slot: 'modifier',
    rarity: 'uncommon',
    match: {
      all: [CreationTags.MATERIAL.SEMANTIC_GUARD],
      any: [
        CreationTags.MATERIAL.SEMANTIC_EARTH,
        CreationTags.MATERIAL.SEMANTIC_METAL,
        CreationTags.MATERIAL.SEMANTIC_BONE,
      ],
    },
    weight: 35,
    energyCost: 18,
    applicableTo: ['artifact'],
    applicableArtifactSlots: ['armor'],
    effectTemplate: {
      type: 'percent_damage_modifier',
      conditions: [{ type: 'hp_below', params: { value: 0.3 } }],
      params: {
        mode: 'reduce',
        value: { base: 0.12, scale: 'quality', coefficient: 0.03 },
        cap: 0.5,
      },
    },
    listenerSpec: {
      eventType: GameplayTags.EVENT.DAMAGE_REQUEST,
      scope: GameplayTags.SCOPE.OWNER_AS_TARGET,
      priority: CREATION_LISTENER_PRIORITIES.damageRequest,
    },
  },

  // --- 8 种元素减伤 ---
  {
    id: 'artifact-defense-fire-resist',
    displayName: '辟火',
    displayDescription: '降低受到的火系伤害',
    slot: 'modifier',
    rarity: 'common',
    match: {
      all: [CreationTags.MATERIAL.SEMANTIC_GUARD],
      any: [ELEMENT_TO_MATERIAL_TAG['水'], ELEMENT_TO_MATERIAL_TAG['冰']],
    },
    weight: 40,
    energyCost: 12,
    applicableTo: ['artifact'],
    applicableArtifactSlots: ['armor', 'accessory'],
    effectTemplate: {
      type: 'percent_damage_modifier',
      conditions: [
        {
          type: 'ability_has_tag',
          params: { tag: ELEMENT_TO_RUNTIME_ABILITY_TAG['火'] },
        },
      ],
      params: {
        mode: 'reduce',
        value: { base: 0.08, scale: 'quality', coefficient: 0.02 },
        cap: 0.5,
      },
    },
    listenerSpec: {
      eventType: GameplayTags.EVENT.DAMAGE_REQUEST,
      scope: GameplayTags.SCOPE.OWNER_AS_TARGET,
      priority: CREATION_LISTENER_PRIORITIES.damageRequest,
    },
  },
  {
    id: 'artifact-defense-ice-resist',
    displayName: '辟冰',
    displayDescription: '降低受到的冰系伤害',
    slot: 'modifier',
    rarity: 'common',
    match: {
      all: [CreationTags.MATERIAL.SEMANTIC_GUARD],
      any: [
        ELEMENT_TO_MATERIAL_TAG['火'],
        CreationTags.MATERIAL.SEMANTIC_FLAME,
      ],
    },
    weight: 38,
    energyCost: 12,
    applicableTo: ['artifact'],
    applicableArtifactSlots: ['armor', 'accessory'],
    effectTemplate: {
      type: 'percent_damage_modifier',
      conditions: [
        {
          type: 'ability_has_tag',
          params: { tag: ELEMENT_TO_RUNTIME_ABILITY_TAG['冰'] },
        },
      ],
      params: {
        mode: 'reduce',
        value: { base: 0.08, scale: 'quality', coefficient: 0.02 },
        cap: 0.5,
      },
    },
    listenerSpec: {
      eventType: GameplayTags.EVENT.DAMAGE_REQUEST,
      scope: GameplayTags.SCOPE.OWNER_AS_TARGET,
      priority: CREATION_LISTENER_PRIORITIES.damageRequest,
    },
  },
  {
    id: 'artifact-defense-thunder-resist',
    displayName: '辟雷',
    displayDescription: '降低受到的雷系伤害',
    slot: 'modifier',
    rarity: 'uncommon',
    match: {
      all: [CreationTags.MATERIAL.SEMANTIC_GUARD],
      any: [ELEMENT_TO_MATERIAL_TAG['木'], ELEMENT_TO_MATERIAL_TAG['土']],
    },
    weight: 36,
    energyCost: 16,
    applicableTo: ['artifact'],
    applicableArtifactSlots: ['armor', 'accessory'],
    effectTemplate: {
      type: 'percent_damage_modifier',
      conditions: [
        {
          type: 'ability_has_tag',
          params: { tag: ELEMENT_TO_RUNTIME_ABILITY_TAG['雷'] },
        },
      ],
      params: {
        mode: 'reduce',
        value: { base: 0.08, scale: 'quality', coefficient: 0.02 },
        cap: 0.5,
      },
    },
    listenerSpec: {
      eventType: GameplayTags.EVENT.DAMAGE_REQUEST,
      scope: GameplayTags.SCOPE.OWNER_AS_TARGET,
      priority: CREATION_LISTENER_PRIORITIES.damageRequest,
    },
  },
  {
    id: 'artifact-defense-wind-resist',
    displayName: '辟风',
    displayDescription: '降低受到的风系伤害',
    slot: 'modifier',
    rarity: 'uncommon',
    match: {
      all: [CreationTags.MATERIAL.SEMANTIC_GUARD],
      any: [ELEMENT_TO_MATERIAL_TAG['土'], ELEMENT_TO_MATERIAL_TAG['金']],
    },
    weight: 34,
    energyCost: 14,
    applicableTo: ['artifact'],
    applicableArtifactSlots: ['armor', 'accessory'],
    effectTemplate: {
      type: 'percent_damage_modifier',
      conditions: [
        {
          type: 'ability_has_tag',
          params: { tag: ELEMENT_TO_RUNTIME_ABILITY_TAG['风'] },
        },
      ],
      params: {
        mode: 'reduce',
        value: { base: 0.08, scale: 'quality', coefficient: 0.02 },
        cap: 0.5,
      },
    },
    listenerSpec: {
      eventType: GameplayTags.EVENT.DAMAGE_REQUEST,
      scope: GameplayTags.SCOPE.OWNER_AS_TARGET,
      priority: CREATION_LISTENER_PRIORITIES.damageRequest,
    },
  },
  {
    id: 'artifact-defense-metal-resist',
    displayName: '辟金',
    displayDescription: '降低受到的金系伤害',
    slot: 'modifier',
    rarity: 'common',
    match: {
      all: [CreationTags.MATERIAL.SEMANTIC_GUARD],
      any: [ELEMENT_TO_MATERIAL_TAG['火'], ELEMENT_TO_MATERIAL_TAG['水']],
    },
    weight: 32,
    energyCost: 12,
    applicableTo: ['artifact'],
    applicableArtifactSlots: ['armor', 'accessory'],
    effectTemplate: {
      type: 'percent_damage_modifier',
      conditions: [
        {
          type: 'ability_has_tag',
          params: { tag: ELEMENT_TO_RUNTIME_ABILITY_TAG['金'] },
        },
      ],
      params: {
        mode: 'reduce',
        value: { base: 0.08, scale: 'quality', coefficient: 0.02 },
        cap: 0.5,
      },
    },
    listenerSpec: {
      eventType: GameplayTags.EVENT.DAMAGE_REQUEST,
      scope: GameplayTags.SCOPE.OWNER_AS_TARGET,
      priority: CREATION_LISTENER_PRIORITIES.damageRequest,
    },
  },
  {
    id: 'artifact-defense-water-resist',
    displayName: '辟水',
    displayDescription: '降低受到的水系伤害',
    slot: 'modifier',
    rarity: 'common',
    match: {
      all: [CreationTags.MATERIAL.SEMANTIC_GUARD],
      any: [ELEMENT_TO_MATERIAL_TAG['土'], ELEMENT_TO_MATERIAL_TAG['木']],
    },
    weight: 30,
    energyCost: 12,
    applicableTo: ['artifact'],
    applicableArtifactSlots: ['armor', 'accessory'],
    effectTemplate: {
      type: 'percent_damage_modifier',
      conditions: [
        {
          type: 'ability_has_tag',
          params: { tag: ELEMENT_TO_RUNTIME_ABILITY_TAG['水'] },
        },
      ],
      params: {
        mode: 'reduce',
        value: { base: 0.08, scale: 'quality', coefficient: 0.02 },
        cap: 0.5,
      },
    },
    listenerSpec: {
      eventType: GameplayTags.EVENT.DAMAGE_REQUEST,
      scope: GameplayTags.SCOPE.OWNER_AS_TARGET,
      priority: CREATION_LISTENER_PRIORITIES.damageRequest,
    },
  },
  {
    id: 'artifact-defense-wood-resist',
    displayName: '辟木',
    displayDescription: '降低受到的木系伤害',
    slot: 'modifier',
    rarity: 'common',
    match: {
      all: [CreationTags.MATERIAL.SEMANTIC_GUARD],
      any: [ELEMENT_TO_MATERIAL_TAG['金'], ELEMENT_TO_MATERIAL_TAG['火']],
    },
    weight: 28,
    energyCost: 12,
    applicableTo: ['artifact'],
    applicableArtifactSlots: ['armor', 'accessory'],
    effectTemplate: {
      type: 'percent_damage_modifier',
      conditions: [
        {
          type: 'ability_has_tag',
          params: { tag: ELEMENT_TO_RUNTIME_ABILITY_TAG['木'] },
        },
      ],
      params: {
        mode: 'reduce',
        value: { base: 0.08, scale: 'quality', coefficient: 0.02 },
        cap: 0.5,
      },
    },
    listenerSpec: {
      eventType: GameplayTags.EVENT.DAMAGE_REQUEST,
      scope: GameplayTags.SCOPE.OWNER_AS_TARGET,
      priority: CREATION_LISTENER_PRIORITIES.damageRequest,
    },
  },
  {
    id: 'artifact-defense-earth-resist',
    displayName: '辟土',
    displayDescription: '降低受到的土系伤害',
    slot: 'modifier',
    rarity: 'common',
    match: {
      all: [CreationTags.MATERIAL.SEMANTIC_GUARD],
      any: [ELEMENT_TO_MATERIAL_TAG['木'], ELEMENT_TO_MATERIAL_TAG['风']],
    },
    weight: 28,
    energyCost: 12,
    applicableTo: ['artifact'],
    applicableArtifactSlots: ['armor', 'accessory'],
    effectTemplate: {
      type: 'percent_damage_modifier',
      conditions: [
        {
          type: 'ability_has_tag',
          params: { tag: ELEMENT_TO_RUNTIME_ABILITY_TAG['土'] },
        },
      ],
      params: {
        mode: 'reduce',
        value: { base: 0.08, scale: 'quality', coefficient: 0.02 },
        cap: 0.5,
      },
    },
    listenerSpec: {
      eventType: GameplayTags.EVENT.DAMAGE_REQUEST,
      scope: GameplayTags.SCOPE.OWNER_AS_TARGET,
      priority: CREATION_LISTENER_PRIORITIES.damageRequest,
    },
  },

  // --- 被暴击后回盾 ---
  {
    id: 'artifact-defense-crit-shield',
    displayName: '波澜不惊',
    displayDescription: '被暴击时生成护盾',
    slot: 'modifier',
    rarity: 'uncommon',
    match: {
      all: [CreationTags.MATERIAL.SEMANTIC_GUARD],
      any: [
        CreationTags.MATERIAL.SEMANTIC_SPIRIT,
        CreationTags.MATERIAL.TYPE_AUXILIARY,
        CreationTags.MATERIAL.SEMANTIC_WATER,
      ],
    },
    weight: 30,
    energyCost: 17,
    applicableTo: ['artifact'],
    applicableArtifactSlots: ['armor', 'accessory'],
    effectTemplate: {
      type: 'shield',
      conditions: [{ type: 'is_critical', params: {} }],
      params: {
        value: {
          attribute: AttributeType.SPIRIT,
          coefficient: 1,
        },
      },
    },
    listenerSpec: {
      eventType: GameplayTags.EVENT.DAMAGE_TAKEN,
      scope: GameplayTags.SCOPE.OWNER_AS_TARGET,
      priority: CREATION_LISTENER_PRIORITIES.damageTaken,
    },
  },
  {
    id: 'artifact-armor-soul-anchoring-plate',
    displayName: '镇魂甲',
    displayDescription: '被施加控制状态时，有概率免疫该状态',
    slot: 'modifier',
    rarity: 'rare',
    match: {
      all: [CreationTags.MATERIAL.SEMANTIC_GUARD],
      any: [
        CreationTags.MATERIAL.SEMANTIC_DIVINE,
        CreationTags.MATERIAL.SEMANTIC_SPIRIT,
        CreationTags.MATERIAL.SEMANTIC_FORMATION,
      ],
    },
    weight: 14,
    energyCost: 32,
    applicableTo: ['artifact'],
    applicableArtifactSlots: ['armor'],
    grantedAbilityTags: [GameplayTags.ABILITY.FUNCTION.BUFF],
    effectTemplate: {
      type: 'buff_immunity',
      conditions: [{ type: 'chance', params: { value: 0.35 } }],
      params: {
        tags: [GameplayTags.BUFF.TYPE.CONTROL],
      },
    },
    listenerSpec: {
      eventType: GameplayTags.EVENT.BUFF_ADD,
      scope: GameplayTags.SCOPE.OWNER_AS_TARGET,
      priority: CREATION_LISTENER_PRIORITIES.buffIntercept,
    },
  },
  {
    id: 'artifact-armor-spirit-leaking-inscription',
    displayName: '泄灵纹甲',
    displayDescription: '受到法术伤害时，以法力吸收部分伤害',
    slot: 'modifier',
    rarity: 'rare',
    match: {
      all: [CreationTags.MATERIAL.SEMANTIC_SPIRIT],
      any: [
        CreationTags.MATERIAL.SEMANTIC_GUARD,
        CreationTags.MATERIAL.SEMANTIC_QI,
        CreationTags.MATERIAL.SEMANTIC_REFINING,
      ],
    },
    weight: 14,
    energyCost: 34,
    applicableTo: ['artifact'],
    applicableArtifactSlots: ['armor'],
    effectTemplate: {
      type: 'magic_shield',
      conditions: [
        {
          type: 'damage_type_is',
          params: { damageType: DamageType.MAGICAL },
        },
      ],
      params: {
        absorbRatio: { base: 0.25, scale: 'quality', coefficient: 0.03, max: 0.46 },
      },
    },
    listenerSpec: {
      eventType: GameplayTags.EVENT.DAMAGE,
      scope: GameplayTags.SCOPE.OWNER_AS_TARGET,
      priority: CREATION_LISTENER_PRIORITIES.damageApply,
    },
  },
  {
    id: 'artifact-armor-tide-breaking-mail',
    displayName: '溃潮甲',
    displayDescription: '护盾吸收足量伤害后回复法力',
    slot: 'modifier',
    rarity: 'legendary',
    match: {
      all: [CreationTags.MATERIAL.SEMANTIC_WATER],
      any: [
        CreationTags.MATERIAL.SEMANTIC_GUARD,
        CreationTags.MATERIAL.SEMANTIC_SPIRIT,
        CreationTags.MATERIAL.TYPE_SPECIAL,
      ],
    },
    exclusiveGroup: EXCLUSIVE_GROUP.ARTIFACT.TREASURE_ULTIMATE,
    weight: 6,
    energyCost: 42,
    applicableTo: ['artifact'],
    applicableArtifactSlots: ['armor'],
    grantedAbilityTags: [GameplayTags.ABILITY.FUNCTION.HEAL],
    effectTemplate: {
      type: 'heal',
      conditions: [
        {
          type: 'shield_absorbed_at_least',
          params: { value: 24 },
        },
      ],
      params: {
        target: 'mp',
        value: {
          attribute: AttributeType.SPIRIT,
          coefficient: 0.24,
          targetMaxMpRatio: {
            base: 0.04,
            scale: 'quality',
            coefficient: 0.006,
            max: 0.08,
          },
        },
      },
    },
    listenerSpec: {
      eventType: GameplayTags.EVENT.DAMAGE_TAKEN,
      scope: GameplayTags.SCOPE.OWNER_AS_TARGET,
      priority: CREATION_LISTENER_PRIORITIES.damageTaken + 1,
      mapping: { caster: 'owner', target: 'owner' },
    },
  },
  {
    id: 'artifact-armor-stone-cocoon',
    displayName: '石茧甲',
    displayDescription: '被暴击时生成厚重护盾',
    slot: 'modifier',
    rarity: 'legendary',
    match: {
      all: [CreationTags.MATERIAL.SEMANTIC_EARTH],
      any: [
        CreationTags.MATERIAL.SEMANTIC_GUARD,
        CreationTags.MATERIAL.SEMANTIC_BONE,
        CreationTags.MATERIAL.TYPE_ORE,
      ],
    },
    exclusiveGroup: EXCLUSIVE_GROUP.ARTIFACT.TREASURE_ULTIMATE,
    weight: 6,
    energyCost: 40,
    applicableTo: ['artifact'],
    applicableArtifactSlots: ['armor'],
    effectTemplate: {
      type: 'shield',
      conditions: [{ type: 'is_critical', params: { scope: 'target' } }],
      params: {
        value: {
          attribute: AttributeType.DEF,
          coefficient: 0.5,
          targetMaxHpRatio: {
            base: 0.04,
            scale: 'quality',
            coefficient: 0.008,
            max: 0.1,
          },
        },
      },
    },
    listenerSpec: {
      eventType: GameplayTags.EVENT.DAMAGE_TAKEN,
      scope: GameplayTags.SCOPE.OWNER_AS_TARGET,
      priority: CREATION_LISTENER_PRIORITIES.damageTaken + 2,
      mapping: { caster: 'owner', target: 'owner' },
    },
  },

  // --- 被暴击后反伤 ---
  {
    id: 'artifact-defense-crit-reflect',
    displayName: '混元',
    displayDescription: '被暴击时反弹部分伤害',
    slot: 'modifier',
    rarity: 'uncommon',
    match: {
      all: [CreationTags.MATERIAL.SEMANTIC_METAL],
      any: [
        CreationTags.MATERIAL.SEMANTIC_THUNDER,
        CreationTags.MATERIAL.SEMANTIC_BLADE,
        CreationTags.MATERIAL.SEMANTIC_GUARD,
      ],
    },
    weight: 25,
    energyCost: 16,
    applicableTo: ['artifact'],
    applicableArtifactSlots: ['accessory'],
    effectTemplate: {
      type: 'reflect',
      conditions: [{ type: 'is_critical', params: {} }],
      params: {
        ratio: { base: 0.12, scale: 'quality', coefficient: 0.07 },
      },
    },
    listenerSpec: {
      eventType: GameplayTags.EVENT.DAMAGE_TAKEN,
      scope: GameplayTags.SCOPE.OWNER_AS_TARGET,
      priority: CREATION_LISTENER_PRIORITIES.damageTaken,
    },
  },

  // --- 回合回血 ---
  {
    id: 'artifact-defense-round-heal',
    displayName: '生命之泉',
    displayDescription: '每回合回复气血',
    slot: 'modifier',
    rarity: 'uncommon',
    match: {
      all: [CreationTags.MATERIAL.SEMANTIC_SUSTAIN],
      any: [
        CreationTags.MATERIAL.SEMANTIC_LIFE,
        CreationTags.MATERIAL.TYPE_HERB,
        CreationTags.MATERIAL.SEMANTIC_QI,
      ],
    },
    exclusiveGroup: EXCLUSIVE_GROUP.ARTIFACT.DEFENSE_ROUND_HEAL,
    weight: 42,
    energyCost: 16,
    applicableTo: ['artifact'],
    applicableArtifactSlots: ['accessory'],
    grantedAbilityTags: [GameplayTags.ABILITY.FUNCTION.HEAL],
    effectTemplate: {
      type: 'heal',
      params: {
        value: {
          attribute: AttributeType.VITALITY,
          coefficient: 0.88,
        },
      },
    },
    listenerSpec: {
      eventType: GameplayTags.EVENT.ROUND_PRE,
      scope: GameplayTags.SCOPE.GLOBAL,
      priority: CREATION_LISTENER_PRIORITIES.roundPre,
    },
  },
  {
    id: 'artifact-accessory-clear-heart-pendant',
    displayName: '清心佩',
    displayDescription: '被施加负面状态时，有概率免疫该状态',
    slot: 'modifier',
    rarity: 'rare',
    match: {
      all: [CreationTags.MATERIAL.SEMANTIC_DIVINE],
      any: [
        CreationTags.MATERIAL.SEMANTIC_SPIRIT,
        CreationTags.MATERIAL.SEMANTIC_WATER,
        CreationTags.MATERIAL.SEMANTIC_LIFE,
      ],
    },
    weight: 14,
    energyCost: 32,
    applicableTo: ['artifact'],
    applicableArtifactSlots: ['accessory'],
    grantedAbilityTags: [GameplayTags.ABILITY.FUNCTION.BUFF],
    effectTemplate: {
      type: 'buff_immunity',
      conditions: [{ type: 'chance', params: { value: 0.3 } }],
      params: {
        tags: [GameplayTags.BUFF.TYPE.DEBUFF],
      },
    },
    listenerSpec: {
      eventType: GameplayTags.EVENT.BUFF_ADD,
      scope: GameplayTags.SCOPE.OWNER_AS_TARGET,
      priority: CREATION_LISTENER_PRIORITIES.buffIntercept + 1,
    },
  },
  {
    id: 'artifact-accessory-leaking-hourglass',
    displayName: '漏刻砂',
    displayDescription: '被神通命中后，有概率延长施法者冷却',
    slot: 'modifier',
    rarity: 'legendary',
    match: {
      all: [CreationTags.MATERIAL.SEMANTIC_TIME],
      any: [
        CreationTags.MATERIAL.SEMANTIC_SPACE,
        CreationTags.MATERIAL.SEMANTIC_FORMATION,
        CreationTags.MATERIAL.TYPE_SPECIAL,
      ],
    },
    exclusiveGroup: EXCLUSIVE_GROUP.ARTIFACT.TREASURE_ULTIMATE,
    weight: 6,
    energyCost: 44,
    applicableTo: ['artifact'],
    applicableArtifactSlots: ['accessory'],
    grantedAbilityTags: [GameplayTags.TRAIT.COOLDOWN],
    effectTemplate: {
      type: 'cooldown_modify',
      conditions: [{ type: 'chance', params: { value: 0.25 } }],
      params: {
        cdModifyValue: { base: 1, scale: 'quality', coefficient: 0, max: 1 },
        maxCount: 1,
      },
    },
    listenerSpec: {
      eventType: GameplayTags.EVENT.DAMAGE_TAKEN,
      scope: GameplayTags.SCOPE.OWNER_AS_TARGET,
      priority: CREATION_LISTENER_PRIORITIES.damageTaken + 3,
      mapping: { caster: 'owner', target: 'event.caster' },
      guard: { skipReflectSource: true },
    },
  },
  {
    id: 'artifact-accessory-mirror-thread-pendant',
    displayName: '镜丝坠',
    displayDescription: '闪避时生成护盾',
    slot: 'modifier',
    rarity: 'rare',
    match: {
      all: [CreationTags.MATERIAL.SEMANTIC_ILLUSION],
      any: [
        CreationTags.MATERIAL.SEMANTIC_WIND,
        CreationTags.MATERIAL.SEMANTIC_SPIRIT,
        CreationTags.MATERIAL.SEMANTIC_SPACE,
      ],
    },
    weight: 14,
    energyCost: 28,
    applicableTo: ['artifact'],
    applicableArtifactSlots: ['accessory'],
    effectTemplate: {
      type: 'shield',
      params: {
        value: {
          attribute: AttributeType.SPEED,
          coefficient: 1,
        },
      },
    },
    listenerSpec: {
      eventType: 'DodgeEvent',
      scope: GameplayTags.SCOPE.OWNER_AS_TARGET,
      priority: CREATION_LISTENER_PRIORITIES.damageApply,
      mapping: { caster: 'owner', target: 'owner' },
    },
  },
  {
    id: 'artifact-accessory-hidden-radiance-box',
    displayName: '藏辉匣',
    displayDescription: '护盾破裂时，按破盾量回复自身气血',
    slot: 'modifier',
    rarity: 'legendary',
    match: {
      all: [CreationTags.MATERIAL.SEMANTIC_LIFE],
      any: [
        CreationTags.MATERIAL.SEMANTIC_GUARD,
        CreationTags.MATERIAL.SEMANTIC_DIVINE,
        CreationTags.MATERIAL.TYPE_SPECIAL,
      ],
    },
    exclusiveGroup: EXCLUSIVE_GROUP.ARTIFACT.TREASURE_ULTIMATE,
    weight: 6,
    energyCost: 42,
    applicableTo: ['artifact'],
    applicableArtifactSlots: ['accessory'],
    grantedAbilityTags: [GameplayTags.ABILITY.FUNCTION.HEAL],
    effectTemplate: {
      type: 'damage_memory',
      params: {
        key: 'hidden_radiance_shield_break',
        mode: 'release',
        event: 'shield_break',
        ratio: {
          base: 0.28,
          scale: 'quality',
          coefficient: 0.035,
          max: 0.55,
        },
        releaseAs: 'heal',
        target: 'target',
      },
    },
    listenerSpec: {
      eventType: 'ShieldBreakEvent',
      scope: GameplayTags.SCOPE.OWNER_AS_TARGET,
      priority: CREATION_LISTENER_PRIORITIES.damageTaken + 1,
      mapping: { caster: 'owner', target: 'owner' },
    },
  },

  // ================================================================
  // ===== ARTIFACT_TREASURE 池 (3 种) — 制造"极品法宝感"
  // ================================================================

  // --- 金甲：受击概率大幅度减伤 ---
  {
    id: 'artifact-treasure-golden-armor',
    displayName: '金甲',
    displayDescription: '受击时有概率大幅降低本次伤害',
    slot: 'modifier',
    rarity: 'legendary',
    match: {
      all: [
        CreationTags.MATERIAL.SEMANTIC_METAL,
        CreationTags.MATERIAL.TYPE_SPECIAL,
      ],
      any: [
        CreationTags.MATERIAL.SEMANTIC_GUARD,
        CreationTags.MATERIAL.SEMANTIC_EARTH,
        CreationTags.MATERIAL.SEMANTIC_BONE,
      ],
    },
    exclusiveGroup: EXCLUSIVE_GROUP.ARTIFACT.TREASURE_ULTIMATE,
    weight: 8,
    energyCost: 50,
    applicableTo: ['artifact'],
    applicableArtifactSlots: ['armor'],
    effectTemplate: {
      type: 'percent_damage_modifier',
      conditions: [{ type: 'chance', params: { value: 0.25 } }],
      params: {
        mode: 'reduce',
        value: { base: 0.5, scale: 'quality', coefficient: 0.05 },
        cap: 0.9,
      },
    },
    listenerSpec: {
      eventType: GameplayTags.EVENT.DAMAGE_REQUEST,
      scope: GameplayTags.SCOPE.OWNER_AS_TARGET,
      priority: CREATION_LISTENER_PRIORITIES.damageRequest,
    },
  },

  // --- 濒死保命 ---
  {
    id: 'artifact-treasure-life-guard',
    displayName: '涅槃',
    displayDescription: '受到致命伤害时免于死亡，并保留 30% 气血',
    slot: 'modifier',
    rarity: 'legendary',
    match: {
      all: [
        CreationTags.MATERIAL.SEMANTIC_GUARD,
        CreationTags.MATERIAL.TYPE_SPECIAL,
      ],
      any: [
        CreationTags.MATERIAL.SEMANTIC_SUSTAIN,
        CreationTags.MATERIAL.SEMANTIC_LIFE,
        CreationTags.MATERIAL.SEMANTIC_DIVINE,
      ],
    },
    exclusiveGroup: EXCLUSIVE_GROUP.ARTIFACT.TREASURE_ULTIMATE,
    weight: 8,
    energyCost: 55,
    applicableTo: ['artifact'],
    applicableArtifactSlots: ['armor'],
    effectTemplate: {
      type: 'death_prevent',
      params: { hpFloorPercent: 0.3 },
    },
    listenerSpec: {
      eventType: GameplayTags.EVENT.DAMAGE_TAKEN,
      scope: GameplayTags.SCOPE.OWNER_AS_TARGET,
      priority: CREATION_LISTENER_PRIORITIES.damageTaken,
    },
  },

  // --- 太虚镜：特定元素伤害概率完全免疫 ---
  {
    id: 'artifact-treasure-void-mirror',
    displayName: '太虚',
    displayDescription: '受击时有概率免疫本次法术伤害',
    slot: 'modifier',
    rarity: 'legendary',
    match: {
      all: [
        CreationTags.MATERIAL.SEMANTIC_SPACE,
        CreationTags.MATERIAL.SEMANTIC_ILLUSION,
      ],
    },
    exclusiveGroup: EXCLUSIVE_GROUP.ARTIFACT.TREASURE_ULTIMATE,
    weight: 8,
    energyCost: 50,
    applicableTo: ['artifact'],
    applicableArtifactSlots: ['weapon', 'accessory'],
    effectTemplate: {
      type: 'damage_immunity',
      conditions: [{ type: 'chance', params: { value: 0.25 } }],
      params: {
        tags: [GameplayTags.ABILITY.CHANNEL.MAGIC],
      },
    },
    listenerSpec: {
      eventType: GameplayTags.EVENT.DAMAGE_TAKEN,
      scope: GameplayTags.SCOPE.OWNER_AS_TARGET,
      priority: CREATION_LISTENER_PRIORITIES.damageTaken,
    },
  },
  {
    id: 'artifact-treasure-karma-mirror',
    displayName: '业镜',
    displayDescription: '受到暴击时，下一次受击反射业力',
    slot: 'modifier',
    rarity: 'legendary',
    match: {
      all: [
        CreationTags.MATERIAL.SEMANTIC_DIVINE,
        CreationTags.MATERIAL.SEMANTIC_FORMATION,
      ],
    },
    exclusiveGroup: EXCLUSIVE_GROUP.ARTIFACT.TREASURE_ULTIMATE,
    weight: 6,
    energyCost: 46,
    applicableTo: ['artifact'],
    applicableArtifactSlots: ['accessory'],
    grantedAbilityTags: [
      GameplayTags.ABILITY.FUNCTION.DAMAGE,
      GameplayTags.ABILITY.CHANNEL.TRUE,
    ],
    effectTemplate: {
      type: 'effect_sequence',
      conditions: [{ type: 'is_critical', params: { scope: 'target' } }],
      params: {
        effects: [
          {
            type: 'damage_memory',
            params: {
              key: 'karma_mirror_crit',
              mode: 'record',
              event: 'critical_taken',
              target: 'target',
              maxStoredValue: {
                targetMaxHpRatio: {
                  base: 1,
                  scale: 'quality',
                  coefficient: 0.08,
                  max: 1.5,
                },
              },
            },
          },
          {
            type: 'apply_buff',
            params: {
              buffConfig: {
                id: 'karma_mirror_ready',
                name: '业镜',
                description:
                  '下一次受到攻击时，反射最近一次承受暴击伤害的一部分，触发后消失。',
                type: BuffType.BUFF,
                duration: 2,
                stackRule: StackRule.OVERRIDE,
                tags: [GameplayTags.BUFF.TYPE.BUFF],
                listeners: [
                  {
                    eventType: GameplayTags.EVENT.DAMAGE_TAKEN,
                    scope: GameplayTags.SCOPE.OWNER_AS_TARGET,
                    priority: CREATION_LISTENER_PRIORITIES.damageTaken,
                    effects: [
                      {
                        type: 'damage_memory',
                        params: {
                          key: 'karma_mirror_crit',
                          mode: 'release',
                          ratio: {
                            base: 0.26,
                            scale: 'quality',
                            coefficient: 0.025,
                            max: 0.44,
                          },
                          releaseAs: 'reflect',
                          target: 'target',
                        },
                      },
                      {
                        type: 'buff_layer_modify',
                        params: {
                          match: { id: 'karma_mirror_ready' },
                          operation: 'clear',
                        },
                      },
                    ],
                  },
                ],
              },
            },
          },
        ],
      },
    },
    listenerSpec: {
      eventType: GameplayTags.EVENT.DAMAGE_TAKEN,
      scope: GameplayTags.SCOPE.OWNER_AS_TARGET,
      priority: CREATION_LISTENER_PRIORITIES.damageTaken,
    },
  },
  {
    id: 'artifact-treasure-calamity-coin',
    displayName: '替劫铜钱',
    displayDescription: '免死后留下劫债，随后延迟偿还气血',
    slot: 'modifier',
    rarity: 'legendary',
    match: {
      all: [CreationTags.MATERIAL.SEMANTIC_GUARD],
      any: [
        CreationTags.MATERIAL.SEMANTIC_SUSTAIN,
        CreationTags.MATERIAL.SEMANTIC_METAL,
      ],
    },
    exclusiveGroup: EXCLUSIVE_GROUP.ARTIFACT.TREASURE_ULTIMATE,
    weight: 6,
    energyCost: 52,
    applicableTo: ['artifact'],
    applicableArtifactSlots: ['accessory'],
    grantedAbilityTags: [
      GameplayTags.ABILITY.FUNCTION.DAMAGE,
      GameplayTags.ABILITY.CHANNEL.TRUE,
    ],
    effectTemplate: {
      type: 'effect_sequence',
      conditions: [{ type: 'is_lethal', params: {} }],
      params: {
        effects: [
          {
            type: 'death_prevent',
            params: {
              hpFloorPercent: {
                base: 0.08,
                scale: 'quality',
                coefficient: 0.012,
                max: 0.18,
              },
            },
          },
          {
            type: 'damage_memory',
            params: {
              key: 'calamity_debt',
              mode: 'record',
              event: 'damage_taken',
              target: 'target',
              maxStoredValue: {
                targetMaxHpRatio: {
                  base: 1.1,
                  scale: 'quality',
                  coefficient: 0.08,
                  max: 1.6,
                },
              },
            },
          },
          {
            type: 'delayed_effect',
            params: {
              id: 'calamity_debt',
              name: '劫债',
              description:
                '1回合后偿还本次致命伤记录的一部分；品质越高，偿还比例越低。',
              delayTurns: 1,
              tags: [GameplayTags.BUFF.TYPE.DEBUFF],
              effects: [
                {
                  type: 'damage_memory',
                  params: {
                    key: 'calamity_debt',
                    mode: 'release',
                    ratio: {
                      base: 0.38,
                      scale: 'quality',
                      coefficient: -0.025,
                      min: 0.2,
                      max: 0.38,
                    },
                    releaseAs: 'damage',
                    target: 'target',
                  },
                },
              ],
            },
          },
        ],
      },
    },
    listenerSpec: {
      eventType: GameplayTags.EVENT.DAMAGE_TAKEN,
      scope: GameplayTags.SCOPE.OWNER_AS_TARGET,
      priority: CREATION_LISTENER_PRIORITIES.damageTaken,
      guard: { allowLethalWindow: true },
    },
  },
  {
    id: 'artifact-treasure-thunder-devour-bottle',
    displayName: '吞雷瓶',
    displayDescription: '受到雷系伤害时减少自身冷却',
    slot: 'modifier',
    rarity: 'legendary',
    match: {
      any: [
        CreationTags.MATERIAL.SEMANTIC_THUNDER,
        CreationTags.MATERIAL.SEMANTIC_ALCHEMY,
      ],
      all: [
        CreationTags.MATERIAL.SEMANTIC_FORMATION,
        CreationTags.MATERIAL.SEMANTIC_SPACE,
      ],
    },
    exclusiveGroup: EXCLUSIVE_GROUP.ARTIFACT.TREASURE_ULTIMATE,
    weight: 6,
    energyCost: 44,
    applicableTo: ['artifact'],
    applicableArtifactSlots: ['accessory'],
    grantedAbilityTags: [GameplayTags.TRAIT.COOLDOWN],
    effectTemplate: {
      type: 'effect_sequence',
      conditions: [
        {
          type: 'ability_has_tag',
          params: { tag: GameplayTags.ABILITY.ELEMENT.THUNDER },
        },
      ],
      params: {
        effects: [
          {
            type: 'apply_buff',
            params: {
              target: 'caster',
              buffConfig: {
                id: 'thunder_devour_charge',
                name: '蓄雷',
                description:
                  '受到雷系伤害时积蓄；达到3层后清空，并减少自身一个技能冷却。',
                type: BuffType.BUFF,
                duration: 3,
                stackRule: StackRule.STACK_LAYER,
                tags: [GameplayTags.BUFF.TYPE.BUFF],
              },
            },
          },
          {
            type: 'consume_status_trigger',
            conditions: [
              {
                type: 'buff_layer_at_least',
                params: { id: 'thunder_devour_charge', value: 3 },
              },
            ],
            params: {
              match: { id: 'thunder_devour_charge' },
              consume: 'all',
              effects: [
                {
                  type: 'cooldown_modify',
                  params: { cdModifyValue: -1, maxCount: 1 },
                },
              ],
            },
          },
        ],
      },
    },
    listenerSpec: {
      eventType: GameplayTags.EVENT.DAMAGE_TAKEN,
      scope: GameplayTags.SCOPE.OWNER_AS_TARGET,
      priority: CREATION_LISTENER_PRIORITIES.damageTaken,
      mapping: { caster: 'owner', target: 'owner' },
    },
  },
  {
    id: 'artifact-defense-soul-purifying-bell',
    displayName: '净魂铃',
    displayDescription: '敌人施加负面状态时，有概率复制回施加者',
    slot: 'modifier',
    rarity: 'rare',
    match: {
      any: [CreationTags.MATERIAL.SEMANTIC_SPIRIT],
      all: [CreationTags.MATERIAL.SEMANTIC_DIVINE],
    },
    weight: 14,
    energyCost: 30,
    applicableTo: ['artifact'],
    applicableArtifactSlots: ['accessory'],
    grantedAbilityTags: [GameplayTags.ABILITY.FUNCTION.BUFF],
    effectTemplate: {
      type: 'buff_copy',
      conditions: [{ type: 'chance', params: { value: 0.35 } }],
      params: {
        match: { tags: [GameplayTags.BUFF.TYPE.DEBUFF] },
        target: 'caster',
      },
    },
    listenerSpec: {
      eventType: GameplayTags.EVENT.BUFF_ADD,
      scope: GameplayTags.SCOPE.OWNER_AS_TARGET,
      priority: CREATION_LISTENER_PRIORITIES.buffIntercept,
      mapping: { caster: 'event.source', target: 'owner' },
    },
  },
  {
    id: 'artifact-treasure-taixu-robe',
    displayName: '太虚袍',
    displayDescription: '受到重击时，将部分伤害延迟结算',
    slot: 'modifier',
    rarity: 'legendary',
    match: {
      all: [
        CreationTags.MATERIAL.SEMANTIC_SPACE,
        CreationTags.MATERIAL.SEMANTIC_GUARD,
      ],
    },
    exclusiveGroup: EXCLUSIVE_GROUP.ARTIFACT.TREASURE_ULTIMATE,
    weight: 6,
    energyCost: 50,
    applicableTo: ['artifact'],
    applicableArtifactSlots: ['armor'],
    effectTemplate: {
      type: 'damage_defer',
      params: {
        ratio: {
          base: 0.22,
          scale: 'quality',
          coefficient: 0.025,
          max: 0.38,
        },
        delayTurns: 2,
        thresholdMaxHpRatio: 0.25,
      },
    },
    listenerSpec: {
      eventType: GameplayTags.EVENT.DAMAGE,
      scope: GameplayTags.SCOPE.OWNER_AS_TARGET,
      priority: CREATION_LISTENER_PRIORITIES.damageApply,
    },
  },
  {
    id: 'artifact-defense-demon-locking-nail',
    displayName: '锁妖钉',
    displayDescription: '抵抗控制时反向封禁施法者并增加其冷却',
    slot: 'modifier',
    rarity: 'rare',
    match: {
      all: [CreationTags.MATERIAL.SEMANTIC_FORMATION],
      any: [
        CreationTags.MATERIAL.SEMANTIC_REFINING,
        CreationTags.MATERIAL.SEMANTIC_ILLUSION,
      ],
    },
    weight: 14,
    energyCost: 32,
    applicableTo: ['artifact'],
    applicableArtifactSlots: ['weapon', 'accessory'],
    grantedAbilityTags: [GameplayTags.ABILITY.FUNCTION.CONTROL],
    effectTemplate: {
      type: 'effect_sequence',
      params: {
        effects: [
          { type: 'ability_lock', params: { rounds: 1, maxCount: 1 } },
          {
            type: 'cooldown_modify',
            params: { cdModifyValue: 1, maxCount: 1 },
          },
        ],
      },
    },
    listenerSpec: {
      eventType: 'ControlResistEvent',
      scope: GameplayTags.SCOPE.OWNER_AS_TARGET,
      priority: CREATION_LISTENER_PRIORITIES.buffIntercept,
      mapping: { caster: 'owner', target: 'event.caster' },
    },
  },
  {
    id: 'artifact-treasure-returning-ruin-pearl',
    displayName: '归墟珠',
    displayDescription: '护盾破裂时，对敌人造成真伤',
    slot: 'modifier',
    rarity: 'legendary',
    match: {
      any: [
        CreationTags.MATERIAL.SEMANTIC_WATER,
        CreationTags.MATERIAL.SEMANTIC_SPACE,
      ],
      all: [CreationTags.MATERIAL.SEMANTIC_BURST],
    },
    exclusiveGroup: EXCLUSIVE_GROUP.ARTIFACT.TREASURE_ULTIMATE,
    weight: 6,
    energyCost: 48,
    applicableTo: ['artifact'],
    applicableArtifactSlots: ['accessory'],
    grantedAbilityTags: [
      GameplayTags.ABILITY.FUNCTION.DAMAGE,
      GameplayTags.ABILITY.CHANNEL.TRUE,
    ],
    effectTemplate: {
      type: 'damage_memory',
      params: {
        key: 'shield_break',
        mode: 'release',
        event: 'shield_break',
        ratio: {
          base: 0.35,
          scale: 'quality',
          coefficient: 0.04,
          max: 0.65,
        },
        releaseAs: 'damage',
        target: 'target',
      },
    },
    listenerSpec: {
      eventType: 'ShieldBreakEvent',
      scope: GameplayTags.SCOPE.OWNER_AS_TARGET,
      priority: CREATION_LISTENER_PRIORITIES.damageTaken,
      mapping: { caster: 'owner', target: 'event.caster' },
    },
  },
  {
    id: 'artifact-treasure-steal-heaven-seal',
    displayName: '偷天印',
    displayDescription: '每场战斗首次受到增益时复制该增益',
    slot: 'modifier',
    rarity: 'legendary',
    match: {
      any: [
        CreationTags.MATERIAL.SEMANTIC_DIVINE,
        CreationTags.MATERIAL.SEMANTIC_ILLUSION,
      ],
      all: [CreationTags.MATERIAL.SEMANTIC_TIME],
    },
    exclusiveGroup: EXCLUSIVE_GROUP.ARTIFACT.TREASURE_ULTIMATE,
    weight: 6,
    energyCost: 42,
    applicableTo: ['artifact'],
    applicableArtifactSlots: ['accessory'],
    grantedAbilityTags: [GameplayTags.ABILITY.FUNCTION.BUFF],
    effectTemplate: {
      type: 'buff_copy',
      conditions: [{ type: 'chance', params: { value: 1 } }],
      params: {
        id: 'steal_heaven_first_buff',
        match: { tags: [GameplayTags.BUFF.TYPE.BUFF] },
        target: 'caster',
        durationDelta: 1,
        maxTriggers: 1,
      },
    },
    listenerSpec: {
      eventType: GameplayTags.EVENT.BUFF_ADD,
      scope: GameplayTags.SCOPE.OWNER_AS_TARGET,
      priority: CREATION_LISTENER_PRIORITIES.buffIntercept,
      mapping: { caster: 'owner', target: 'owner' },
    },
  },
];
