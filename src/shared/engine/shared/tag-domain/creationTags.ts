import { GameplayTagContainer } from './GameplayTagContainer';

/**
 * CreationTags: 造物系统作者侧与过程侧标签词表。
 * 这些标签只应参与输入、筛选与结果归类，不应直接作为战斗运行时标签消费。
 */
export class CreationTagContainer extends GameplayTagContainer {}

export const CreationTags = {
  MATERIAL: {
    ROOT: 'Material',
    TYPE: 'Material.Type', // 材料类型总类
    TYPE_HERB: 'Material.Type.Herb', // 药材
    TYPE_ORE: 'Material.Type.Ore', // 矿石
    TYPE_MONSTER: 'Material.Type.Monster', // 妖兽材料
    TYPE_MANUAL: 'Material.Type.Manual', // 典籍总类（兼容聚合规则）
    TYPE_GONGFA_MANUAL: 'Material.Type.Manual.GongFa', // 功法典籍
    TYPE_SKILL_MANUAL: 'Material.Type.Manual.Skill', // 神通秘术
    TYPE_SPECIAL: 'Material.Type.Special', // 天材地宝
    TYPE_AUXILIARY: 'Material.Type.Auxiliary', // 辅料
    QUALITY: 'Material.Quality', // 品质标签根
    ELEMENT: 'Material.Element', // 元素标签根
    SEMANTIC: 'Material.Semantic', // 语义标签根
    SEMANTIC_FLAME: 'Material.Semantic.Flame', // 火焰/灼烧
    SEMANTIC_FREEZE: 'Material.Semantic.Freeze', // 冰寒/冻结
    SEMANTIC_THUNDER: 'Material.Semantic.Thunder', // 雷霆/电击
    SEMANTIC_WIND: 'Material.Semantic.Wind', // 风行/气流
    SEMANTIC_BLADE: 'Material.Semantic.Blade', // 锋刃/攻伐
    SEMANTIC_GUARD: 'Material.Semantic.Guard', // 防护/坚壁
    SEMANTIC_BURST: 'Material.Semantic.Burst', // 爆发/烈性
    SEMANTIC_SUSTAIN: 'Material.Semantic.Sustain', // 持续/恢复
    SEMANTIC_MANUAL: 'Material.Semantic.Manual', // 典籍/传承
    SEMANTIC_SPIRIT: 'Material.Semantic.Spirit', // 灵识/神魂
    SEMANTIC_EARTH: 'Material.Semantic.Earth', // 土脉/山岩
    SEMANTIC_METAL: 'Material.Semantic.Metal', // 金铁/铸炼
    SEMANTIC_WATER: 'Material.Semantic.Water', // 水流/潮汐
    SEMANTIC_WOOD: 'Material.Semantic.Wood', // 草木/生长
    SEMANTIC_POISON: 'Material.Semantic.Poison', // 毒瘴/腐蚀
    SEMANTIC_DIVINE: 'Material.Semantic.Divine', // 神圣/天授
    SEMANTIC_SPACE: 'Material.Semantic.Space', // 空间/界域
    SEMANTIC_TIME: 'Material.Semantic.Time', // 时间/岁序
    SEMANTIC_LIFE: 'Material.Semantic.Life', // 生机/复苏
    SEMANTIC_ALCHEMY: 'Material.Semantic.Alchemy', // 丹道/药性
    SEMANTIC_REFINING: 'Material.Semantic.Refining', // 器道/锻铸
    SEMANTIC_BEAST: 'Material.Semantic.Beast', // 妖性/兽性
    SEMANTIC_BLOOD: 'Material.Semantic.Blood', // 血煞/气血
    SEMANTIC_BONE: 'Material.Semantic.Bone', // 骨甲/角刺
    SEMANTIC_FORMATION: 'Material.Semantic.Formation', // 阵纹/禁制
    SEMANTIC_ILLUSION: 'Material.Semantic.Illusion', // 幻术/迷神
    SEMANTIC_QI: 'Material.Semantic.Qi', // 灵气/元气
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
  CreationTags.MATERIAL.SEMANTIC_ALCHEMY,
  CreationTags.MATERIAL.SEMANTIC_REFINING,
  CreationTags.MATERIAL.SEMANTIC_BEAST,
  CreationTags.MATERIAL.SEMANTIC_BLOOD,
  CreationTags.MATERIAL.SEMANTIC_BONE,
  CreationTags.MATERIAL.SEMANTIC_FORMATION,
  CreationTags.MATERIAL.SEMANTIC_ILLUSION,
  CreationTags.MATERIAL.SEMANTIC_QI,
] as const;

export type CreationMaterialSemanticTag =
  (typeof CREATION_MATERIAL_SEMANTIC_TAGS)[number];
