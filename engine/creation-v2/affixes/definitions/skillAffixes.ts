import { AttributeType, BuffType, ModifierType, StackRule } from '../../contracts/battle';
import { CREATION_LISTENER_PRIORITIES } from '../../config/CreationBalance';
import { ELEMENT_TO_MATERIAL_TAG } from '../../config/CreationMappings';
import { CreationTags } from '../../core/GameplayTags';
import { AffixDefinition } from '../types';

/**
 * 技能词缀池
 * applicableTo: ['skill']
 * 技能词缀可选 listenerSpec
 * 无 listenerSpec 的效果直接写入 active_skill effects[]
 * 有 listenerSpec 的效果会被包装为主动技能自己的临时 listeners[]
 */
export const SKILL_AFFIXES: AffixDefinition[] = [
  // ===== core 词缀（4 种） =====
  {
    id: 'skill-core-damage',
    displayName: '斩击',
    displayDescription: '施放时造成一次伤害',
    category: 'core',
    tagQuery: [
      CreationTags.MATERIAL.SEMANTIC_BLADE,
      CreationTags.MATERIAL.SEMANTIC_BURST,
      CreationTags.RECIPE.PRODUCT_BIAS_SKILL,
    ],
    exclusiveGroup: 'skill-core',
    weight: 80,
    energyCost: 8,
    applicableTo: ['skill'],
    effectTemplate: {
      type: 'damage',
      params: {
        value: {
          base: { base: 20, scale: 'quality', coefficient: 8 },
          attribute: AttributeType.MAGIC_ATK,
          coefficient: 0.5,
        },
      },
    },
  },
  {
    id: 'skill-core-damage-fire',
    displayName: '焚岳斩',
    displayDescription: '施放时造成一次火属性伤害',
    category: 'core',
    tagQuery: [CreationTags.MATERIAL.SEMANTIC_FLAME, ELEMENT_TO_MATERIAL_TAG['火']],
    exclusiveGroup: 'skill-core',
    weight: 60,
    energyCost: 10,
    applicableTo: ['skill'],
    effectTemplate: {
      type: 'damage',
      params: {
        value: {
          base: { base: 22, scale: 'quality', coefficient: 9 },
          attribute: AttributeType.MAGIC_ATK,
          coefficient: 0.55,
        },
      },
    },
  },
  {
    id: 'skill-core-damage-ice',
    displayName: '玄冰斩',
    displayDescription: '施放时造成一次冰属性伤害',
    category: 'core',
    tagQuery: [CreationTags.MATERIAL.SEMANTIC_FREEZE, ELEMENT_TO_MATERIAL_TAG['冰']],
    exclusiveGroup: 'skill-core',
    weight: 60,
    energyCost: 10,
    applicableTo: ['skill'],
    effectTemplate: {
      type: 'damage',
      params: {
        value: {
          base: { base: 20, scale: 'quality', coefficient: 9 },
          attribute: AttributeType.MAGIC_ATK,
          coefficient: 0.5,
        },
      },
    },
  },
  {
    id: 'skill-core-heal',
    displayName: '愈合',
    displayDescription: '施放时恢复目标气血',
    category: 'core',
    tagQuery: [CreationTags.MATERIAL.SEMANTIC_SUSTAIN, CreationTags.MATERIAL.TYPE_HERB],
    exclusiveGroup: 'skill-core',
    weight: 60,
    energyCost: 8,
    applicableTo: ['skill'],
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
    id: 'skill-core-control',
    displayName: '冻结',
    displayDescription: '施放时施加控制效果',
    category: 'core',
    tagQuery: [CreationTags.MATERIAL.SEMANTIC_FREEZE, CreationTags.MATERIAL.SEMANTIC_THUNDER],
    exclusiveGroup: 'skill-core',
    weight: 40,
    energyCost: 12,
    minQuality: '灵品',
    applicableTo: ['skill'],
    effectTemplate: {
      type: 'apply_buff',
      params: {
        buffConfig: {
          id: 'craft-stun',
          name: '眩晕',
          type: BuffType.CONTROL,
          duration: 1,
          stackRule: StackRule.IGNORE,
          tags: ['Status.Stun', 'Status.Control'],
        },
        chance: 0.8,
      },
    },
  },

  // ===== prefix 词缀（3 种） =====
  {
    id: 'skill-prefix-crit-boost',
    displayName: '锋锐',
    displayDescription: '提升本次技能伤害',
    category: 'prefix',
    tagQuery: [CreationTags.MATERIAL.SEMANTIC_BLADE, CreationTags.MATERIAL.TYPE_ORE],
    weight: 80,
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
      eventType: CreationTags.BATTLE_EVENT.DAMAGE_REQUEST,
      scope: CreationTags.LISTENER_SCOPE.OWNER_AS_CASTER,
      priority: CREATION_LISTENER_PRIORITIES.damageRequest,
    },
  },
  {
    id: 'skill-prefix-magic-pen',
    displayName: '破法',
    displayDescription: '临时提升施法者法术穿透',
    category: 'prefix',
    tagQuery: [CreationTags.MATERIAL.TYPE_MONSTER, CreationTags.MATERIAL.SEMANTIC_BURST],
    weight: 60,
    energyCost: 6,
    applicableTo: ['skill'],
    effectTemplate: {
      type: 'attribute_stat_buff',
      params: {
        attrType: AttributeType.MAGIC_PENETRATION,
        modType: ModifierType.FIXED,
        value: { base: 0.06, scale: 'quality', coefficient: 0.02 },
        duration: 1,
        stackRule: StackRule.OVERRIDE,
      },
    },
    listenerSpec: {
      eventType: CreationTags.BATTLE_EVENT.SKILL_CAST,
      scope: CreationTags.LISTENER_SCOPE.OWNER_AS_CASTER,
      priority: CREATION_LISTENER_PRIORITIES.skillCast,
      mapping: {
        caster: 'owner',
        target: 'owner',
      },
    },
  },
  {
    id: 'skill-prefix-spirit-boost',
    displayName: '灵机',
    displayDescription: '临时提升施法者灵力',
    category: 'prefix',
    tagQuery: [CreationTags.MATERIAL.SEMANTIC_SPIRIT, CreationTags.MATERIAL.TYPE_HERB],
    weight: 60,
    energyCost: 6,
    applicableTo: ['skill'],
    effectTemplate: {
      type: 'attribute_stat_buff',
      params: {
        attrType: AttributeType.SPIRIT,
        modType: ModifierType.FIXED,
        value: { base: 3, scale: 'quality', coefficient: 1 },
        duration: 1,
        stackRule: StackRule.OVERRIDE,
      },
    },
    listenerSpec: {
      eventType: CreationTags.BATTLE_EVENT.SKILL_CAST,
      scope: CreationTags.LISTENER_SCOPE.OWNER_AS_CASTER,
      priority: CREATION_LISTENER_PRIORITIES.skillCast,
      mapping: {
        caster: 'owner',
        target: 'owner',
      },
    },
  },

  // ===== suffix 词缀（3 种） =====
  {
    id: 'skill-suffix-burn',
    displayName: '灼烧附加',
    displayDescription: '命中时附加灼烧 debuff',
    category: 'suffix',
    tagQuery: [CreationTags.MATERIAL.SEMANTIC_FLAME, ELEMENT_TO_MATERIAL_TAG['火']],
    weight: 60,
    energyCost: 8,
    applicableTo: ['skill'],
    effectTemplate: {
      type: 'apply_buff',
      params: {
        buffConfig: {
          id: 'craft-burn',
          name: '灼烧',
          type: BuffType.DEBUFF,
          duration: 2,
          stackRule: StackRule.REFRESH_DURATION,
          tags: ['Status.Burn', 'Status.DOT'],
          listeners: [
            {
              eventType: CreationTags.BATTLE_EVENT.ROUND_PRE,
              scope: CreationTags.LISTENER_SCOPE.OWNER_AS_TARGET,
              priority: 20,
              effects: [
                {
                  type: 'damage',
                  params: {
                    value: { base: 8, attribute: AttributeType.MAGIC_ATK, coefficient: 0.15 },
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
    id: 'skill-suffix-dispel',
    displayName: '破除',
    displayDescription: '消除目标一层 debuff',
    category: 'suffix',
    tagQuery: [CreationTags.MATERIAL.SEMANTIC_SPIRIT, CreationTags.MATERIAL.SEMANTIC_MANUAL],
    weight: 40,
    energyCost: 6,
    applicableTo: ['skill'],
    effectTemplate: {
      type: 'dispel',
      params: { maxCount: 1 },
    },
  },
  {
    id: 'skill-suffix-freeze',
    displayName: '冰缓附加',
    displayDescription: '命中时附加减速 debuff',
    category: 'suffix',
    tagQuery: [CreationTags.MATERIAL.SEMANTIC_FREEZE, ELEMENT_TO_MATERIAL_TAG['冰']],
    weight: 60,
    energyCost: 8,
    applicableTo: ['skill'],
    effectTemplate: {
      type: 'apply_buff',
      params: {
        buffConfig: {
          id: 'craft-chill',
          name: '冰缓',
          type: BuffType.DEBUFF,
          duration: 2,
          stackRule: StackRule.REFRESH_DURATION,
          tags: ['Status.Chill'],
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
];
