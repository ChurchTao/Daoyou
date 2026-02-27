import type { Quality } from '@/types/constants';

export const RECYCLE_LOW_TIER_MAX: Quality = '玄品';
export const HIGH_TIER_MIN: Quality = '真品';
export const RECYCLE_PRICE_PROFILE = 'conservative' as const;

// MaterialGenerator 生产价格波动区间：base * typeMultiplier * [0.8, 1.2]
export const PRODUCE_PRICE_FACTOR_MIN = 0.8;
export const PRODUCE_PRICE_FACTOR_MAX = 1.2;
// 回收价封顶：必须低于生产最低系数 0.8
export const RECYCLE_PRICE_FACTOR_CAP = 0.79;

// 低品回收锚定系数（乘以 anchorPrice）
export const LOW_TIER_ANCHOR_FACTOR: Record<'凡品' | '灵品' | '玄品', number> = {
  凡品: 0.26,
  灵品: 0.33,
  玄品: 0.42,
};

// 高品回收基础锚定系数（按品质）
export const HIGH_TIER_BASE_FACTOR: Record<
  '真品' | '地品' | '天品' | '仙品' | '神品',
  number
> = {
  真品: 0.38,
  地品: 0.44,
  天品: 0.5,
  仙品: 0.58,
  神品: 0.64,
};

// 鉴定评级倍率（高品专用）
export const APPRAISAL_RATING_MULTIPLIER: Record<'S' | 'A' | 'B' | 'C', number> = {
  S: 1.25,
  A: 1.15,
  B: 1.08,
  C: 1.0,
};

export const APPRAISAL_KEYWORD_WEIGHTS: Record<string, number> = {
  上古: 0.04,
  本源: 0.06,
  法则: 0.05,
  稀缺: 0.03,
  罕见: 0.02,
  完整: 0.02,
  残缺: -0.04,
  驳杂: -0.03,
  杂质: -0.03,
};

export const APPRAISAL_KEYWORD_BONUS_MIN = -0.08;
export const APPRAISAL_KEYWORD_BONUS_MAX = 0.12;

export const APPRAISAL_SESSION_TTL_SEC = 180;

// 法宝回收锚定：以“同品质材料基础价格”作为锚点
export const ARTIFACT_MATERIAL_ANCHOR_FACTOR: Record<Quality, number> = {
  凡品: 0.6,
  灵品: 0.58,
  玄品: 0.56,
  真品: 0.54,
  地品: 0.52,
  天品: 0.5,
  仙品: 0.48,
  神品: 0.46,
};

export const ARTIFACT_SLOT_FACTOR: Record<'weapon' | 'armor' | 'accessory', number> = {
  weapon: 1.05,
  armor: 1,
  accessory: 0.98,
};
