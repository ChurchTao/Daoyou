import type { Quality } from '@shared/types/constants';

/**
 * ============================================================
 *  修为系统 · 统一调参面板
 * ============================================================
 *
 *  本文件集中了修为计算中所有可调系数，方便后期平衡性调整。
 *  修改任一常量即可全局生效，无需深入公式函数内部。
 *
 *  核心公式：
 *    修为 = 基础修为 × 闭关年限 × 灵根系数 × 功法系数
 *          × 年限系数 × 随机波动
 *    若触发顿悟，修为翻倍，额外获得 20~50 感悟值。
 *    若处于瓶颈期，修为减半。
 *    非顿悟时也可获得 0~MAX_NORMAL_INSIGHT 点感悟值。
 * ============================================================
 */

// ──────────────────────────────────────────────
//  1. 灵根系数
// ──────────────────────────────────────────────

/** 灵根系数基础偏移量。公式：BASE + 主灵根强度 / 100 */
export const SPIRITUAL_ROOT_BASE = 0.5;

/** 无灵根时的默认灵根强度（兜底值） */
export const DEFAULT_SPIRITUAL_ROOT_STRENGTH = 50;

// ──────────────────────────────────────────────
//  2. 功法系数
// ──────────────────────────────────────────────

/** 各品级功法对应的修为乘数 */
export const TECHNIQUE_QUALITY_MULTIPLIERS: Record<Quality, number> = {
  凡品: 0.8,
  灵品: 0.85,
  玄品: 0.9,
  真品: 0.95,
  地品: 1.0,
  天品: 1.05,
  仙品: 1.1,
  神品: 1.15,
};

/** 无功法时的默认修为乘数 */
export const NO_TECHNIQUE_MULTIPLIER = 1.0;

/** 功法品级遍历时的初始下限（确保不低于此值） */
export const TECHNIQUE_MIN_MULTIPLIER = 0.8;

/** 功法品质查表时的兜底品级 */
export const TECHNIQUE_FALLBACK_QUALITY: Quality = '凡品';

// ──────────────────────────────────────────────
//  3. 年限系数
// ──────────────────────────────────────────────

/**
 * 年限系数公式：BASE + SCALE × √(log₁₀(years + 1))
 *
 * 参考值（BASE=0.8, SCALE=0.2）：
 *   1 年 → 0.94    10 年 → 1.13
 *   50 年 → 1.30   100 年 → 1.38   200 年 → 1.46
 */
export const YEARS_MULTIPLIER_BASE = 0.6;
export const YEARS_MULTIPLIER_SCALE = 0.4;

// ──────────────────────────────────────────────
//  4. 随机波动
// ──────────────────────────────────────────────

/**
 * 修为随机波动范围。
 * 实际因子 = (1 - HALF_RANGE) + rng() × FULL_RANGE
 * 当前 ±10%：0.9 ~ 1.1
 */
export const RANDOM_FACTOR_LOW = 0.8;
export const RANDOM_FACTOR_RANGE = 0.3;

// ──────────────────────────────────────────────
//  5. 顿悟
// ──────────────────────────────────────────────

/** 顿悟触发概率（固定百分比） */
export const EPIPHANY_CHANCE = 0.05;

/** 顿悟时修为翻倍乘数 */
export const EPIPHANY_EXP_MULTIPLIER = 1.5;

/** 顿悟时额外感悟值的下限（含） */
export const EPIPHANY_INSIGHT_MIN = 20;

/**
 * 顿悟时额外感悟值的随机区间宽度。
 * 实际值 = EPIPHANY_INSIGHT_MIN + floor(rng × EPIPHANY_INSIGHT_RANGE)
 * 当前：20 + [0, 30] = 20~50
 */
export const EPIPHANY_INSIGHT_RANGE = 31;

// ──────────────────────────────────────────────
//  6. 常规感悟值（非顿悟）
// ──────────────────────────────────────────────

/** 常规感悟值上限 */
export const MAX_NORMAL_INSIGHT = 20;

/**
 * 常规感悟值缩放因子。
 * 公式：min(MAX, floor(√years × SCALE × rng))
 */
export const NORMAL_INSIGHT_SCALE = 1.2;

// ──────────────────────────────────────────────
//  7. 瓶颈期
// ──────────────────────────────────────────────

/** 瓶颈期触发阈值（修为进度百分比） */
export const BOTTLENECK_THRESHOLD = 75;

/** 瓶颈期内闭关修为衰减乘数 */
export const BOTTLENECK_EXP_PENALTY = 0.5;

// ──────────────────────────────────────────────
//  8. 突破门槛
// ──────────────────────────────────────────────

/** 最低突破进度要求（百分比） */
export const BREAKTHROUGH_MIN_PROGRESS = 60;

/** 常规突破进度阈值（百分比） */
export const NORMAL_BREAKTHROUGH_THRESHOLD = 80;

/** 圆满突破所需的最低感悟值 */
export const PERFECT_BREAKTHROUGH_INSIGHT = 50;

// ──────────────────────────────────────────────
//  9. 突破失败损失
// ──────────────────────────────────────────────

/**
 * 各突破类型的失败损失参数。
 * baseLow / baseRange 决定基础损失比：baseLow + rng × baseRange
 * insightDivisor 决定感悟保护力度：实际损失 = 基础损失 × (1 - insight / divisor)
 */
export const FAILURE_LOSS_PARAMS = {
  forced:  { baseLow: 0.5, baseRange: 0.2, insightDivisor: 500 },
  normal:  { baseLow: 0.3, baseRange: 0.2, insightDivisor: 300 },
  perfect: { baseLow: 0.2, baseRange: 0.1, insightDivisor: 200 },
} as const;
