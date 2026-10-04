/** Public materials capabilities. Keep implementation files private. */
export {
  BASE_PRICES,
  QUALITY_CHANCE_MAP,
  QUALITY_TO_RANK,
  QUANTITY_RANGE_MAP,
  RANK_TO_QUALITY,
  TYPE_CHANCE_MAP,
  TYPE_DESCRIPTIONS,
  TYPE_MULTIPLIERS,
} from '../materials/config.js';
export { getFallbackMaterialPreset } from '../materials/fallback-presets.js';
export type { FallbackMaterialPreset } from '../materials/fallback-presets.js';
export { MARKET_PRESET_POOL } from '../materials/market-presets.js';
export type { MarketMaterialPreset } from '../materials/market-presets.js';
