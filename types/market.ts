import type { ElementType, EquipmentSlot, Quality } from './constants';

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
