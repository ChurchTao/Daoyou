import { GameplayTagContainer } from './GameplayTagContainer';

/**
 * CreationTags: 造物系统作者侧与过程侧标签词表。
 * 这些标签只应参与输入、筛选与结果归类，不应直接作为战斗运行时标签消费。
 */
export class CreationTagContainer extends GameplayTagContainer {}

export const CreationTags = {
  MATERIAL: {
    ROOT: 'Material',
    TYPE: 'Material.Type',
    TYPE_HERB: 'Material.Type.Herb',
    TYPE_ORE: 'Material.Type.Ore',
    TYPE_MONSTER: 'Material.Type.Monster',
    TYPE_MANUAL: 'Material.Type.Manual',
    TYPE_SPECIAL: 'Material.Type.Special',
    TYPE_AUXILIARY: 'Material.Type.Auxiliary',
    QUALITY: 'Material.Quality',
    ELEMENT: 'Material.Element',
    SEMANTIC: 'Material.Semantic',
    SEMANTIC_FLAME: 'Material.Semantic.Flame',
    SEMANTIC_FREEZE: 'Material.Semantic.Freeze',
    SEMANTIC_THUNDER: 'Material.Semantic.Thunder',
    SEMANTIC_WIND: 'Material.Semantic.Wind',
    SEMANTIC_BLADE: 'Material.Semantic.Blade',
    SEMANTIC_GUARD: 'Material.Semantic.Guard',
    SEMANTIC_BURST: 'Material.Semantic.Burst',
    SEMANTIC_SUSTAIN: 'Material.Semantic.Sustain',
    SEMANTIC_MANUAL: 'Material.Semantic.Manual',
    SEMANTIC_SPIRIT: 'Material.Semantic.Spirit',
    SEMANTIC_EARTH: 'Material.Semantic.Earth',
    SEMANTIC_METAL: 'Material.Semantic.Metal',
    SEMANTIC_WATER: 'Material.Semantic.Water',
    SEMANTIC_WOOD: 'Material.Semantic.Wood',
    SEMANTIC_POISON: 'Material.Semantic.Poison',
    SEMANTIC_DIVINE: 'Material.Semantic.Divine',
    SEMANTIC_SPACE: 'Material.Semantic.Space',
    SEMANTIC_TIME: 'Material.Semantic.Time',
    SEMANTIC_LIFE: 'Material.Semantic.Life',
    RECIPE: 'Material.Recipe',
  },

  INTENT: {
    ROOT: 'Intent',
    PRODUCT: 'Intent.Product',
    PRODUCT_SKILL: 'Intent.Product.Skill',
    PRODUCT_ARTIFACT: 'Intent.Product.Artifact',
    PRODUCT_GONGFA: 'Intent.Product.GongFa',
    OUTCOME: 'Intent.Outcome',
    OUTCOME_ACTIVE: 'Intent.Outcome.ActiveSkill',
    OUTCOME_PASSIVE: 'Intent.Outcome.PassiveAbility',
  },

  RECIPE: {
    ROOT: 'Recipe',
    PRODUCT_BIAS: 'Recipe.ProductBias',
    PRODUCT_BIAS_SKILL: 'Recipe.ProductBias.Skill',
    PRODUCT_BIAS_ARTIFACT: 'Recipe.ProductBias.Artifact',
    PRODUCT_BIAS_GONGFA: 'Recipe.ProductBias.GongFa',
    PRODUCT_BIAS_UTILITY: 'Recipe.ProductBias.Utility',
    INTENT: 'Recipe.Intent',
    MATCHED: 'Recipe.Matched',
    GATED: 'Recipe.Gated',
    UNLOCKED: 'Recipe.Unlocked',
  },

  ENERGY: {
    ROOT: 'Energy',
    BASE: 'Energy.Base',
    BONUS: 'Energy.Bonus',
    RESERVED: 'Energy.Reserved',
  },

  AFFIX: {
    ROOT: 'Affix',
    PREFIX: 'Affix.Prefix',
    SUFFIX: 'Affix.Suffix',
    CORE: 'Affix.Core',
    SIGNATURE: 'Affix.Signature',
    RESONANCE: 'Affix.Resonance',
    SYNERGY: 'Affix.Synergy',
    MYTHIC: 'Affix.Mythic',
  },

  OUTCOME: {
    ROOT: 'Outcome',
    ACTIVE_SKILL: 'Outcome.ActiveSkill',
    PASSIVE_ABILITY: 'Outcome.PassiveAbility',
    ARTIFACT: 'Outcome.Artifact',
    GONGFA: 'Outcome.GongFa',
  },
} as const;

export const CREATION_MATERIAL_SEMANTIC_TAGS = [
  CreationTags.MATERIAL.SEMANTIC_FLAME,
  CreationTags.MATERIAL.SEMANTIC_FREEZE,
  CreationTags.MATERIAL.SEMANTIC_THUNDER,
  CreationTags.MATERIAL.SEMANTIC_WIND,
  CreationTags.MATERIAL.SEMANTIC_BLADE,
  CreationTags.MATERIAL.SEMANTIC_GUARD,
  CreationTags.MATERIAL.SEMANTIC_BURST,
  CreationTags.MATERIAL.SEMANTIC_SUSTAIN,
  CreationTags.MATERIAL.SEMANTIC_MANUAL,
  CreationTags.MATERIAL.SEMANTIC_SPIRIT,
  CreationTags.MATERIAL.SEMANTIC_EARTH,
  CreationTags.MATERIAL.SEMANTIC_METAL,
  CreationTags.MATERIAL.SEMANTIC_WATER,
  CreationTags.MATERIAL.SEMANTIC_WOOD,
  CreationTags.MATERIAL.SEMANTIC_POISON,
  CreationTags.MATERIAL.SEMANTIC_DIVINE,
  CreationTags.MATERIAL.SEMANTIC_SPACE,
  CreationTags.MATERIAL.SEMANTIC_TIME,
  CreationTags.MATERIAL.SEMANTIC_LIFE,
] as const;

export type CreationMaterialSemanticTag =
  (typeof CREATION_MATERIAL_SEMANTIC_TAGS)[number];
