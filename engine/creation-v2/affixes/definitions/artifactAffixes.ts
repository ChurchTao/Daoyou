/*
 * artifactAffixes: 法宝词缀定义集合（大幅扩展）。
 * 法宝词缀特点：通常包含 listenerSpec，用于被动能力的 listener 注册
 * 包括常驻属性修改、战斗中被动触发、以及高阶联动效果
 */
import { CREATION_LISTENER_PRIORITIES } from '../../config/CreationBalance';
import { ELEMENT_TO_MATERIAL_TAG } from '../../config/CreationMappings';
import {
  CreationTags,
  ELEMENT_TO_RUNTIME_ABILITY_TAG,
  GameplayTags,
} from '@/engine/shared/tag-domain';
import {
  AttributeType,
  BuffType,
  ModifierType,
  StackRule,
} from '../../contracts/battle';
import { AffixDefinition, matchAll } from '../types';

export const ARTIFACT_AFFIXES: AffixDefinition[] = [
  // ========================
  // ===== SLOT-BOUND CORE 词缀 (artifact only)
  // ========================
  {
    id: 'artifact-core-weapon-dual-edge',
    displayName: '锋魂双极',
    displayDescription: '永久提升物理攻击与法术攻击，作为战器的核心底座',
    category: 'core',
    match: matchAll([CreationTags.MATERIAL.TYPE_ORE, CreationTags.MATERIAL.SEMANTIC_BLADE]),
    exclusiveGroup: 'artifact-core-slot-weapon',
    weight: 100,
    energyCost: 8,
    applicableArtifactSlots: ['weapon'],
    applicableTo: ['artifact'],
    effectTemplate: {
      type: 'attribute_modifier',
      params: {
        modifiers: [
          {
            attrType: AttributeType.ATK,
            modType: ModifierType.FIXED,
            value: { base: 6, scale: 'quality', coefficient: 2 },
          },
          {
            attrType: AttributeType.MAGIC_ATK,
            modType: ModifierType.FIXED,
            value: { base: 6, scale: 'quality', coefficient: 2 },
          },
        ],
      },
    },
  },
  {
    id: 'artifact-core-armor-dual-ward',
    displayName: '玄甲双御',
    displayDescription: '永久提升物理防御与法术防御，作为护甲的核心底座',
    category: 'core',
    match: matchAll([CreationTags.MATERIAL.TYPE_ORE, CreationTags.MATERIAL.SEMANTIC_GUARD]),
    exclusiveGroup: 'artifact-core-slot-armor',
    weight: 100,
    energyCost: 8,
    applicableArtifactSlots: ['armor'],
    applicableTo: ['artifact'],
    effectTemplate: {
      type: 'attribute_modifier',
      params: {
        modifiers: [
          {
            attrType: AttributeType.DEF,
            modType: ModifierType.FIXED,
            value: { base: 6, scale: 'quality', coefficient: 2 },
          },
          {
            attrType: AttributeType.MAGIC_DEF,
            modType: ModifierType.FIXED,
            value: { base: 6, scale: 'quality', coefficient: 2 },
          },
        ],
      },
    },
  },
  {
    id: 'artifact-core-accessory-omen',
    displayName: '星兆坠',
    displayDescription: '永久提升暴击率与暴击伤害，作为饰品的输出型核心',
    category: 'core',
    match: matchAll([CreationTags.MATERIAL.SEMANTIC_BLADE, CreationTags.MATERIAL.SEMANTIC_BURST]),
    exclusiveGroup: 'artifact-core-slot-accessory',
    weight: 78,
    energyCost: 8,
    applicableArtifactSlots: ['accessory'],
    applicableTo: ['artifact'],
    effectTemplate: {
      type: 'attribute_modifier',
      params: {
        modifiers: [
          {
            attrType: AttributeType.CRIT_RATE,
            modType: ModifierType.FIXED,
            value: { base: 0.035, scale: 'quality', coefficient: 0.008 },
          },
          {
            attrType: AttributeType.CRIT_DAMAGE_MULT,
            modType: ModifierType.FIXED,
            value: { base: 0.08, scale: 'quality', coefficient: 0.02 },
          },
        ],
      },
    },
  },
  {
    id: 'artifact-core-accessory-skystride',
    displayName: '游光佩',
    displayDescription: '永久提升命中与闪避，作为饰品的机动型核心',
    category: 'core',
    match: matchAll([CreationTags.MATERIAL.SEMANTIC_WIND, CreationTags.MATERIAL.SEMANTIC_BLADE]),
    exclusiveGroup: 'artifact-core-slot-accessory',
    weight: 74,
    energyCost: 8,
    applicableArtifactSlots: ['accessory'],
    applicableTo: ['artifact'],
    effectTemplate: {
      type: 'attribute_modifier',
      params: {
        modifiers: [
          {
            attrType: AttributeType.ACCURACY,
            modType: ModifierType.FIXED,
            value: { base: 0.06, scale: 'quality', coefficient: 0.015 },
          },
          {
            attrType: AttributeType.EVASION_RATE,
            modType: ModifierType.FIXED,
            value: { base: 0.035, scale: 'quality', coefficient: 0.008 },
          },
        ],
      },
    },
  },
  {
    id: 'artifact-core-accessory-command',
    displayName: '摄心珮',
    displayDescription: '永久提升控制命中与控制抗性，作为饰品的控制型核心',
    category: 'core',
    match: matchAll([CreationTags.MATERIAL.SEMANTIC_MANUAL, CreationTags.MATERIAL.SEMANTIC_SPIRIT]),
    exclusiveGroup: 'artifact-core-slot-accessory',
    weight: 72,
    energyCost: 8,
    applicableArtifactSlots: ['accessory'],
    applicableTo: ['artifact'],
    effectTemplate: {
      type: 'attribute_modifier',
      params: {
        modifiers: [
          {
            attrType: AttributeType.CONTROL_HIT,
            modType: ModifierType.FIXED,
            value: { base: 0.045, scale: 'quality', coefficient: 0.01 },
          },
          {
            attrType: AttributeType.CONTROL_RESISTANCE,
            modType: ModifierType.FIXED,
            value: { base: 0.045, scale: 'quality', coefficient: 0.01 },
          },
        ],
      },
    },
  },
  {
    id: 'artifact-core-accessory-riftpiercer',
    displayName: '破界坠',
    displayDescription: '永久提升物穿与法穿，作为饰品的穿透型核心',
    category: 'core',
    match: matchAll([CreationTags.MATERIAL.SEMANTIC_METAL, CreationTags.MATERIAL.SEMANTIC_BURST]),
    exclusiveGroup: 'artifact-core-slot-accessory',
    weight: 70,
    energyCost: 8,
    applicableArtifactSlots: ['accessory'],
    applicableTo: ['artifact'],
    effectTemplate: {
      type: 'attribute_modifier',
      params: {
        modifiers: [
          {
            attrType: AttributeType.ARMOR_PENETRATION,
            modType: ModifierType.FIXED,
            value: { base: 0.08, scale: 'quality', coefficient: 0.015 },
          },
          {
            attrType: AttributeType.MAGIC_PENETRATION,
            modType: ModifierType.FIXED,
            value: { base: 0.08, scale: 'quality', coefficient: 0.015 },
          },
        ],
      },
    },
  },
  {
    id: 'artifact-core-accessory-aegis-soul',
    displayName: '守心玉',
    displayDescription: '永久提升暴击抗性与暴伤减免，作为饰品的韧性型核心',
    category: 'core',
    match: matchAll([CreationTags.MATERIAL.SEMANTIC_GUARD, CreationTags.MATERIAL.SEMANTIC_WATER]),
    exclusiveGroup: 'artifact-core-slot-accessory',
    weight: 68,
    energyCost: 8,
    applicableArtifactSlots: ['accessory'],
    applicableTo: ['artifact'],
    effectTemplate: {
      type: 'attribute_modifier',
      params: {
        modifiers: [
          {
            attrType: AttributeType.CRIT_RESIST,
            modType: ModifierType.FIXED,
            value: { base: 0.05, scale: 'quality', coefficient: 0.01 },
          },
          {
            attrType: AttributeType.CRIT_DAMAGE_REDUCTION,
            modType: ModifierType.FIXED,
            value: { base: 0.08, scale: 'quality', coefficient: 0.015 },
          },
        ],
      },
    },
  },
  {
    id: 'artifact-core-accessory-renewal',
    displayName: '回天佩',
    displayDescription: '永久提升治疗增强与命中，作为饰品的续航型核心',
    category: 'core',
    match: matchAll([CreationTags.MATERIAL.SEMANTIC_SUSTAIN, CreationTags.MATERIAL.SEMANTIC_SPIRIT]),
    exclusiveGroup: 'artifact-core-slot-accessory',
    weight: 66,
    energyCost: 8,
    applicableArtifactSlots: ['accessory'],
    applicableTo: ['artifact'],
    effectTemplate: {
      type: 'attribute_modifier',
      params: {
        modifiers: [
          {
            attrType: AttributeType.HEAL_AMPLIFY,
            modType: ModifierType.FIXED,
            value: { base: 0.07, scale: 'quality', coefficient: 0.015 },
          },
          {
            attrType: AttributeType.ACCURACY,
            modType: ModifierType.FIXED,
            value: { base: 0.05, scale: 'quality', coefficient: 0.012 },
          },
        ],
      },
    },
  },
  {
    id: 'artifact-core-weapon-dual-edge-t2',
    displayName: '玄锋双极',
    displayDescription: '玄品战器核心，同时强化物理与法术进攻能力',
    category: 'core',
    match: matchAll([CreationTags.MATERIAL.TYPE_ORE, CreationTags.MATERIAL.SEMANTIC_BLADE]),
    exclusiveGroup: 'artifact-core-slot-weapon',
    weight: 52,
    energyCost: 10,
    minQuality: '玄品',
    applicableArtifactSlots: ['weapon'],
    applicableTo: ['artifact'],
    effectTemplate: {
      type: 'attribute_modifier',
      params: {
        modifiers: [
          {
            attrType: AttributeType.ATK,
            modType: ModifierType.FIXED,
            value: { base: 9, scale: 'quality', coefficient: 3 },
          },
          {
            attrType: AttributeType.MAGIC_ATK,
            modType: ModifierType.FIXED,
            value: { base: 9, scale: 'quality', coefficient: 3 },
          },
        ],
      },
    },
  },
  {
    id: 'artifact-core-weapon-dual-edge-t3',
    displayName: '真武双极',
    displayDescription: '真品战器核心，双攻成长显著跃升',
    category: 'core',
    match: matchAll([CreationTags.MATERIAL.TYPE_ORE, CreationTags.MATERIAL.SEMANTIC_BLADE]),
    exclusiveGroup: 'artifact-core-slot-weapon',
    weight: 21,
    energyCost: 12,
    minQuality: '真品',
    applicableArtifactSlots: ['weapon'],
    applicableTo: ['artifact'],
    effectTemplate: {
      type: 'attribute_modifier',
      params: {
        modifiers: [
          {
            attrType: AttributeType.ATK,
            modType: ModifierType.FIXED,
            value: { base: 14, scale: 'quality', coefficient: 5 },
          },
          {
            attrType: AttributeType.MAGIC_ATK,
            modType: ModifierType.FIXED,
            value: { base: 14, scale: 'quality', coefficient: 5 },
          },
        ],
      },
    },
  },
  {
    id: 'artifact-core-weapon-dual-edge-t4',
    displayName: '地脉诛锋',
    displayDescription: '地品战器核心，双攻属性形成明显质变',
    category: 'core',
    match: matchAll([CreationTags.MATERIAL.TYPE_ORE, CreationTags.MATERIAL.SEMANTIC_BLADE]),
    exclusiveGroup: 'artifact-core-slot-weapon',
    weight: 7,
    energyCost: 14,
    minQuality: '地品',
    applicableArtifactSlots: ['weapon'],
    applicableTo: ['artifact'],
    effectTemplate: {
      type: 'attribute_modifier',
      params: {
        modifiers: [
          {
            attrType: AttributeType.ATK,
            modType: ModifierType.FIXED,
            value: { base: 22, scale: 'quality', coefficient: 8 },
          },
          {
            attrType: AttributeType.MAGIC_ATK,
            modType: ModifierType.FIXED,
            value: { base: 22, scale: 'quality', coefficient: 8 },
          },
        ],
      },
    },
  },
  {
    id: 'artifact-core-armor-dual-ward-t2',
    displayName: '玄甲双壁',
    displayDescription: '玄品护甲核心，同时强化物防与法防',
    category: 'core',
    match: matchAll([CreationTags.MATERIAL.TYPE_ORE, CreationTags.MATERIAL.SEMANTIC_GUARD]),
    exclusiveGroup: 'artifact-core-slot-armor',
    weight: 52,
    energyCost: 10,
    minQuality: '玄品',
    applicableArtifactSlots: ['armor'],
    applicableTo: ['artifact'],
    effectTemplate: {
      type: 'attribute_modifier',
      params: {
        modifiers: [
          {
            attrType: AttributeType.DEF,
            modType: ModifierType.FIXED,
            value: { base: 9, scale: 'quality', coefficient: 3 },
          },
          {
            attrType: AttributeType.MAGIC_DEF,
            modType: ModifierType.FIXED,
            value: { base: 9, scale: 'quality', coefficient: 3 },
          },
        ],
      },
    },
  },
  {
    id: 'artifact-core-armor-dual-ward-t3',
    displayName: '真元双壁',
    displayDescription: '真品护甲核心，双防梯度显著抬升',
    category: 'core',
    match: matchAll([CreationTags.MATERIAL.TYPE_ORE, CreationTags.MATERIAL.SEMANTIC_GUARD]),
    exclusiveGroup: 'artifact-core-slot-armor',
    weight: 21,
    energyCost: 12,
    minQuality: '真品',
    applicableArtifactSlots: ['armor'],
    applicableTo: ['artifact'],
    effectTemplate: {
      type: 'attribute_modifier',
      params: {
        modifiers: [
          {
            attrType: AttributeType.DEF,
            modType: ModifierType.FIXED,
            value: { base: 14, scale: 'quality', coefficient: 5 },
          },
          {
            attrType: AttributeType.MAGIC_DEF,
            modType: ModifierType.FIXED,
            value: { base: 14, scale: 'quality', coefficient: 5 },
          },
        ],
      },
    },
  },
  {
    id: 'artifact-core-armor-dual-ward-t4',
    displayName: '地岳双镇',
    displayDescription: '地品护甲核心，双防属性形成明显韧性门槛',
    category: 'core',
    match: matchAll([CreationTags.MATERIAL.TYPE_ORE, CreationTags.MATERIAL.SEMANTIC_GUARD]),
    exclusiveGroup: 'artifact-core-slot-armor',
    weight: 7,
    energyCost: 14,
    minQuality: '地品',
    applicableArtifactSlots: ['armor'],
    applicableTo: ['artifact'],
    effectTemplate: {
      type: 'attribute_modifier',
      params: {
        modifiers: [
          {
            attrType: AttributeType.DEF,
            modType: ModifierType.FIXED,
            value: { base: 22, scale: 'quality', coefficient: 8 },
          },
          {
            attrType: AttributeType.MAGIC_DEF,
            modType: ModifierType.FIXED,
            value: { base: 22, scale: 'quality', coefficient: 8 },
          },
        ],
      },
    },
  },
  {
    id: 'artifact-core-accessory-omen-t2',
    displayName: '星魄凶兆',
    displayDescription: '玄品饰品核心，暴击双属性进入清晰成长带',
    category: 'core',
    match: matchAll([CreationTags.MATERIAL.SEMANTIC_BLADE, CreationTags.MATERIAL.SEMANTIC_BURST]),
    exclusiveGroup: 'artifact-core-slot-accessory',
    weight: 44,
    energyCost: 10,
    minQuality: '玄品',
    applicableArtifactSlots: ['accessory'],
    applicableTo: ['artifact'],
    effectTemplate: {
      type: 'attribute_modifier',
      params: {
        modifiers: [
          {
            attrType: AttributeType.CRIT_RATE,
            modType: ModifierType.FIXED,
            value: { base: 0.05, scale: 'quality', coefficient: 0.012 },
          },
          {
            attrType: AttributeType.CRIT_DAMAGE_MULT,
            modType: ModifierType.FIXED,
            value: { base: 0.12, scale: 'quality', coefficient: 0.03 },
          },
        ],
      },
    },
  },
  {
    id: 'artifact-core-accessory-omen-t3',
    displayName: '天机凶兆',
    displayDescription: '真品饰品核心，暴击率与暴伤形成高阶质变',
    category: 'core',
    match: matchAll([CreationTags.MATERIAL.SEMANTIC_BLADE, CreationTags.MATERIAL.SEMANTIC_BURST]),
    exclusiveGroup: 'artifact-core-slot-accessory',
    weight: 18,
    energyCost: 12,
    minQuality: '真品',
    applicableArtifactSlots: ['accessory'],
    applicableTo: ['artifact'],
    effectTemplate: {
      type: 'attribute_modifier',
      params: {
        modifiers: [
          {
            attrType: AttributeType.CRIT_RATE,
            modType: ModifierType.FIXED,
            value: { base: 0.075, scale: 'quality', coefficient: 0.018 },
          },
          {
            attrType: AttributeType.CRIT_DAMAGE_MULT,
            modType: ModifierType.FIXED,
            value: { base: 0.18, scale: 'quality', coefficient: 0.045 },
          },
        ],
      },
    },
  },
  {
    id: 'artifact-core-accessory-omen-t4',
    displayName: '灭劫星坠',
    displayDescription: '地品饰品核心，暴击双属性足以主导输出节奏',
    category: 'core',
    match: matchAll([CreationTags.MATERIAL.SEMANTIC_BLADE, CreationTags.MATERIAL.SEMANTIC_BURST]),
    exclusiveGroup: 'artifact-core-slot-accessory',
    weight: 5,
    energyCost: 14,
    minQuality: '地品',
    applicableArtifactSlots: ['accessory'],
    applicableTo: ['artifact'],
    effectTemplate: {
      type: 'attribute_modifier',
      params: {
        modifiers: [
          {
            attrType: AttributeType.CRIT_RATE,
            modType: ModifierType.FIXED,
            value: { base: 0.11, scale: 'quality', coefficient: 0.024 },
          },
          {
            attrType: AttributeType.CRIT_DAMAGE_MULT,
            modType: ModifierType.FIXED,
            value: { base: 0.26, scale: 'quality', coefficient: 0.06 },
          },
        ],
      },
    },
  },
  {
    id: 'artifact-core-accessory-skystride-t2',
    displayName: '流光御风佩',
    displayDescription: '玄品饰品核心，命中与闪避形成机动梯度',
    category: 'core',
    match: matchAll([CreationTags.MATERIAL.SEMANTIC_WIND, CreationTags.MATERIAL.SEMANTIC_BLADE]),
    exclusiveGroup: 'artifact-core-slot-accessory',
    weight: 42,
    energyCost: 10,
    minQuality: '玄品',
    applicableArtifactSlots: ['accessory'],
    applicableTo: ['artifact'],
    effectTemplate: {
      type: 'attribute_modifier',
      params: {
        modifiers: [
          {
            attrType: AttributeType.ACCURACY,
            modType: ModifierType.FIXED,
            value: { base: 0.08, scale: 'quality', coefficient: 0.02 },
          },
          {
            attrType: AttributeType.EVASION_RATE,
            modType: ModifierType.FIXED,
            value: { base: 0.05, scale: 'quality', coefficient: 0.012 },
          },
        ],
      },
    },
  },
  {
    id: 'artifact-core-accessory-skystride-t3',
    displayName: '太虚游光佩',
    displayDescription: '真品饰品核心，机动双属性进入高阶档位',
    category: 'core',
    match: matchAll([CreationTags.MATERIAL.SEMANTIC_WIND, CreationTags.MATERIAL.SEMANTIC_BLADE]),
    exclusiveGroup: 'artifact-core-slot-accessory',
    weight: 17,
    energyCost: 12,
    minQuality: '真品',
    applicableArtifactSlots: ['accessory'],
    applicableTo: ['artifact'],
    effectTemplate: {
      type: 'attribute_modifier',
      params: {
        modifiers: [
          {
            attrType: AttributeType.ACCURACY,
            modType: ModifierType.FIXED,
            value: { base: 0.11, scale: 'quality', coefficient: 0.025 },
          },
          {
            attrType: AttributeType.EVASION_RATE,
            modType: ModifierType.FIXED,
            value: { base: 0.07, scale: 'quality', coefficient: 0.016 },
          },
        ],
      },
    },
  },
  {
    id: 'artifact-core-accessory-skystride-t4',
    displayName: '遁天逐影佩',
    displayDescription: '地品饰品核心，高机动属性可重塑命中与闪避节奏',
    category: 'core',
    match: matchAll([CreationTags.MATERIAL.SEMANTIC_WIND, CreationTags.MATERIAL.SEMANTIC_BLADE]),
    exclusiveGroup: 'artifact-core-slot-accessory',
    weight: 5,
    energyCost: 14,
    minQuality: '地品',
    applicableArtifactSlots: ['accessory'],
    applicableTo: ['artifact'],
    effectTemplate: {
      type: 'attribute_modifier',
      params: {
        modifiers: [
          {
            attrType: AttributeType.ACCURACY,
            modType: ModifierType.FIXED,
            value: { base: 0.15, scale: 'quality', coefficient: 0.032 },
          },
          {
            attrType: AttributeType.EVASION_RATE,
            modType: ModifierType.FIXED,
            value: { base: 0.1, scale: 'quality', coefficient: 0.02 },
          },
        ],
      },
    },
  },
  {
    id: 'artifact-core-accessory-command-t2',
    displayName: '镇心御令',
    displayDescription: '玄品饰品核心，控制命中与抗性同时抬升',
    category: 'core',
    match: matchAll([CreationTags.MATERIAL.SEMANTIC_MANUAL, CreationTags.MATERIAL.SEMANTIC_SPIRIT]),
    exclusiveGroup: 'artifact-core-slot-accessory',
    weight: 40,
    energyCost: 10,
    minQuality: '玄品',
    applicableArtifactSlots: ['accessory'],
    applicableTo: ['artifact'],
    effectTemplate: {
      type: 'attribute_modifier',
      params: {
        modifiers: [
          {
            attrType: AttributeType.CONTROL_HIT,
            modType: ModifierType.FIXED,
            value: { base: 0.06, scale: 'quality', coefficient: 0.015 },
          },
          {
            attrType: AttributeType.CONTROL_RESISTANCE,
            modType: ModifierType.FIXED,
            value: { base: 0.06, scale: 'quality', coefficient: 0.015 },
          },
        ],
      },
    },
  },
  {
    id: 'artifact-core-accessory-command-t3',
    displayName: '天威摄心珮',
    displayDescription: '真品饰品核心，控制对抗能力进入高阶层级',
    category: 'core',
    match: matchAll([CreationTags.MATERIAL.SEMANTIC_MANUAL, CreationTags.MATERIAL.SEMANTIC_SPIRIT]),
    exclusiveGroup: 'artifact-core-slot-accessory',
    weight: 16,
    energyCost: 12,
    minQuality: '真品',
    applicableArtifactSlots: ['accessory'],
    applicableTo: ['artifact'],
    effectTemplate: {
      type: 'attribute_modifier',
      params: {
        modifiers: [
          {
            attrType: AttributeType.CONTROL_HIT,
            modType: ModifierType.FIXED,
            value: { base: 0.085, scale: 'quality', coefficient: 0.02 },
          },
          {
            attrType: AttributeType.CONTROL_RESISTANCE,
            modType: ModifierType.FIXED,
            value: { base: 0.085, scale: 'quality', coefficient: 0.02 },
          },
        ],
      },
    },
  },
  {
    id: 'artifact-core-accessory-command-t4',
    displayName: '绝识统御珮',
    displayDescription: '地品饰品核心，控制命中与抗性形成显著质变',
    category: 'core',
    match: matchAll([CreationTags.MATERIAL.SEMANTIC_MANUAL, CreationTags.MATERIAL.SEMANTIC_SPIRIT]),
    exclusiveGroup: 'artifact-core-slot-accessory',
    weight: 5,
    energyCost: 14,
    minQuality: '地品',
    applicableArtifactSlots: ['accessory'],
    applicableTo: ['artifact'],
    effectTemplate: {
      type: 'attribute_modifier',
      params: {
        modifiers: [
          {
            attrType: AttributeType.CONTROL_HIT,
            modType: ModifierType.FIXED,
            value: { base: 0.12, scale: 'quality', coefficient: 0.025 },
          },
          {
            attrType: AttributeType.CONTROL_RESISTANCE,
            modType: ModifierType.FIXED,
            value: { base: 0.12, scale: 'quality', coefficient: 0.025 },
          },
        ],
      },
    },
  },
  {
    id: 'artifact-core-accessory-riftpiercer-t2',
    displayName: '裂隙穿霄坠',
    displayDescription: '玄品饰品核心，双穿透进入可感知成长带',
    category: 'core',
    match: matchAll([CreationTags.MATERIAL.SEMANTIC_METAL, CreationTags.MATERIAL.SEMANTIC_BURST]),
    exclusiveGroup: 'artifact-core-slot-accessory',
    weight: 38,
    energyCost: 10,
    minQuality: '玄品',
    applicableArtifactSlots: ['accessory'],
    applicableTo: ['artifact'],
    effectTemplate: {
      type: 'attribute_modifier',
      params: {
        modifiers: [
          {
            attrType: AttributeType.ARMOR_PENETRATION,
            modType: ModifierType.FIXED,
            value: { base: 0.11, scale: 'quality', coefficient: 0.02 },
          },
          {
            attrType: AttributeType.MAGIC_PENETRATION,
            modType: ModifierType.FIXED,
            value: { base: 0.11, scale: 'quality', coefficient: 0.02 },
          },
        ],
      },
    },
  },
  {
    id: 'artifact-core-accessory-riftpiercer-t3',
    displayName: '太虚断界坠',
    displayDescription: '真品饰品核心，双穿透形成清晰的破防质变',
    category: 'core',
    match: matchAll([CreationTags.MATERIAL.SEMANTIC_METAL, CreationTags.MATERIAL.SEMANTIC_BURST]),
    exclusiveGroup: 'artifact-core-slot-accessory',
    weight: 16,
    energyCost: 12,
    minQuality: '真品',
    applicableArtifactSlots: ['accessory'],
    applicableTo: ['artifact'],
    effectTemplate: {
      type: 'attribute_modifier',
      params: {
        modifiers: [
          {
            attrType: AttributeType.ARMOR_PENETRATION,
            modType: ModifierType.FIXED,
            value: { base: 0.15, scale: 'quality', coefficient: 0.03 },
          },
          {
            attrType: AttributeType.MAGIC_PENETRATION,
            modType: ModifierType.FIXED,
            value: { base: 0.15, scale: 'quality', coefficient: 0.03 },
          },
        ],
      },
    },
  },
  {
    id: 'artifact-core-accessory-riftpiercer-t4',
    displayName: '诸天破界坠',
    displayDescription: '地品饰品核心，双穿透足以显著缩短优势局回合',
    category: 'core',
    match: matchAll([CreationTags.MATERIAL.SEMANTIC_METAL, CreationTags.MATERIAL.SEMANTIC_BURST]),
    exclusiveGroup: 'artifact-core-slot-accessory',
    weight: 5,
    energyCost: 14,
    minQuality: '地品',
    applicableArtifactSlots: ['accessory'],
    applicableTo: ['artifact'],
    effectTemplate: {
      type: 'attribute_modifier',
      params: {
        modifiers: [
          {
            attrType: AttributeType.ARMOR_PENETRATION,
            modType: ModifierType.FIXED,
            value: { base: 0.2, scale: 'quality', coefficient: 0.04 },
          },
          {
            attrType: AttributeType.MAGIC_PENETRATION,
            modType: ModifierType.FIXED,
            value: { base: 0.2, scale: 'quality', coefficient: 0.04 },
          },
        ],
      },
    },
  },
  {
    id: 'artifact-core-accessory-aegis-soul-t2',
    displayName: '守心玄玉',
    displayDescription: '玄品饰品核心，韧性双属性形成明确成长',
    category: 'core',
    match: matchAll([CreationTags.MATERIAL.SEMANTIC_GUARD, CreationTags.MATERIAL.SEMANTIC_WATER]),
    exclusiveGroup: 'artifact-core-slot-accessory',
    weight: 36,
    energyCost: 10,
    minQuality: '玄品',
    applicableArtifactSlots: ['accessory'],
    applicableTo: ['artifact'],
    effectTemplate: {
      type: 'attribute_modifier',
      params: {
        modifiers: [
          {
            attrType: AttributeType.CRIT_RESIST,
            modType: ModifierType.FIXED,
            value: { base: 0.07, scale: 'quality', coefficient: 0.015 },
          },
          {
            attrType: AttributeType.CRIT_DAMAGE_REDUCTION,
            modType: ModifierType.FIXED,
            value: { base: 0.12, scale: 'quality', coefficient: 0.02 },
          },
        ],
      },
    },
  },
  {
    id: 'artifact-core-accessory-aegis-soul-t3',
    displayName: '太一镇魄玉',
    displayDescription: '真品饰品核心，韧性成长足以压低敌方暴击收益',
    category: 'core',
    match: matchAll([CreationTags.MATERIAL.SEMANTIC_GUARD, CreationTags.MATERIAL.SEMANTIC_WATER]),
    exclusiveGroup: 'artifact-core-slot-accessory',
    weight: 15,
    energyCost: 12,
    minQuality: '真品',
    applicableArtifactSlots: ['accessory'],
    applicableTo: ['artifact'],
    effectTemplate: {
      type: 'attribute_modifier',
      params: {
        modifiers: [
          {
            attrType: AttributeType.CRIT_RESIST,
            modType: ModifierType.FIXED,
            value: { base: 0.1, scale: 'quality', coefficient: 0.02 },
          },
          {
            attrType: AttributeType.CRIT_DAMAGE_REDUCTION,
            modType: ModifierType.FIXED,
            value: { base: 0.18, scale: 'quality', coefficient: 0.03 },
          },
        ],
      },
    },
  },
  {
    id: 'artifact-core-accessory-aegis-soul-t4',
    displayName: '万劫不破玉',
    displayDescription: '地品饰品核心，韧性双属性形成高阶生存门槛',
    category: 'core',
    match: matchAll([CreationTags.MATERIAL.SEMANTIC_GUARD, CreationTags.MATERIAL.SEMANTIC_WATER]),
    exclusiveGroup: 'artifact-core-slot-accessory',
    weight: 5,
    energyCost: 14,
    minQuality: '地品',
    applicableArtifactSlots: ['accessory'],
    applicableTo: ['artifact'],
    effectTemplate: {
      type: 'attribute_modifier',
      params: {
        modifiers: [
          {
            attrType: AttributeType.CRIT_RESIST,
            modType: ModifierType.FIXED,
            value: { base: 0.14, scale: 'quality', coefficient: 0.028 },
          },
          {
            attrType: AttributeType.CRIT_DAMAGE_REDUCTION,
            modType: ModifierType.FIXED,
            value: { base: 0.24, scale: 'quality', coefficient: 0.04 },
          },
        ],
      },
    },
  },
  {
    id: 'artifact-core-accessory-renewal-t2',
    displayName: '回天灵佩',
    displayDescription: '玄品饰品核心，治疗增强与命中同步抬升',
    category: 'core',
    match: matchAll([CreationTags.MATERIAL.SEMANTIC_SUSTAIN, CreationTags.MATERIAL.SEMANTIC_SPIRIT]),
    exclusiveGroup: 'artifact-core-slot-accessory',
    weight: 34,
    energyCost: 10,
    minQuality: '玄品',
    applicableArtifactSlots: ['accessory'],
    applicableTo: ['artifact'],
    effectTemplate: {
      type: 'attribute_modifier',
      params: {
        modifiers: [
          {
            attrType: AttributeType.HEAL_AMPLIFY,
            modType: ModifierType.FIXED,
            value: { base: 0.1, scale: 'quality', coefficient: 0.02 },
          },
          {
            attrType: AttributeType.ACCURACY,
            modType: ModifierType.FIXED,
            value: { base: 0.07, scale: 'quality', coefficient: 0.015 },
          },
        ],
      },
    },
  },
  {
    id: 'artifact-core-accessory-renewal-t3',
    displayName: '万生回天佩',
    displayDescription: '真品饰品核心，续航与命中同时形成高阶成长',
    category: 'core',
    match: matchAll([CreationTags.MATERIAL.SEMANTIC_SUSTAIN, CreationTags.MATERIAL.SEMANTIC_SPIRIT]),
    exclusiveGroup: 'artifact-core-slot-accessory',
    weight: 18,
    energyCost: 12,
    minQuality: '真品',
    applicableArtifactSlots: ['accessory'],
    applicableTo: ['artifact'],
    effectTemplate: {
      type: 'attribute_modifier',
      params: {
        modifiers: [
          {
            attrType: AttributeType.HEAL_AMPLIFY,
            modType: ModifierType.FIXED,
            value: { base: 0.14, scale: 'quality', coefficient: 0.03 },
          },
          {
            attrType: AttributeType.ACCURACY,
            modType: ModifierType.FIXED,
            value: { base: 0.1, scale: 'quality', coefficient: 0.02 },
          },
        ],
      },
    },
  },
  {
    id: 'artifact-core-accessory-renewal-t4',
    displayName: '渡厄长生佩',
    displayDescription: '地品饰品核心，续航双属性足以改变拉锯战表现',
    category: 'core',
    match: matchAll([CreationTags.MATERIAL.SEMANTIC_SUSTAIN, CreationTags.MATERIAL.SEMANTIC_SPIRIT]),
    exclusiveGroup: 'artifact-core-slot-accessory',
    weight: 4,
    energyCost: 14,
    minQuality: '地品',
    applicableArtifactSlots: ['accessory'],
    applicableTo: ['artifact'],
    effectTemplate: {
      type: 'attribute_modifier',
      params: {
        modifiers: [
          {
            attrType: AttributeType.HEAL_AMPLIFY,
            modType: ModifierType.FIXED,
            value: { base: 0.19, scale: 'quality', coefficient: 0.04 },
          },
          {
            attrType: AttributeType.ACCURACY,
            modType: ModifierType.FIXED,
            value: { base: 0.14, scale: 'quality', coefficient: 0.03 },
          },
        ],
      },
    },
  },

  // ========================
  // ===== LEGACY 非槽位词缀（已降级为 prefix / suffix，避免继续占用 core 合约）
  // ========================
  {
    id: 'artifact-core-vitality',
    displayName: '万载玄铁之躯',
    displayDescription: '永久提升体魄，增强耐久力',
    category: 'prefix',
    match: matchAll([CreationTags.MATERIAL.TYPE_ORE, CreationTags.MATERIAL.SEMANTIC_GUARD]),
    exclusiveGroup: 'artifact-core-stat',
    weight: 95,
    energyCost: 8,
    applicableTo: ['artifact'],
    effectTemplate: {
      type: 'attribute_modifier',
      params: {
        attrType: AttributeType.VITALITY,
        modType: ModifierType.FIXED,
        value: { base: 4, scale: 'quality', coefficient: 2 },
      },
    },
  },
  {
    id: 'artifact-core-spirit',
    displayName: '灵光聚蕴',
    displayDescription: '永久提升灵力，增加魔法威力',
    category: 'prefix',
    match: matchAll([CreationTags.MATERIAL.SEMANTIC_SPIRIT, CreationTags.MATERIAL.TYPE_MONSTER]),
    exclusiveGroup: 'artifact-core-stat',
    weight: 90,
    energyCost: 8,
    applicableTo: ['artifact'],
    effectTemplate: {
      type: 'attribute_modifier',
      params: {
        attrType: AttributeType.SPIRIT,
        modType: ModifierType.FIXED,
        value: { base: 4, scale: 'quality', coefficient: 2 },
      },
    },
  },
  {
    id: 'artifact-core-attack-power',
    displayName: '锐金神锋',
    displayDescription: '永久提升物理攻击力',
    category: 'prefix',
    match: matchAll([CreationTags.MATERIAL.SEMANTIC_BLADE, CreationTags.MATERIAL.TYPE_ORE]),
    exclusiveGroup: 'artifact-core-stat',
    weight: 82,
    energyCost: 8,
    applicableTo: ['artifact'],
    effectTemplate: {
      type: 'attribute_modifier',
      params: {
        attrType: AttributeType.ATK,
        modType: ModifierType.FIXED,
        value: { base: 4, scale: 'quality', coefficient: 2 },
      },
    },
  },
  {
    id: 'artifact-core-magic-attack',
    displayName: '法力汇聚',
    displayDescription: '永久提升法术攻击力',
    category: 'prefix',
    match: matchAll([CreationTags.MATERIAL.SEMANTIC_SPIRIT, CreationTags.MATERIAL.SEMANTIC_BURST]),
    exclusiveGroup: 'artifact-core-stat',
    weight: 80,
    energyCost: 8,
    applicableTo: ['artifact'],
    effectTemplate: {
      type: 'attribute_modifier',
      params: {
        attrType: AttributeType.MAGIC_ATK,
        modType: ModifierType.FIXED,
        value: { base: 4, scale: 'quality', coefficient: 2 },
      },
    },
  },
  {
    id: 'artifact-core-shield-on-hit',
    displayName: '护盾反应',
    displayDescription: '受击时自动生成防护护盾',
    category: 'suffix',
    match: matchAll([
      CreationTags.MATERIAL.SEMANTIC_GUARD,
      CreationTags.MATERIAL.TYPE_ORE,
      CreationTags.MATERIAL.SEMANTIC_BURST,
    ]),
    exclusiveGroup: 'artifact-core-defense',
    weight: 75,
    energyCost: 10,
    applicableTo: ['artifact'],
    grantedAbilityTags: [GameplayTags.TRAIT.SHIELD_MASTER],
    effectTemplate: {
      type: 'shield',
      params: {
        value: {
          base: { base: 14, scale: 'quality', coefficient: 6 },
          attribute: AttributeType.SPIRIT,
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
  {
    id: 'artifact-core-reflect-thorns',
    displayName: '荆甲反噬',
    displayDescription: '受击后反震伤害给攻击者',
    category: 'suffix',
    match: matchAll([CreationTags.MATERIAL.SEMANTIC_GUARD, CreationTags.MATERIAL.SEMANTIC_BURST]),
    exclusiveGroup: 'artifact-core-defense',
    weight: 70,
    energyCost: 10,
    applicableTo: ['artifact'],
    grantedAbilityTags: [GameplayTags.TRAIT.REFLECT],
    effectTemplate: {
      type: 'reflect',
      params: {
        ratio: { base: 0.12, scale: 'quality', coefficient: 0.03 },
      },
    },
    listenerSpec: {
      eventType: GameplayTags.EVENT.DAMAGE_TAKEN,
      scope: GameplayTags.SCOPE.OWNER_AS_TARGET,
      priority: CREATION_LISTENER_PRIORITIES.damageTaken,
      guard: {
        skipReflectSource: true,
      },
    },
  },
  {
    id: 'artifact-core-heal-passive',
    displayName: '生命泉眼',
    displayDescription: '战斗中每回合恢复气血',
    category: 'suffix',
    match: matchAll([CreationTags.MATERIAL.SEMANTIC_SUSTAIN, CreationTags.MATERIAL.TYPE_HERB]),
    exclusiveGroup: 'artifact-core-defense',
    weight: 68,
    energyCost: 9,
    applicableTo: ['artifact'],
    grantedAbilityTags: [GameplayTags.ABILITY.FUNCTION.HEAL],
    effectTemplate: {
      type: 'heal',
      params: {
        value: {
          base: { base: 10, scale: 'quality', coefficient: 4 },
          attribute: AttributeType.SPIRIT,
          coefficient: 0.2,
        },
      },
    },
    listenerSpec: {
      eventType: GameplayTags.EVENT.ROUND_PRE,
      scope: GameplayTags.SCOPE.GLOBAL,
      priority: CREATION_LISTENER_PRIORITIES.roundPre,
      mapping: {
        caster: 'owner',
        target: 'owner',
      },
    },
  },
  {
    id: 'artifact-core-death-prevent',
    displayName: '临危不惧',
    displayDescription: '一次战斗中当生命危急时强行续住一线',
    category: 'suffix',
    match: matchAll([
      CreationTags.MATERIAL.SEMANTIC_GUARD,
      CreationTags.MATERIAL.SEMANTIC_SPIRIT,
      CreationTags.MATERIAL.TYPE_SPECIAL,
    ]),
    exclusiveGroup: 'artifact-core-defense',
    weight: 55,
    energyCost: 11,
    applicableTo: ['artifact'],
    effectTemplate: {
      type: 'death_prevent',
      params: {},
    },
    listenerSpec: {
      eventType: GameplayTags.EVENT.DAMAGE_TAKEN,
      scope: GameplayTags.SCOPE.OWNER_AS_TARGET,
      priority: CREATION_LISTENER_PRIORITIES.damageTaken,
      guard: {
        requireOwnerAlive: false,
        allowLethalWindow: true,
      },
    },
  },
  {
    id: 'artifact-core-last-stand-shell',
    displayName: '玄壳逆守',
    displayDescription: '仅在自身低血时触发强化护盾',
    category: 'suffix',
    match: matchAll([
      CreationTags.MATERIAL.SEMANTIC_GUARD,
      CreationTags.MATERIAL.SEMANTIC_SPIRIT,
    ]),
    exclusiveGroup: 'artifact-core-defense',
    weight: 44,
    energyCost: 11,
    minQuality: '灵品',
    applicableTo: ['artifact'],
    grantedAbilityTags: [GameplayTags.TRAIT.SHIELD_MASTER],
    effectTemplate: {
      type: 'shield',
      conditions: [{ type: 'hp_below', params: { value: 0.4, scope: 'caster' } }],
      params: {
        value: {
          base: { base: 18, scale: 'quality', coefficient: 6 },
          attribute: AttributeType.SPIRIT,
          coefficient: 0.25,
        },
      },
    },
    listenerSpec: {
      eventType: GameplayTags.EVENT.DAMAGE_TAKEN,
      scope: GameplayTags.SCOPE.OWNER_AS_TARGET,
      priority: CREATION_LISTENER_PRIORITIES.damageTaken,
    },
  },

  // ========================
  // ===== PREFIX 词缀 (13 种)
  // ========================
  {
    id: 'artifact-prefix-crit-rate',
    displayName: '锋刃之势',
    displayDescription: '永久提升暴击率',
    category: 'prefix',
    match: matchAll([CreationTags.MATERIAL.SEMANTIC_BLADE, CreationTags.MATERIAL.TYPE_MONSTER]),
    exclusiveGroup: 'artifact-prefix-crit-rate-tier',
    weight: 90,
    energyCost: 6,
    applicableTo: ['artifact'],
    effectTemplate: {
      type: 'attribute_modifier',
      params: {
        attrType: AttributeType.CRIT_RATE,
        modType: ModifierType.FIXED,
        value: { base: 0.03, scale: 'quality', coefficient: 0.01 },
      },
    },
  },
  {
    id: 'artifact-prefix-speed',
    displayName: '风行步',
    displayDescription: '永久提升身法速度',
    category: 'prefix',
    match: matchAll([CreationTags.MATERIAL.SEMANTIC_WIND, ELEMENT_TO_MATERIAL_TAG['风']]),
    exclusiveGroup: 'artifact-prefix-mobility',
    weight: 80,
    energyCost: 6,
    applicableTo: ['artifact'],
    effectTemplate: {
      type: 'attribute_modifier',
      params: {
        attrType: AttributeType.SPEED,
        modType: ModifierType.FIXED,
        value: { base: 2, scale: 'quality', coefficient: 1 },
      },
    },
  },
  {
    id: 'artifact-prefix-evasion',
    displayName: '轻灵之影',
    displayDescription: '永久提升闪避率',
    category: 'prefix',
    match: matchAll([CreationTags.MATERIAL.SEMANTIC_WIND, CreationTags.MATERIAL.SEMANTIC_BLADE]),
    exclusiveGroup: 'artifact-prefix-mobility',
    weight: 75,
    energyCost: 6,
    applicableTo: ['artifact'],
    effectTemplate: {
      type: 'attribute_modifier',
      params: {
        attrType: AttributeType.EVASION_RATE,
        modType: ModifierType.FIXED,
        value: { base: 0.03, scale: 'quality', coefficient: 0.01 },
      },
    },
  },
  {
    id: 'artifact-prefix-magic-penetration',
    displayName: '法穿锐锋',
    displayDescription: '永久提升法术穿透',
    category: 'prefix',
    match: matchAll([CreationTags.MATERIAL.SEMANTIC_SPIRIT, CreationTags.MATERIAL.SEMANTIC_BURST]),
    weight: 70,
    energyCost: 7,
    applicableTo: ['artifact'],
    effectTemplate: {
      type: 'attribute_modifier',
      params: {
        attrType: AttributeType.MAGIC_PENETRATION,
        modType: ModifierType.FIXED,
        value: { base: 0.05, scale: 'quality', coefficient: 0.015 },
      },
    },
  },
  {
    id: 'artifact-prefix-crit-damage',
    displayName: '暴击深化',
    displayDescription: '永久提升暴击伤害倍数',
    category: 'prefix',
    match: matchAll([CreationTags.MATERIAL.SEMANTIC_BURST, CreationTags.MATERIAL.TYPE_ORE]),
    exclusiveGroup: 'artifact-prefix-crit-dmg-tier',
    weight: 68,
    energyCost: 7,
    applicableTo: ['artifact'],
    effectTemplate: {
      type: 'attribute_modifier',
      params: {
        attrType: AttributeType.CRIT_DAMAGE_MULT,
        modType: ModifierType.FIXED,
        value: { base: 0.1, scale: 'quality', coefficient: 0.02 },
      },
    },
  },
  {
    id: 'artifact-prefix-heal-amplify',
    displayName: '医手回春',
    displayDescription: '永久提升治疗效果倍数',
    category: 'prefix',
    match: matchAll([CreationTags.MATERIAL.SEMANTIC_SUSTAIN, CreationTags.MATERIAL.SEMANTIC_SPIRIT]),
    weight: 65,
    energyCost: 7,
    applicableTo: ['artifact'],
    effectTemplate: {
      type: 'attribute_modifier',
      params: {
        attrType: AttributeType.HEAL_AMPLIFY,
        modType: ModifierType.FIXED,
        value: { base: 0.08, scale: 'quality', coefficient: 0.015 },
      },
    },
  },
  {
    id: 'artifact-prefix-cooldown-seal',
    displayName: '封窍镇息',
    displayDescription: '持有者施法命中时延长目标冷却',
    category: 'prefix',
    match: matchAll([CreationTags.MATERIAL.SEMANTIC_MANUAL, CreationTags.MATERIAL.SEMANTIC_GUARD]),
    weight: 60,
    energyCost: 7,
    applicableTo: ['artifact'],
    effectTemplate: {
      type: 'cooldown_modify',
      params: {
        cdModifyValue: { base: 0.8, scale: 'quality', coefficient: 0.15 },
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
    id: 'artifact-prefix-physical-defense',
    displayName: '铁血护体',
    displayDescription: '永久提升物理防御',
    category: 'prefix',
    match: matchAll([CreationTags.MATERIAL.SEMANTIC_GUARD, CreationTags.MATERIAL.TYPE_ORE]),
    weight: 58,
    energyCost: 6,
    applicableTo: ['artifact'],
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
    id: 'artifact-prefix-magic-defense',
    displayName: '法力屏障',
    displayDescription: '永久提升法术防御',
    category: 'prefix',
    match: matchAll([CreationTags.MATERIAL.SEMANTIC_SPIRIT, CreationTags.MATERIAL.TYPE_HERB]),
    weight: 56,
    energyCost: 6,
    applicableTo: ['artifact'],
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
    id: 'artifact-prefix-willpower-boost',
    displayName: '心如磐石',
    displayDescription: '永久提升意志力，抵抗控制',
    category: 'prefix',
    match: matchAll([CreationTags.MATERIAL.SEMANTIC_MANUAL, CreationTags.MATERIAL.TYPE_MANUAL]),
    weight: 52,
    energyCost: 6,
    applicableTo: ['artifact'],
    effectTemplate: {
      type: 'attribute_modifier',
      params: {
        attrType: AttributeType.WILLPOWER,
        modType: ModifierType.FIXED,
        value: { base: 2, scale: 'quality', coefficient: 1 },
      },
    },
  },
  {
    id: 'artifact-prefix-wisdom-insight',
    displayName: '明慧识海',
    displayDescription: '永久提升悟性，加快修为',
    category: 'prefix',
    match: matchAll([CreationTags.MATERIAL.SEMANTIC_SPIRIT, CreationTags.MATERIAL.SEMANTIC_MANUAL]),
    weight: 50,
    energyCost: 6,
    applicableTo: ['artifact'],
    effectTemplate: {
      type: 'attribute_modifier',
      params: {
        attrType: AttributeType.WISDOM,
        modType: ModifierType.FIXED,
        value: { base: 2, scale: 'quality', coefficient: 1 },
      },
    },
  },
  {
    id: 'artifact-prefix-chill-hunter',
    displayName: '霜痕猎袭',
    displayDescription: '仅对冰缓目标触发额外增伤',
    category: 'prefix',
    match: matchAll([
      CreationTags.MATERIAL.SEMANTIC_FREEZE,
      CreationTags.MATERIAL.SEMANTIC_BURST,
    ]),
    weight: 42,
    energyCost: 7,
    applicableTo: ['artifact'],
    effectTemplate: {
      type: 'percent_damage_modifier',
      conditions: [
        { type: 'has_tag', params: { tag: GameplayTags.STATUS.STATE.CHILLED } },
      ],
      params: {
        mode: 'increase',
        value: { base: 0.13, scale: 'quality', coefficient: 0.025 },
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
  // ===== SUFFIX 词缀 (11 种)
  // ========================
  {
    id: 'artifact-suffix-heal-on-round',
    displayName: '回生珠',
    displayDescription: '每回合开始时恢复气血',
    category: 'suffix',
    match: matchAll([CreationTags.MATERIAL.SEMANTIC_SUSTAIN, CreationTags.MATERIAL.TYPE_HERB]),
    exclusiveGroup: 'artifact-suffix-round-heal-tier',
    weight: 75,
    energyCost: 8,
    applicableTo: ['artifact'],
    grantedAbilityTags: [GameplayTags.ABILITY.FUNCTION.HEAL],
    effectTemplate: {
      type: 'heal',
      params: {
        value: {
          base: { base: 8, scale: 'quality', coefficient: 4 },
          attribute: AttributeType.SPIRIT,
          coefficient: 0.15,
        },
      },
    },
    listenerSpec: {
      eventType: GameplayTags.EVENT.ROUND_PRE,
      scope: GameplayTags.SCOPE.GLOBAL,
      priority: CREATION_LISTENER_PRIORITIES.roundPre,
      mapping: {
        caster: 'owner',
        target: 'owner',
      },
    },
  },
  {
    id: 'artifact-suffix-armor-passive',
    displayName: '坚壁',
    displayDescription: '受击时减免伤害',
    category: 'suffix',
    match: matchAll([CreationTags.MATERIAL.SEMANTIC_GUARD, CreationTags.MATERIAL.TYPE_ORE]),
    weight: 70,
    energyCost: 8,
    applicableTo: ['artifact'],
    effectTemplate: {
      type: 'percent_damage_modifier',
      params: {
        mode: 'reduce',
        value: { base: 0.08, scale: 'quality', coefficient: 0.02 },
        cap: 0.35,
      },
    },
    listenerSpec: {
      eventType: GameplayTags.EVENT.DAMAGE_REQUEST,
      scope: GameplayTags.SCOPE.OWNER_AS_TARGET,
      priority: CREATION_LISTENER_PRIORITIES.damageRequest,
    },
  },
  {
    id: 'artifact-suffix-magic-shield',
    displayName: '玄光法幕',
    displayDescription: '受击时消耗灵力抵消伤害',
    category: 'suffix',
    match: matchAll([CreationTags.MATERIAL.SEMANTIC_SPIRIT, CreationTags.MATERIAL.SEMANTIC_GUARD]),
    weight: 68,
    energyCost: 9,
    applicableTo: ['artifact'],
    effectTemplate: {
      type: 'magic_shield',
      params: {
        absorbRatio: { base: 0.78, scale: 'quality', coefficient: 0.03 },
      },
    },
    listenerSpec: {
      eventType: GameplayTags.EVENT.DAMAGE,
      scope: GameplayTags.SCOPE.OWNER_AS_TARGET,
      priority: CREATION_LISTENER_PRIORITIES.damageApplyImmunity,
    },
  },
  {
    id: 'artifact-suffix-vampiric-core',
    displayName: '噬生核心',
    displayDescription: '持有者造成伤害后回复气血',
    category: 'suffix',
    match: matchAll([CreationTags.MATERIAL.SEMANTIC_BURST, CreationTags.MATERIAL.SEMANTIC_SUSTAIN]),
    weight: 65,
    energyCost: 9,
    applicableTo: ['artifact'],
    grantedAbilityTags: [GameplayTags.TRAIT.LIFESTEAL],
    effectTemplate: {
      type: 'resource_drain',
      params: {
        sourceType: 'hp',
        targetType: 'hp',
        ratio: { base: 0.1, scale: 'quality', coefficient: 0.03 },
      },
    },
    listenerSpec: {
      eventType: GameplayTags.EVENT.DAMAGE_TAKEN,
      scope: GameplayTags.SCOPE.OWNER_AS_CASTER,
      priority: CREATION_LISTENER_PRIORITIES.damageTaken,
    },
  },
  {
    id: 'artifact-suffix-mana-recovery',
    displayName: '灵力回源',
    displayDescription: '每回合恢复一定灵力',
    category: 'suffix',
    match: matchAll([CreationTags.MATERIAL.SEMANTIC_SPIRIT, CreationTags.MATERIAL.TYPE_HERB]),
    weight: 60,
    energyCost: 8,
    applicableTo: ['artifact'],
    grantedAbilityTags: [GameplayTags.ABILITY.FUNCTION.HEAL],
    effectTemplate: {
      type: 'heal',
      params: {
        target: 'mp',
        value: {
          base: { base: 10, scale: 'quality', coefficient: 4 },
          attribute: AttributeType.SPIRIT,
          coefficient: 0.12,
        },
      },
    },
    listenerSpec: {
      eventType: GameplayTags.EVENT.ROUND_PRE,
      scope: GameplayTags.SCOPE.GLOBAL,
      priority: CREATION_LISTENER_PRIORITIES.roundPre,
      mapping: {
        caster: 'owner',
        target: 'owner',
      },
    },
  },
  {
    id: 'artifact-suffix-counter-attack',
    displayName: '反制之舞',
    displayDescription: '受击时反击攻击者',
    category: 'suffix',
    match: matchAll([CreationTags.MATERIAL.SEMANTIC_BLADE, CreationTags.MATERIAL.SEMANTIC_BURST]),
    weight: 58,
    energyCost: 9,
    applicableTo: ['artifact'],
    grantedAbilityTags: [
      GameplayTags.ABILITY.FUNCTION.DAMAGE,
      GameplayTags.ABILITY.CHANNEL.PHYSICAL,
    ],
    effectTemplate: {
      type: 'damage',
      params: {
        value: {
          base: { base: 5, scale: 'quality', coefficient: 2 },
          attribute: AttributeType.ATK,
          coefficient: 0.25,
        },
      },
    },
    listenerSpec: {
      eventType: GameplayTags.EVENT.DAMAGE_TAKEN,
      scope: GameplayTags.SCOPE.OWNER_AS_TARGET,
      priority: CREATION_LISTENER_PRIORITIES.damageTaken,
      mapping: {
        caster: 'owner',
        target: 'event.caster',
      },
    },
  },
  {
    id: 'artifact-suffix-buff-immunity',
    displayName: '纯净之域',
    displayDescription: '对特定类型buff免疫',
    category: 'suffix',
    match: matchAll([CreationTags.MATERIAL.SEMANTIC_SPIRIT, CreationTags.MATERIAL.SEMANTIC_GUARD]),
    weight: 50,
    energyCost: 10,
    applicableTo: ['artifact'],
    effectTemplate: {
      type: 'buff_immunity',
      params: {
        tags: [GameplayTags.BUFF.TYPE.DEBUFF],
      },
    },
    listenerSpec: {
      eventType: GameplayTags.EVENT.BUFF_ADD,
      scope: GameplayTags.SCOPE.OWNER_AS_TARGET,
      priority: CREATION_LISTENER_PRIORITIES.buffIntercept,
    },
  },
  {
    id: 'artifact-suffix-damage-type-reduce',
    displayName: '寒魄克制',
    displayDescription: '减少冰系技能造成的伤害',
    category: 'suffix',
    match: matchAll([CreationTags.MATERIAL.SEMANTIC_GUARD, ELEMENT_TO_MATERIAL_TAG['冰']]),
    weight: 48,
    energyCost: 9,
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
        value: { base: 0.1, scale: 'quality', coefficient: 0.02 },
        cap: 0.4,
      },
    },
    listenerSpec: {
      eventType: GameplayTags.EVENT.DAMAGE_REQUEST,
      scope: GameplayTags.SCOPE.OWNER_AS_TARGET,
      priority: CREATION_LISTENER_PRIORITIES.damageRequest,
    },
  },
  {
    id: 'artifact-suffix-dispel-debuff',
    displayName: '涤心术',
    displayDescription: '每回合自动解除一层debuff',
    category: 'suffix',
    match: matchAll([CreationTags.MATERIAL.SEMANTIC_SPIRIT, CreationTags.MATERIAL.TYPE_MANUAL]),
    weight: 45,
    energyCost: 8,
    applicableTo: ['artifact'],
    effectTemplate: {
      type: 'dispel',
      params: {
        targetTag: GameplayTags.BUFF.TYPE.DEBUFF,
        maxCount: 1,
      },
    },
    listenerSpec: {
      eventType: GameplayTags.EVENT.ROUND_PRE,
      scope: GameplayTags.SCOPE.GLOBAL,
      priority: CREATION_LISTENER_PRIORITIES.roundPre,
      mapping: {
        caster: 'owner',
        target: 'owner',
      },
    },
  },
  {
    id: 'artifact-suffix-high-mana-sunder',
    displayName: '灵潮断界',
    displayDescription: '仅在目标高蓝时触发灵能压制',
    category: 'suffix',
    match: matchAll([
      CreationTags.MATERIAL.SEMANTIC_THUNDER,
      CreationTags.MATERIAL.SEMANTIC_SPIRIT,
    ]),
    weight: 38,
    energyCost: 9,
    applicableTo: ['artifact'],
    grantedAbilityTags: [GameplayTags.TRAIT.MANA_THIEF],
    effectTemplate: {
      type: 'mana_burn',
      conditions: [{ type: 'mp_above', params: { value: 0.65 } }],
      params: {
        value: {
          base: { base: 12, scale: 'quality', coefficient: 4 },
          attribute: AttributeType.MAGIC_ATK,
          coefficient: 0.18,
        },
      },
    },
    listenerSpec: {
      eventType: GameplayTags.EVENT.DAMAGE_TAKEN,
      scope: GameplayTags.SCOPE.OWNER_AS_CASTER,
      priority: CREATION_LISTENER_PRIORITIES.damageTaken,
    },
  },

  // ========================
  // ===== RESONANCE 词缀 (5 种)
  // ========================
  {
    id: 'artifact-resonance-element-force',
    displayName: '元素共鸣',
    displayDescription: '元素技能造成的伤害持续增幅',
    category: 'resonance',
    match: matchAll([
      CreationTags.MATERIAL.SEMANTIC_FLAME,
      CreationTags.MATERIAL.SEMANTIC_FREEZE,
      ELEMENT_TO_MATERIAL_TAG['火'],
    ]),
    weight: 55,
    energyCost: 11,
    applicableTo: ['artifact'],
    effectTemplate: {
      type: 'percent_damage_modifier',
      conditions: [
        {
          type: 'ability_has_tag',
          params: { tag: GameplayTags.ABILITY.ELEMENT.ROOT },
        },
      ],
      params: {
        mode: 'increase',
        value: { base: 0.06, scale: 'quality', coefficient: 0.015 },
        cap: 0.4,
      },
    },
    listenerSpec: {
      eventType: GameplayTags.EVENT.DAMAGE_REQUEST,
      scope: GameplayTags.SCOPE.OWNER_AS_CASTER,
      priority: CREATION_LISTENER_PRIORITIES.damageRequest,
    },
  },
  {
    id: 'artifact-resonance-dual-defense',
    displayName: '盾阵同心',
    displayDescription: '物防与法防同步增幅',
    category: 'resonance',
    match: matchAll([CreationTags.MATERIAL.SEMANTIC_GUARD, CreationTags.MATERIAL.SEMANTIC_SPIRIT]),
    weight: 52,
    energyCost: 11,
    applicableTo: ['artifact'],
    effectTemplate: {
      type: 'attribute_modifier',
      params: {
        modifiers: [
          {
            attrType: AttributeType.DEF,
            modType: ModifierType.ADD,
            value: { base: 0.08, scale: 'quality', coefficient: 0.015 },
          },
          {
            attrType: AttributeType.MAGIC_DEF,
            modType: ModifierType.ADD,
            value: { base: 0.08, scale: 'quality', coefficient: 0.015 },
          },
        ],
      },
    },
  },
  {
    id: 'artifact-resonance-sustain-bond',
    displayName: '生命纽带',
    displayDescription: '治疗效果与防御相互强化',
    category: 'resonance',
    match: matchAll([CreationTags.MATERIAL.SEMANTIC_SUSTAIN, CreationTags.MATERIAL.SEMANTIC_GUARD]),
    weight: 49,
    energyCost: 10,
    applicableTo: ['artifact'],
    effectTemplate: {
      type: 'attribute_modifier',
      params: {
        modifiers: [
          {
            attrType: AttributeType.HEAL_AMPLIFY,
            modType: ModifierType.FIXED,
            value: { base: 0.07, scale: 'quality', coefficient: 0.015 },
          },
          {
            attrType: AttributeType.DEF,
            modType: ModifierType.ADD,
            value: { base: 0.05, scale: 'quality', coefficient: 0.01 },
          },
          {
            attrType: AttributeType.MAGIC_DEF,
            modType: ModifierType.ADD,
            value: { base: 0.05, scale: 'quality', coefficient: 0.01 },
          },
        ],
      },
    },
  },
  {
    id: 'artifact-resonance-offensense-flow',
    displayName: '攻防循环',
    displayDescription: '攻击与防御在战斗中同步抬升',
    category: 'resonance',
    match: matchAll([CreationTags.MATERIAL.SEMANTIC_BURST, CreationTags.MATERIAL.SEMANTIC_GUARD]),
    weight: 46,
    energyCost: 11,
    applicableTo: ['artifact'],
    effectTemplate: {
      type: 'attribute_modifier',
      params: {
        modifiers: [
          {
            attrType: AttributeType.ATK,
            modType: ModifierType.ADD,
            value: { base: 0.05, scale: 'quality', coefficient: 0.01 },
          },
          {
            attrType: AttributeType.MAGIC_ATK,
            modType: ModifierType.ADD,
            value: { base: 0.05, scale: 'quality', coefficient: 0.01 },
          },
          {
            attrType: AttributeType.DEF,
            modType: ModifierType.ADD,
            value: { base: 0.05, scale: 'quality', coefficient: 0.01 },
          },
          {
            attrType: AttributeType.MAGIC_DEF,
            modType: ModifierType.ADD,
            value: { base: 0.05, scale: 'quality', coefficient: 0.01 },
          },
        ],
      },
    },
  },
  {
    id: 'artifact-resonance-opening-pressure',
    displayName: '开局震压',
    displayDescription: '仅在目标高血时触发开局攻势加成',
    category: 'resonance',
    match: matchAll([
      CreationTags.MATERIAL.SEMANTIC_BURST,
      CreationTags.MATERIAL.SEMANTIC_GUARD,
    ]),
    weight: 36,
    energyCost: 11,
    applicableTo: ['artifact'],
    effectTemplate: {
      type: 'percent_damage_modifier',
      conditions: [{ type: 'hp_above', params: { value: 0.75 } }],
      params: {
        mode: 'increase',
        value: { base: 0.11, scale: 'quality', coefficient: 0.02 },
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
  // ===== SYNERGY 词缀 (6 种)
  // ========================
  {
    id: 'artifact-synergy-multi-defense',
    displayName: '三重防御',
    displayDescription: '多层防御机制相互补强',
    category: 'synergy',
    match: matchAll([
      CreationTags.MATERIAL.SEMANTIC_GUARD,
      CreationTags.MATERIAL.SEMANTIC_SPIRIT,
      CreationTags.MATERIAL.TYPE_ORE,
    ]),
    weight: 48,
    energyCost: 12,
    applicableTo: ['artifact'],
    grantedAbilityTags: [GameplayTags.TRAIT.SHIELD_MASTER],
    effectTemplate: {
      type: 'shield',
      params: {
        value: {
          base: { base: 12, scale: 'quality', coefficient: 5 },
          attribute: AttributeType.SPIRIT,
          coefficient: 0.25,
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
    id: 'artifact-synergy-reflect-burst',
    displayName: '反击爆裂',
    displayDescription: '反伤与反击叠加触发',
    category: 'synergy',
    match: matchAll([CreationTags.MATERIAL.SEMANTIC_BURST, CreationTags.MATERIAL.SEMANTIC_GUARD]),
    weight: 45,
    energyCost: 12,
    applicableTo: ['artifact'],
    grantedAbilityTags: [GameplayTags.TRAIT.REFLECT],
    effectTemplate: {
      type: 'reflect',
      params: {
        ratio: { base: 0.18, scale: 'quality', coefficient: 0.035 },
      },
    },
    listenerSpec: {
      eventType: GameplayTags.EVENT.DAMAGE_TAKEN,
      scope: GameplayTags.SCOPE.OWNER_AS_TARGET,
      priority: CREATION_LISTENER_PRIORITIES.damageTaken,
      guard: {
        skipReflectSource: true,
      },
    },
  },
  {
    id: 'artifact-synergy-lifesteal-sustain',
    displayName: '吸血强生',
    displayDescription: '生命吸取与恢复相互增幅',
    category: 'synergy',
    match: matchAll([CreationTags.MATERIAL.SEMANTIC_SUSTAIN, CreationTags.MATERIAL.SEMANTIC_BURST]),
    weight: 42,
    energyCost: 12,
    applicableTo: ['artifact'],
    grantedAbilityTags: [GameplayTags.TRAIT.LIFESTEAL],
    effectTemplate: {
      type: 'resource_drain',
      params: {
        sourceType: 'hp',
        targetType: 'hp',
        ratio: { base: 0.14, scale: 'quality', coefficient: 0.035 },
      },
    },
    listenerSpec: {
      eventType: GameplayTags.EVENT.DAMAGE_TAKEN,
      scope: GameplayTags.SCOPE.OWNER_AS_CASTER,
      priority: CREATION_LISTENER_PRIORITIES.damageTaken,
    },
  },
  {
    id: 'artifact-synergy-control-immunity',
    displayName: '坚志不渝',
    displayDescription: '控制抗性与意志力相互强化',
    category: 'synergy',
    match: matchAll([
      CreationTags.MATERIAL.SEMANTIC_MANUAL,
      CreationTags.MATERIAL.SEMANTIC_GUARD,
    ]),
    weight: 39,
    energyCost: 11,
    applicableTo: ['artifact'],
    effectTemplate: {
      type: 'apply_buff',
      conditions: [
        {
          type: 'buff_count_at_least',
          params: { value: 2, scope: 'caster' },
        },
      ],
      params: {
        buffConfig: {
          id: 'craft-control-immunity-window',
          name: '坚志不渝',
          type: BuffType.BUFF,
          duration: 1,
          stackRule: StackRule.OVERRIDE,
          tags: [GameplayTags.BUFF.TYPE.BUFF],
          statusTags: [GameplayTags.STATUS.CATEGORY.BUFF],
          modifiers: [
            {
              attrType: AttributeType.WILLPOWER,
              type: ModifierType.ADD,
              value: 0.12,
            },
            {
              attrType: AttributeType.CONTROL_RESISTANCE,
              type: ModifierType.FIXED,
              value: 0.06,
            },
          ],
        },
        chance: 1,
      },
    },
    listenerSpec: {
      eventType: GameplayTags.EVENT.ROUND_PRE,
      scope: GameplayTags.SCOPE.GLOBAL,
      priority: CREATION_LISTENER_PRIORITIES.roundPre,
      mapping: {
        caster: 'owner',
        target: 'owner',
      },
    },
  },
  {
    id: 'artifact-synergy-desperate-aegis',
    displayName: '绝境护界',
    displayDescription: '仅在自身低血时触发的大幅减伤护持',
    category: 'synergy',
    match: matchAll([
      CreationTags.MATERIAL.SEMANTIC_GUARD,
      CreationTags.MATERIAL.SEMANTIC_SPIRIT,
    ]),
    weight: 35,
    energyCost: 12,
    applicableTo: ['artifact'],
    effectTemplate: {
      type: 'percent_damage_modifier',
      conditions: [{ type: 'hp_below', params: { value: 0.4, scope: 'caster' } }],
      params: {
        mode: 'reduce',
        value: { base: 0.2, scale: 'quality', coefficient: 0.03 },
        cap: 0.7,
      },
    },
    listenerSpec: {
      eventType: GameplayTags.EVENT.DAMAGE_REQUEST,
      scope: GameplayTags.SCOPE.OWNER_AS_TARGET,
      priority: CREATION_LISTENER_PRIORITIES.damageRequest,
    },
  },
  {
    id: 'artifact-synergy-burn-punisher',
    displayName: '灼痕裁决',
    displayDescription: '仅对带灼烧目标触发的额外反震',
    category: 'synergy',
    match: matchAll([
      CreationTags.MATERIAL.SEMANTIC_FLAME,
      CreationTags.MATERIAL.SEMANTIC_BURST,
    ]),
    weight: 34,
    energyCost: 12,
    applicableTo: ['artifact'],
    grantedAbilityTags: [GameplayTags.TRAIT.REFLECT],
    effectTemplate: {
      type: 'reflect',
      conditions: [
        { type: 'has_tag', params: { tag: GameplayTags.STATUS.STATE.BURNED } },
        { type: 'chance', params: { value: 0.75 } },
      ],
      params: {
        ratio: { base: 0.2, scale: 'quality', coefficient: 0.03 },
      },
    },
    listenerSpec: {
      eventType: GameplayTags.EVENT.DAMAGE_TAKEN,
      scope: GameplayTags.SCOPE.OWNER_AS_TARGET,
      priority: CREATION_LISTENER_PRIORITIES.damageTaken,
      guard: {
        skipReflectSource: true,
      },
    },
  },

  // ========================
  // ===== SIGNATURE 词缀 (4 种)
  // ========================
  {
    id: 'artifact-signature-ice-armor',
    displayName: '玄冰神甲',
    displayDescription: '冰属性保护，大幅提升防御',
    category: 'signature',
    match: matchAll([ELEMENT_TO_MATERIAL_TAG['冰'], CreationTags.MATERIAL.SEMANTIC_FREEZE]),
    exclusiveGroup: 'artifact-signature-ultimate',
    weight: 35,
    energyCost: 14,
    minQuality: '真品',
    applicableTo: ['artifact'],
    effectTemplate: {
      type: 'attribute_modifier',
      params: {
        attrType: AttributeType.DEF,
        modType: ModifierType.ADD,
        value: { base: 0.15, scale: 'quality', coefficient: 0.03 },
      },
    },
  },
  {
    id: 'artifact-signature-spellward',
    displayName: '玄罡避法罩',
    displayDescription: '在受创瞬间隔断法术侵袭，免疫命中魔法标签的伤害',
    category: 'signature',
    match: matchAll([
      CreationTags.MATERIAL.SEMANTIC_GUARD,
      CreationTags.MATERIAL.SEMANTIC_SPIRIT,
      CreationTags.MATERIAL.TYPE_ORE,
    ]),
    exclusiveGroup: 'artifact-signature-ultimate',
    weight: 26,
    energyCost: 14,
    minQuality: '真品',
    applicableTo: ['artifact'],
    effectTemplate: {
      type: 'damage_immunity',
      params: {
        tags: [GameplayTags.ABILITY.CHANNEL.MAGIC],
      },
    },
    listenerSpec: {
      eventType: GameplayTags.EVENT.DAMAGE,
      scope: GameplayTags.SCOPE.OWNER_AS_TARGET,
      priority: CREATION_LISTENER_PRIORITIES.damageApplyImmunity,
    },
  },
  {
    id: 'artifact-signature-prismatic-aegis',
    displayName: '万象法界',
    displayDescription: '以灵力构筑高阶法幕，压低瞬时伤害',
    category: 'signature',
    match: matchAll([
      CreationTags.MATERIAL.SEMANTIC_SPIRIT,
      CreationTags.MATERIAL.SEMANTIC_GUARD,
      CreationTags.MATERIAL.TYPE_MANUAL,
    ]),
    exclusiveGroup: 'artifact-signature-ultimate',
    weight: 32,
    energyCost: 14,
    minQuality: '真品',
    applicableTo: ['artifact'],
    effectTemplate: {
      type: 'magic_shield',
      params: {
        absorbRatio: { base: 0.9, scale: 'quality', coefficient: 0.02 },
      },
    },
    listenerSpec: {
      eventType: GameplayTags.EVENT.DAMAGE,
      scope: GameplayTags.SCOPE.OWNER_AS_TARGET,
      priority: CREATION_LISTENER_PRIORITIES.damageApplyImmunity,
    },
  },
  {
    id: 'artifact-signature-eternal-defense',
    displayName: '永恒堡垒',
    displayDescription: '血线下探时启动堡垒压制，显著降低受到的伤害',
    category: 'signature',
    match: matchAll([
      CreationTags.MATERIAL.SEMANTIC_GUARD,
      CreationTags.MATERIAL.TYPE_SPECIAL,
      CreationTags.MATERIAL.SEMANTIC_SPIRIT,
    ]),
    exclusiveGroup: 'artifact-signature-ultimate',
    weight: 28,
    energyCost: 15,
    minQuality: '地品',
    applicableTo: ['artifact'],
    effectTemplate: {
      type: 'percent_damage_modifier',
      conditions: [{ type: 'hp_below', params: { value: 0.65, scope: 'caster' } }],
      params: {
        mode: 'reduce',
        value: { base: 0.12, scale: 'quality', coefficient: 0.03 },
        cap: 0.6,
      },
    },
    listenerSpec: {
      eventType: GameplayTags.EVENT.DAMAGE_REQUEST,
      scope: GameplayTags.SCOPE.OWNER_AS_TARGET,
      priority: CREATION_LISTENER_PRIORITIES.damageRequest,
    },
  },

  // ========================
  // ===== MYTHIC 词缀 (1 种)
  // ========================
  {
    id: 'artifact-mythic-judgment-seal',
    displayName: '末世审判',
    displayDescription: '战斗中所有防御与反击相互共鸣并指数增长',
    category: 'mythic',
    match: matchAll([
      CreationTags.MATERIAL.SEMANTIC_GUARD,
      CreationTags.MATERIAL.SEMANTIC_BURST,
      CreationTags.MATERIAL.TYPE_SPECIAL,
    ]),
    exclusiveGroup: 'artifact-mythic-transcendent',
    weight: 28,
    energyCost: 16,
    minQuality: '玄品',
    applicableTo: ['artifact'],
    grantedAbilityTags: [GameplayTags.TRAIT.REFLECT],
    effectTemplate: {
      type: 'reflect',
      conditions: [{ type: 'chance', params: { value: 0.82 } }],
      params: {
        ratio: { base: 0.3, scale: 'quality', coefficient: 0.05 },
      },
    },
    listenerSpec: {
      eventType: GameplayTags.EVENT.DAMAGE_TAKEN,
      scope: GameplayTags.SCOPE.OWNER_AS_TARGET,
      priority: CREATION_LISTENER_PRIORITIES.damageTaken,
      guard: {
        skipReflectSource: true,
      },
    },
  },
  // ========================
  // ===== 强度分层扩充 T2 / T3 / T4 + 天品仙品专属
  // ========================

  // --- 核心体魄 T2（玄品+，exclusiveGroup: artifact-core-stat）---
  {
    id: 'artifact-core-vitality-t2',
    displayName: '玄铁锻骨',
    displayDescription: '玄铁炼体，体魄极大强化',
    category: 'prefix',
    match: matchAll([
      CreationTags.MATERIAL.TYPE_ORE,
      CreationTags.MATERIAL.SEMANTIC_GUARD,
      CreationTags.MATERIAL.SEMANTIC_SPIRIT,
    ]),
    exclusiveGroup: 'artifact-core-stat',
    weight: 50,
    energyCost: 10,
    minQuality: '玄品',
    applicableTo: ['artifact'],
    effectTemplate: {
      type: 'attribute_modifier',
      params: {
        attrType: AttributeType.VITALITY,
        modType: ModifierType.FIXED,
        value: { base: 7, scale: 'quality', coefficient: 3 },
      },
    },
  },

  // --- 核心体魄 T3（真品+，exclusiveGroup: artifact-core-stat）---
  {
    id: 'artifact-core-vitality-t3',
    displayName: '万载玄晶体魄',
    displayDescription: '真灵玄晶淬炼，体魄铸就超凡，难以撼动',
    category: 'prefix',
    match: matchAll([
      CreationTags.MATERIAL.TYPE_ORE,
      CreationTags.MATERIAL.SEMANTIC_GUARD,
      CreationTags.MATERIAL.TYPE_SPECIAL,
    ]),
    exclusiveGroup: 'artifact-core-stat',
    weight: 20,
    energyCost: 12,
    minQuality: '真品',
    applicableTo: ['artifact'],
    effectTemplate: {
      type: 'attribute_modifier',
      params: {
        attrType: AttributeType.VITALITY,
        modType: ModifierType.FIXED,
        value: { base: 12, scale: 'quality', coefficient: 5 },
      },
    },
  },

  // --- 核心体魄 T4（地品+，exclusiveGroup: artifact-core-stat）---
  {
    id: 'artifact-core-vitality-t4',
    displayName: '地劫焚骨秘体',
    displayDescription: '地阶材料铸就，体魄坚若大地，寻常伤害难撼分毫',
    category: 'prefix',
    match: matchAll([
      CreationTags.MATERIAL.TYPE_ORE,
      CreationTags.MATERIAL.SEMANTIC_GUARD,
      CreationTags.MATERIAL.TYPE_SPECIAL,
    ]),
    exclusiveGroup: 'artifact-core-stat',
    weight: 6,
    energyCost: 14,
    minQuality: '地品',
    applicableTo: ['artifact'],
    effectTemplate: {
      type: 'attribute_modifier',
      params: {
        attrType: AttributeType.VITALITY,
        modType: ModifierType.FIXED,
        value: { base: 20, scale: 'quality', coefficient: 8 },
      },
    },
  },

  // --- 核心灵力 T2（玄品+，exclusiveGroup: artifact-core-stat）---
  {
    id: 'artifact-core-spirit-t2',
    displayName: '太初灵光汇聚',
    displayDescription: '玄级灵力汇聚，法力大幅增强',
    category: 'prefix',
    match: matchAll([
      CreationTags.MATERIAL.SEMANTIC_SPIRIT,
      CreationTags.MATERIAL.TYPE_MONSTER,
      CreationTags.MATERIAL.SEMANTIC_BURST,
    ]),
    exclusiveGroup: 'artifact-core-stat',
    weight: 48,
    energyCost: 10,
    minQuality: '玄品',
    applicableTo: ['artifact'],
    effectTemplate: {
      type: 'attribute_modifier',
      params: {
        attrType: AttributeType.SPIRIT,
        modType: ModifierType.FIXED,
        value: { base: 7, scale: 'quality', coefficient: 3 },
      },
    },
  },

  // --- 核心灵力 T3（真品+，exclusiveGroup: artifact-core-stat）---
  {
    id: 'artifact-core-spirit-t3',
    displayName: '太一灵光',
    displayDescription: '真灵聚顶，灵力跨越凡俗，直指大道',
    category: 'prefix',
    match: matchAll([
      CreationTags.MATERIAL.SEMANTIC_SPIRIT,
      CreationTags.MATERIAL.TYPE_SPECIAL,
    ]),
    exclusiveGroup: 'artifact-core-stat',
    weight: 19,
    energyCost: 12,
    minQuality: '真品',
    applicableTo: ['artifact'],
    effectTemplate: {
      type: 'attribute_modifier',
      params: {
        attrType: AttributeType.SPIRIT,
        modType: ModifierType.FIXED,
        value: { base: 12, scale: 'quality', coefficient: 5 },
      },
    },
  },

  // --- 核心法术攻击 T2（玄品+，exclusiveGroup: artifact-core-stat）---
  {
    id: 'artifact-core-magic-attack-t2',
    displayName: '凌云法力汇聚',
    displayDescription: '玄级法力凝聚，法术攻击大幅增强',
    category: 'prefix',
    match: matchAll([
      CreationTags.MATERIAL.SEMANTIC_SPIRIT,
      CreationTags.MATERIAL.SEMANTIC_BURST,
      CreationTags.MATERIAL.TYPE_MONSTER,
    ]),
    exclusiveGroup: 'artifact-core-stat',
    weight: 45,
    energyCost: 10,
    minQuality: '玄品',
    applicableTo: ['artifact'],
    effectTemplate: {
      type: 'attribute_modifier',
      params: {
        attrType: AttributeType.MAGIC_ATK,
        modType: ModifierType.FIXED,
        value: { base: 7, scale: 'quality', coefficient: 3 },
      },
    },
  },

  // --- 核心法术攻击 T3（真品+，exclusiveGroup: artifact-core-stat）---
  {
    id: 'artifact-core-magic-attack-t3',
    displayName: '太虚法力极境',
    displayDescription: '真灵法力涌现，法术攻击达到极限',
    category: 'prefix',
    match: matchAll([
      CreationTags.MATERIAL.SEMANTIC_SPIRIT,
      CreationTags.MATERIAL.SEMANTIC_BURST,
      CreationTags.MATERIAL.TYPE_SPECIAL,
    ]),
    exclusiveGroup: 'artifact-core-stat',
    weight: 18,
    energyCost: 12,
    minQuality: '真品',
    applicableTo: ['artifact'],
    effectTemplate: {
      type: 'attribute_modifier',
      params: {
        attrType: AttributeType.MAGIC_ATK,
        modType: ModifierType.FIXED,
        value: { base: 12, scale: 'quality', coefficient: 5 },
      },
    },
  },

  // --- 前缀暴击率 T2（玄品+，exclusiveGroup: artifact-prefix-crit-rate-tier）---
  {
    id: 'artifact-prefix-crit-rate-t2',
    displayName: '凌锋极势',
    displayDescription: '玄气凝聚锋芒，暴击率大幅提升',
    category: 'prefix',
    match: matchAll([
      CreationTags.MATERIAL.SEMANTIC_BLADE,
      CreationTags.MATERIAL.TYPE_MONSTER,
      CreationTags.MATERIAL.SEMANTIC_BURST,
    ]),
    exclusiveGroup: 'artifact-prefix-crit-rate-tier',
    weight: 48,
    energyCost: 8,
    minQuality: '玄品',
    applicableTo: ['artifact'],
    effectTemplate: {
      type: 'attribute_modifier',
      params: {
        attrType: AttributeType.CRIT_RATE,
        modType: ModifierType.FIXED,
        value: { base: 0.06, scale: 'quality', coefficient: 0.015 },
      },
    },
  },

  // --- 前缀暴击率 T3（真品+，exclusiveGroup: artifact-prefix-crit-rate-tier）---
  {
    id: 'artifact-prefix-crit-rate-t3',
    displayName: '绝杀锋芒',
    displayDescription: '真灵极锋，主动暴击成为常态',
    category: 'prefix',
    match: matchAll([
      CreationTags.MATERIAL.SEMANTIC_BLADE,
      CreationTags.MATERIAL.TYPE_SPECIAL,
    ]),
    exclusiveGroup: 'artifact-prefix-crit-rate-tier',
    weight: 18,
    energyCost: 10,
    minQuality: '真品',
    applicableTo: ['artifact'],
    effectTemplate: {
      type: 'attribute_modifier',
      params: {
        attrType: AttributeType.CRIT_RATE,
        modType: ModifierType.FIXED,
        value: { base: 0.10, scale: 'quality', coefficient: 0.025 },
      },
    },
  },

  // --- 前缀暴击伤害 T2（玄品+，exclusiveGroup: artifact-prefix-crit-dmg-tier）---
  {
    id: 'artifact-prefix-crit-damage-t2',
    displayName: '暴击极深化',
    displayDescription: '玄级暴击强化，暴击伤害倍数大幅提升',
    category: 'prefix',
    match: matchAll([
      CreationTags.MATERIAL.SEMANTIC_BURST,
      CreationTags.MATERIAL.TYPE_ORE,
      CreationTags.MATERIAL.SEMANTIC_BLADE,
    ]),
    exclusiveGroup: 'artifact-prefix-crit-dmg-tier',
    weight: 45,
    energyCost: 9,
    minQuality: '玄品',
    applicableTo: ['artifact'],
    effectTemplate: {
      type: 'attribute_modifier',
      params: {
        attrType: AttributeType.CRIT_DAMAGE_MULT,
        modType: ModifierType.FIXED,
        value: { base: 0.18, scale: 'quality', coefficient: 0.03 },
      },
    },
  },

  // --- 前缀暴击伤害 T3（真品+，exclusiveGroup: artifact-prefix-crit-dmg-tier）---
  {
    id: 'artifact-prefix-crit-damage-t3',
    displayName: '神裂天击',
    displayDescription: '真灵极域，每次暴击都能造成毁天灭地之力',
    category: 'prefix',
    match: matchAll([
      CreationTags.MATERIAL.SEMANTIC_BURST,
      CreationTags.MATERIAL.TYPE_SPECIAL,
    ]),
    exclusiveGroup: 'artifact-prefix-crit-dmg-tier',
    weight: 17,
    energyCost: 11,
    minQuality: '真品',
    applicableTo: ['artifact'],
    effectTemplate: {
      type: 'attribute_modifier',
      params: {
        attrType: AttributeType.CRIT_DAMAGE_MULT,
        modType: ModifierType.FIXED,
        value: { base: 0.30, scale: 'quality', coefficient: 0.05 },
      },
    },
  },

  // --- 后缀每回合回血 T2（玄品+，exclusiveGroup: artifact-suffix-round-heal-tier）---
  {
    id: 'artifact-suffix-round-heal-t2',
    displayName: '涌泉回生',
    displayDescription: '玄灵泉水灌注，每回合大量恢复气血',
    category: 'suffix',
    match: matchAll([
      CreationTags.MATERIAL.SEMANTIC_SUSTAIN,
      CreationTags.MATERIAL.TYPE_HERB,
      CreationTags.MATERIAL.SEMANTIC_SPIRIT,
    ]),
    exclusiveGroup: 'artifact-suffix-round-heal-tier',
    weight: 42,
    energyCost: 10,
    minQuality: '玄品',
    applicableTo: ['artifact'],
    grantedAbilityTags: [GameplayTags.ABILITY.FUNCTION.HEAL],
    effectTemplate: {
      type: 'heal',
      params: {
        value: {
          base: { base: 14, scale: 'quality', coefficient: 6 },
          attribute: AttributeType.SPIRIT,
          coefficient: 0.28,
        },
      },
    },
    listenerSpec: {
      eventType: GameplayTags.EVENT.ROUND_PRE,
      scope: GameplayTags.SCOPE.GLOBAL,
      priority: CREATION_LISTENER_PRIORITIES.roundPre,
      mapping: {
        caster: 'owner',
        target: 'owner',
      },
    },
  },

  // --- 后缀每回合回血 T3（真品+，exclusiveGroup: artifact-suffix-round-heal-tier）---
  {
    id: 'artifact-suffix-round-heal-t3',
    displayName: '生命轮回',
    displayDescription: '真灵循环流转，每回合气血大量涌现',
    category: 'suffix',
    match: matchAll([
      CreationTags.MATERIAL.SEMANTIC_SUSTAIN,
      CreationTags.MATERIAL.TYPE_SPECIAL,
    ]),
    exclusiveGroup: 'artifact-suffix-round-heal-tier',
    weight: 15,
    energyCost: 12,
    minQuality: '真品',
    applicableTo: ['artifact'],
    grantedAbilityTags: [GameplayTags.ABILITY.FUNCTION.HEAL],
    effectTemplate: {
      type: 'heal',
      params: {
        value: {
          base: { base: 22, scale: 'quality', coefficient: 9 },
          attribute: AttributeType.SPIRIT,
          coefficient: 0.44,
        },
      },
    },
    listenerSpec: {
      eventType: GameplayTags.EVENT.ROUND_PRE,
      scope: GameplayTags.SCOPE.GLOBAL,
      priority: CREATION_LISTENER_PRIORITIES.roundPre,
      mapping: {
        caster: 'owner',
        target: 'owner',
      },
    },
  },

  // --- 天品专属：魂铠天筑（天品+）---
  {
    id: 'artifact-heaven-soul-fortress',
    displayName: '魂铠天筑',
    displayDescription: '天品法宝，受击时以灵魂之力凝结巨大护盾',
    category: 'signature',
    match: matchAll([
      CreationTags.MATERIAL.SEMANTIC_GUARD,
      CreationTags.MATERIAL.SEMANTIC_SPIRIT,
      CreationTags.MATERIAL.TYPE_SPECIAL,
    ]),
    exclusiveGroup: 'artifact-heaven-tier',
    weight: 3,
    energyCost: 15,
    minQuality: '天品',
    applicableTo: ['artifact'],
    grantedAbilityTags: [GameplayTags.TRAIT.SHIELD_MASTER],
    effectTemplate: {
      type: 'shield',
      params: {
        value: {
          base: { base: 28, scale: 'quality', coefficient: 10 },
          attribute: AttributeType.SPIRIT,
          coefficient: 0.55,
        },
      },
    },
    listenerSpec: {
      eventType: GameplayTags.EVENT.DAMAGE_TAKEN,
      scope: GameplayTags.SCOPE.OWNER_AS_TARGET,
      priority: CREATION_LISTENER_PRIORITIES.damageTaken,
    },
  },

  // --- 天品专属：天道轮回（天品+）---
  {
    id: 'artifact-heaven-rebirth',
    displayName: '天道轮回',
    displayDescription: '天品法宝，唤醒轮回之力，一战中可免死',
    category: 'mythic',
    match: matchAll([
      CreationTags.MATERIAL.SEMANTIC_DIVINE,
      CreationTags.MATERIAL.SEMANTIC_GUARD,
      CreationTags.MATERIAL.TYPE_SPECIAL,
    ]),
    exclusiveGroup: 'artifact-heaven-tier',
    weight: 2,
    energyCost: 16,
    minQuality: '天品',
    applicableTo: ['artifact'],
    effectTemplate: {
      type: 'death_prevent',
      params: {},
    },
    listenerSpec: {
      eventType: GameplayTags.EVENT.DAMAGE_TAKEN,
      scope: GameplayTags.SCOPE.OWNER_AS_TARGET,
      priority: CREATION_LISTENER_PRIORITIES.damageTaken,
      guard: {
        requireOwnerAlive: false,
        allowLethalWindow: true,
      },
    },
  },

  // --- 仙品专属：万古不灭意志（仙品+）---
  {
    id: 'artifact-immortal-undying-will',
    displayName: '万古不灭意志',
    displayDescription: '仙品法宝，持有者受到的所有伤害大幅削减，几近无敌',
    category: 'mythic',
    match: matchAll([
      CreationTags.MATERIAL.SEMANTIC_DIVINE,
      CreationTags.MATERIAL.SEMANTIC_GUARD,
      CreationTags.MATERIAL.TYPE_SPECIAL,
    ]),
    exclusiveGroup: 'artifact-immortal-tier',
    weight: 1,
    energyCost: 18,
    minQuality: '仙品',
    applicableTo: ['artifact'],
    effectTemplate: {
      type: 'percent_damage_modifier',
      params: {
        mode: 'reduce',
        value: { base: 0.55, scale: 'quality', coefficient: 0.05 },
        cap: 0.80,
      },
    },
    listenerSpec: {
      eventType: GameplayTags.EVENT.DAMAGE_REQUEST,
      scope: GameplayTags.SCOPE.OWNER_AS_TARGET,
      priority: CREATION_LISTENER_PRIORITIES.damageRequest,
    },
  },
  // --- 核心灵力 T4（地品+，exclusiveGroup: artifact-core-stat）---
  {
    id: 'artifact-core-spirit-t4',
    displayName: '仙灵聚顶',
    displayDescription: '地阶仙灵汇聚，灵力之强超越常识',
    category: 'prefix',
    match: matchAll([
      CreationTags.MATERIAL.SEMANTIC_SPIRIT,
      CreationTags.MATERIAL.TYPE_SPECIAL,
    ]),
    exclusiveGroup: 'artifact-core-stat',
    weight: 6,
    energyCost: 14,
    minQuality: '地品',
    applicableTo: ['artifact'],
    effectTemplate: {
      type: 'attribute_modifier',
      params: {
        attrType: AttributeType.SPIRIT,
        modType: ModifierType.FIXED,
        value: { base: 20, scale: 'quality', coefficient: 8 },
      },
    },
  },

  // --- 核心法术攻击 T4（地品+，exclusiveGroup: artifact-core-stat）---
  {
    id: 'artifact-core-magic-attack-t4',
    displayName: '法力极境天门',
    displayDescription: '地阶材料开启法力天门，法术攻击逼近道的极限',
    category: 'prefix',
    match: matchAll([
      CreationTags.MATERIAL.SEMANTIC_SPIRIT,
      CreationTags.MATERIAL.SEMANTIC_BURST,
      CreationTags.MATERIAL.TYPE_SPECIAL,
    ]),
    exclusiveGroup: 'artifact-core-stat',
    weight: 6,
    energyCost: 14,
    minQuality: '地品',
    applicableTo: ['artifact'],
    effectTemplate: {
      type: 'attribute_modifier',
      params: {
        attrType: AttributeType.MAGIC_ATK,
        modType: ModifierType.FIXED,
        value: { base: 20, scale: 'quality', coefficient: 8 },
      },
    },
  },

  // --- 前缀暴击率 T4（地品+，exclusiveGroup: artifact-prefix-crit-rate-tier）---
  {
    id: 'artifact-prefix-crit-rate-t4',
    displayName: '必杀锋极',
    displayDescription: '地阶神兵，每一击几乎必然暴击',
    category: 'prefix',
    match: matchAll([
      CreationTags.MATERIAL.SEMANTIC_BLADE,
      CreationTags.MATERIAL.TYPE_SPECIAL,
    ]),
    exclusiveGroup: 'artifact-prefix-crit-rate-tier',
    weight: 4,
    energyCost: 12,
    minQuality: '地品',
    applicableTo: ['artifact'],
    effectTemplate: {
      type: 'attribute_modifier',
      params: {
        attrType: AttributeType.CRIT_RATE,
        modType: ModifierType.FIXED,
        value: { base: 0.16, scale: 'quality', coefficient: 0.04 },
      },
    },
  },

  // --- 前缀暴击伤害 T4（地品+，exclusiveGroup: artifact-prefix-crit-dmg-tier）---
  {
    id: 'artifact-prefix-crit-damage-t4',
    displayName: '天道轰杀',
    displayDescription: '地阶天道之力，每次暴击有如天惩降临，伤害无限放大',
    category: 'prefix',
    match: matchAll([
      CreationTags.MATERIAL.SEMANTIC_BURST,
      CreationTags.MATERIAL.TYPE_SPECIAL,
    ]),
    exclusiveGroup: 'artifact-prefix-crit-dmg-tier',
    weight: 4,
    energyCost: 13,
    minQuality: '地品',
    applicableTo: ['artifact'],
    effectTemplate: {
      type: 'attribute_modifier',
      params: {
        attrType: AttributeType.CRIT_DAMAGE_MULT,
        modType: ModifierType.FIXED,
        value: { base: 0.48, scale: 'quality', coefficient: 0.07 },
      },
    },
  },

  // --- 后缀每回合回血 T4（地品+，exclusiveGroup: artifact-suffix-round-heal-tier）---
  {
    id: 'artifact-suffix-round-heal-t4',
    displayName: '万古生机',
    displayDescription: '地阶生机之力，每回合恢复超量气血，犹如永生',
    category: 'suffix',
    match: matchAll([
      CreationTags.MATERIAL.SEMANTIC_SUSTAIN,
      CreationTags.MATERIAL.TYPE_SPECIAL,
    ]),
    exclusiveGroup: 'artifact-suffix-round-heal-tier',
    weight: 4,
    energyCost: 14,
    minQuality: '地品',
    applicableTo: ['artifact'],
    grantedAbilityTags: [GameplayTags.ABILITY.FUNCTION.HEAL],
    effectTemplate: {
      type: 'heal',
      params: {
        value: {
          base: { base: 34, scale: 'quality', coefficient: 13 },
          attribute: AttributeType.SPIRIT,
          coefficient: 0.65,
        },
      },
    },
    listenerSpec: {
      eventType: GameplayTags.EVENT.ROUND_PRE,
      scope: GameplayTags.SCOPE.GLOBAL,
      priority: CREATION_LISTENER_PRIORITIES.roundPre,
      mapping: {
        caster: 'owner',
        target: 'owner',
      },
    },
  },
];
