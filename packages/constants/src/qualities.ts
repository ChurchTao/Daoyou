// 先天气运品质
export const QUALITY_VALUES = [
  '凡品',
  '灵品',
  '玄品',
  '真品',
  '地品',
  '天品',
  '仙品',
  '神品',
] as const;

export type Quality = (typeof QUALITY_VALUES)[number];


// 品质等级映射（用于缩放计算）
export const QUALITY_ORDER: Record<Quality, number> = {
  凡品: 0,
  灵品: 1,
  玄品: 2,
  真品: 3,
  地品: 4,
  天品: 5,
  仙品: 6,
  神品: 7,
};
