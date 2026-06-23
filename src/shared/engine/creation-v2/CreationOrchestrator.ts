import { CreationTags } from '@shared/engine/shared/tag-domain';
import { CreationAbilityAdapter } from './adapters/CreationAbilityAdapter';
import { CreationOutcomeMaterializer } from './adapters/types';
import {
  AffixPoolBuilder,
  AffixRegistry,
  AffixSelector,
  DEFAULT_AFFIX_REGISTRY,
} from './affixes';
import { AffixPicker } from './affixes/AffixPicker';
import { AffixRollEngine } from './affixes/AffixRollEngine';
import { AsyncMaterialAnalyzer } from './analysis/AsyncMaterialAnalyzer';
import { buildCreationTagSignals } from './analysis/CreationTagSignalBuilder';
import { DefaultMaterialAnalyzer } from './analysis/DefaultMaterialAnalyzer';
import type { MaterialSemanticEnrichmentReport } from './analysis/MaterialSemanticEnricher';
import {
  DeepSeekProductNamingEnricher,
  ProductNamingFacts,
} from './analysis/ProductNamingEnricher';
import { deriveProjectionQualityFromBudget } from './analysis/ProjectionQualityProfile';
import { DefaultEnergyBudgeter } from './budgeting/DefaultEnergyBudgeter';
import { ProductComposerRegistry } from './composers/ProductComposerRegistry';
import { resolveAffixSlotCount } from './config/CreationBalance';
import { CreationEventBus } from './core/EventBus';
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
  OutcomePersistedEvent,
  RecipeValidatedEvent,
} from './core/events';
import { CreationPhase, CreationWorkflowOptions } from './core/types';
import { CreationSession } from './CreationSession';
import { CreationError } from './errors';
import { CreationPhaseHandlerRegistry } from './handlers/CreationPhaseHandlers';
import { PhaseActionRegistry } from './handlers/PhaseActionRegistry';
import { WorkflowVariantPolicy } from './handlers/WorkflowVariantPolicy';
import { SkillProductModel } from './models';
import { createSeededRandom } from './random';
import { DefaultIntentResolver } from './resolvers/DefaultIntentResolver';
import { AffixPoolDecision, AffixSelectionDecision } from './rules/contracts';
import { DefaultRecipeValidator } from './rules/DefaultRecipeValidator';
import {
  AffixCandidate,
  AffixSelectionAudit,
  CreationBlueprint,
  CreationIntent,
  CreationSessionInput,
  EnergyBudget,
  IntentCraftInput,
  MaterialFingerprint,
  RecipeMatch,
  RolledAffix,
} from './types';
import { validateCreationInput } from './validation/CreationInputValidator';

/*
 * CreationOrchestrator: 编排层主入口。
 * 责任：管理 CreationSession 生命周期、注册与派发阶段动作（PhaseActionRegistry）、
 * 驱动事件链（通过 CreationEventBus 发布 CreationDomainEvent）、管理 WorkflowVariantPolicy（变体策略），
 * 提供高阶入口（craftSync / craftAsync / runEventDrivenWorkflow / waitForWorkflowCompletion）以及保持 session 状态。
 */
export class CreationOrchestrator {
  private readonly sessions = new Map<string, CreationSession>();
  private readonly activeWorkflowPolicies = new Map<
    string,
    WorkflowVariantPolicy
  >();
  private readonly workflowCompletions = new Map<
    string,
    {
      promise: Promise<CreationSession>;
      resolve: (session: CreationSession) => void;
    }
  >();

  readonly phaseActionRegistry: PhaseActionRegistry;

  constructor(
    readonly eventBus = new CreationEventBus(),
    private readonly outcomeMaterializer: CreationOutcomeMaterializer = new CreationAbilityAdapter(),
    private readonly materialAnalyzer = new DefaultMaterialAnalyzer(),
    private readonly asyncMaterialAnalyzer = new AsyncMaterialAnalyzer(),
    private readonly intentResolver = new DefaultIntentResolver(),
    private readonly recipeValidator = new DefaultRecipeValidator(),
    private readonly energyBudgeter = new DefaultEnergyBudgeter(),
    private readonly blueprintComposer: {
      compose(session: CreationSession): CreationBlueprint;
    } = new ProductComposerRegistry(),
    private readonly affixPoolBuilder = new AffixPoolBuilder(),
    private readonly affixSelector = new AffixSelector(),
    readonly affixRegistry: AffixRegistry = DEFAULT_AFFIX_REGISTRY,
    private readonly namingEnricher = new DeepSeekProductNamingEnricher(),
  ) {
    this.phaseActionRegistry = new PhaseActionRegistry();
    this.phaseActionRegistry.registerDefaults({
      analyzeSync: (session) => {
        this.analyzeMaterialsWithDefaults(session);
      },
      analyzeAsync: async (session) => {
        await this.analyzeMaterialsWithDefaultsAsync(session);
      },
      resolveIntent: (session) => {
        this.resolveIntentWithDefaults(session);
      },
      validateRecipe: (session) => {
        this.validateRecipeWithDefaults(session);
      },
      budgetEnergy: (session) => {
        this.budgetEnergyWithDefaults(session);
      },
      buildAffixPool: (session) => {
        this.buildAffixPoolWithDefaults(session);
      },
      rollAffixes: (session) => {
        this.rollAffixesWithDefaults(session);
      },
      composeBlueprint: (session) => {
        this.composeBlueprintWithDefaults(session);
      },
      enrichNaming: async (session) => {
        await this.enrichNamingWithLLM(session);
      },
      materializeOrComplete: (session) => {
        this.materializeOutcome(session);
      },
    });

    new CreationPhaseHandlerRegistry({
      getSession: (sessionId) => this.sessions.get(sessionId),
      isWorkflowActive: (sessionId) =>
        this.activeWorkflowPolicies.has(sessionId),
      getVariantPolicy: (sessionId) =>
        this.activeWorkflowPolicies.get(sessionId),
      phaseActionRegistry: this.phaseActionRegistry,
      completeWorkflow: (sessionId) => {
        this.completeWorkflow(sessionId);
      },
      fail: (session, reason, details) => {
        this.fail(session, reason, details);
      },
    }).register(this.eventBus);
  }

  createSession(input: CreationSessionInput): CreationSession {
    if (input.sessionId && this.sessions.has(input.sessionId)) {
      throw new Error(
        `CreationOrchestrator: sessionId '${input.sessionId}' is already in use. ` +
          `Provide a unique sessionId or call clearSession() first.`,
      );
    }
    const session = new CreationSession(input);
    this.sessions.set(session.id, session);
    return session;
  }

  /**
   * 启动事件驱动造物工作流。
   *
   * @param options.autoMaterialize - 默认 true。
   *   - true: 蓝图组合完成后自动实体化，session 最终 phase 为 OUTCOME_MATERIALIZED。
   *   - false: workflow 在 BLUEPRINT_COMPOSED 阶段完成，调用方需手动调用
   *     `materializeOutcome(session)` 或 `materializeOutcomeWith()` 进行实体化。
   * @param options.materialAnalysisMode - 'sync'（默认）或 'async'（启用 LLM 语义分析）。
   */
  runEventDrivenWorkflow(
    session: CreationSession,
    options: CreationWorkflowOptions = {},
  ): CreationSession {
    this.sessions.set(session.id, session);
    this.createWorkflowCompletion(session.id);

    const validation = validateCreationInput(session.state.input);
    if (!validation.valid) {
      this.fail(session, validation.reason ?? '输入校验失败');
      const completion = this.workflowCompletions.get(session.id);
      this.workflowCompletions.delete(session.id);
      if (completion) {
        completion.resolve(session);
      }
      return session;
    }

    this.activeWorkflowPolicies.set(
      session.id,
      WorkflowVariantPolicy.fromOptions(options),
    );
    this.submitMaterials(session);
    return session;
  }

  /**
   * 等待 workflow 完成并返回最终 session。
   *
   * 当 `autoMaterialize: false` 时，workflow 在 session.state.phase === BLUEPRINT_COMPOSED
   * 时即完成（蓝图已就绪，尚未实体化）。调用方可通过检查 phase 判断是否需要手动实体化。
   */
  waitForWorkflowCompletion(sessionId: string): Promise<CreationSession> {
    const existing = this.workflowCompletions.get(sessionId);
    if (existing) {
      return existing.promise;
    }

    const session = this.sessions.get(sessionId);
    if (!session) {
      return Promise.reject(
        new Error(`Unknown workflow session: ${sessionId}`),
      );
    }

    if (!this.activeWorkflowPolicies.has(sessionId)) {
      return Promise.resolve(session);
    }

    return this.createWorkflowCompletion(sessionId).promise;
  }

  getSession(sessionId: string): CreationSession | undefined {
    return this.sessions.get(sessionId);
  }

  /**
   * 清理指定 sessionId 对应的 session 及相关工作流状态。
   * 幂等操作：若 session 不存在则静默忽略。
   * 典型用途：造物完成或失败后释放内存；或在重新造物前清理旧 session。
   */
  clearSession(sessionId: string): void {
    this.sessions.delete(sessionId);
    this.workflowCompletions.delete(sessionId);
    this.activeWorkflowPolicies.delete(sessionId);
  }

  /**
   * 高阶造物入口（同步材料分析模式）。
   * 等价于 createSession + runEventDrivenWorkflow(materialAnalysisMode: 'sync') + waitForWorkflowCompletion。
   * 返回完成后的 CreationSession，调用方通过 session.state.blueprint 读取产物。
   */
  craftSync(
    input: CreationSessionInput,
    options: Omit<CreationWorkflowOptions, 'materialAnalysisMode'> = {},
  ): Promise<CreationSession> {
    const session = this.createSession(input);
    this.runEventDrivenWorkflow(session, {
      ...options,
      materialAnalysisMode: 'sync',
    });
    return this.waitForWorkflowCompletion(session.id);
  }

  /**
   * 高阶造物入口（异步 LLM 语义分析模式）。
   * 等价于 createSession + runEventDrivenWorkflow(materialAnalysisMode: 'async') + waitForWorkflowCompletion。
   * 返回完成后的 CreationSession，调用方通过 session.state.blueprint 读取产物。
   */
  craftAsync(
    input: CreationSessionInput,
    options: Omit<CreationWorkflowOptions, 'materialAnalysisMode'> = {},
  ): Promise<CreationSession> {
    const session = this.createSession(input);
    this.runEventDrivenWorkflow(session, {
      ...options,
      materialAnalysisMode: 'async',
    });
    return this.waitForWorkflowCompletion(session.id);
  }

  craftFromIntent(
    input: IntentCraftInput,
    options: Omit<CreationWorkflowOptions, 'materialAnalysisMode'> & {
      rng?: () => number;
      suppressLogs?: boolean;
    } = {},
  ): CreationSession {
    if ((options.namingMode ?? 'skip') === 'llm') {
      throw new Error(
        'craftFromIntent does not support llm naming; use enemy copy enrichment instead',
      );
    }

    const session = this.createSession({
      sessionId: input.sessionId,
      slugSeed: input.slugSeed,
      cultivatorId: input.cultivatorId,
      creatorName: input.creatorName,
      realm: input.realm,
      realmStage: input.realmStage,
      productType: input.productType,
      materials: [],
      userPrompt: input.userPrompt,
      contextPositiveTagBiases: input.positiveTagBiases,
      contextNegativeTagBiases: input.negativeTagBiases,
      requestedSlot: input.requestedSlot,
      requestedTargetPolicy: input.requestedTargetPolicy,
    });
    session.state.intentCraftMeta = {
      ...session.state.intentCraftMeta,
      maxAffixCount: input.maxAffixCount,
      excludedAffixIds: input.excludedAffixIds,
      selectionSeed: `${String(input.seed)}:${input.stableOutputKey}`,
      rng: options.rng,
      stableOutputKey: input.stableOutputKey,
      suppressLogs: options.suppressLogs,
      projectionContext: input.projectionContext,
    };

    try {
      const intent: CreationIntent = {
        productType: input.productType,
        dominantTags: Array.from(new Set(input.dominantTags)),
        positiveTagBiases: input.positiveTagBiases,
        negativeTagBiases: input.negativeTagBiases,
        ...(input.elementBias ? { elementBias: input.elementBias } : {}),
        ...(input.requestedSlot
          ? {
              slotBias: input.requestedSlot,
              slotBiasSource: 'requested' as const,
            }
          : {}),
        ...(input.requestedTargetPolicy
          ? { targetPolicyBias: input.requestedTargetPolicy }
          : {}),
      };
      this.resolveIntent(session, intent);

      const recipeMatch = this.recipeValidator.validateFromMaterialFacts(
        {
          productType: input.productType,
          fingerprints: [],
          normalizedTags: [
            ...intent.dominantTags,
            this.resolveSyntheticRecipeBiasTag(input.productType),
          ],
          recipeTags: [this.resolveSyntheticRecipeBiasTag(input.productType)],
          dominantTags: [...intent.dominantTags],
          energyProfile: {
            baseEnergy: Math.max(0, input.energyBudget),
            diversityBonus: 0,
            coherenceBonus: 0,
            effectiveEnergy: Math.max(0, input.energyBudget),
            unlockScore: Math.max(0, Math.round(input.unlockScore)),
          },
          unlockScore: Math.max(0, Math.round(input.unlockScore)),
        },
        intent,
      );
      if (!recipeMatch.valid) {
        this.fail(session, recipeMatch.notes?.[0] ?? '意图造物配方校验失败', {
          notes: recipeMatch.notes,
        });
        return session;
      }
      this.validateRecipe(session, recipeMatch);

      const budget = {
        baseTotal: Math.max(0, input.energyBudget),
        effectiveTotal: Math.max(0, input.energyBudget),
        reserved: recipeMatch.reservedEnergy ?? 0,
        spent: 0,
        remaining: Math.max(
          0,
          Math.max(0, input.energyBudget) - (recipeMatch.reservedEnergy ?? 0),
        ),
        initialRemaining: Math.max(
          0,
          Math.max(0, input.energyBudget) - (recipeMatch.reservedEnergy ?? 0),
        ),
        allocations: [],
        rejections: [],
        sources: [
          { source: 'intent_budget', amount: Math.max(0, input.energyBudget) },
        ],
      } satisfies EnergyBudget;
      this.budgetEnergy(session, budget);

      this.activeWorkflowPolicies.set(
        session.id,
        WorkflowVariantPolicy.fromOptions({
          autoMaterialize: options.autoMaterialize ?? false,
          namingMode: options.namingMode ?? 'skip',
          workflowMode: 'intent',
        }),
      );
      this.executeSyncPhaseAction('buildAffixPool', session);

      return session;
    } finally {
      this.clearSession(session.id);
    }
  }

  private resolveSyntheticRecipeBiasTag(
    productType: IntentCraftInput['productType'],
  ): string {
    switch (productType) {
      case 'artifact':
        return CreationTags.RECIPE.PRODUCT_BIAS_ARTIFACT;
      case 'gongfa':
        return CreationTags.RECIPE.PRODUCT_BIAS_GONGFA;
      case 'skill':
        return CreationTags.RECIPE.PRODUCT_BIAS_SKILL;
    }
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

  /**
   * @internal 供测试和工作流内部神调使用。
   * 生产调用方请改用 `createSession` + `craftSync/Async` 等高阶入口。
   */
  protected analyzeMaterialsWithDefaults(
    session: CreationSession,
  ): MaterialFingerprint[] {
    const fingerprints = this.materialAnalyzer.analyze(
      session.state.input.materials,
    );
    this.recordMaterialAnalysis(session, fingerprints);
    return fingerprints;
  }

  /**
   * @internal 供测试和工作流内部神调使用（异步版）。
   * 生产调用方请改用 `createSession` + `craftSync/Async` 等高阶入口。
   */
  protected async analyzeMaterialsWithDefaultsAsync(
    session: CreationSession,
  ): Promise<MaterialFingerprint[]> {
    const { fingerprints, enrichment } =
      await this.asyncMaterialAnalyzer.analyze(session.state.input.materials);
    this.observeMaterialSemanticEnrichment(session, enrichment);
    this.recordMaterialAnalysis(session, fingerprints);
    return fingerprints;
  }

  recordMaterialAnalysis(
    session: CreationSession,
    fingerprints: MaterialFingerprint[],
  ): void {
    session.state.materialFingerprints = fingerprints;
    session.syncInputTagSignals(this.collectInputTagSignals(session));
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
    session.syncInputTagSignals(this.collectInputTagSignals(session));
    session.setPhase(CreationPhase.INTENT_RESOLVED);

    this.eventBus.publish<IntentResolvedEvent>({
      type: 'IntentResolvedEvent',
      sessionId: session.id,
      timestamp: Date.now(),
      intent,
    });
  }

  /**
   * @internal 供测试和工作流内部神调使用。
   * 生产调用方请改用 `createSession` + `craftSync/Async` 等高阶入口。
   */
  protected resolveIntentWithDefaults(
    session: CreationSession,
  ): CreationIntent {
    const intent = this.intentResolver.resolve(
      session.state.input,
      session.state.materialFingerprints,
    );
    this.resolveIntent(session, intent);
    return intent;
  }

  validateRecipe(session: CreationSession, recipeMatch: RecipeMatch): void {
    session.state.recipeMatch = recipeMatch;
    session.syncInputTagSignals(this.collectInputTagSignals(session));
    session.setPhase(CreationPhase.RECIPE_VALIDATED);

    this.eventBus.publish<RecipeValidatedEvent>({
      type: 'RecipeValidatedEvent',
      sessionId: session.id,
      timestamp: Date.now(),
      recipeMatch,
    });
  }

  /**
   * @internal 供测试和工作流内部神调使用。
   * 生产调用方请改用 `createSession` + `craftSync/Async` 等高阶入口。
   */
  protected validateRecipeWithDefaults(session: CreationSession): RecipeMatch {
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

  /**
   * @internal 供测试和工作流内部神调使用。
   * 生产调用方请改用 `createSession` + `craftSync/Async` 等高阶入口。
   */
  protected budgetEnergyWithDefaults(session: CreationSession): EnergyBudget {
    const budget = this.energyBudgeter.allocate(
      session.state.materialFingerprints,
      session.state.recipeMatch,
      session.state.input.productType,
    );
    this.budgetEnergy(session, budget);
    return budget;
  }

  buildAffixPool(
    session: CreationSession,
    affixPool: AffixCandidate[],
    poolDecision?: AffixPoolDecision,
  ): void {
    session.state.affixPool = affixPool;
    session.state.rolledAffixes = [];
    session.state.affixSelectionAudit = undefined;
    session.state.affixSelectionFinalDecision = undefined;
    if (poolDecision) session.state.affixPoolDecision = poolDecision;
    session.setPhase(CreationPhase.AFFIX_POOL_BUILT);

    this.eventBus.publish<AffixPoolBuiltEvent>({
      type: 'AffixPoolBuiltEvent',
      sessionId: session.id,
      timestamp: Date.now(),
      affixPool,
      poolDecision,
    });
  }

  /**
   * @internal 供测试和工作流内部神调使用。
   * 生产调用方请改用 `createSession` + `craftSync/Async` 等高阶入口。
   */
  protected buildAffixPoolWithDefaults(
    session: CreationSession,
  ): AffixCandidate[] {
    const decision = this.affixPoolBuilder.buildDecision(
      this.affixRegistry,
      session,
    );
    const excludedAffixIds = new Set(
      session.state.intentCraftMeta?.excludedAffixIds ?? [],
    );
    const filteredCandidates = excludedAffixIds.size
      ? decision.candidates.filter(
          (candidate) => !excludedAffixIds.has(candidate.id),
        )
      : decision.candidates;
    this.buildAffixPool(session, filteredCandidates, {
      ...decision,
      candidates: filteredCandidates,
    });
    return filteredCandidates;
  }

  rollAffixes(
    session: CreationSession,
    affixes: RolledAffix[],
    finalSelectionDecision?: AffixSelectionDecision,
  ): void {
    session.state.rolledAffixes = affixes;
    const resolvedFinalSelectionDecision =
      finalSelectionDecision ??
      session.state.affixSelectionAudit?.finalDecision;
    if (resolvedFinalSelectionDecision) {
      session.state.affixSelectionFinalDecision =
        resolvedFinalSelectionDecision;
    }

    if (session.state.energyBudget) {
      if (
        this.hasMatchingSelectionAudit(
          session.state.affixSelectionAudit,
          affixes,
        )
      ) {
        session.state.energyBudget = this.energyBudgeter.finalizeSelection(
          session.state.energyBudget,
          session.state.affixSelectionAudit,
        );
      } else {
        session.state.affixSelectionAudit = undefined;
        session.state.energyBudget = this.energyBudgeter.reconcileRolledAffixes(
          session.state.energyBudget,
          affixes,
        );
      }
    }

    session.setPhase(CreationPhase.AFFIX_ROLLED);

    this.eventBus.publish<AffixRolledEvent>({
      type: 'AffixRolledEvent',
      sessionId: session.id,
      timestamp: Date.now(),
      affixes,
      ...(session.state.affixSelectionAudit
        ? { selectionAudit: session.state.affixSelectionAudit }
        : {}),
      ...(resolvedFinalSelectionDecision
        ? { finalSelectionDecision: resolvedFinalSelectionDecision }
        : {}),
    });
  }

  /**
   * @internal 供测试和工作流内部神调使用。
   * 生产调用方请改用 `createSession` + `craftSync/Async` 等高阶入口。
   */
  protected rollAffixesWithDefaults(session: CreationSession): RolledAffix[] {
    if (!session.state.intent) {
      throw new Error('Cannot roll affixes before resolving intent');
    }
    if (!session.state.energyBudget) {
      throw new Error('Cannot roll affixes before energy budgeting');
    }
    const availableAffixEnergy =
      session.state.energyBudget.initialRemaining ??
      session.state.energyBudget.remaining;
    const overrideMaxAffixCount = session.state.intentCraftMeta?.maxAffixCount;
    const maxAffixCount = overrideMaxAffixCount
      ? Math.min(
          resolveAffixSlotCount(availableAffixEnergy),
          overrideMaxAffixCount,
        )
      : resolveAffixSlotCount(availableAffixEnergy);

    const selectionSeed = session.state.intentCraftMeta?.selectionSeed;
    const seededRng =
      session.state.intentCraftMeta?.rng ??
      (selectionSeed ? createSeededRandom(selectionSeed) : undefined);
    const selector = seededRng
      ? new AffixSelector(
          undefined,
          new AffixPicker(seededRng),
          new AffixRollEngine(seededRng),
        )
      : this.affixSelector;

    const { audit: selection } = selector.selectWithDecision(
      session.state.affixPool,
      session.state.energyBudget,
      session.state.intent,
      maxAffixCount,
    );

    // 断言：必须包含核心词缀（如果是技能、功法、法宝）
    const needsCore = ['skill', 'gongfa', 'artifact'].includes(
      session.state.input.productType,
    );
    const hasCore = selection.affixes.some((affix) => affix.slot === 'core');
    if (needsCore && !hasCore) {
      const message =
        selection.exhaustionReason === 'budget_exhausted'
          ? '当前材料灵力不足，无法凝成核心词条。请提高材料品阶、增加投入数量，或更换更契合的主材。'
          : '当前材料无法凝成核心词条。请更换更契合该造物类型的主材。';
      throw new CreationError(
        'Selection',
        'NO_CORE_AFFIX',
        message,
        { decision: selection },
      );
    }

    session.state.affixSelectionAudit = selection;
    if (selection.finalDecision) {
      session.state.affixSelectionFinalDecision = selection.finalDecision;
    }
    this.rollAffixes(session, selection.affixes, selection.finalDecision);
    return selection.affixes;
  }

  private executeSyncPhaseAction(
    action: 'buildAffixPool' | 'rollAffixes' | 'composeBlueprint' | 'materializeOrComplete',
    session: CreationSession,
  ): void {
    const phaseAction = this.phaseActionRegistry.get(action);
    if (!phaseAction) {
      throw new Error(`Missing phase action: ${action}`);
    }

    const result = phaseAction(session);
    if (result instanceof Promise) {
      throw new Error(`Action ${action} cannot run asynchronously in craftFromIntent`);
    }
  }

  composeBlueprint(
    session: CreationSession,
    blueprint: CreationBlueprint,
  ): void {
    session.state.blueprint = blueprint;
    session.syncInputTagSignals(this.collectInputTagSignals(session));
    session.setPhase(CreationPhase.BLUEPRINT_COMPOSED);

    this.eventBus.publish<BlueprintComposedEvent>({
      type: 'BlueprintComposedEvent',
      sessionId: session.id,
      timestamp: Date.now(),
      blueprint,
    });
  }

  /**
   * @internal 供测试和工作流内部神调使用。
   * 生产调用方请改用 `createSession` + `craftSync/Async` 等高阶入口。
   */
  protected composeBlueprintWithDefaults(
    session: CreationSession,
  ): CreationBlueprint {
    const blueprint = this.blueprintComposer.compose(session);

    // 断言：产出的效果列表不能为空 (针对技能)
    if (session.state.input.productType === 'skill') {
      const skillModel = blueprint.productModel as SkillProductModel;
      if (
        !skillModel.battleProjection ||
        skillModel.battleProjection.effects.length === 0
      ) {
        throw new CreationError(
          'Composition',
          'EMPTY_EFFECTS',
          '技能产出的效果列表不能为空',
          { decision: blueprint },
        );
      }
    }

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
      throw new Error(
        'Cannot materialize outcome before blueprint is composed',
      );
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

  protected completeWorkflow(sessionId: string): void {
    const session = this.sessions.get(sessionId);
    const completion = this.workflowCompletions.get(sessionId);
    this.activeWorkflowPolicies.delete(sessionId);
    this.workflowCompletions.delete(sessionId);
    if (session) {
      this.logWorkflowCompleted(session);
    }
    if (session && completion) {
      completion.resolve(session);
    }
  }

  protected async enrichNamingWithLLM(session: CreationSession): Promise<void> {
    if (!session.state.blueprint) {
      throw new Error('Cannot enrich naming before blueprint is composed');
    }
    if (!session.state.energyBudget) {
      throw new Error('Cannot enrich naming before energy budgeting');
    }

    const projectionQualityProfile = deriveProjectionQualityFromBudget(
      session.state.energyBudget,
    );

    // 从 session.state 构建 ProductNamingFacts 对象
    const facts: ProductNamingFacts = {
      productType: session.state.input.productType,
      projectionQuality: projectionQualityProfile.quality,
      elementBias: session.state.intent?.elementBias,
      slotBias: session.state.intent?.slotBias,
      dominantTags: session.state.intent?.dominantTags ?? [],
      rolledAffixes: session.state.rolledAffixes,
      materialNames: session.state.materialFingerprints.map(
        (f) => f.materialName,
      ),
      userPrompt: session.state.input.userPrompt,
    };

    const enrichment = await this.namingEnricher.enrich(facts);

    if (enrichment) {
      const model = session.state.blueprint.productModel;
      model.originalName = model.name; // Task 3 已增加该字段
      model.name = enrichment.name;
      model.description = enrichment.description;

      session.state.namingMetadata = {
        status: 'success',
        styleInsight: enrichment.styleInsight,
        originalName: model.originalName,
        provider: 'deepseek',
      };
    } else {
      session.state.namingMetadata = {
        status: 'fallback',
        originalName: session.state.blueprint.productModel.name,
      };
    }

    // 核心流转逻辑
    const policy = this.activeWorkflowPolicies.get(session.id);
    if (policy) {
      if (policy.isAutoMaterialize()) {
        this.materializeOutcome(session);
      } else {
        this.completeWorkflow(session.id);
      }
    }
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
      ...(details?.cause ? { cause: details.cause } : {}),
    });

    this.logWorkflowFailed(session, failedAtPhase, reason, details);
  }

  private collectInputTagSignals(session: CreationSession) {
    return buildCreationTagSignals({
      materialFingerprints: session.state.materialFingerprints,
      intent: session.state.intent,
      recipeMatch: session.state.recipeMatch,
    });
  }

  /**
   * 可观测钩子：记录 async LLM 语义增强结果，不参与 workflow phase 推进。
   * 子类可覆盖该方法接入外部日志系统。
   */
  protected observeMaterialSemanticEnrichment(
    session: CreationSession,
    enrichment: Pick<
      MaterialSemanticEnrichmentReport,
      'status' | 'provider' | 'fallbackReason' | 'failureDisposition'
    >,
  ): void {
    if (
      process.env.NODE_ENV === 'test' ||
      session.state.intentCraftMeta?.suppressLogs
    ) {
      return;
    }

    if (enrichment.status === 'fallback') {
      console.warn('[creation-v2] material semantic enrichment fallback', {
        sessionId: session.id,
        provider: enrichment.provider,
        reason: enrichment.fallbackReason,
        failureDisposition: enrichment.failureDisposition,
      });
      return;
    }

    console.info('[creation-v2] material semantic enrichment', {
      sessionId: session.id,
      provider: enrichment.provider,
      status: enrichment.status,
    });
  }

  private hasMatchingSelectionAudit(
    audit: AffixSelectionAudit | undefined,
    affixes: RolledAffix[],
  ): audit is AffixSelectionAudit {
    if (!audit || audit.affixes.length !== affixes.length) {
      return false;
    }

    return audit.affixes.every((auditAffix, index) => {
      const rolledAffix = affixes[index];
      return (
        rolledAffix !== undefined &&
        auditAffix.id === rolledAffix.id &&
        auditAffix.energyCost === rolledAffix.energyCost
      );
    });
  }

  private logWorkflowCompleted(session: CreationSession): void {
    if (
      process.env.NODE_ENV === 'test' ||
      session.state.intentCraftMeta?.suppressLogs
    ) {
      return;
    }

    console.info('[creation-v2] workflow completed', {
      sessionId: session.id,
      phase: session.state.phase,
      productType: session.state.input.productType,
      autoMaterialized:
        session.state.phase === CreationPhase.OUTCOME_MATERIALIZED,
      blueprintName: session.state.blueprint?.productModel.name,
      rolledAffixes: this.summarizeRolledAffixes(session.state.rolledAffixes),
      energyBudget: this.summarizeEnergyBudget(session.state.energyBudget),
      selection: this.summarizeSelection(session.state.affixSelectionAudit),
    });
  }

  private logWorkflowFailed(
    session: CreationSession,
    failedAtPhase: CreationPhase,
    reason: string,
    details?: Record<string, unknown>,
  ): void {
    if (
      process.env.NODE_ENV === 'test' ||
      session.state.intentCraftMeta?.suppressLogs
    ) {
      return;
    }

    console.warn('[creation-v2] workflow failed', {
      sessionId: session.id,
      failedAtPhase,
      currentPhase: session.state.phase,
      productType: session.state.input.productType,
      reason,
      details,
      rolledAffixes: this.summarizeRolledAffixes(session.state.rolledAffixes),
      energyBudget: this.summarizeEnergyBudget(session.state.energyBudget),
      selection: this.summarizeSelection(session.state.affixSelectionAudit),
    });
  }

  private summarizeEnergyBudget(budget?: EnergyBudget) {
    if (!budget) {
      return undefined;
    }

    return {
      baseTotal: budget.baseTotal,
      effectiveTotal: budget.effectiveTotal,
      reserved: budget.reserved,
      availableForAffixes:
        budget.initialRemaining ??
        Math.max(0, budget.effectiveTotal - budget.reserved),
      spent: budget.spent,
      remaining: budget.remaining,
      exhaustionReason: budget.exhaustionReason,
      sources: budget.sources,
      allocations: budget.allocations,
      rejections: budget.rejections ?? [],
    };
  }

  private summarizeRolledAffixes(affixes: RolledAffix[]) {
    return affixes.map((affix) => ({
      id: affix.id,
      name: affix.name,
      slot: affix.slot,
      rarity: affix.rarity,
      energyCost: affix.energyCost,
      rollScore: affix.rollScore,
      rollEfficiency: affix.rollEfficiency,
      finalMultiplier: affix.finalMultiplier,
      isPerfect: affix.isPerfect,
    }));
  }

  private summarizeSelection(audit?: AffixSelectionAudit) {
    if (!audit) {
      return undefined;
    }

    return {
      spent: audit.spent,
      remaining: audit.remaining,
      exhaustionReason: audit.exhaustionReason,
      roundCount: audit.rounds.length,
      allocations: audit.allocations,
      rejections: audit.rejections,
    };
  }
}
