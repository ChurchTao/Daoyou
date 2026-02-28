import type {
  ElementType,
  EquipmentSlot,
  Quality,
  RealmType,
} from './constants';
import type { Material } from './cultivator';

export type MarketLayer = 'common' | 'treasure' | 'heaven' | 'black';
export type RegionProfileKey = 'tiannan' | 'luanxinghai' | 'dajin' | 'default';

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

export interface MysteryRevealPayload {
  material: Material;
  createdAt: number;
  disguiseTier: Quality;
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
