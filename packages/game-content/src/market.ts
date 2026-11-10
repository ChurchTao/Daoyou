import type { MarketLayer } from '@daoyou/game-domain/market';
import type { Quality } from '@daoyou/constants/qualities';


/** 材料库不足时允许使用内存预设兜底的低层市场 */
export const MARKET_PRESET_FALLBACK_LAYERS: MarketLayer[] = [
  'common',
  'treasure',
];

/** 必须依赖持久材料库的高层市场，不在刷新期触发 LLM 生成 */
export const MARKET_LIBRARY_REQUIRED_LAYERS: MarketLayer[] = [
  'heaven',
  'black',
];


/** 刷新周期（毫秒） */
export const MARKET_REFRESH_MS: Record<MarketLayer, number> = {
  common: 60 * 60 * 1000, // 1 小时
  treasure: 2 * 60 * 60 * 1000, // 2 小时
  heaven: 6 * 60 * 60 * 1000, // 6 小时
  black: 2 * 60 * 60 * 1000, // 2 小时
};


/** 每层商品数量 */
export const MARKET_ITEM_COUNT = 8;

/** 普通坊市基础材料每叠数量，生成货架时在闭区间内等概率抽取。 */
export const MARKET_MATERIAL_STACK_RANGES: Record<
  Quality,
  { min: number; max: number }
> = {
  凡品: { min: 20, max: 30 },
  灵品: { min: 10, max: 15 },
  玄品: { min: 5, max: 8 },
  真品: { min: 2, max: 3 },
  地品: { min: 1, max: 2 },
  天品: { min: 1, max: 1 },
  仙品: { min: 1, max: 1 },
  神品: { min: 1, max: 1 },
};
