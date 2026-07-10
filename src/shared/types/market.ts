import type {
  ElementType,
  EquipmentSlot,
  MaterialType,
  Quality,
  RealmType,
} from './constants';
import type { Material } from './cultivator';

export type MarketLayer = 'common' | 'treasure' | 'heaven' | 'black';
export type RegionProfileKey = 'tiannan' | 'luanxinghai' | 'dajin' | 'default';

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
  common: 15 * 60 * 1000,    // 15 分钟
  treasure: 15 * 60 * 1000,  // 15 分钟
  heaven: 2 * 60 * 60 * 1000, // 2 小时
  black: 2 * 60 * 60 * 1000,  // 2 小时
};

/** 每层商品数量 */
export const MARKET_ITEM_COUNT = 8;

// ─── 地域差异化 ───

export interface RegionProfileLayerOverride {
  count?: number;
  rankRange?: { min: Quality; max: Quality };
  mysteryChance?: number;
  qualityWeights?: Partial<Record<Quality, number>>;
  minHighTierCount?: number;
}

export interface RegionProfile {
  typeWeights: Partial<Record<MaterialType, number>>;
  priceModifier: { min: number; max: number };
  layerOverrides: Partial<Record<MarketLayer, RegionProfileLayerOverride>>;
  signatureTags: string[];
  signatureRatio: number;
}

export interface ResolvedLayerConfig {
  count: number;
  rankRange: { min: Quality; max: Quality };
  mysteryChance?: number;
  qualityWeights?: Partial<Record<Quality, number>>;
  minHighTierCount?: number;
  access: MarketAccessRule;
}

export interface MarketAccessRule {
  minRealm?: RealmType;
  entryFee?: number;
  requiresToken?: boolean;
}

export interface MarketAccessState {
  allowed: boolean;
  reason?: string;
  entryFee?: number;
}

export interface MarketListingBase {
  id: string;
  nodeId: string;
  layer: MarketLayer;
  price: number;
  basePrice?: number;
  quantity: number;
}

export interface MysteryMeta {
  mysteryId: string;
  disguisedName: string;
  identifyCost: number;
  purchasedAt: number;
}

export interface MysteryDetails {
  mystery: {
    mysteryId: string;
    identifyCost: number;
    disguiseTier: Quality;
    purchasedAt: number;
    type?: MaterialType;
    rankRange?: { min: Quality; max: Quality };
    anchorPrice?: number;
    nodeId?: string;
    layer?: MarketLayer;
    regionTags?: string[];
  };
}

export type MarketListing = MarketListingBase &
  Omit<Material, 'id' | 'price' | 'quantity'> & {
    quantity: number;
    isMystery?: boolean;
    mysteryMask?: {
      badge: '?';
      disguisedName: string;
    };
  };

export interface MysteryRevealContext {
  type: MaterialType;
  rankRange: { min: Quality; max: Quality };
  anchorPrice: number;
  nodeId: string;
  layer: MarketLayer;
  regionTags: string[];
  createdAt: number;
}

export type SellPhase = 'preview' | 'confirm';
export type SellMode = 'low_bulk' | 'high_single';
export type SellItemType = 'material' | 'artifact';

export interface HighTierAppraisal {
  rating: 'S' | 'A' | 'B' | 'C';
  comment: string;
  keywords: string[];
}

export interface SellPreviewItem {
  id: string;
  name: string;
  rank?: Quality; // material
  quality?: Quality; // artifact
  quantity: number;
  unitPrice: number;
  totalPrice: number;
  slot?: EquipmentSlot;
  score?: number;
  element?: ElementType;
}

export interface SellPreviewResponse {
  success: true;
  itemType: SellItemType;
  sessionId: string;
  mode: SellMode;
  items: SellPreviewItem[];
  totalSpiritStones: number;
  appraisal?: HighTierAppraisal;
  expiresAt: number;
}

export interface SellConfirmSoldItem {
  id: string;
  name: string;
  rank?: Quality; // material
  quality?: Quality; // artifact
  quantity: number;
  price: number;
  slot?: EquipmentSlot;
  score?: number;
  element?: ElementType;
}

export interface SellConfirmResponse {
  success: true;
  itemType: SellItemType;
  gainedSpiritStones: number;
  soldItems: SellConfirmSoldItem[];
  remainingSpiritStones: number;
  appraisal?: HighTierAppraisal;
}
