import type { BlackMarketPricingState } from '@shared/lib/blackMarketRules';
import type {
  BlackMarketClue,
  BlackMarketInspectionKind,
  BlackMarketMessage,
  BlackMarketNpcId,
  BlackMarketReveal,
  BlackMarketSessionPhase,
} from '@shared/types/blackMarket';
import type { Material } from '@shared/types/cultivator';

export interface BlackMarketSafeClue extends BlackMarketClue {
  fact: string;
  fallbackText: string;
}

export interface BlackMarketInternalSession {
  id: string;
  userId: string;
  cultivatorId: string;
  nodeId: string;
  npcId: BlackMarketNpcId;
  cycle: number;
  listingId: string;
  phase: BlackMarketSessionPhase;
  seed: string;
  itemLibraryItemId: string;
  hiddenItem: Material;
  disguisedName: string;
  disguisedDescription: string;
  pricing: BlackMarketPricingState;
  inspectTurnsUsed: number;
  haggleTurnsUsed: number;
  revealedClueIds: string[];
  clues: BlackMarketSafeClue[];
  messages: BlackMarketMessage[];
  version: number;
  expiresAt: number;
  reveal?: BlackMarketReveal;
}

export interface BlackMarketConversationJudgment {
  intent: 'inspect' | 'question' | 'haggle' | 'chat' | 'buy' | 'leave';
  strategy:
    | 'reason'
    | 'relationship'
    | 'pressure'
    | 'bluff'
    | 'direct_offer'
    | 'unknown';
  argumentQuality: 0 | 1 | 2;
  referencedClueIds: string[];
  reply: string;
}

export interface BlackMarketInteractCommand {
  action: 'inspect' | 'question' | 'haggle';
  inspectionKind?: BlackMarketInspectionKind;
  message?: string;
  offeredPrice?: number;
  version: number;
}
