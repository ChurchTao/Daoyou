import type { Quality } from '@daoyou/constants/qualities';

// 独立经济配置，不随坊市报价或材料描述变化。内部统一使用十分之一份。
export const QUALITY_SHARES: Record<Quality, number> = {
  凡品: 1,
  灵品: 6,
  玄品: 20,
  真品: 60,
  地品: 200,
  天品: 1000,
  仙品: 4000,
  神品: 20000,
};

export const TYPE_TENTHS = { ore: 10, monster: 12, aux: 15, tcdb: 25 } as const;
