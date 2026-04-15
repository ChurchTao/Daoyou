/*
 * artifactAffixes: 法宝词缀定义集合（大幅扩展）。
 * 法宝词缀特点：通常包含 listenerSpec，用于被动能力的 listener 注册
 * 包括常驻属性修改、战斗中被动触发、以及高阶联动效果
 */
import { CreationTags, GameplayTags } from '@/engine/shared/tag-domain';
import { CREATION_LISTENER_PRIORITIES } from '../../config/CreationBalance';
import { ELEMENT_TO_MATERIAL_TAG } from '../../config/CreationMappings';
import {
  AttributeType,
  BuffType,
  ModifierType,
  StackRule,
} from '../../contracts/battle';
import { EXCLUSIVE_GROUP } from '../exclusiveGroups';
import { AffixDefinition, matchAll } from '../types';

export const ARTIFACT_AFFIXES: AffixDefinition[] = [
  // ========================
  // ===== SLOT-BOUND CORE 词缀 (artifact only)
  // ========================
  {
    id: 'artifact-core-weapon-dual-edge',
    displayName: '双攻战器',
    displayDescription: '永久提升物攻和法攻，修士常用的基础战器词条',
    category: 'core',
    match: matchAll([]),
    exclusiveGroup: EXCLUSIVE_GROUP.ARTIFACT.CORE_SLOT_WEAPON,
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
    displayName: '双防护甲',
    displayDescription: '永久提升物防和法防，适合稳扎稳打的护甲词条',
    category: 'core',
    match: matchAll([]),
    exclusiveGroup: EXCLUSIVE_GROUP.ARTIFACT.CORE_SLOT_ARMOR,
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
    id: 'artifact-core-accessory-secondary-roll',
    displayName: '二级属性佩',
    displayDescription:
      '造物时从全部二级属性池中随机抽取2条属性強化，每件配饰属性组合独一无二',
    category: 'core',
    match: matchAll([]),
    exclusiveGroup: EXCLUSIVE_GROUP.ARTIFACT.CORE_SLOT_ACCESSORY,
    weight: 100,
    energyCost: 8,
    applicableArtifactSlots: ['accessory'],
    applicableTo: ['artifact'],
    effectTemplate: {
      type: 'random_attribute_modifier',
      params: {
        pickCount: 2,
        pool: [
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
          {
            attrType: AttributeType.EVASION_RATE,
            modType: ModifierType.FIXED,
            value: { base: 0.035, scale: 'quality', coefficient: 0.008 },
          },
          {
            attrType: AttributeType.ACCURACY,
            modType: ModifierType.FIXED,
            value: { base: 0.06, scale: 'quality', coefficient: 0.015 },
          },
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
          {
            attrType: AttributeType.HEAL_AMPLIFY,
            modType: ModifierType.FIXED,
            value: { base: 0.07, scale: 'quality', coefficient: 0.015 },
          },
        ],
      },
    },
  },

  // ========================
  // ===== prefix / suffix 非槽位词缀
  // ========================
  {
    id: 'artifact-suffix-shield-on-hit',
    displayName: '受击护盾',
    displayDescription: '受击时自动生成护盾，提升容错',
    category: 'suffix',
    match: matchAll([
      CreationTags.MATERIAL.SEMANTIC_GUARD,
      CreationTags.MATERIAL.TYPE_ORE,
      CreationTags.MATERIAL.SEMANTIC_BURST,
    ]),
    exclusiveGroup: EXCLUSIVE_GROUP.ARTIFACT.CORE_DEFENSE,
    weight: 75,
    energyCost: 10,
    applicableTo: ['artifact'],
    applicableArtifactSlots: ['armor', 'accessory'],
    grantedAbilityTags: [GameplayTags.TRAIT.SHIELD_MASTER],
    effectTemplate: {
      type: 'shield',
      params: {
        value: {
          base: { base: 14, scale: 'quality', coefficient: 6 },
          attribute: AttributeType.SPIRIT,
          coefficient: 0.1,
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
    id: 'artifact-suffix-reflect-thorns',
    displayName: '受击反伤',
    displayDescription: '受击后把一部分伤害反给敌人',
    category: 'suffix',
    match: matchAll([
      CreationTags.MATERIAL.SEMANTIC_GUARD,
      CreationTags.MATERIAL.SEMANTIC_BURST,
    ]),
    exclusiveGroup: EXCLUSIVE_GROUP.ARTIFACT.CORE_DEFENSE,
    weight: 70,
    energyCost: 10,
    applicableTo: ['artifact'],
    applicableArtifactSlots: ['armor', 'accessory'],
    grantedAbilityTags: [GameplayTags.TRAIT.REFLECT],
    effectTemplate: {
      type: 'reflect',
      params: {
        ratio: { base: 0.05, scale: 'quality', coefficient: 0.01 },
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
    id: 'artifact-suffix-heal-on-round',
    displayName: '回合回血',
    displayDescription: '每回合自动恢复气血，续航更稳定',
    category: 'suffix',
    match: matchAll([
      CreationTags.MATERIAL.SEMANTIC_SUSTAIN,
      CreationTags.MATERIAL.TYPE_HERB,
    ]),
    exclusiveGroup: EXCLUSIVE_GROUP.ARTIFACT.CORE_DEFENSE,
    weight: 68,
    energyCost: 9,
    applicableTo: ['artifact'],
    applicableArtifactSlots: ['armor', 'accessory'],
    grantedAbilityTags: [GameplayTags.ABILITY.FUNCTION.HEAL],
    effectTemplate: {
      type: 'heal',
      params: {
        value: {
          base: { base: 10, scale: 'quality', coefficient: 4 },
          attribute: AttributeType.SPIRIT,
          coefficient: 0.1,
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
    id: 'artifact-suffix-death-prevent',
    displayName: '濒死续命',
    displayDescription: '每场战斗可在致命时刻保命一次',
    category: 'suffix',
    match: matchAll([
      CreationTags.MATERIAL.SEMANTIC_GUARD,
      CreationTags.MATERIAL.SEMANTIC_SPIRIT,
      CreationTags.MATERIAL.TYPE_SPECIAL,
    ]),
    exclusiveGroup: EXCLUSIVE_GROUP.ARTIFACT.CORE_DEFENSE,
    weight: 55,
    energyCost: 11,
    applicableTo: ['artifact'],
    applicableArtifactSlots: ['armor', 'accessory'],
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
    id: 'artifact-suffix-last-stand-shell',
    displayName: '低血护盾',
    displayDescription: '血量低时触发更强护盾，适合反打',
    category: 'suffix',
    match: matchAll([
      CreationTags.MATERIAL.SEMANTIC_GUARD,
      CreationTags.MATERIAL.SEMANTIC_SPIRIT,
    ]),
    exclusiveGroup: EXCLUSIVE_GROUP.ARTIFACT.CORE_DEFENSE,
    weight: 44,
    energyCost: 11,
    minQuality: '灵品',
    applicableTo: ['artifact'],
    applicableArtifactSlots: ['armor', 'accessory'],
    grantedAbilityTags: [GameplayTags.TRAIT.SHIELD_MASTER],
    effectTemplate: {
      type: 'shield',
      conditions: [
        { type: 'hp_below', params: { value: 0.4, scope: 'caster' } },
      ],
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
  {
    id: 'artifact-suffix-armor-passive',
    displayName: '全能减伤',
    displayDescription: '受击时百分比减免伤害',
    category: 'suffix',
    match: matchAll([
      CreationTags.MATERIAL.SEMANTIC_GUARD,
      CreationTags.MATERIAL.TYPE_ORE,
    ]),
    weight: 70,
    energyCost: 8,
    applicableTo: ['artifact'],
    applicableArtifactSlots: ['armor', 'accessory'],
    effectTemplate: {
      type: 'percent_damage_modifier',
      params: {
        mode: 'reduce',
        value: { base: 0.05, scale: 'quality', coefficient: 0.01 },
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
    id: 'artifact-suffix-vampiric-core',
    displayName: '全能吸血',
    displayDescription: '造成伤害后按比例回复气血',
    category: 'suffix',
    match: matchAll([
      CreationTags.MATERIAL.SEMANTIC_BURST,
      CreationTags.MATERIAL.SEMANTIC_SUSTAIN,
    ]),
    weight: 40,
    energyCost: 9,
    applicableTo: ['artifact'],
    applicableArtifactSlots: ['weapon'],
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
      priority: CREATION_LISTENER_PRIORITIES.damageTaken,
    },
  },
  // 物理吸血
  {
    id: 'artifact-suffix-physical-vampiric-core',
    displayName: '物理吸血',
    displayDescription: '造成物理伤害后按比例回复气血',
    category: 'suffix',
    match: matchAll([
      CreationTags.MATERIAL.SEMANTIC_BURST,
      CreationTags.MATERIAL.SEMANTIC_SUSTAIN,
    ]),
    weight: 68,
    energyCost: 9,
    applicableTo: ['artifact'],
    applicableArtifactSlots: ['weapon'],
    grantedAbilityTags: [GameplayTags.TRAIT.LIFESTEAL],
    effectTemplate: {
      type: 'resource_drain',
      conditions: [
        {
          type: 'ability_has_tag',
          params: { tag: GameplayTags.ABILITY.CHANNEL.PHYSICAL },
        },
      ],
      params: {
        sourceType: 'hp',
        targetType: 'hp',
        ratio: { base: 0.05, scale: 'quality', coefficient: 0.01 },
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
    displayName: '回合回蓝',
    displayDescription: '每回合恢复一定灵力',
    category: 'suffix',
    match: matchAll([
      CreationTags.MATERIAL.SEMANTIC_SPIRIT,
      CreationTags.MATERIAL.TYPE_HERB,
    ]),
    weight: 60,
    energyCost: 8,
    applicableTo: ['artifact'],
    applicableArtifactSlots: ['accessory'],
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
    id: 'artifact-suffix-dispel-debuff',
    displayName: '自动驱散',
    displayDescription: '每回合有概率自动驱散一层减益',
    category: 'suffix',
    match: matchAll([
      CreationTags.MATERIAL.SEMANTIC_SPIRIT,
      CreationTags.MATERIAL.TYPE_MANUAL,
    ]),
    weight: 45,
    energyCost: 8,
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
      scope: GameplayTags.SCOPE.GLOBAL,
      priority: CREATION_LISTENER_PRIORITIES.roundPre,
      mapping: {
        caster: 'owner',
        target: 'owner',
      },
    },
  },
  // ========================
  // ===== RESONANCE 词缀 (5 种)
  // ========================
  {
    id: 'artifact-resonance-opening-pressure',
    displayName: '开局压制',
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
    id: 'artifact-synergy-control-immunity',
    displayName: '受控反制',
    displayDescription: '在受控压力下强化意志和抗控',
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
    displayName: '残血减伤',
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
      conditions: [
        { type: 'hp_below', params: { value: 0.4, scope: 'caster' } },
      ],
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
    displayName: '灼烧反震',
    displayDescription: '对灼烧目标触发额外反震伤害',
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
    displayName: '冰甲护体',
    displayDescription: '冰系护体词条，大幅提升防御能力',
    category: 'signature',
    match: matchAll([
      ELEMENT_TO_MATERIAL_TAG['冰'],
      CreationTags.MATERIAL.SEMANTIC_FREEZE,
    ]),
    exclusiveGroup: EXCLUSIVE_GROUP.ARTIFACT.SIGNATURE_ULTIMATE,
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
    displayName: '法术免伤罩',
    displayDescription: '受击时可免疫法术通道伤害，专克法修',
    category: 'signature',
    match: matchAll([
      CreationTags.MATERIAL.SEMANTIC_GUARD,
      CreationTags.MATERIAL.SEMANTIC_SPIRIT,
      CreationTags.MATERIAL.TYPE_ORE,
    ]),
    exclusiveGroup: EXCLUSIVE_GROUP.ARTIFACT.SIGNATURE_ULTIMATE,
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
    displayName: '法力护界',
    displayDescription: '消耗法力吸收伤害，降低爆发压力',
    category: 'signature',
    match: matchAll([
      CreationTags.MATERIAL.SEMANTIC_SPIRIT,
      CreationTags.MATERIAL.SEMANTIC_GUARD,
      CreationTags.MATERIAL.TYPE_MANUAL,
    ]),
    exclusiveGroup: EXCLUSIVE_GROUP.ARTIFACT.SIGNATURE_ULTIMATE,
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
    displayName: '残血堡垒',
    displayDescription: '血量降低后触发强减伤，适合残局翻盘',
    category: 'signature',
    match: matchAll([
      CreationTags.MATERIAL.SEMANTIC_GUARD,
      CreationTags.MATERIAL.TYPE_SPECIAL,
      CreationTags.MATERIAL.SEMANTIC_SPIRIT,
    ]),
    exclusiveGroup: EXCLUSIVE_GROUP.ARTIFACT.SIGNATURE_ULTIMATE,
    weight: 28,
    energyCost: 15,
    minQuality: '地品',
    applicableTo: ['artifact'],
    effectTemplate: {
      type: 'percent_damage_modifier',
      conditions: [
        { type: 'hp_below', params: { value: 0.65, scope: 'caster' } },
      ],
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
    displayName: '终战反伤印',
    displayDescription: '高阶反伤词条，受击时强力反震敌人',
    category: 'mythic',
    match: matchAll([
      CreationTags.MATERIAL.SEMANTIC_GUARD,
      CreationTags.MATERIAL.SEMANTIC_BURST,
      CreationTags.MATERIAL.TYPE_SPECIAL,
    ]),
    exclusiveGroup: EXCLUSIVE_GROUP.ARTIFACT.MYTHIC_TRANSCENDENT,
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
];
