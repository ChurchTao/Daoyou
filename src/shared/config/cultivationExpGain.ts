import type { RealmStage, RealmType } from '@shared/types/constants';

/**
 * 各境界的目标完成天数。
 *
 * 设计含义：一个活跃玩家从该境界初期走完圆满，理论上需要的总天数。
 * 推导 cap 时使用：
 *   境界总经验 = REALM_TARGET_DAYS[realm] × REALM_DAILY_EXP_BUDGET[realm]
 *
 * 调参建议：
 * - 想延长/缩短某个境界整体周期，优先改这里。
 * - 改这里通常也要同步重算 EXP_CAP_TABLE，否则目标天数只作为文档参考。
 */
export const REALM_TARGET_DAYS = {
  炼气: 3,
  筑基: 7,
  金丹: 21,
  元婴: 42,
  化神: 70,
  炼虚: 98,
  合体: 126,
  大乘: 154,
  渡劫: 182,
} satisfies Record<RealmType, number>;

/**
 * 各境界的每日经验预算。
 *
 * 设计含义：一个活跃玩家每天可通过日常、副本、战斗、离线等玩法
 * 合理获得的经验基准量。
 *
 * 普通玩法统一公式：
 *   经验 = floor(
 *     REALM_DAILY_EXP_BUDGET[realm]
 *     × sourceDailyFraction
 *     × units
 *     × sourceMultiplier
 *   )
 *
 * 调参建议：
 * - 想让某个境界所有玩法的“每日获得点数”整体变大/变小，改这里。
 * - 不建议用它调单个玩法强弱；单玩法应改对应 EXP_BUDGET。
 */
export const REALM_DAILY_EXP_BUDGET = {
  炼气: 1_000,
  筑基: 1_800,
  金丹: 3_200,
  元婴: 5_600,
  化神: 9_000,
  炼虚: 14_000,
  合体: 21_000,
  大乘: 30_000,
  渡劫: 42_000,
} satisfies Record<RealmType, number>;

/**
 * 境界内四个阶段的经验权重。
 *
 * 设计含义：每个境界的总经验按该权重拆成初期/中期/后期/圆满四段。
 * 推导单阶段 cap 时使用：
 *   阶段 cap ≈ REALM_TARGET_DAYS[realm]
 *            × REALM_DAILY_EXP_BUDGET[realm]
 *            × STAGE_EXP_WEIGHT[stage]
 *
 * 当前突破成功会扣除当前阶段 cap，并把溢出的 cultivation_exp 带入下一阶段，
 * 因此 EXP_CAP_TABLE 是“单阶段经验成本”，不是累计经验。
 */
export const STAGE_EXP_WEIGHT = {
  初期: 0.15,
  中期: 0.2,
  后期: 0.25,
  圆满: 0.4,
} satisfies Record<RealmStage, number>;

/**
 * 闭关修炼基础预算。
 *
 * 基础公式：
 *   闭关基础经验 = dailyBudget × dailyFractionPerYear × min(years, maxYears)
 *
 * 注意：这里算出的只是“闭关基础经验”。服务端闭关还会继续叠加：
 *   灵根倍率 × 功法倍率 × 年限倍率 × 随机波动 × 顿悟倍率 × 瓶颈惩罚
 *
 * 调参建议：
 * - dailyFractionPerYear 控制每闭关 1 年相当于多少“每日预算”。
 * - maxYears 控制单次闭关可计入经验的最大年限，防止一次闭关过长击穿节奏。
 */
export const RETREAT_EXP_BUDGET = {
  dailyFractionPerYear: 0.005,
  maxYears: 200,
  minBaseExp: 1,
} as const;

/**
 * 离线收益预算。
 *
 * 基础公式：
 *   离线经验 = dailyBudget
 *            × dailyFractionPerUnit
 *            × min(hoursElapsed / hoursPerUnit, maxUnits)
 *            × randomFactor
 *
 * 当前设计：
 * - 每 1 小时为 1 个收益单元。
 * - 24 小时达到上限 24 个单元。
 * - 24 小时平均收益 = dailyBudget × 0.008 × 24 = 19.2% 日预算。
 * - 随机波动为 0.8~1.2，因此 24 小时实际为 15.36%~23.04% 日预算。
 * - 24 小时达到上限 24 个单元。
 */
export const OFFLINE_YIELD_EXP_BUDGET = {
  dailyFractionPerUnit: 0.008,
  hoursPerUnit: 1,
  maxUnits: 24,
  minBaseExp: 1,
  randomFactor: {
    min: 0.8,
    range: 0.4,
  },
} as const;

/**
 * 战斗胜利经验预算。
 *
 * 基础公式：
 *   战斗经验 = dailyBudget
 *            × dailyFraction
 *            × realmDiffMultiplier
 *            × victoryMultiplier
 *
 * 调参建议：
 * - dailyFraction 控制同境普通胜利的基准收益。
 * - realmDiffMultiplier 控制挑战更高/更低境界的收益差距。
 * - victoryMultiplier 控制完胜、挑战胜利等表现奖励。
 */
export const BATTLE_VICTORY_EXP_BUDGET = {
  dailyFraction: 0.008,
  minBaseExp: 1,
  realmDiffMultiplier: {
    weaker: 0.25,
    same: 1,
    oneAbove: 1.4,
    twoOrMoreAbove: 1.8,
  },
  victoryMultiplier: {
    normal: 1,
    perfect: 1.15,
    challenged: 1.1,
  },
} as const;

/**
 * 副本经验预算。
 *
 * 主流程使用 tierDailyFraction：
 *   副本经验 = dailyBudget
 *            × tierDailyFraction[tier]
 *            × (1 + dangerBonus × dangerBonusScale)
 *            × dungeonDifficultyRewardBonus
 *
 * 其中 dungeonDifficultyRewardBonus 在地图难度配置中维护：
 *   easy 1.0 / normal 1.1 / hard 1.2 / elite 1.3 / boss 1.5
 *
 * 兼容旧 helper 时使用 resultDailyFraction：
 *   perfect -> S, good -> A, normal -> B, failed -> 2% 日预算
 *
 * 调参建议：
 * - 想调整 S/A/B/C/D 评级收益，改 tierDailyFraction。
 * - 想调整危险分对修为的影响，改 dangerBonusScale。
 * - 不建议再维护一套独立 result 曲线，避免副本入口分叉。
 */
export const DUNGEON_EXP_BUDGET = {
  minBaseExp: 1,
  tierDailyFraction: {
    S: 0.32,
    A: 0.22,
    B: 0.14,
    C: 0.08,
    D: 0.04,
  },
  resultDailyFraction: {
    perfect: 0.32,
    good: 0.22,
    normal: 0.14,
    failed: 0.02,
  },
  dangerBonusScale: 0.2,
} as const;

/**
 * 日常任务经验预算。
 *
 * 基础公式：
 *   日常经验 = dailyBudget × difficultyDailyFraction[difficulty]
 *
 * 调参建议：
 * - easy/normal 应作为稳定低门槛收益。
 * - hard/elite 可承担活跃玩家的主要确定性日收益。
 */
export const DAILY_TASK_EXP_BUDGET = {
  minBaseExp: 1,
  difficultyDailyFraction: {
    easy: 0.05,
    normal: 0.08,
    hard: 0.12,
    elite: 0.18,
  },
} as const;

/**
 * 奇遇事件经验预算。
 *
 * 基础公式：
 *   奇遇经验 = dailyBudget
 *            × dailyFractionByWeight[weight]
 *            × multiplier
 *
 * 调参建议：
 * - minor/normal/major 表示事件权重，不表示境界。
 * - multiplier 适合用于命格、剧情分支、一次性活动等局部加成。
 */
export const EVENT_EXP_BUDGET = {
  minBaseExp: 1,
  dailyFractionByWeight: {
    minor: 0.05,
    normal: 0.1,
    major: 0.25,
  },
} as const;

/**
 * 系统奖励经验预算。
 *
 * 基础公式：
 *   系统奖励经验 = min(
 *     dailyBudget × dailyFractionByWeight[weight] × multiplier,
 *     dailyBudget × maxDailyFraction
 *   )
 *
 * 设计含义：系统奖励可用于补偿、邮件、运营活动等来源，但单次奖励
 * 不能超过 maxDailyFraction 对应的每日预算比例。
 */
export const SYSTEM_REWARD_EXP_BUDGET = {
  minBaseExp: 1,
  maxDailyFraction: 0.8,
  dailyFractionByWeight: {
    minor: 0.05,
    normal: 0.1,
    major: 0.25,
  },
} as const;
