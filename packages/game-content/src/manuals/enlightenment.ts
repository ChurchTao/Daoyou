import { BASE_PRICES } from '../materials/config.js';

export const ENLIGHTENMENT_QUALITIES = [
  '凡品',
  '灵品',
  '玄品',
  '真品',
  '地品',
  '天品',
  '仙品',
  '神品',
] as const;

export const ENLIGHTENMENT_REALMS = [
  '炼气',
  '筑基',
  '金丹',
  '元婴',
  '化神',
  '炼虚',
  '合体',
  '大乘',
] as const;

export const insightCosts = [1, 2, 3, 5, 8, 12, 20, 32];

/** Sliding three-realm window, same shape as the original four basic realms. */
export const supports = [
  [0],
  [0, 1],
  [0, 1, 2],
  [1, 2, 3],
  [2, 3, 4],
  [3, 4, 5],
  [4, 5, 6],
  [5, 6, 7],
];

export const enlightenmentQualityMinimumRealms = [
  '炼气',
  '炼气',
  '炼气',
  '筑基',
  '金丹',
  '元婴',
  '化神',
  '炼虚',
] as const;

// 前四境沿用原典籍估价；后四境以独立参考值延续价格梯度，不改变材料售价。
// 悟道权重在规则层取参考价平方根的倒数。
export const realmReferenceValues = [
  BASE_PRICES.玄品,
  BASE_PRICES.真品,
  BASE_PRICES.地品,
  BASE_PRICES.天品,
  200_000,
  1_000_000,
  5_000_000,
  25_000_000,
];
