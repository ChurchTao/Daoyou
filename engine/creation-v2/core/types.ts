/*
 * core/types.ts: 核心类型与流程枚举
 * 包含 CreationEvent、CreationPhase、CreationWorkflowOptions 等跨模块共享的基础类型。
 */

export type CreationTagPath = string;
export type CreationEventPriority = number;

export interface CreationEvent {
  readonly type: string;
  readonly timestamp: number;
  readonly sessionId: string;
}

export interface CreationWorkflowOptions {
  autoMaterialize?: boolean;
  materialAnalysisMode?: 'sync' | 'async';
}

export interface CreationPhaseHandler<TEvent extends CreationEvent = CreationEvent> {
  readonly eventType: TEvent['type'];
  readonly priority?: CreationEventPriority;
  handle(event: TEvent): void;
}

export enum CreationPhase {
  INIT = 'init',
  MATERIAL_SUBMITTED = 'material_submitted',
  MATERIAL_ANALYZED = 'material_analyzed',
  INTENT_RESOLVED = 'intent_resolved',
  RECIPE_VALIDATED = 'recipe_validated',
  ENERGY_BUDGETED = 'energy_budgeted',
  AFFIX_POOL_BUILT = 'affix_pool_built',
  AFFIX_ROLLED = 'affix_rolled',
  BLUEPRINT_COMPOSED = 'blueprint_composed',
  OUTCOME_MATERIALIZED = 'outcome_materialized',
  OUTCOME_PERSISTED = 'outcome_persisted',
  FAILED = 'failed',
}

export enum CreationEventPriorityLevel {
  INTENT_ANALYSIS = 80,
  RULE_VALIDATION = 70,
  ENERGY_BUDGET = 60,
  AFFIX_SELECTION = 50,
  BLUEPRINT_COMPOSITION = 40,
  MATERIALIZATION = 30,
  AUDIT = 10,
}