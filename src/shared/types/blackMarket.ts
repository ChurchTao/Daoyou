import type { ElementType, MaterialType, Quality } from './constants';
import type { MarketAccessState } from './market';

export const BLACK_MARKET_NPC_IDS = [
  'smiling-keeper',
  'silent-elder',
  'urgent-cultivator',
] as const;

export type BlackMarketNpcId = (typeof BLACK_MARKET_NPC_IDS)[number];

export const BLACK_MARKET_INSPECTION_KINDS = [
  'appearance',
  'aura',
  'damage',
  'origin',
  'sale_reason',
] as const;

export type BlackMarketInspectionKind =
  (typeof BLACK_MARKET_INSPECTION_KINDS)[number];

export type BlackMarketSessionPhase =
  'talking' | 'deal_ready' | 'completed' | 'abandoned' | 'expired';

export type BlackMarketNpcStatus = 'available' | 'in_progress' | 'completed';

export type BlackMarketNegotiationMood =
  'calm' | 'guarded' | 'impatient' | 'agreed' | 'closed';

export type BlackMarketMessageRole = 'npc' | 'player' | 'system';

export interface BlackMarketMessage {
  id: string;
  role: BlackMarketMessageRole;
  body: string;
  createdAt: number;
}

export interface BlackMarketClue {
  id: string;
  kind: BlackMarketInspectionKind;
  text: string;
}

export interface BlackMarketNpcSummary {
  id: BlackMarketNpcId;
  sigil: string;
  name: string;
  identity: string;
  responsibility: string;
  status: BlackMarketNpcStatus;
}

export interface BlackMarketOverview {
  nodeId: string;
  cycle: number;
  nextRefresh: number;
  access: MarketAccessState;
  scene: {
    title: string;
    description: string;
  };
  npcs: BlackMarketNpcSummary[];
}

export interface BlackMarketListingMask {
  id: string;
  disguisedName: string;
  description: string;
}

export type BlackMarketRevealRating =
  '血亏' | '小亏' | '公允' | '小赚' | '捡漏' | '天降横财';

export interface BlackMarketRevealedMaterial {
  id: string;
  name: string;
  type: MaterialType;
  rank: Quality;
  element?: ElementType;
  description?: string;
  quantity: number;
}

export interface BlackMarketReveal {
  material: BlackMarketRevealedMaterial;
  initialPrice?: number;
  paidPrice: number;
  anchorValue: number;
  valueRatio: number;
  rating: BlackMarketRevealRating;
  epilogue: string;
}

export interface BlackMarketSessionView {
  id: string;
  nodeId: string;
  npcId: BlackMarketNpcId;
  cycle: number;
  phase: BlackMarketSessionPhase;
  listing: BlackMarketListingMask;
  initialPrice: number;
  currentPrice: number;
  canInspect: boolean;
  canHaggle: boolean;
  negotiationMood: BlackMarketNegotiationMood;
  revealedClues: BlackMarketClue[];
  messages: BlackMarketMessage[];
  version: number;
  expiresAt: number;
  reveal?: BlackMarketReveal;
}

export type BlackMarketInteractionAction = 'inspect' | 'question' | 'haggle';

export interface BlackMarketInteractionResult {
  session: BlackMarketSessionView;
  outcome?: 'accepted' | 'countered' | 'conceded' | 'rejected' | 'locked';
  degraded?: boolean;
  notice?: string;
}
