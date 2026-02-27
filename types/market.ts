import type { Quality } from './constants';

export type SellPhase = 'preview' | 'confirm';
export type SellMode = 'low_bulk' | 'high_single';

export interface HighTierAppraisal {
  rating: 'S' | 'A' | 'B' | 'C';
  comment: string;
  keywords: string[];
}

export interface SellPreviewItem {
  id: string;
  name: string;
  rank: Quality;
  quantity: number;
  unitPrice: number;
  totalPrice: number;
}

export interface SellPreviewResponse {
  success: true;
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
  rank: Quality;
  quantity: number;
  price: number;
}

export interface SellConfirmResponse {
  success: true;
  gainedSpiritStones: number;
  soldItems: SellConfirmSoldItem[];
  remainingSpiritStones: number;
  appraisal?: HighTierAppraisal;
}
