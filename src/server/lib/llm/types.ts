import type { LlmProviderId } from '@shared/config/llm';

export type LlmSceneId =
  | 'alchemy-formula-analysis'
  | 'alchemy-improvised-copy'
  | 'alchemy-recipe-plan'
  | 'black-market-observations'
  | 'black-market-turn'
  | 'black-market-reply'
  | 'black-market-perception'
  | 'breakthrough-story'
  | 'character-generation'
  | 'divine-fortune'
  | 'dungeon-round'
  | 'dungeon-settlement'
  | 'enemy-narrative'
  | 'fate-naming'
  | 'identity-reshape'
  | 'lifespan-exhausted'
  | 'material-generation'
  | 'material-semantic-enrichment'
  | 'product-naming'
  | 'yield-story';

export type LlmStructuredFailureKind =
  | 'content-filter'
  | 'empty-output'
  | 'json-parse'
  | 'output-truncated'
  | 'schema-validation'
  | 'unknown';

export interface LlmCallAttemptMetrics {
  attempt: number;
  status: 'success' | 'failure';
  usage: Record<string, number>;
  failureKind?: LlmStructuredFailureKind;
  finishReason?: string;
}

export interface LlmCallMetrics {
  sceneId: LlmSceneId;
  provider: LlmProviderId;
  model: string;
  systemChars: number;
  userChars: number;
  schemaChars: number;
  retryCount: number;
  usage: Record<string, number>;
  status: 'success' | 'failure';
  failureKind?: LlmStructuredFailureKind;
  finishReason?: string;
  retryReason?: LlmStructuredFailureKind;
  retryFinishReason?: string;
  attempts?: LlmCallAttemptMetrics[];
}
