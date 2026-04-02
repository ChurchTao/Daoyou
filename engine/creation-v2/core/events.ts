import {
  AffixCandidate,
  CraftedOutcome,
  CreationBlueprint,
  CreationIntent,
  CreationSessionInput,
  EnergyBudget,
  MaterialFingerprintLLMMetadata,
  MaterialFingerprint,
  RecipeMatch,
  RolledAffix,
} from '../types';
import type { AffixPoolDecision, AffixSelectionDecision } from '../rules/contracts';
import { CreationEvent, CreationPhase } from './types';

/*
 * MaterialSubmittedEvent: 当调用方提交材料启动造物流程时发布的领域事件。
 * 负载包含 CreationSessionInput（用户提交的材料列表、产物类型等）。
 */
export interface MaterialSubmittedEvent extends CreationEvent {
  type: 'MaterialSubmittedEvent';
  input: CreationSessionInput;
}

export interface MaterialAnalyzedEvent extends CreationEvent {
  type: 'MaterialAnalyzedEvent';
  fingerprints: MaterialFingerprint[];
}

export interface MaterialSemanticEnrichedEvent extends CreationEvent {
  type: 'MaterialSemanticEnrichedEvent';
  fingerprints: MaterialFingerprint[];
  metadata: Array<{
    materialId?: string;
    materialName: string;
    llm: MaterialFingerprintLLMMetadata;
  }>;
}

export interface MaterialSemanticEnrichmentFallbackEvent extends CreationEvent {
  type: 'MaterialSemanticEnrichmentFallbackEvent';
  reason: string;
  failureDisposition: 'retryable' | 'non_retryable';
  metadata: Array<{
    materialId?: string;
    materialName: string;
    llm: MaterialFingerprintLLMMetadata;
  }>;
}

export interface MaterialSemanticEnrichmentRetryableFallbackEvent
  extends CreationEvent {
  type: 'MaterialSemanticEnrichmentRetryableFallbackEvent';
  reason: string;
  metadata: Array<{
    materialId?: string;
    materialName: string;
    llm: MaterialFingerprintLLMMetadata;
  }>;
}

export interface MaterialSemanticEnrichmentTerminalFallbackEvent
  extends CreationEvent {
  type: 'MaterialSemanticEnrichmentTerminalFallbackEvent';
  reason: string;
  metadata: Array<{
    materialId?: string;
    materialName: string;
    llm: MaterialFingerprintLLMMetadata;
  }>;
}

export interface IntentResolvedEvent extends CreationEvent {
  type: 'IntentResolvedEvent';
  intent: CreationIntent;
}

export interface RecipeValidatedEvent extends CreationEvent {
  type: 'RecipeValidatedEvent';
  recipeMatch: RecipeMatch;
}

export interface EnergyBudgetedEvent extends CreationEvent {
  type: 'EnergyBudgetedEvent';
  budget: EnergyBudget;
}

export interface AffixPoolBuiltEvent extends CreationEvent {
  type: 'AffixPoolBuiltEvent';
  affixPool: AffixCandidate[];
  poolDecision?: AffixPoolDecision;
}

export interface AffixRolledEvent extends CreationEvent {
  type: 'AffixRolledEvent';
  affixes: RolledAffix[];
  selectionDecision?: AffixSelectionDecision;
}

export interface BlueprintComposedEvent extends CreationEvent {
  type: 'BlueprintComposedEvent';
  blueprint: CreationBlueprint;
}

export interface OutcomeMaterializedEvent extends CreationEvent {
  type: 'OutcomeMaterializedEvent';
  outcome: CraftedOutcome;
}

export interface OutcomePersistedEvent extends CreationEvent {
  type: 'OutcomePersistedEvent';
  outcome: CraftedOutcome;
}

export interface CraftFailedEvent extends CreationEvent {
  type: 'CraftFailedEvent';
  phase: CreationPhase;
  reason: string;
  details?: Record<string, unknown>;
}

export type CreationDomainEvent =
  | MaterialSubmittedEvent
  | MaterialAnalyzedEvent
  | MaterialSemanticEnrichedEvent
  | MaterialSemanticEnrichmentFallbackEvent
  | MaterialSemanticEnrichmentRetryableFallbackEvent
  | MaterialSemanticEnrichmentTerminalFallbackEvent
  | IntentResolvedEvent
  | RecipeValidatedEvent
  | EnergyBudgetedEvent
  | AffixPoolBuiltEvent
  | AffixRolledEvent
  | BlueprintComposedEvent
  | OutcomeMaterializedEvent
  | OutcomePersistedEvent
  | CraftFailedEvent;