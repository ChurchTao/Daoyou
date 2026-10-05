import type { MaterialType } from './inventory.js';
import type { Quality } from '@daoyou/constants/qualities';
import type { RealmType } from '@daoyou/constants/realms';
import type { Material } from './cultivator.js';
import type { InventoryEquipment } from './equipment/inventory.js';


export type MarketLayer = 'common' | 'treasure' | 'heaven' | 'black';

export type RegionProfileKey =
  'tiannan' | 'luanxinghai' | 'dajin' | 'baicao' | 'beast' | 'equipment' | 'default';


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


export type MarketMaterialListing = MarketListingBase &
  Omit<Material, 'id' | 'price' | 'quantity'> & {
    quantity: number;
    isMystery?: boolean;
    mysteryMask?: {
      badge: '?';
      disguisedName: string;
    };
  };


export type MarketItemListing = MarketListingBase & {
  definitionId: string;
  name: string;
  quantity: number;
  instanceData?: InventoryEquipment;
};


export type MarketListing = MarketMaterialListing | MarketItemListing;


export interface MysteryRevealContext {
  type: MaterialType;
  rankRange: { min: Quality; max: Quality };
  anchorPrice: number;
  nodeId: string;
  layer: MarketLayer;
  regionTags: string[];
  createdAt: number;
}


export interface HighTierAppraisal {
  rating: 'S' | 'A' | 'B' | 'C';
  comment: string;
  keywords: string[];
}
