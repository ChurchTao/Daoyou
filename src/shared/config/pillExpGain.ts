import type { Quality } from '@shared/types/constants';

/**
 * 丹药修为收益配置。
 *
 * 丹药不纳入通用 daily budget 经验模型；炼丹/丹药系统可以按品质、
 * 契合度、毒性、服用限制等独立调参。
 *
 * 兼容计算公式：
 *   丹药经验 = expCap
 *            × percentByQuality[quality]
 *            × fitMultiplier
 *
 * 当旧调用方传 qualityScalar 时：
 *   丹药经验 = expCap
 *            × percentByQuality['凡品']
 *            × qualityScalar
 *            × fitMultiplier
 *
 * 调参建议：
 * - 此处只保留丹药修为数值的品质基础表。
 * - 丹药的最终强度、毒性、服用次数限制、炼丹契合度应继续在丹药/炼丹系统处理。
 * - 不要把这里重新接回 REALM_DAILY_EXP_BUDGET，否则丹药会再次参与通用经验节奏。
 */
export const PILL_EXP_BUDGET = {
  percentByQuality: {
    凡品: 0.002,
    灵品: 0.0035,
    玄品: 0.006,
    真品: 0.01,
    地品: 0.017,
    天品: 0.028,
    仙品: 0.045,
    神品: 0.07,
  } satisfies Record<Quality, number>,
  minBaseExp: 1,
} as const;
