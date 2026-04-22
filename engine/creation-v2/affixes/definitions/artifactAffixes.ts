/*
 * artifactAffixes: 法宝词缀定义（梦幻西游风格三角重构）
 *
 * 法宝定位："货" — 负责"装备出货感"，词条价值集中在面板底力、受击反馈、保命与对策。
 *
 * 池结构：
 *   artifact_panel   (~55%) — 决定这件装备是不是好货
 *   artifact_defense  (~30%) — 提供容错、反制、保命与对策
 *   artifact_treasure (~15%) — 制造"极品法宝感"
 *
 * 硬边界（Section 2.3 + Section 6.3）：
 *   - 不定义主流派规则（归 gongfa）
 *   - 不承担主动施法型爆发逻辑（归 skill）
 *   - 以 OWNER_AS_TARGET / GLOBAL 为主
 *   - 固定值面板必须保留在 Artifact 域
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
    displayName: '双刃强化',
    displayDescription: '武器法宝同时提升物理与法术攻击力',
    category: 'artifact_panel',
    rarity: 'common',
    match: {},
    exclusiveGroup: EXCLUSIVE_GROUP.ARTIFACT.PANEL_SLOT_WEAPON,
    weight: 100,
    energyCost: 10,
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
            value: { base: 4, scale: 'quality', coefficient: 2 },
          },
          {
            attrType: AttributeType.MAGIC_ATK,
            modType: ModifierType.FIXED,
            value: { base: 4, scale: 'quality', coefficient: 2 },
          },
        ],
      },
    },
  },
  {
    id: 'artifact-panel-armor-dual-def',
    displayName: '重甲护体',
    displayDescription: '护甲法宝同时提升物理与法术防御',
    category: 'artifact_panel',
    rarity: 'common',
    match: {},
    exclusiveGroup: EXCLUSIVE_GROUP.ARTIFACT.PANEL_SLOT_ARMOR,
    weight: 100,
    energyCost: 10,
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
            value: { base: 3, scale: 'quality', coefficient: 1.5 },
          },
          {
            attrType: AttributeType.MAGIC_DEF,
            modType: ModifierType.FIXED,
            value: { base: 3, scale: 'quality', coefficient: 1.5 },
          },
        ],
      },
    },
  },
  {
    id: 'artifact-panel-accessory-utility',
    displayName: '灵饰增益',
    displayDescription: '饰品法宝提升速度、暴击、命中等实用属性',
    category: 'artifact_panel',
    rarity: 'common',
    match: {},
    exclusiveGroup: EXCLUSIVE_GROUP.ARTIFACT.PANEL_SLOT_ACCESSORY,
    weight: 100,
    energyCost: 10,
    applicableTo: ['artifact'],
    applicableArtifactSlots: ['accessory'],
    effectTemplate: {
      type: 'random_attribute_modifier',
      params: {
        pickCount: 2,
        pool: [
          {
            attrType: AttributeType.SPEED,
            modType: ModifierType.FIXED,
            value: { base: 2, scale: 'quality', coefficient: 1 },
          },
          {
            attrType: AttributeType.CRIT_RATE,
            modType: ModifierType.FIXED,
            value: { base: 0.02, scale: 'quality', coefficient: 0.008 },
          },
          {
            attrType: AttributeType.ACCURACY,
            modType: ModifierType.FIXED,
            value: { base: 0.02, scale: 'quality', coefficient: 0.008 },
          },
          {
            attrType: AttributeType.CONTROL_RESISTANCE,
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
    displayName: '物攻面板',
    displayDescription: '固定提升物理攻击力',
    category: 'artifact_panel',
    rarity: 'common',
    match: { all: [CreationTags.MATERIAL.SEMANTIC_BLADE] },
    exclusiveGroup: EXCLUSIVE_GROUP.ARTIFACT.PANEL_STAT,
    weight: 80,
    energyCost: 6,
    applicableTo: ['artifact'],
    applicableArtifactSlots: ['weapon', 'armor', 'accessory'],
    effectTemplate: {
      type: 'attribute_modifier',
      params: {
        attrType: AttributeType.ATK,
        modType: ModifierType.FIXED,
        value: { base: 3, scale: 'quality', coefficient: 1.5 },
      },
    },
  },
  {
    id: 'artifact-panel-magic-atk',
    displayName: '法攻面板',
    displayDescription: '固定提升法术攻击力',
    category: 'artifact_panel',
    rarity: 'common',
    match: { all: [CreationTags.MATERIAL.SEMANTIC_SPIRIT] },
    exclusiveGroup: EXCLUSIVE_GROUP.ARTIFACT.PANEL_STAT,
    weight: 80,
    energyCost: 6,
    applicableTo: ['artifact'],
    applicableArtifactSlots: ['weapon', 'armor', 'accessory'],
    effectTemplate: {
      type: 'attribute_modifier',
      params: {
        attrType: AttributeType.MAGIC_ATK,
        modType: ModifierType.FIXED,
        value: { base: 3, scale: 'quality', coefficient: 1.5 },
      },
    },
  },
  {
    id: 'artifact-panel-def',
    displayName: '物防面板',
    displayDescription: '固定提升物理防御',
    category: 'artifact_panel',
    rarity: 'common',
    match: { all: [CreationTags.MATERIAL.SEMANTIC_GUARD] },
    exclusiveGroup: EXCLUSIVE_GROUP.ARTIFACT.PANEL_STAT,
    weight: 65,
    energyCost: 5,
    applicableTo: ['artifact'],
    applicableArtifactSlots: ['weapon', 'armor', 'accessory'],
    effectTemplate: {
      type: 'attribute_modifier',
      params: {
        attrType: AttributeType.DEF,
        modType: ModifierType.FIXED,
        value: { base: 2, scale: 'quality', coefficient: 1 },
      },
    },
  },
  {
    id: 'artifact-panel-magic-def',
    displayName: '法防面板',
    displayDescription: '固定提升法术防御',
    category: 'artifact_panel',
    rarity: 'common',
    match: {
      any: [
        CreationTags.MATERIAL.SEMANTIC_WATER,
        CreationTags.MATERIAL.SEMANTIC_SPIRIT,
        CreationTags.MATERIAL.SEMANTIC_GUARD,
      ],
    },
    exclusiveGroup: EXCLUSIVE_GROUP.ARTIFACT.PANEL_STAT,
    weight: 60,
    energyCost: 5,
    applicableTo: ['artifact'],
    applicableArtifactSlots: ['weapon', 'armor', 'accessory'],
    effectTemplate: {
      type: 'attribute_modifier',
      params: {
        attrType: AttributeType.MAGIC_DEF,
        modType: ModifierType.FIXED,
        value: { base: 2, scale: 'quality', coefficient: 1 },
      },
    },
  },

  {
    id: 'artifact-panel-speed',
    displayName: '速度面板',
    displayDescription: '固定提升身法',
    category: 'artifact_panel',
    rarity: 'common',
    match: { all: [CreationTags.MATERIAL.SEMANTIC_WIND] },
    exclusiveGroup: EXCLUSIVE_GROUP.ARTIFACT.PANEL_STAT,
    weight: 60,
    energyCost: 6,
    applicableTo: ['artifact'],
    applicableArtifactSlots: ['weapon', 'armor', 'accessory'],
    effectTemplate: {
      type: 'attribute_modifier',
      params: {
        attrType: AttributeType.SPEED,
        modType: ModifierType.FIXED,
        value: { base: 1, scale: 'quality', coefficient: 0.8 },
      },
    },
  },
  {
    id: 'artifact-panel-crit-rate',
    displayName: '暴击面板',
    displayDescription: '固定提升暴击率',
    category: 'artifact_panel',
    rarity: 'uncommon',
    match: { all: [CreationTags.MATERIAL.SEMANTIC_BURST] },
    exclusiveGroup: EXCLUSIVE_GROUP.ARTIFACT.PANEL_CRIT_RATE,
    weight: 50,
    energyCost: 7,
    applicableTo: ['artifact'],
    applicableArtifactSlots: ['weapon', 'armor', 'accessory'],
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
    displayName: '爆伤面板',
    displayDescription: '固定提升暴击伤害',
    category: 'artifact_panel',
    rarity: 'uncommon',
    match: {
      all: [CreationTags.MATERIAL.SEMANTIC_BURST],
      any: [
        CreationTags.MATERIAL.SEMANTIC_BLADE,
        CreationTags.MATERIAL.SEMANTIC_METAL,
        CreationTags.MATERIAL.SEMANTIC_BEAST,
      ],
    },
    exclusiveGroup: EXCLUSIVE_GROUP.ARTIFACT.PANEL_CRIT_DMG,
    weight: 45,
    energyCost: 7,
    applicableTo: ['artifact'],
    applicableArtifactSlots: ['weapon', 'armor', 'accessory'],
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
    displayName: '命中面板',
    displayDescription: '固定提升命中率',
    category: 'artifact_panel',
    rarity: 'common',
    match: {
      any: [
        CreationTags.MATERIAL.SEMANTIC_MANUAL,
        CreationTags.MATERIAL.SEMANTIC_WIND,
        CreationTags.MATERIAL.SEMANTIC_SPIRIT,
      ],
    },
    exclusiveGroup: EXCLUSIVE_GROUP.ARTIFACT.PANEL_STAT,
    weight: 50,
    energyCost: 5,
    applicableTo: ['artifact'],
    applicableArtifactSlots: ['weapon', 'armor', 'accessory'],
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
    displayName: '闪避面板',
    displayDescription: '固定提升闪避率',
    category: 'artifact_panel',
    rarity: 'common',
    match: { all: [CreationTags.MATERIAL.SEMANTIC_WIND] },
    exclusiveGroup: EXCLUSIVE_GROUP.ARTIFACT.PANEL_MOBILITY,
    weight: 45,
    energyCost: 5,
    applicableTo: ['artifact'],
    applicableArtifactSlots: ['weapon', 'armor', 'accessory'],
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
    displayName: '控制命中面板',
    displayDescription: '固定提升控制命中',
    category: 'artifact_panel',
    rarity: 'uncommon',
    match: {
      any: [
        CreationTags.MATERIAL.SEMANTIC_THUNDER,
        CreationTags.MATERIAL.SEMANTIC_ILLUSION,
        CreationTags.MATERIAL.SEMANTIC_FREEZE,
      ],
    },
    exclusiveGroup: EXCLUSIVE_GROUP.ARTIFACT.PANEL_STAT,
    weight: 40,
    energyCost: 6,
    applicableTo: ['artifact'],
    applicableArtifactSlots: ['weapon', 'armor', 'accessory'],
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
    displayName: '控制抗性面板',
    displayDescription: '固定提升控制抗性',
    category: 'artifact_panel',
    rarity: 'uncommon',
    match: {
      any: [
        CreationTags.MATERIAL.SEMANTIC_EARTH,
        CreationTags.MATERIAL.SEMANTIC_GUARD,
        CreationTags.MATERIAL.SEMANTIC_DIVINE,
      ],
    },
    exclusiveGroup: EXCLUSIVE_GROUP.ARTIFACT.PANEL_STAT,
    weight: 40,
    energyCost: 6,
    applicableTo: ['artifact'],
    applicableArtifactSlots: ['weapon', 'armor', 'accessory'],
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
    displayName: '灵力悟性面板',
    displayDescription: '固定提升灵力',
    category: 'artifact_panel',
    rarity: 'common',
    match: {
      all: [CreationTags.MATERIAL.SEMANTIC_SPIRIT],
      any: [
        CreationTags.MATERIAL.SEMANTIC_QI,
        CreationTags.MATERIAL.TYPE_HERB,
        CreationTags.MATERIAL.TYPE_MANUAL,
      ],
    },
    exclusiveGroup: EXCLUSIVE_GROUP.ARTIFACT.PANEL_STAT,
    weight: 55,
    energyCost: 5,
    applicableTo: ['artifact'],
    applicableArtifactSlots: ['weapon', 'armor', 'accessory'],
    effectTemplate: {
      type: 'attribute_modifier',
      params: {
        attrType: AttributeType.SPIRIT,
        modType: ModifierType.FIXED,
        value: { base: 2, scale: 'quality', coefficient: 1 },
      },
    },
  },
  {
    id: 'artifact-panel-vitality',
    displayName: '体魄面板',
    displayDescription: '固定提升体魄',
    category: 'artifact_panel',
    rarity: 'common',
    match: {
      all: [CreationTags.MATERIAL.SEMANTIC_SUSTAIN],
      any: [
        CreationTags.MATERIAL.SEMANTIC_BLOOD,
        CreationTags.MATERIAL.SEMANTIC_LIFE,
        CreationTags.MATERIAL.TYPE_HERB,
      ],
    },
    exclusiveGroup: EXCLUSIVE_GROUP.ARTIFACT.PANEL_STAT,
    weight: 55,
    energyCost: 5,
    applicableTo: ['artifact'],
    applicableArtifactSlots: ['weapon', 'armor', 'accessory'],
    effectTemplate: {
      type: 'attribute_modifier',
      params: {
        attrType: AttributeType.VITALITY,
        modType: ModifierType.FIXED,
        value: { base: 2, scale: 'quality', coefficient: 1 },
      },
    },
  },
  {
    id: 'artifact-panel-wisdom',
    displayName: '悟性面板',
    displayDescription: '固定提升悟性',
    category: 'artifact_panel',
    rarity: 'common',
    match: { all: [CreationTags.MATERIAL.SEMANTIC_MANUAL] },
    exclusiveGroup: EXCLUSIVE_GROUP.ARTIFACT.PANEL_STAT,
    weight: 45,
    energyCost: 5,
    applicableTo: ['artifact'],
    applicableArtifactSlots: ['weapon', 'armor', 'accessory'],
    effectTemplate: {
      type: 'attribute_modifier',
      params: {
        attrType: AttributeType.WISDOM,
        modType: ModifierType.FIXED,
        value: { base: 1, scale: 'quality', coefficient: 0.8 },
      },
    },
  },
  {
    id: 'artifact-panel-willpower',
    displayName: '神识面板',
    displayDescription: '固定提升神识',
    category: 'artifact_panel',
    rarity: 'common',
    match: {
      any: [
        CreationTags.MATERIAL.SEMANTIC_GUARD,
        CreationTags.MATERIAL.SEMANTIC_SPIRIT,
        CreationTags.MATERIAL.SEMANTIC_DIVINE,
      ],
    },
    exclusiveGroup: EXCLUSIVE_GROUP.ARTIFACT.PANEL_STAT,
    weight: 40,
    energyCost: 5,
    applicableTo: ['artifact'],
    applicableArtifactSlots: ['weapon', 'armor', 'accessory'],
    effectTemplate: {
      type: 'attribute_modifier',
      params: {
        attrType: AttributeType.WILLPOWER,
        modType: ModifierType.FIXED,
        value: { base: 1, scale: 'quality', coefficient: 0.8 },
      },
    },
  },

  // ================================================================
  // ===== ARTIFACT_DEFENSE 池 — 防守 / 反制 / 保命
  // ================================================================

  // --- 反伤荆棘 ---
  {
    id: 'artifact-defense-reflect-thorns',
    displayName: '荆棘',
    displayDescription: '受击时反弹部分伤害',
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
    energyCost: 8,
    applicableTo: ['artifact'],
    effectTemplate: {
      type: 'reflect',
      params: {
        ratio: { base: 0.08, scale: 'quality', coefficient: 0.02 },
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
    displayName: '绝处逢生',
    displayDescription: '首次受到致死伤害时保留 1 点气血',
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
    energyCost: 12,
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
    displayName: '绝境护盾',
    displayDescription: '气血低于阈值时受击有概率获得护盾',
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
    energyCost: 9,
    applicableTo: ['artifact'],
    effectTemplate: {
      type: 'shield',
      conditions: [
        { type: 'hp_below', params: { value: 0.3 } },
        { type: 'chance', params: { value: 0.35 } },
      ],
      params: {
        value: {
          base: { base: 15, scale: 'quality', coefficient: 6 },
          attribute: AttributeType.WILLPOWER,
          coefficient: 0.3,
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
    displayName: '坚韧',
    displayDescription: '受击时降低固定伤害',
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
    energyCost: 7,
    applicableTo: ['artifact'],
    effectTemplate: {
      type: 'percent_damage_modifier',
      params: {
        mode: 'reduce',
        value: { base: 0.04, scale: 'quality', coefficient: 0.01 },
        cap: 0.3,
      },
    },
    listenerSpec: {
      eventType: GameplayTags.EVENT.DAMAGE_TAKEN,
      scope: GameplayTags.SCOPE.OWNER_AS_TARGET,
      priority: CREATION_LISTENER_PRIORITIES.damageTaken,
    },
  },

  // --- 回合回蓝 ---
  {
    id: 'artifact-defense-mana-recovery',
    displayName: '灵泉',
    displayDescription: '每回合自动回复少量法力',
    category: 'artifact_defense',
    rarity: 'common',
    match: {
      all: [CreationTags.MATERIAL.SEMANTIC_SPIRIT],
      any: [
        CreationTags.MATERIAL.SEMANTIC_QI,
        CreationTags.MATERIAL.TYPE_HERB,
        CreationTags.MATERIAL.SEMANTIC_WATER,
      ],
    },
    weight: 45,
    energyCost: 6,
    applicableTo: ['artifact'],
    grantedAbilityTags: [GameplayTags.ABILITY.FUNCTION.HEAL],
    effectTemplate: {
      type: 'heal',
      params: {
        target: 'mp',
        value: {
          base: { base: 5, scale: 'quality', coefficient: 2 },
          attribute: AttributeType.SPIRIT,
          coefficient: 0.04,
        },
      },
    },
    listenerSpec: {
      eventType: GameplayTags.EVENT.ROUND_PRE,
      scope: GameplayTags.SCOPE.OWNER_AS_TARGET,
      priority: CREATION_LISTENER_PRIORITIES.roundPre,
    },
  },

  // --- 负面清除 ---
  {
    id: 'artifact-defense-debuff-cleanse',
    displayName: '净化',
    displayDescription: '受击后有概率清除一层负面状态',
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
    energyCost: 8,
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

  // --- 绝境护甲（低血减伤） ---
  {
    id: 'artifact-defense-desperate-aegis',
    displayName: '绝境护甲',
    displayDescription: '气血低于阈值时受到伤害降低',
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
    energyCost: 8,
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
      eventType: GameplayTags.EVENT.DAMAGE_TAKEN,
      scope: GameplayTags.SCOPE.OWNER_AS_TARGET,
      priority: CREATION_LISTENER_PRIORITIES.damageTaken,
    },
  },

  // --- 8 种元素减伤 ---
  {
    id: 'artifact-defense-fire-resist',
    displayName: '火抗',
    displayDescription: '受到火系伤害降低',
    category: 'artifact_defense',
    rarity: 'common',
    match: { all: [ELEMENT_TO_MATERIAL_TAG['火']] },
    weight: 40,
    energyCost: 5,
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
      eventType: GameplayTags.EVENT.DAMAGE_TAKEN,
      scope: GameplayTags.SCOPE.OWNER_AS_TARGET,
      priority: CREATION_LISTENER_PRIORITIES.damageTaken,
    },
  },
  {
    id: 'artifact-defense-ice-resist',
    displayName: '冰抗',
    displayDescription: '受到冰系伤害降低',
    category: 'artifact_defense',
    rarity: 'common',
    match: { all: [ELEMENT_TO_MATERIAL_TAG['冰']] },
    weight: 38,
    energyCost: 5,
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
      eventType: GameplayTags.EVENT.DAMAGE_TAKEN,
      scope: GameplayTags.SCOPE.OWNER_AS_TARGET,
      priority: CREATION_LISTENER_PRIORITIES.damageTaken,
    },
  },
  {
    id: 'artifact-defense-thunder-resist',
    displayName: '雷抗',
    displayDescription: '受到雷系伤害降低',
    category: 'artifact_defense',
    rarity: 'common',
    match: { all: [ELEMENT_TO_MATERIAL_TAG['雷']] },
    weight: 36,
    energyCost: 5,
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
      eventType: GameplayTags.EVENT.DAMAGE_TAKEN,
      scope: GameplayTags.SCOPE.OWNER_AS_TARGET,
      priority: CREATION_LISTENER_PRIORITIES.damageTaken,
    },
  },
  {
    id: 'artifact-defense-wind-resist',
    displayName: '风抗',
    displayDescription: '受到风系伤害降低',
    category: 'artifact_defense',
    rarity: 'common',
    match: { all: [ELEMENT_TO_MATERIAL_TAG['风']] },
    weight: 34,
    energyCost: 5,
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
      eventType: GameplayTags.EVENT.DAMAGE_TAKEN,
      scope: GameplayTags.SCOPE.OWNER_AS_TARGET,
      priority: CREATION_LISTENER_PRIORITIES.damageTaken,
    },
  },
  {
    id: 'artifact-defense-metal-resist',
    displayName: '金抗',
    displayDescription: '受到金系伤害降低',
    category: 'artifact_defense',
    rarity: 'common',
    match: { all: [ELEMENT_TO_MATERIAL_TAG['金']] },
    weight: 32,
    energyCost: 5,
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
      eventType: GameplayTags.EVENT.DAMAGE_TAKEN,
      scope: GameplayTags.SCOPE.OWNER_AS_TARGET,
      priority: CREATION_LISTENER_PRIORITIES.damageTaken,
    },
  },
  {
    id: 'artifact-defense-water-resist',
    displayName: '水抗',
    displayDescription: '受到水系伤害降低',
    category: 'artifact_defense',
    rarity: 'common',
    match: { all: [ELEMENT_TO_MATERIAL_TAG['水']] },
    weight: 30,
    energyCost: 5,
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
      eventType: GameplayTags.EVENT.DAMAGE_TAKEN,
      scope: GameplayTags.SCOPE.OWNER_AS_TARGET,
      priority: CREATION_LISTENER_PRIORITIES.damageTaken,
    },
  },
  {
    id: 'artifact-defense-wood-resist',
    displayName: '木抗',
    displayDescription: '受到木系伤害降低',
    category: 'artifact_defense',
    rarity: 'common',
    match: { all: [ELEMENT_TO_MATERIAL_TAG['木']] },
    weight: 28,
    energyCost: 5,
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
      eventType: GameplayTags.EVENT.DAMAGE_TAKEN,
      scope: GameplayTags.SCOPE.OWNER_AS_TARGET,
      priority: CREATION_LISTENER_PRIORITIES.damageTaken,
    },
  },
  {
    id: 'artifact-defense-earth-resist',
    displayName: '土抗',
    displayDescription: '受到土系伤害降低',
    category: 'artifact_defense',
    rarity: 'common',
    match: { all: [ELEMENT_TO_MATERIAL_TAG['土']] },
    weight: 28,
    energyCost: 5,
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
      eventType: GameplayTags.EVENT.DAMAGE_TAKEN,
      scope: GameplayTags.SCOPE.OWNER_AS_TARGET,
      priority: CREATION_LISTENER_PRIORITIES.damageTaken,
    },
  },

  // --- 被暴击后回盾 ---
  {
    id: 'artifact-defense-crit-shield',
    displayName: '波澜不惊',
    displayDescription: '被暴击后获得护盾',
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
    energyCost: 8,
    applicableTo: ['artifact'],
    effectTemplate: {
      type: 'shield',
      conditions: [{ type: 'is_critical', params: {} }],
      params: {
        value: {
          base: { base: 12, scale: 'quality', coefficient: 5 },
          attribute: AttributeType.WILLPOWER,
          coefficient: 0.2,
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
    displayDescription: '被暴击后反弹伤害给攻击者',
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
    energyCost: 9,
    applicableTo: ['artifact'],
    effectTemplate: {
      type: 'reflect',
      conditions: [{ type: 'is_critical', params: {} }],
      params: {
        ratio: { base: 0.15, scale: 'quality', coefficient: 0.04 },
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
    displayName: '生命之源',
    displayDescription: '每回合回复少量气血',
    category: 'artifact_defense',
    rarity: 'common',
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
    energyCost: 6,
    applicableTo: ['artifact'],
    grantedAbilityTags: [GameplayTags.ABILITY.FUNCTION.HEAL],
    effectTemplate: {
      type: 'heal',
      params: {
        value: {
          base: { base: 6, scale: 'quality', coefficient: 3 },
          attribute: AttributeType.VITALITY,
          coefficient: 0.05,
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
    energyCost: 16,
    minQuality: '玄品',
    applicableTo: ['artifact'],
    effectTemplate: {
      type: 'percent_damage_modifier',
      conditions: [{ type: 'chance', params: { value: 0.25 } }],
      params: {
        mode: 'reduce',
        value: { base: 0.5, scale: 'quality', coefficient: 0.1 },
        cap: 0.9,
      },
    },
    listenerSpec: {
      eventType: GameplayTags.EVENT.DAMAGE_TAKEN,
      scope: GameplayTags.SCOPE.OWNER_AS_TARGET,
      priority: CREATION_LISTENER_PRIORITIES.damageTaken,
    },
  },

  // --- 护命：首次濒死保命 ---
  {
    id: 'artifact-treasure-life-guard',
    displayName: '护命',
    displayDescription: '首次受到致死伤害时保留较多气血',
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
    energyCost: 18,
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
    displayName: '太虚镜',
    displayDescription: '受到特定元素伤害时有概率完全免疫',
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
    energyCost: 17,
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
