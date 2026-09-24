import type { Quality } from '@shared/types/constants';

/** 各品质规划区间的中值；丹药品相、契合与槽位倍率由统一炼丹公式处理。 */
export const BEAST_CULTIVATION_BASE_BY_QUALITY: Record<Quality, number> = {
  凡品: 587.5,
  灵品: 1175,
  玄品: 2350,
  真品: 4700,
  地品: 9375,
  天品: 18750,
  仙品: 37500,
  神品: 75000,
};
