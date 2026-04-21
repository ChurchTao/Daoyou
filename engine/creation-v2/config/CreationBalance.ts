import { AffixCategory, CreationProductType } from '../types';
import { CREATION_EVENT_PRIORITY_LEVELS } from './CreationEventPriorities';

/**
 * 词缀分类解锁阈值表。
 * 数值含义：当材料分析得到的 unlock score 达到该值后，对应分类才允许进入词缀池。
 * 三段阶梯：核心池(0) / 中层池(20) / 稀有池(40)
 */
export const CREATION_AFFIX_UNLOCK_THRESHOLDS = {
  // 核心池：永远可用
  skill_core: 0,
  gongfa_foundation: 0,
  artifact_panel: 0,
  // 中层池：中等材料解锁
  skill_variant: 20,
  gongfa_school: 20,
  artifact_defense: 20,
  // 稀有池：高投入材料才解锁
  skill_rare: 49,
  gongfa_secret: 49,
  artifact_treasure: 49,
} as const;

/**
 * 各产物类型的保留能量。
 * 这部分能量会优先留给产物本体蓝图，不允许被词缀抽取消耗。
 */
export const CREATION_RESERVED_ENERGY: Record<CreationProductType, number> = {
  // 主动技能需要保留更多基础能量来支撑伤害、蓝耗等主结构。
  skill: 3,
  // 法宝本体所需的基础结构能量。
  artifact: 2,
  // 功法本体所需的基础结构能量。
  gongfa: 2,
};

/**
 * 造物输入约束。
 * 用于在流程入口快速拦截异常输入，防止后续阶段建立在无效材料之上。
 */
export const CREATION_INPUT_CONSTRAINTS = {
  // 至少需要多少种材料才允许开始造物。
  minMaterialKinds: 1,
  // 最多允许提交多少种不同材料。
  maxMaterialKinds: 6,
  // 单种材料最少提交多少个。
  minQuantityPerMaterial: 1,
  // 单种材料最多提交多少个，避免堆量过度放大收益。
  maxQuantityPerMaterial: 3,
} as const;

/**
 * 主动技能在缺少完整词缀时的默认投影参数。
 * 用于兜底生成可运行的技能蓝图，避免出现空能力。
 */
export const CREATION_SKILL_DEFAULTS = {
  // 兜底技能的最低基础伤害。
  minDamageBase: 12,
  // 兜底技能的最低蓝耗。
  minMpCost: 80,
  // 治疗型技能默认冷却。
  healCooldown: 3,
  // 伤害型技能默认冷却。
  damageCooldown: 2,
  // 增益或控制型技能默认冷却。
  buffCooldown: 3,
} as const;

/**
 * creation-v2 的统一持续时间策略。
 *
 * 约束来源于本轮平衡计划：
 * - control 默认 2 回合，高阶特殊控制最多 3 回合
 * - 非控制 buff / debuff 统一收敛到 3-6 回合
 * - 仅允许极少数高成本、强语义的特例保留常驻
 */
export const CREATION_DURATION_POLICY = {
  control: {
    default: 2,
    elite: 3,
  },
  buffDebuff: {
    short: 3,
    standard: 4,
    long: 5,
    extended: 6,
    persistentException: -1,
  },
} as const;

/**
 * 被动产物在缺少完整词缀时的默认投影参数。
 * 主要用于法宝、功法这类被动能力的兜底构造。
 */
export const CREATION_PASSIVE_DEFAULTS = {
  // 法宝护盾型兜底效果的最低基础值。
  minArtifactShieldBase: 10,
  // 功法回复型兜底效果的最低基础值。
  minGongFaHealBase: 8,
} as const;

/**
 * 材料能量计算参数。
 * 用于把“品质、数量、类型”转换为 energyValue，并附加结构奖励。
 */
export const CREATION_MATERIAL_ENERGY = {
  // 各品质对应的基础权重，索引按品质顺序映射。
  qualityWeights: [3, 4, 6, 7, 8, 10, 12, 14] as const,
  // 普通 manual 类型额外提供的能量奖励。
  manualBonus: 2,
  // gongfa_manual / skill_manual 这类专用秘籍的额外能量奖励。
  specializedManualBonus: 3,
  // 每多一种不同材料类型时提供的多样性奖励。
  diversityBonusPerExtraType: 2,
  // 多样性奖励的总上限，防止材料种类堆叠收益失控。
  maxDiversityBonus: 8,
  // 同语义标签重复出现时，每层提供的语义一致性奖励。
  coherenceBonusPerStack: 2,
  // 语义一致性奖励的总上限。
  maxCoherenceBonus: 6,
};

/**
 * unlock score 计算参数。
 * unlock score 用来决定“能解锁到多高阶的词缀分类”，与 spendable energy 分轨计算。
 */
export const CREATION_UNLOCK_SCORE_PROFILE = {
  // 各材料按强度排序后的贡献权重，越靠后的材料对高阶解锁贡献越低。
  materialContributionWeights: [1, 0.82, 0.64, 0.5, 0.38, 0.28] as const,
  // 多样性奖励折算到 unlock score 时的倍率。
  diversityBonusMultiplier: 1,
  // 语义一致性奖励折算到 unlock score 时的倍率。
  coherenceBonusMultiplier: 1,
} as const;

/**
 * 词缀入池与权重修正参数。
 * 这组配置决定词缀是否有资格进入候选池，以及进入后权重如何被放大或压低。
 */
export const CREATION_AFFIX_POOL_SCORING = {
  // 视为“高阶桶”的分类集合，用于统一做高阶数量限制。
  highTierCategories: ['skill_rare', 'gongfa_secret', 'artifact_treasure'] as const,

  // 不同分类至少需要命中多少个标签，才有资格进入候选池。
  minTagHitsByCategory: {
    // 中层池：至少命中 1 个标签。
    skill_variant: 1,
    gongfa_school: 1,
    artifact_defense: 1,
    // 稀有池：至少命中 2 个标签，要求更严格。
    skill_rare: 2,
    gongfa_secret: 2,
    artifact_treasure: 2,
  } as const,

  // 各分类进入候选池所需达到的最低 admission score。
  minimumScoreByCategory: {
    // 核心池不做分数门槛限制。
    skill_core: 0,
    gongfa_foundation: 0,
    artifact_panel: 0,
    // 中层池的最低准入分数。
    skill_variant: 0.45,
    gongfa_school: 0.45,
    artifact_defense: 0.45,
    // 稀有池的最低准入分数，要求最高。
    skill_rare: 0.7,
    gongfa_secret: 0.7,
    artifact_treasure: 0.7,
  } as const,

  // 各类信号源在 tagSignalScores 中的加权强度。
  tagSignalWeights: {
    // 材料显式标签的权重。
    explicitMaterial: 0.25,
    // 材料配方标签的权重。
    recipeMaterial: 0.35,
    // 材料语义标签的权重，通常最能代表材料气质。
    semanticMaterial: 0.55,
    // 已匹配配方标签带来的额外权重。
    matchedRecipe: 0.6,
    // Intent 里主导标签的权重。
    dominantIntent: 0.55,
  } as const,

  // 单个 tag 的信号分最高上限，避免某个标签被无限堆高。
  maxSignalScorePerTag: 2.5,

  // admission score 的三项构成权重。
  scoreWeights: {
    // 标签覆盖率权重，表示候选词缀命中标签的完整度。
    coverage: 0.55,
    // 标签信号强度权重，表示这些标签在当前材料中的热度。
    signal: 0.25,
    // 品质适配度权重，表示当前材料品质与词缀品质门槛的匹配程度。
    qualityFit: 0.2,
  } as const,

  // 每多命中一个标签时，对最终权重给予的额外奖励系数。
  tagHitBonus: 0.18,
  // 标签覆盖率对最终权重的额外放大奖励。
  coverageBonus: 0.45,
};

/**
 * 非 core 词缀的类别规划。
 * 主要用于表达系统希望不同类别在整体分布上承担的角色和占比。
 */
export const CREATION_AFFIX_CATEGORY_PLAN = {
  // 完整优先级顺序：核心池 > 中层池 > 稀有池。
  priorityOrder: [
    'skill_core',
    'gongfa_foundation',
    'artifact_panel',
    'skill_variant',
    'gongfa_school',
    'artifact_defense',
    'skill_rare',
    'gongfa_secret',
    'artifact_treasure',
  ] as const,

  // 各分类在长期统计中的目标占比，用于辅助分布校准。
  targetShare: {
    skill_core: 0.12,
    skill_variant: 0.22,
    skill_rare: 0.08,
    gongfa_foundation: 0.12,
    gongfa_school: 0.22,
    gongfa_secret: 0.06,
    artifact_panel: 0.08,
    artifact_defense: 0.08,
    artifact_treasure: 0.02,
  } as const,
} as const;

/**
 * 高阶桶上限。
 * 用来控制高阶词缀整体数量，而不是单独控制某个分类的出现次数。
 * 具体的每池上限（skill_rare/gongfa_secret/artifact_treasure 各 1）
 * 由 AffixSelectionConstraints 的固定池配额负责。
 */
export interface CreationAffixBucketCaps {
  /** skill_rare/gongfa_secret/artifact_treasure 这类稀有池词缀总共最多允许出现多少个。 */
  highTierTotal: number;
}

/**
 * 造物侧 listener 的事件优先级配置。
 * 这些数值决定生成的被动或监听效果在 battle-v5 事件流中的执行先后。
 */
export const CREATION_LISTENER_PRIORITIES = {
  // 行动触发前的增益或预处理优先级。
  actionPreBuff: CREATION_EVENT_PRIORITY_LEVELS.ACTION_TRIGGER,
  // 技能施放瞬间的监听优先级。
  skillCast: CREATION_EVENT_PRIORITY_LEVELS.SKILL_CAST,
  // 伤害请求阶段的监听优先级，必须早于 DamageSystem 本身，
  // 否则增减伤桶会在结算后才写入，导致运行时失效。
  damageRequest: CREATION_EVENT_PRIORITY_LEVELS.DAMAGE_REQUEST + 1,
  // 伤害实际结算阶段的监听优先级。
  damageApply: CREATION_EVENT_PRIORITY_LEVELS.DAMAGE_APPLY,
  // 免疫类效果在伤害结算阶段略后执行，确保能拦截最终伤害。
  damageApplyImmunity: CREATION_EVENT_PRIORITY_LEVELS.DAMAGE_APPLY + 1,
  // 受击后触发的监听优先级，常用于反击、回血、吸血等效果。
  damageTaken: CREATION_EVENT_PRIORITY_LEVELS.DAMAGE_TAKEN,
  // 回合开始前的监听优先级。
  roundPre: CREATION_EVENT_PRIORITY_LEVELS.ROUND_PRE,
  // Buff 拦截阶段的监听优先级。
  buffIntercept: CREATION_EVENT_PRIORITY_LEVELS.BUFF_INTERCEPT,
} as const;

/**
 * 蓝图投影阶段的平衡参数。
 * 这些配置决定 energyBudget 如何被翻译成技能蓝耗、优先级、护盾兜底值等战斗参数。
 */
export const CREATION_PROJECTION_BALANCE = {
  /**
   * 主动技能优先级的基础值。
   * 计算方式通常为：base + affix 数量。
   * 这里取 10，是为了对齐 battle-v5 中主动技能的常规优先级层级。
   */
  skillPriorityBase: 10,

  /**
   * 主动技能蓝耗换算除数。
   * 计算方式通常为：round(effectiveTotal / mpCostDivisor)，并受 minMpCost 下限约束。
   * 除数越小，最终技能蓝耗越高。
   */
  mpCostDivisor: 3,

  /**
   * 法宝护盾型兜底效果的换算除数。
   * 计算方式通常为：remaining / artifactShieldBaseDivisor。
   * 除数越小，剩余词缀能量转换出的护盾值越大。
   */
  artifactShieldBaseDivisor: 1.5,

  /**
   * 单个造物最多允许拥有多少个词缀。
   * 当前 V2 硬上限为：1 个 core + 最多 4 个非 core，总计 5 个。
   */
  defaultMaxAffixCount: 5,

  /** 永久 Buff 的持续时间哨兵值，-1 表示不会自然过期。 */
  permanentBuffDuration: -1,

  /** 功法 Spirit 增益型兜底效果的基础值。 */
  gongfaSpiritBuffBase: 3,

  /**
   * 主动技能冷却时间品质加成（基于品质 order 0-7）。
   * 将在基础冷却上增加该值，且总冷却限制在 2~8 回合。
   */
  qualityCooldownBonus: [0, 0, 1, 2, 3, 4, 5, 6] as const,
} as const;

/**
 * 能量预算梯次 -> 词缀槽位数映射。
 * 低投入时限制词缀槽位，高投入时开放更多槽位，形成成长梯次感。
 * 槽位由“可支配词缀预算”决定，而不是总能量。
 * 解锁高阶类别与能否装满词缀槽位是两条独立轨道。
 * - 可支配能量 < 18：仅 core + 1 非核心，共 2 词缀。
 * - 可支配能量 18-33：core + 2 非核心，共 3 词缀。
 * - 可支配能量 34-55：core + 3 非核心，共 4 词缀。
 * - 可支配能量 >= 56：core + 4 非核心，共 5 词缀，即当前上限。
 */
export const CREATION_ENERGY_SLOT_TIERS: ReadonlyArray<{
  /** 当前梯次生效的能量上界，低于该值即落入此梯次。 */
  maxEnergy: number;
  /** 当前梯次允许开放的最大词缀数量。 */
  maxAffixCount: number;
}> = [
  // 小于 18 点可支配词缀能量时，只开放 2 词缀。
  { maxEnergy: 18, maxAffixCount: 2 },
  // 小于 34 点可支配词缀能量时，开放到 3 词缀。
  { maxEnergy: 34, maxAffixCount: 3 },
  // 小于 56 点可支配词缀能量时，开放到 4 词缀。
  { maxEnergy: 56, maxAffixCount: 4 },
  // 56 点及以上开放完整 5 词缀上限。
  { maxEnergy: Infinity, maxAffixCount: 5 },
];

/**
 * 造物数值波动与完美度策略。
 * 这里的配置是全局生效的，所有词缀在抽中后都会按此逻辑进行数值“洗炼”。
 */
export const CREATION_ROLL_POLICY = {
  // 全局波动范围：0.85 表示最低随到基础值的 85%，1.15 表示最高 115%
  globalVarianceRange: [0.85, 1.15] as [number, number],

  // 完美标记阈值：当效率分 (rollEfficiency) 超过 0.96 时，赋予 Perfect 标记
  perfectThreshold: 0.96,

  // 能量对随机下限的修正系数：
  // 逻辑：每多 1 点有效能量，随机下限提升 0.002 (即 0.2%)
  // 这样投入高品质材料的玩家，下限更高，随出 Perfect 的机会也更大。
  energyBiasFactor: 0.002,

  // 随机分布模型：'normal' 为正态分布（大部分在中庸区间），'uniform' 为均匀随机
  distribution: 'normal' as 'normal' | 'uniform',
} as const;

/**
 * 根据可支配词缀能量查找对应的词缀槽位数上限。
 * 参数 availableAffixEnergy 越高，可开放的 maxAffixCount 越大。
 */
export function resolveAffixSlotCount(availableAffixEnergy: number): number {
  for (const tier of CREATION_ENERGY_SLOT_TIERS) {
    if (availableAffixEnergy < tier.maxEnergy) return tier.maxAffixCount;
  }
  return CREATION_PROJECTION_BALANCE.defaultMaxAffixCount;
}