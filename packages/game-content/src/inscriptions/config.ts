import type { Quality } from '@daoyou/constants/qualities';

// 矿石份数。妖兽、辅助、天材地宝按 1.2、1.5、2.5 倍，由类型系数换成整数十分位。
export const QUALITY_SHARES: Record<Quality, number> = {
  凡品: 10,
  灵品: 60,
  玄品: 200,
  真品: 600,
  地品: 2000,
  天品: 10000,
  仙品: 40000,
  神品: 200000,
};

export const TYPE_TENTHS = { ore: 10, monster: 12, aux: 15, tcdb: 25 } as const;
