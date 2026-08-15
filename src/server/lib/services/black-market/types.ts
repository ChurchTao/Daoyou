import type { BlackMarketObservationCandidate } from '@shared/lib/blackMarketObservations';
import type { BlackMarketPricingState } from '@shared/lib/blackMarketPricing';
import type { BlackMarketBeliefPatch } from '@shared/lib/blackMarketBelief';
import type {
  BlackMarketInspectionKind,
  BlackMarketMessage,
  BlackMarketNpcId,
  BlackMarketReveal,
  BlackMarketSessionPhase,
} from '@shared/types/blackMarket';
import type { Material } from '@shared/types/cultivator';

export interface BlackMarketInternalObservation extends BlackMarketObservationCandidate {
  source: 'surface' | 'inspection';
  revealedAtTurn?: number;
}

export type BlackMarketClaimMode = 'belief' | 'bluff' | 'evasion';

export interface BlackMarketNpcBeliefState {
  suspectedTypes: string[];
  suspectedQualityLabel: string;
  confidence: 'low' | 'medium' | 'high';
  perceivedValueBand: { low: number; high: number };
  clueInterpretations: Array<{
    observationId: string;
    interpretation: string;
  }>;
  mistakenAssumptions: string[];
  guardedTopics: string[];
  beliefSummary: string;
  deceptionStyle: 'bluffing' | 'withholding' | 'evasive';
  bluffBudget: number;
  bluffsUsed: number;
}

export interface BlackMarketConversationClaim {
  id: string;
  topic: string;
  text: string;
  mode: BlackMarketClaimMode;
  turn: number;
}

export interface BlackMarketConversationMemory {
  claims: BlackMarketConversationClaim[];
  playerOffers: number[];
  citedObservationIds: string[];
  promises: string[];
  activeBluffs: string[];
  turnSummary: string;
}

export interface BlackMarketInternalSession {
  id: string;
  userId: string;
  cultivatorId: string;
  nodeId: string;
  npcId: BlackMarketNpcId;
  dayKey: string;
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
  revealedObservationIds: string[];
  observations: BlackMarketInternalObservation[];
  belief: BlackMarketNpcBeliefState;
  initialBeliefSummary: string;
  memory: BlackMarketConversationMemory;
  messages: BlackMarketMessage[];
  turnsUsed: number;
  maxTurns: number;
  pendingTurn?: {
    token: string;
    version: number;
    startedAt: number;
  };
  version: number;
  expiresAt: number;
  reveal?: BlackMarketReveal;
}

export interface BlackMarketTurnNegotiation {
  decision: 'accept' | 'counter' | 'reject' | 'end';
  concession: number;
  patienceDelta: -2 | -1;
}

export interface BlackMarketTurnProposal {
  intent:
    'chat' | 'observe' | 'question' | 'challenge' | 'haggle' | 'buy' | 'leave';
  referencedObservationIds: string[];
  revealObservationId?: string;
  reasoning: {
    evidenceStrength: 'none' | 'weak' | 'credible';
    conflictsWithBelief: boolean;
    feelsManipulated: boolean;
    dominantMotive: 'profit' | 'urgency' | 'pride' | 'caution';
  };
  beliefPressure: -2 | -1 | 0 | 1;
  beliefPatch: BlackMarketBeliefPatch;
  claimPlan?: {
    topic: string;
    mode: BlackMarketClaimMode;
    summary: string;
  };
  negotiation?: BlackMarketTurnNegotiation;
  gesture: string;
  memoryPatch: {
    promises: string[];
    activeBluffs: string[];
    turnSummary: string;
  };
}

export interface BlackMarketTurnContext {
  scene: {
    title: string;
    description: string;
  };
  npc: {
    name: string;
    voice: string;
    mood: string;
    flexibilityLevel: string;
    identity: string;
  };
  listing: {
    disguisedName: string;
    disguisedDescription: string;
  };
  currentPrice: number;
  offerAssessment?: 'insulting' | 'low' | 'reasonable' | 'strong';
  canInspect: boolean;
  canHaggle: boolean;
  turnsRemaining: number;
  dealReady: boolean;
  belief: BlackMarketNpcBeliefState;
  memory: BlackMarketConversationMemory;
  knownObservations: Array<{
    id: string;
    topic: BlackMarketInspectionKind;
    text: string;
    reliability: 'direct' | 'inferred';
  }>;
  availableObservations: Array<{
    id: string;
    topic: BlackMarketInspectionKind;
    safeFact: string;
  }>;
  conversation: BlackMarketMessage[];
  playerMessage: string;
  offeredPrice?: number;
}

export interface BlackMarketTurnResult {
  proposal: BlackMarketTurnProposal;
  degraded: boolean;
}

export interface BlackMarketPreparedTurn {
  result: import('@shared/types/blackMarket').BlackMarketInteractionResult;
  sessionId: string;
  messageId: string;
  gesture: string;
  fallbackBody: string;
  replyContext: BlackMarketTurnContext;
  proposal: BlackMarketTurnProposal;
  negotiationOutcome?: import('@shared/lib/blackMarketNegotiation').BlackMarketNegotiationOutcome;
}
