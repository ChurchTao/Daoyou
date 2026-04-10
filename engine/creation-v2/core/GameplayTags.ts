/*
 * CreationTags: 造物系统私有语义标签。
 * 这里仅保留描述“造物过程”相关的标签（素材、意图、配方、能量、词缀分类）。
 * 所有的战斗特性、事件、状态标签均应直接引用 @/engine/battle-v5/core/GameplayTags。
 */
import { GameplayTagContainer } from '@/engine/battle-v5/core/GameplayTags';

// Alias 容器实现，确保底层逻辑统一
export class CreationTagContainer extends GameplayTagContainer {}

export const CreationTags = {
  // 材料标签：用于材料指纹抽取阶段（MaterialFingerprint）与词缀候选筛选（AffixPoolBuild）
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
    // 语义标签作为素材的“炼金属性”，保留在造物域
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
    SEMANTIC_CHAOS: 'Material.Semantic.Chaos',
    SEMANTIC_SPACE: 'Material.Semantic.Space',
    SEMANTIC_TIME: 'Material.Semantic.Time',
    SEMANTIC_LIFE: 'Material.Semantic.Life',
    RECIPE: 'Material.Recipe',
  },

  // 意图标签：用于 Intent 解析阶段决定造物方向
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

  // 配方标签
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

  // 能量标签
  ENERGY: {
    ROOT: 'Energy',
    BASE: 'Energy.Base',
    BONUS: 'Energy.Bonus',
    RESERVED: 'Energy.Reserved',
  },

  // 词缀分类标签（仅用于 CE 内部池管理）
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

  // 结果标签：用于产物投影阶段标识最终产物类型
  OUTCOME: {
    ROOT: 'Outcome',
    ACTIVE_SKILL: 'Outcome.ActiveSkill',
    PASSIVE_ABILITY: 'Outcome.PassiveAbility',
    ARTIFACT: 'Outcome.Artifact',
    GONGFA: 'Outcome.GongFa',
  },
} as const;
