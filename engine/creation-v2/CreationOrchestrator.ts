import {
  AffixPoolBuiltEvent,
  AffixRolledEvent,
  BlueprintComposedEvent,
  CraftFailedEvent,
  EnergyBudgetedEvent,
  IntentResolvedEvent,
  MaterialAnalyzedEvent,
  MaterialSemanticEnrichedEvent,
  MaterialSemanticEnrichmentFallbackEvent,
  MaterialSemanticEnrichmentRetryableFallbackEvent,
  MaterialSemanticEnrichmentTerminalFallbackEvent,
  MaterialSubmittedEvent,
  OutcomeMaterializedEvent,
  OutcomePersistedEvent,
  RecipeValidatedEvent,
} from './core/events';
import { CreationEventBus } from './core/EventBus';
import { CreationPhase, CreationWorkflowOptions } from './core/types';
import { CreationSession } from './CreationSession';
import { CreationAbilityAdapter } from './adapters/CreationAbilityAdapter';
import { CreationOutcomeMaterializer } from './adapters/types';
import { AsyncMaterialAnalyzer } from './analysis/AsyncMaterialAnalyzer';
import { DefaultMaterialAnalyzer } from './analysis/DefaultMaterialAnalyzer';
import { DefaultEnergyBudgeter } from './budgeting/DefaultEnergyBudgeter';
import { ProductComposerRegistry } from './composers/ProductComposerRegistry';
import {
  AffixCandidate,
  CreationBlueprint,
  CreationIntent,
  CreationSessionInput,
  EnergyBudget,
  MaterialFingerprint,
  RecipeMatch,
  RolledAffix,
} from './types';
import { DefaultIntentResolver } from './resolvers/DefaultIntentResolver';
import { DefaultRecipeValidator } from './rules/DefaultRecipeValidator';
import { AffixPoolBuilder, AffixRegistry, AffixSelector, DEFAULT_AFFIX_REGISTRY } from './affixes';
import { CreationPhaseHandlerRegistry } from './handlers/CreationPhaseHandlers';

export class CreationOrchestrator {
  private readonly sessions = new Map<string, CreationSession>();
  private readonly activeWorkflowOptions = new Map<
    string,
    Required<CreationWorkflowOptions>
  >();
  private readonly workflowCompletions = new Map<
    string,
    {
      promise: Promise<CreationSession>;
      resolve: (session: CreationSession) => void;
    }
  >();

  constructor(
    readonly eventBus = new CreationEventBus(),
    private readonly outcomeMaterializer: CreationOutcomeMaterializer = new CreationAbilityAdapter(),
    private readonly materialAnalyzer = new DefaultMaterialAnalyzer(),
    private readonly asyncMaterialAnalyzer = new AsyncMaterialAnalyzer(),
    private readonly intentResolver = new DefaultIntentResolver(),
    private readonly recipeValidator = new DefaultRecipeValidator(),
    private readonly energyBudgeter = new DefaultEnergyBudgeter(),
    private readonly blueprintComposer: { compose(session: CreationSession): CreationBlueprint } = new ProductComposerRegistry(),
    private readonly affixPoolBuilder = new AffixPoolBuilder(),
    private readonly affixSelector = new AffixSelector(),
    readonly affixRegistry: AffixRegistry = DEFAULT_AFFIX_REGISTRY,
  ) {
    new CreationPhaseHandlerRegistry({
      getSession: (sessionId) => this.sessions.get(sessionId),
      isWorkflowActive: (sessionId) => this.activeWorkflowOptions.has(sessionId),
      shouldAutoMaterialize: (sessionId) =>
        this.activeWorkflowOptions.get(sessionId)?.autoMaterialize ?? false,
      shouldUseAsyncMaterialAnalysis: (sessionId) =>
        this.activeWorkflowOptions.get(sessionId)?.materialAnalysisMode === 'async',
      completeWorkflow: (sessionId) => {
        const session = this.sessions.get(sessionId);
        const completion = this.workflowCompletions.get(sessionId);
        this.activeWorkflowOptions.delete(sessionId);
        this.workflowCompletions.delete(sessionId);
        if (session && completion) {
          completion.resolve(session);
        }
      },
      analyzeMaterialsWithDefaults: (session) => {
        this.analyzeMaterialsWithDefaults(session);
      },
      analyzeMaterialsWithDefaultsAsync: async (session) => {
        await this.analyzeMaterialsWithDefaultsAsync(session);
      },
      resolveIntentWithDefaults: (session) => {
        this.resolveIntentWithDefaults(session);
      },
      validateRecipeWithDefaults: (session) => {
        this.validateRecipeWithDefaults(session);
      },
      budgetEnergyWithDefaults: (session) => {
        this.budgetEnergyWithDefaults(session);
      },
      buildAffixPoolWithDefaults: (session) => {
        this.buildAffixPoolWithDefaults(session);
      },
      rollAffixesWithDefaults: (session) => {
        this.rollAffixesWithDefaults(session);
      },
      composeBlueprintWithDefaults: (session) => {
        this.composeBlueprintWithDefaults(session);
      },
      materializeOutcome: (session) => {
        this.materializeOutcome(session);
      },
      fail: (session, reason, details) => {
        this.fail(session, reason, details);
      },
    }).register(this.eventBus);
  }

  createSession(input: CreationSessionInput): CreationSession {
    const session = new CreationSession(input);
    this.sessions.set(session.id, session);
    return session;
  }

  runEventDrivenWorkflow(
    session: CreationSession,
    options: CreationWorkflowOptions = {},
  ): CreationSession {
    this.sessions.set(session.id, session);
    this.createWorkflowCompletion(session.id);
    this.activeWorkflowOptions.set(session.id, {
      autoMaterialize: options.autoMaterialize ?? true,
      materialAnalysisMode: options.materialAnalysisMode ?? 'sync',
    });
    this.submitMaterials(session);
    return session;
  }

  waitForWorkflowCompletion(sessionId: string): Promise<CreationSession> {
    const existing = this.workflowCompletions.get(sessionId);
    if (existing) {
      return existing.promise;
    }

    const session = this.sessions.get(sessionId);
    if (!session) {
      return Promise.reject(new Error(`Unknown workflow session: ${sessionId}`));
    }

    if (!this.activeWorkflowOptions.has(sessionId)) {
      return Promise.resolve(session);
    }

    return this.createWorkflowCompletion(sessionId).promise;
  }

  getSession(sessionId: string): CreationSession | undefined {
    return this.sessions.get(sessionId);
  }

  private createWorkflowCompletion(sessionId: string) {
    const existing = this.workflowCompletions.get(sessionId);
    if (existing) {
      return existing;
    }

    let resolve!: (session: CreationSession) => void;
    const promise = new Promise<CreationSession>((res) => {
      resolve = res;
    });

    const completion = { promise, resolve };
    this.workflowCompletions.set(sessionId, completion);
    return completion;
  }

  submitMaterials(session: CreationSession): void {
    session.setPhase(CreationPhase.MATERIAL_SUBMITTED);
    this.eventBus.publish<MaterialSubmittedEvent>({
      type: 'MaterialSubmittedEvent',
      sessionId: session.id,
      timestamp: Date.now(),
      input: session.state.input,
    });
  }

  analyzeMaterialsWithDefaults(session: CreationSession): MaterialFingerprint[] {
    const fingerprints = this.materialAnalyzer.analyze(session.state.input.materials);
    this.recordMaterialAnalysis(session, fingerprints);
    return fingerprints;
  }

  async analyzeMaterialsWithDefaultsAsync(
    session: CreationSession,
  ): Promise<MaterialFingerprint[]> {
    const { fingerprints, enrichment } = await this.asyncMaterialAnalyzer.analyze(
      session.state.input.materials,
    );
    this.publishMaterialSemanticEnrichment(session, fingerprints, enrichment);
    this.recordMaterialAnalysis(session, fingerprints);
    return fingerprints;
  }

  recordMaterialAnalysis(
    session: CreationSession,
    fingerprints: MaterialFingerprint[],
  ): void {
    session.state.materialFingerprints = fingerprints;
    session.syncTags(this.collectSessionTags(session));
    session.setPhase(CreationPhase.MATERIAL_ANALYZED);

    this.eventBus.publish<MaterialAnalyzedEvent>({
      type: 'MaterialAnalyzedEvent',
      sessionId: session.id,
      timestamp: Date.now(),
      fingerprints,
    });
  }

  resolveIntent(session: CreationSession, intent: CreationIntent): void {
    session.state.intent = intent;
    session.syncTags(this.collectSessionTags(session));
    session.setPhase(CreationPhase.INTENT_RESOLVED);

    this.eventBus.publish<IntentResolvedEvent>({
      type: 'IntentResolvedEvent',
      sessionId: session.id,
      timestamp: Date.now(),
      intent,
    });
  }

  resolveIntentWithDefaults(session: CreationSession): CreationIntent {
    const intent = this.intentResolver.resolve(
      session.state.input,
      session.state.materialFingerprints,
    );
    this.resolveIntent(session, intent);
    return intent;
  }

  validateRecipe(session: CreationSession, recipeMatch: RecipeMatch): void {
    session.state.recipeMatch = recipeMatch;
    session.syncTags(this.collectSessionTags(session));
    session.setPhase(CreationPhase.RECIPE_VALIDATED);

    this.eventBus.publish<RecipeValidatedEvent>({
      type: 'RecipeValidatedEvent',
      sessionId: session.id,
      timestamp: Date.now(),
      recipeMatch,
    });
  }

  validateRecipeWithDefaults(session: CreationSession): RecipeMatch {
    if (!session.state.intent) {
      throw new Error('Cannot validate recipe before resolving intent');
    }

    const recipeMatch = this.recipeValidator.validate(
      session.state.input.productType,
      session.state.materialFingerprints,
      session.state.intent,
    );

    if (!recipeMatch.valid) {
      this.fail(session, recipeMatch.notes?.[0] ?? '配方校验失败', {
        notes: recipeMatch.notes,
      });
      return recipeMatch;
    }

    this.validateRecipe(session, recipeMatch);
    return recipeMatch;
  }

  budgetEnergy(session: CreationSession, budget: EnergyBudget): void {
    session.state.energyBudget = budget;
    session.setPhase(CreationPhase.ENERGY_BUDGETED);

    this.eventBus.publish<EnergyBudgetedEvent>({
      type: 'EnergyBudgetedEvent',
      sessionId: session.id,
      timestamp: Date.now(),
      budget,
    });
  }

  budgetEnergyWithDefaults(session: CreationSession): EnergyBudget {
    const budget = this.energyBudgeter.allocate(
      session.state.materialFingerprints,
      session.state.recipeMatch,
    );
    this.budgetEnergy(session, budget);
    return budget;
  }

  buildAffixPool(session: CreationSession, affixPool: AffixCandidate[]): void {
    session.state.affixPool = affixPool;
    session.setPhase(CreationPhase.AFFIX_POOL_BUILT);

    this.eventBus.publish<AffixPoolBuiltEvent>({
      type: 'AffixPoolBuiltEvent',
      sessionId: session.id,
      timestamp: Date.now(),
      affixPool,
    });
  }

  buildAffixPoolWithDefaults(session: CreationSession): AffixCandidate[] {
    const pool = this.affixPoolBuilder.build(this.affixRegistry, session);
    this.buildAffixPool(session, pool);
    return pool;
  }

  rollAffixes(session: CreationSession, affixes: RolledAffix[]): void {
    session.state.rolledAffixes = affixes;

    if (session.state.energyBudget) {
      session.state.energyBudget = this.energyBudgeter.reconcileRolledAffixes(
        session.state.energyBudget,
        affixes,
      );
    }

    session.setPhase(CreationPhase.AFFIX_ROLLED);

    this.eventBus.publish<AffixRolledEvent>({
      type: 'AffixRolledEvent',
      sessionId: session.id,
      timestamp: Date.now(),
      affixes,
    });
  }

  rollAffixesWithDefaults(session: CreationSession): RolledAffix[] {
    if (!session.state.intent) {
      throw new Error('Cannot roll affixes before resolving intent');
    }
    if (!session.state.energyBudget) {
      throw new Error('Cannot roll affixes before energy budgeting');
    }
    const selection = this.affixSelector.select(
      session.state.affixPool,
      session.state.energyBudget,
      session.state.intent,
    );
    session.state.energyBudget = this.energyBudgeter.applySelectionAudit(
      session.state.energyBudget,
      selection,
    );
    this.rollAffixes(session, selection.affixes);
    return selection.affixes;
  }

  composeBlueprint(
    session: CreationSession,
    blueprint: CreationBlueprint,
  ): void {
    session.state.blueprint = blueprint;
    session.syncTags(this.collectSessionTags(session));
    session.setPhase(CreationPhase.BLUEPRINT_COMPOSED);

    this.eventBus.publish<BlueprintComposedEvent>({
      type: 'BlueprintComposedEvent',
      sessionId: session.id,
      timestamp: Date.now(),
      blueprint,
    });
  }

  composeBlueprintWithDefaults(session: CreationSession): CreationBlueprint {
    const blueprint = this.blueprintComposer.compose(session);
    this.composeBlueprint(session, blueprint);
    return blueprint;
  }

  materializeOutcome(session: CreationSession) {
    return this.materializeOutcomeWith(session, this.outcomeMaterializer);
  }

  materializeOutcomeWith(
    session: CreationSession,
    materializer: CreationOutcomeMaterializer,
  ) {
    if (!session.state.blueprint) {
      throw new Error('Cannot materialize outcome before blueprint is composed');
    }

    const outcome = materializer.materialize(
      session.state.input.productType,
      session.state.blueprint,
    );

    session.state.outcome = outcome;
    session.setPhase(CreationPhase.OUTCOME_MATERIALIZED);

    this.eventBus.publish<OutcomeMaterializedEvent>({
      type: 'OutcomeMaterializedEvent',
      sessionId: session.id,
      timestamp: Date.now(),
      outcome,
    });

    return outcome;
  }

  markPersisted(session: CreationSession): void {
    if (!session.state.outcome) {
      throw new Error('Cannot persist outcome before materialization');
    }

    session.setPhase(CreationPhase.OUTCOME_PERSISTED);
    this.eventBus.publish<OutcomePersistedEvent>({
      type: 'OutcomePersistedEvent',
      sessionId: session.id,
      timestamp: Date.now(),
      outcome: session.state.outcome,
    });
  }

  fail(
    session: CreationSession,
    reason: string,
    details?: Record<string, unknown>,
  ): void {
    const failedAtPhase = session.state.phase;
    session.state.failureReason = reason;
    session.setPhase(CreationPhase.FAILED);

    this.eventBus.publish<CraftFailedEvent>({
      type: 'CraftFailedEvent',
      sessionId: session.id,
      timestamp: Date.now(),
      phase: failedAtPhase,
      reason,
      details,
    });
  }

  private collectSessionTags(session: CreationSession): string[] {
    const tags = new Set<string>();

    session.state.materialFingerprints.forEach((fingerprint) => {
      fingerprint.explicitTags.forEach((tag) => tags.add(tag));
      fingerprint.semanticTags.forEach((tag) => tags.add(tag));
      fingerprint.recipeTags.forEach((tag) => tags.add(tag));
    });

    session.state.intent?.dominantTags.forEach((tag) => tags.add(tag));
    session.state.intent?.requestedTags.forEach((tag) => tags.add(tag));
    session.state.recipeMatch?.matchedTags.forEach((tag) => tags.add(tag));
    session.state.blueprint?.tags.forEach((tag) => tags.add(tag));

    return Array.from(tags);
  }

  private publishMaterialSemanticEnrichment(
    session: CreationSession,
    fingerprints: MaterialFingerprint[],
    enrichment: {
      status: 'disabled' | 'success' | 'fallback';
      fallbackReason?: string;
      failureDisposition?: 'retryable' | 'non_retryable';
    },
  ): void {
    const metadata = fingerprints
      .filter((fingerprint) => fingerprint.metadata?.llm)
      .map((fingerprint) => ({
        materialId: fingerprint.materialId,
        materialName: fingerprint.materialName,
        llm: fingerprint.metadata!.llm!,
      }));

    if (enrichment.status === 'success') {
      this.eventBus.publish<MaterialSemanticEnrichedEvent>({
        type: 'MaterialSemanticEnrichedEvent',
        sessionId: session.id,
        timestamp: Date.now(),
        fingerprints,
        metadata,
      });
    }

    if (enrichment.status === 'fallback') {
      this.eventBus.publish<MaterialSemanticEnrichmentFallbackEvent>({
        type: 'MaterialSemanticEnrichmentFallbackEvent',
        sessionId: session.id,
        timestamp: Date.now(),
        reason: enrichment.fallbackReason ?? 'LLM semantic enrichment fallback',
        failureDisposition: enrichment.failureDisposition ?? 'retryable',
        metadata,
      });

      if (enrichment.failureDisposition === 'non_retryable') {
        this.eventBus.publish<MaterialSemanticEnrichmentTerminalFallbackEvent>({
          type: 'MaterialSemanticEnrichmentTerminalFallbackEvent',
          sessionId: session.id,
          timestamp: Date.now(),
          reason: enrichment.fallbackReason ?? 'LLM semantic enrichment fallback',
          metadata,
        });
      } else {
        this.eventBus.publish<MaterialSemanticEnrichmentRetryableFallbackEvent>({
          type: 'MaterialSemanticEnrichmentRetryableFallbackEvent',
          sessionId: session.id,
          timestamp: Date.now(),
          reason: enrichment.fallbackReason ?? 'LLM semantic enrichment fallback',
          metadata,
        });
      }
    }
  }
}