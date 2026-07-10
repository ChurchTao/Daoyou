import type { ElementType, MaterialType, Quality } from '@shared/types/constants';
import marketData from './data/marketPresets.json';

export interface MarketMaterialPreset {
  name: string;
  description: string;
  element: ElementType;
}

type QualityPresets = Record<Quality, MarketMaterialPreset[]>;

/**
 * 坊市专用材料预设池
 *
 * 用于凡市（common）和珍宝阁（treasure）的预设兜底。
 * 天宝殿（heaven）和黑市（black）必须使用持久材料库。
 *
 * 覆盖品质：凡品 ~ 地品
 * 每槽位 12 个预设，共 7 类型 × 5 品质 × 12 预设 = 420 条
 *
 * 数据从 data/marketPresets.json 加载
 */
export const MARKET_PRESET_POOL = marketData as Record<MaterialType, QualityPresets>;
