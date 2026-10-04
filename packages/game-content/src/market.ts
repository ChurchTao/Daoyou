import type { MarketLayer } from '@daoyou/game-domain/market';


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
  common: 15 * 60 * 1000, // 15 分钟
  treasure: 15 * 60 * 1000, // 15 分钟
  heaven: 2 * 60 * 60 * 1000, // 2 小时
  black: 2 * 60 * 60 * 1000, // 2 小时
};


/** 每层商品数量 */
export const MARKET_ITEM_COUNT = 8;
