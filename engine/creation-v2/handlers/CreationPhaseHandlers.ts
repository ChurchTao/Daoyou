import {
  AffixPoolBuiltEvent,
  AffixRolledEvent,
  BlueprintComposedEvent,
  CraftFailedEvent,
  EnergyBudgetedEvent,
  IntentResolvedEvent,
  MaterialAnalyzedEvent,
  MaterialSubmittedEvent,
  OutcomeMaterializedEvent,
  RecipeValidatedEvent,
} from '../core/events';
import { CreationEventBus } from '../core/EventBus';
import {
  CreationEventPriorityLevel,
  CreationEvent,
  CreationPhase,
  CreationPhaseHandler,
} from '../core/types';
import { CreationSession } from '../CreationSession';

export interface CreationPhaseHandlerDeps {
  getSession(sessionId: string): CreationSession | undefined;
  isWorkflowActive(sessionId: string): boolean;
  shouldAutoMaterialize(sessionId: string): boolean;
  shouldUseAsyncMaterialAnalysis(sessionId: string): boolean;
  completeWorkflow(sessionId: string): void;
  analyzeMaterialsWithDefaults(session: CreationSession): void;
  analyzeMaterialsWithDefaultsAsync(session: CreationSession): Promise<void>;
  resolveIntentWithDefaults(session: CreationSession): void;
  validateRecipeWithDefaults(session: CreationSession): void;
  budgetEnergyWithDefaults(session: CreationSession): void;
  buildAffixPoolWithDefaults(session: CreationSession): void;
  rollAffixesWithDefaults(session: CreationSession): void;
  composeBlueprintWithDefaults(session: CreationSession): void;
  materializeOutcome(session: CreationSession): void;
  fail(session: CreationSession, reason: string, details?: Record<string, unknown>): void;
}

type WorkflowActionKey =
  | 'analyzeSync'
  | 'analyzeAsync'
  | 'resolveIntent'
  | 'validateRecipe'
  | 'budgetEnergy'
  | 'buildAffixPool'
  | 'rollAffixes'
  | 'composeBlueprint'
  | 'materializeOrComplete'
  | 'completeWorkflow';

interface WorkflowTransition<TEvent extends CreationEvent = CreationEvent> {
  eventType: TEvent['type'];
  priority: CreationEventPriorityLevel;
  expectedPhase?: CreationPhase;
  resolveAction: (event: TEvent) => WorkflowActionKey | null;
}

export class CreationPhaseHandlerRegistry {
  constructor(private readonly deps: CreationPhaseHandlerDeps) {}

  register(eventBus: CreationEventBus): void {
    const transitions: WorkflowTransition[] = [
      {
        eventType: 'MaterialSubmittedEvent',
        priority: CreationEventPriorityLevel.INTENT_ANALYSIS,
        expectedPhase: CreationPhase.MATERIAL_SUBMITTED,
        resolveAction: (event) =>
          this.deps.shouldUseAsyncMaterialAnalysis(event.sessionId)
            ? 'analyzeAsync'
            : 'analyzeSync',
      },
      {
        eventType: 'MaterialAnalyzedEvent',
        priority: CreationEventPriorityLevel.INTENT_ANALYSIS,
        expectedPhase: CreationPhase.MATERIAL_ANALYZED,
        resolveAction: () => 'resolveIntent',
      },
      {
        eventType: 'IntentResolvedEvent',
        priority: CreationEventPriorityLevel.RULE_VALIDATION,
        expectedPhase: CreationPhase.INTENT_RESOLVED,
        resolveAction: () => 'validateRecipe',
      },
      {
        eventType: 'RecipeValidatedEvent',
        priority: CreationEventPriorityLevel.ENERGY_BUDGET,
        expectedPhase: CreationPhase.RECIPE_VALIDATED,
        resolveAction: () => 'budgetEnergy',
      },
      {
        eventType: 'EnergyBudgetedEvent',
        priority: CreationEventPriorityLevel.AFFIX_SELECTION,
        expectedPhase: CreationPhase.ENERGY_BUDGETED,
        resolveAction: () => 'buildAffixPool',
      },
      {
        eventType: 'AffixPoolBuiltEvent',
        priority: CreationEventPriorityLevel.AFFIX_SELECTION,
        expectedPhase: CreationPhase.AFFIX_POOL_BUILT,
        resolveAction: () => 'rollAffixes',
      },
      {
        eventType: 'AffixRolledEvent',
        priority: CreationEventPriorityLevel.BLUEPRINT_COMPOSITION,
        expectedPhase: CreationPhase.AFFIX_ROLLED,
        resolveAction: () => 'composeBlueprint',
      },
      {
        eventType: 'BlueprintComposedEvent',
        priority: CreationEventPriorityLevel.MATERIALIZATION,
        expectedPhase: CreationPhase.BLUEPRINT_COMPOSED,
        resolveAction: (event) =>
          this.deps.shouldAutoMaterialize(event.sessionId)
            ? 'materializeOrComplete'
            : 'completeWorkflow',
      },
      {
        eventType: 'OutcomeMaterializedEvent',
        priority: CreationEventPriorityLevel.AUDIT,
        resolveAction: () => 'completeWorkflow',
      },
      {
        eventType: 'CraftFailedEvent',
        priority: CreationEventPriorityLevel.AUDIT,
        resolveAction: () => 'completeWorkflow',
      },
    ];

    const handlers: CreationPhaseHandler[] = transitions.map((transition) => ({
      eventType: transition.eventType,
      priority: transition.priority,
      handle: (event) => {
        void this.handleTransition(event as CreationEvent, transition);
      },
    }));

    handlers.forEach((handler) => {
      eventBus.subscribe(handler.eventType, handler.handle, handler.priority ?? 0);
    });
  }

  private async handleTransition(
    event: CreationEvent,
    transition: WorkflowTransition,
  ): Promise<void> {
    const action = transition.resolveAction(event);
    if (!action) {
      return;
    }

    if (action === 'completeWorkflow') {
      if (this.deps.isWorkflowActive(event.sessionId)) {
        this.deps.completeWorkflow(event.sessionId);
      }
      return;
    }

    const session = transition.expectedPhase
      ? this.getWorkflowSession(event.sessionId, transition.expectedPhase)
      : undefined;

    if (!session) {
      return;
    }

    await this.executeAction(session, action);
  }

  private async executeAction(
    session: CreationSession,
    action: Exclude<WorkflowActionKey, 'completeWorkflow'>,
  ): Promise<void> {
    try {
      switch (action) {
        case 'analyzeSync':
          this.deps.analyzeMaterialsWithDefaults(session);
          return;
        case 'analyzeAsync':
          await this.deps.analyzeMaterialsWithDefaultsAsync(session);
          return;
        case 'resolveIntent':
          this.deps.resolveIntentWithDefaults(session);
          return;
        case 'validateRecipe':
          this.deps.validateRecipeWithDefaults(session);
          return;
        case 'budgetEnergy':
          this.deps.budgetEnergyWithDefaults(session);
          return;
        case 'buildAffixPool':
          this.deps.buildAffixPoolWithDefaults(session);
          return;
        case 'rollAffixes':
          this.deps.rollAffixesWithDefaults(session);
          return;
        case 'composeBlueprint':
          this.deps.composeBlueprintWithDefaults(session);
          return;
        case 'materializeOrComplete':
          this.deps.materializeOutcome(session);
          return;
      }
    } catch (error) {
      this.deps.fail(session, action === 'analyzeAsync' ? '异步材料分析失败' : '造物工作流阶段执行失败', {
        action,
        cause: error instanceof Error ? error.message : String(error),
      });
    }
  }

  private getWorkflowSession(
    sessionId: string,
    expectedPhase: CreationPhase,
  ): CreationSession | undefined {
    if (!this.deps.isWorkflowActive(sessionId)) {
      return undefined;
    }

    const session = this.deps.getSession(sessionId);
    if (!session || session.state.phase !== expectedPhase) {
      return undefined;
    }

    return session;
  }
}