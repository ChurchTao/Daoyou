/*
 * 灵能消耗平衡规则 (Energy Cost Balance Rule - V2):
 * 1. 核心池 (Core/Panel): 8 ~ 15 点。作为基础底盘，保证产物基本强度。
 * 2. 变体池 (Variant/School/Defense): 12 ~ 20 点。主要能量吸收点，定义流派特色。
 * 3. 稀有池 (Rare/Secret/Treasure): 35 ~ 55 点。顶级消耗项，吸收神品材料溢出能量，产出质变效果。
 *
 * PBU 换算逻辑：PBU = (∑词缀消耗 * 类别系数 * 效率加成) * 品质乘数 + 极品奖励。
 */
import {
  CreationTags,
  ELEMENT_TO_RUNTIME_ABILITY_TAG,
  GameplayTags,
} from '@/engine/shared/tag-domain';
import { CREATION_LISTENER_PRIORITIES } from '../../config/CreationBalance';
import { ELEMENT_TO_MATERIAL_TAG } from '../../config/CreationMappings';
import { AttributeType, ModifierType } from '../../contracts/battle';
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
    displayDescription: '武器法宝提升物理与法术攻击力',
    category: 'artifact_core',
    rarity: 'common',
    match: {},
    exclusiveGroup: EXCLUSIVE_GROUP.ARTIFACT.PANEL_SLOT_WEAPON,
    weight: 100,
    energyCost: 5,
    applicableTo: ['artifact'],
    applicableArtifactSlots: ['weapon'],
    effectTemplate: {
      type: 'random_attribute_modifier',
      params: {
        pickCount: 2,
        pool: [
          {
            attrType: AttributeType.ATK,
            modType: ModifierType.FIXED,
            value: { base: 40, scale: 'quality', coefficient: 6 },
          },
          {
            attrType: AttributeType.MAGIC_ATK,
            modType: ModifierType.FIXED,
            value: { base: 40, scale: 'quality', coefficient: 6 },
          },
        ],
      },
    },
  },
  {
    id: 'artifact-panel-armor-dual-def',
    displayName: '基础防御',
    displayDescription: '护甲法宝提升物理与法术防御',
    category: 'artifact_core',
    rarity: 'common',
    match: {},
    exclusiveGroup: EXCLUSIVE_GROUP.ARTIFACT.PANEL_SLOT_ARMOR,
    weight: 100,
    energyCost: 5,
    applicableTo: ['artifact'],
    applicableArtifactSlots: ['armor'],
    effectTemplate: {
      type: 'random_attribute_modifier',
      params: {
        pickCount: 2,
        pool: [
          {
            attrType: AttributeType.DEF,
            modType: ModifierType.FIXED,
            value: { base: 32, scale: 'quality', coefficient: 6 },
          },
          {
            attrType: AttributeType.MAGIC_DEF,
            modType: ModifierType.FIXED,
            value: { base: 32, scale: 'quality', coefficient: 6 },
          },
        ],
      },
    },
  },
  {
    id: 'artifact-panel-accessory-utility',
    displayName: '基础属性',
    displayDescription: '饰品法宝提升速度、暴击、命中等基础属性',
    category: 'artifact_core',
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
    displayDescription: '提升物理攻击力',
    category: 'artifact_panel',
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
        value: { base: 18, scale: 'quality', coefficient: 4 },
      },
    },
  },
  {
    id: 'artifact-panel-magic-atk',
    displayName: '聚灵',
    displayDescription: '铭刻聚灵纹路，提升法宝传导法术时的威力',
    category: 'artifact_panel',
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
        value: { base: 18, scale: 'quality', coefficient: 4 },
      },
    },
  },
  {
    id: 'artifact-panel-def',
    displayName: '铁壁',
    displayDescription: '器体坚不可摧，被动强化肉身物理承伤之能',
    category: 'artifact_panel',
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
        value: { base: 12, scale: 'quality', coefficient: 5 },
      },
    },
  },
  {
    id: 'artifact-panel-magic-def',
    displayName: '御法',
    displayDescription: '莹莹宝光流转，化解袭来的诸般五行咒法术力',
    category: 'artifact_panel',
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
        value: { base: 12, scale: 'quality', coefficient: 5 },
      },
    },
  },

  {
    id: 'artifact-panel-crit-rate',
    displayName: '会心',
    displayDescription: '提升暴击几率',
    category: 'artifact_panel',
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
    displayDescription: '激发凶煞戾气，让致命一击造成更绝望惨重的创伤',
    category: 'artifact_panel',
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
    category: 'artifact_panel',
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
    category: 'artifact_panel',
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
    category: 'artifact_panel',
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
    category: 'artifact_panel',
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
    displayDescription: '提升灵力',
    category: 'artifact_panel',
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
        value: { base: 12, scale: 'quality', coefficient: 5 },
      },
    },
  },
  {
    id: 'artifact-panel-vitality',
    displayName: '淬体',
    displayDescription: '提升体魄',
    category: 'artifact_panel',
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
        value: { base: 12, scale: 'quality', coefficient: 5 },
      },
    },
  },
  {
    id: 'artifact-panel-wisdom',
    displayName: '开智',
    displayDescription: '时有清气流转，助人平心静气、提升推衍参悟道法的慧极',
    category: 'artifact_panel',
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
        value: { base: 12, scale: 'quality', coefficient: 5 },
      },
    },
  },
  {
    id: 'artifact-panel-willpower',
    displayName: '凝神',
    displayDescription: '固本培元，令修者无形识海坚若磐石',
    category: 'artifact_panel',
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
        value: { base: 12, scale: 'quality', coefficient: 5 },
      },
    },
  },
  {
    id: 'artifact-panel-speed',
    displayName: '乘风',
    displayDescription: '法宝质地轻灵，使持有者身法更显莫测无矩',
    category: 'artifact_panel',
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
        value: { base: 12, scale: 'quality', coefficient: 5 },
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
    category: 'artifact_defense',
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
    effectTemplate: {
      type: 'reflect',
      conditions: [{ type: 'chance', params: { value: 0.3 } }],
      params: {
        ratio: { base: 0.03, scale: 'quality', coefficient: 0.01 },
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
    displayDescription: '在形神俱灭之际，强行截存一丝生机',
    category: 'artifact_defense',
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
    minQuality: '灵品',
    applicableTo: ['artifact'],
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
    displayDescription: '气血衰微时，受击有概率自行激发真元护体',
    category: 'artifact_defense',
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
    effectTemplate: {
      type: 'shield',
      conditions: [
        { type: 'hp_below', params: { value: 0.3 } },
        { type: 'chance', params: { value: 0.3 } },
      ],
      params: {
        value: {
          base: { base: 15, scale: 'quality', coefficient: 6 },
          attribute: AttributeType.SPIRIT,
          coefficient: 0.02,
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
    category: 'artifact_defense',
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
    displayDescription: '暗循周天，法宝每回合皆可自动接引天地灵气重聚真元',
    category: 'artifact_defense',
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
    grantedAbilityTags: [GameplayTags.ABILITY.FUNCTION.HEAL],
    effectTemplate: {
      type: 'heal',
      params: {
        target: 'mp',
        value: {
          base: { base: 5, scale: 'quality', coefficient: 2 },
          attribute: AttributeType.SPIRIT,
          coefficient: 0.01,
        },
      },
    },
    listenerSpec: {
      eventType: GameplayTags.EVENT.ROUND_PRE,
      scope: GameplayTags.SCOPE.OWNER_AS_TARGET,
      priority: CREATION_LISTENER_PRIORITIES.roundPre,
    },
  },

  // --- 法力护盾 ---
  {
    id: 'artifact-defense-magic-shield',
    displayName: '玄罡',
    displayDescription: '受击时，以真元为障，优先吸收部分伤害',
    category: 'artifact_defense',
    rarity: 'rare',
    match: {
      all: [CreationTags.MATERIAL.SEMANTIC_SPIRIT],
      any: [
        CreationTags.MATERIAL.SEMANTIC_GUARD,
        CreationTags.MATERIAL.SEMANTIC_QI,
        CreationTags.MATERIAL.SEMANTIC_WATER,
      ],
    },
    weight: 18,
    energyCost: 35,
    applicableTo: ['artifact'],
    effectTemplate: {
      type: 'magic_shield',
      params: {
        absorbRatio: { base: 0.5, scale: 'quality', coefficient: 0.48 / 7 },
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
    category: 'artifact_defense',
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
    category: 'artifact_defense',
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
      scope: GameplayTags.SCOPE.OWNER_AS_TARGET,
      priority: CREATION_LISTENER_PRIORITIES.roundPre,
    },
  },

  // --- 绝境护甲（低血减伤） ---
  {
    id: 'artifact-defense-desperate-aegis',
    displayName: '临危不惧',
    displayDescription:
      '法宝感主命危，自行卸去来袭劲力，令持有者在气血衰微时更能强撑危局',
    category: 'artifact_defense',
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
    displayDescription: '蕴含冰寒之息，遭烈焰焚烧时可削弱大部分火系真诀威力',
    category: 'artifact_defense',
    rarity: 'common',
    match: {
      all: [CreationTags.MATERIAL.SEMANTIC_GUARD],
      any: [ELEMENT_TO_MATERIAL_TAG['水'], ELEMENT_TO_MATERIAL_TAG['冰']],
    },
    weight: 40,
    energyCost: 12,
    applicableTo: ['artifact'],
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
    displayDescription: '携炎阳脉络，受霜雪侵体时能护住经脉免遭冻结冰寒之害',
    category: 'artifact_defense',
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
    displayDescription: '绝缘辟雷，万重天劫临身亦能将其劲气化去大半',
    category: 'artifact_defense',
    rarity: 'uncommon',
    match: {
      all: [CreationTags.MATERIAL.SEMANTIC_GUARD],
      any: [ELEMENT_TO_MATERIAL_TAG['木'], ELEMENT_TO_MATERIAL_TAG['土']],
    },
    weight: 36,
    energyCost: 16,
    applicableTo: ['artifact'],
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
    displayDescription: '宝光所及，狂风息止，受风系道法席卷时伤害大减',
    category: 'artifact_defense',
    rarity: 'uncommon',
    match: {
      all: [CreationTags.MATERIAL.SEMANTIC_GUARD],
      any: [ELEMENT_TO_MATERIAL_TAG['土'], ELEMENT_TO_MATERIAL_TAG['金']],
    },
    weight: 34,
    energyCost: 14,
    applicableTo: ['artifact'],
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
    displayDescription: '暗合卸力之理，遇金铁之锐不撄其锋，可化解部分金系穿透',
    category: 'artifact_defense',
    rarity: 'common',
    match: {
      all: [CreationTags.MATERIAL.SEMANTIC_GUARD],
      any: [ELEMENT_TO_MATERIAL_TAG['火'], ELEMENT_TO_MATERIAL_TAG['水']],
    },
    weight: 32,
    energyCost: 12,
    applicableTo: ['artifact'],
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
    displayDescription: '携避水妙用，使敌方阴柔水行绵力如落空处，难伤分毫',
    category: 'artifact_defense',
    rarity: 'common',
    match: {
      all: [CreationTags.MATERIAL.SEMANTIC_GUARD],
      any: [ELEMENT_TO_MATERIAL_TAG['土'], ELEMENT_TO_MATERIAL_TAG['木']],
    },
    weight: 30,
    energyCost: 12,
    applicableTo: ['artifact'],
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
    displayDescription: '蕴含肃杀伐木之意，受木属神通缠绕及毒瘴侵蚀显著减轻',
    category: 'artifact_defense',
    rarity: 'common',
    match: {
      all: [CreationTags.MATERIAL.SEMANTIC_GUARD],
      any: [ELEMENT_TO_MATERIAL_TAG['金'], ELEMENT_TO_MATERIAL_TAG['火']],
    },
    weight: 28,
    energyCost: 12,
    applicableTo: ['artifact'],
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
    displayDescription: '乘厚土德载，使地系镇压与土行重击难撼其根基',
    category: 'artifact_defense',
    rarity: 'common',
    match: {
      all: [CreationTags.MATERIAL.SEMANTIC_GUARD],
      any: [ELEMENT_TO_MATERIAL_TAG['木'], ELEMENT_TO_MATERIAL_TAG['风']],
    },
    weight: 28,
    energyCost: 12,
    applicableTo: ['artifact'],
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
    displayDescription: '在突遭危殆重击时，灵力如潮水汇聚结成护体光幕',
    category: 'artifact_defense',
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
    effectTemplate: {
      type: 'shield',
      conditions: [{ type: 'is_critical', params: {} }],
      params: {
        value: {
          base: { base: 12, scale: 'quality', coefficient: 5 },
          attribute: AttributeType.SPIRIT,
          coefficient: 0.02,
        },
      },
    },
    listenerSpec: {
      eventType: GameplayTags.EVENT.DAMAGE_TAKEN,
      scope: GameplayTags.SCOPE.OWNER_AS_TARGET,
      priority: CREATION_LISTENER_PRIORITIES.damageTaken,
    },
  },

  // --- 被暴击后反伤 ---
  {
    id: 'artifact-defense-crit-reflect',
    displayName: '混元',
    displayDescription: '在承受凌厉猛击的瞬间，法阵自发逆转余波反震予施袭者',
    category: 'artifact_defense',
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
    effectTemplate: {
      type: 'reflect',
      conditions: [{ type: 'is_critical', params: {} }],
      params: {
        ratio: { base: 0.04, scale: 'quality', coefficient: 0.02 },
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
    displayDescription: '器体内封存草木之精，随真气流转持续蕴养残破血脉',
    category: 'artifact_defense',
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
    grantedAbilityTags: [GameplayTags.ABILITY.FUNCTION.HEAL],
    effectTemplate: {
      type: 'heal',
      params: {
        value: {
          base: { base: 6, scale: 'quality', coefficient: 3 },
          attribute: AttributeType.VITALITY,
          coefficient: 0.02,
        },
      },
    },
    listenerSpec: {
      eventType: GameplayTags.EVENT.ROUND_PRE,
      scope: GameplayTags.SCOPE.OWNER_AS_TARGET,
      priority: CREATION_LISTENER_PRIORITIES.roundPre,
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
    category: 'artifact_treasure',
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
    weight: 5,
    energyCost: 50,
    minQuality: '玄品',
    applicableTo: ['artifact'],
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
    displayDescription:
      '在生死绝境之时可护住心脉使气火不绝',
    category: 'artifact_treasure',
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
    weight: 4,
    energyCost: 55,
    minQuality: '真品',
    applicableTo: ['artifact'],
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
    displayDescription: '太虚无形，有概率将袭来的术法悉数化入虚无',
    category: 'artifact_treasure',
    rarity: 'legendary',
    match: {
      all: [
        CreationTags.MATERIAL.SEMANTIC_SPIRIT,
        CreationTags.MATERIAL.TYPE_SPECIAL,
      ],
      any: [
        CreationTags.MATERIAL.SEMANTIC_WATER,
        CreationTags.MATERIAL.SEMANTIC_DIVINE,
        CreationTags.MATERIAL.SEMANTIC_SPACE,
      ],
    },
    exclusiveGroup: EXCLUSIVE_GROUP.ARTIFACT.TREASURE_ULTIMATE,
    weight: 4,
    energyCost: 50,
    minQuality: '玄品',
    applicableTo: ['artifact'],
    effectTemplate: {
      type: 'damage_immunity',
      conditions: [{ type: 'chance', params: { value: 0.15 } }],
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
];
