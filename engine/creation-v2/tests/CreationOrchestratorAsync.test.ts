import { CreationAbilityAdapter } from '@/engine/creation-v2/adapters/CreationAbilityAdapter';
import { AsyncMaterialAnalyzer } from '@/engine/creation-v2/analysis/AsyncMaterialAnalyzer';
import { DefaultMaterialAnalyzer } from '@/engine/creation-v2/analysis/DefaultMaterialAnalyzer';
import { DefaultEnergyBudgeter } from '@/engine/creation-v2/budgeting/DefaultEnergyBudgeter';
import { DefaultIntentResolver } from '@/engine/creation-v2/resolvers/DefaultIntentResolver';
import { DefaultRecipeValidator } from '@/engine/creation-v2/rules/DefaultRecipeValidator';
import { CreationEventBus } from '@/engine/creation-v2/core/EventBus';
import { CreationEventPriorityLevel } from '@/engine/creation-v2/core/types';
import { TestableCreationOrchestrator as CreationOrchestrator } from '@/engine/creation-v2/tests/helpers/TestableCreationOrchestrator';
import { AffixPoolBuilder, AffixSelector, DEFAULT_AFFIX_REGISTRY } from '@/engine/creation-v2/affixes';
import { ProductComposerRegistry } from '@/engine/creation-v2/composers/ProductComposerRegistry';
import { MaterialFingerprint } from '@/engine/creation-v2/types';

class StubAsyncMaterialAnalyzer {
  constructor(
    private readonly fingerprints: MaterialFingerprint[],
    private readonly enrichment: {
      status: 'success' | 'fallback';
      fallbackReason?: string;
      failureDisposition?: 'retryable' | 'non_retryable';
    },
  ) {}

  async analyze() {
    return {
      fingerprints: this.fingerprints,
      enrichment: this.enrichment,
    };
  }
}

describe('CreationOrchestrator async material analysis', () => {
  it('应发布 MaterialSemanticEnrichedEvent', async () => {
    const eventBus = new CreationEventBus();
    const events: string[] = [];
    eventBus.subscribe(
      'MaterialSemanticEnrichedEvent',
      () => events.push('enriched'),
      CreationEventPriorityLevel.INTENT_ANALYSIS,
    );

    const orchestrator = new CreationOrchestrator(
      eventBus,
      new CreationAbilityAdapter(),
      new DefaultMaterialAnalyzer(),
      new StubAsyncMaterialAnalyzer(
        [
          {
            materialId: 'mat-1',
            materialName: '赤炎铁',
            materialType: 'ore',
            rank: '玄品',
            quantity: 1,
            explicitTags: ['Material.Type.Ore', 'Material.Element.Fire'],
            semanticTags: ['Material.Semantic.Flame', 'Material.Semantic.Burst'],
            recipeTags: ['Recipe.ProductBias.Skill'],
            energyValue: 12,
            rarityWeight: 3,
            element: '火',
            metadata: {
              description: '赤炎矿',
              llm: {
                status: 'success',
                addedTags: ['Material.Semantic.Burst'],
                droppedTags: [],
                provider: 'mock',
              },
            },
          },
        ],
        { status: 'success' },
      ) as unknown as AsyncMaterialAnalyzer,
      new DefaultIntentResolver(),
      new DefaultRecipeValidator(),
      new DefaultEnergyBudgeter(),
      new ProductComposerRegistry(),
      new AffixPoolBuilder(),
      new AffixSelector(),
      DEFAULT_AFFIX_REGISTRY,
    );

    const session = orchestrator.createSession({
      productType: 'skill',
      materials: [
        {
          id: 'mat-1',
          name: '赤炎铁',
          type: 'ore',
          rank: '玄品',
          quantity: 1,
          element: '火',
          description: '赤炎矿',
        },
      ],
    });

    const fingerprints = await orchestrator.analyzeMaterialsWithDefaultsAsync(session);
    expect(events).toEqual(['enriched']);
    expect(fingerprints[0].semanticTags).toContain('Material.Semantic.Burst');
  });

  it('应发布 MaterialSemanticEnrichmentFallbackEvent', async () => {
    const eventBus = new CreationEventBus();
    const events: string[] = [];
    eventBus.subscribe(
      'MaterialSemanticEnrichmentFallbackEvent',
      () => events.push('fallback'),
      CreationEventPriorityLevel.INTENT_ANALYSIS,
    );
    eventBus.subscribe(
      'MaterialSemanticEnrichmentRetryableFallbackEvent',
      () => events.push('retryable'),
      CreationEventPriorityLevel.INTENT_ANALYSIS,
    );

    const orchestrator = new CreationOrchestrator(
      eventBus,
      new CreationAbilityAdapter(),
      new DefaultMaterialAnalyzer(),
      new StubAsyncMaterialAnalyzer(
        [
          {
            materialId: 'mat-1',
            materialName: '赤炎铁',
            materialType: 'ore',
            rank: '玄品',
            quantity: 1,
            explicitTags: ['Material.Type.Ore', 'Material.Element.Fire'],
            semanticTags: ['Material.Semantic.Flame'],
            recipeTags: ['Recipe.ProductBias.Skill'],
            energyValue: 12,
            rarityWeight: 3,
            element: '火',
            metadata: {
              description: '赤炎矿',
              llm: {
                status: 'fallback',
                addedTags: [],
                droppedTags: [],
                reason: 'timeout',
                provider: 'mock',
              },
            },
          },
        ],
        {
          status: 'fallback',
          fallbackReason: 'timeout',
          failureDisposition: 'retryable',
        },
      ) as unknown as AsyncMaterialAnalyzer,
      new DefaultIntentResolver(),
      new DefaultRecipeValidator(),
      new DefaultEnergyBudgeter(),
      new ProductComposerRegistry(),
      new AffixPoolBuilder(),
      new AffixSelector(),
      DEFAULT_AFFIX_REGISTRY,
    );

    const session = orchestrator.createSession({
      productType: 'skill',
      materials: [
        {
          id: 'mat-1',
          name: '赤炎铁',
          type: 'ore',
          rank: '玄品',
          quantity: 1,
          element: '火',
          description: '赤炎矿',
        },
      ],
    });

    await orchestrator.analyzeMaterialsWithDefaultsAsync(session);
    expect(events).toEqual(['fallback', 'retryable']);
  });

  it('应为不可重试 fallback 发布 terminal 事件', async () => {
    const eventBus = new CreationEventBus();
    const events: string[] = [];
    eventBus.subscribe(
      'MaterialSemanticEnrichmentFallbackEvent',
      () => events.push('fallback'),
      CreationEventPriorityLevel.INTENT_ANALYSIS,
    );
    eventBus.subscribe(
      'MaterialSemanticEnrichmentTerminalFallbackEvent',
      () => events.push('terminal'),
      CreationEventPriorityLevel.INTENT_ANALYSIS,
    );

    const orchestrator = new CreationOrchestrator(
      eventBus,
      new CreationAbilityAdapter(),
      new DefaultMaterialAnalyzer(),
      new StubAsyncMaterialAnalyzer(
        [
          {
            materialId: 'mat-1',
            materialName: '残损玉片',
            materialType: 'ore',
            rank: '玄品',
            quantity: 1,
            explicitTags: ['Material.Type.Ore'],
            semanticTags: ['Material.Semantic.Stable'],
            recipeTags: ['Recipe.ProductBias.Skill'],
            energyValue: 8,
            rarityWeight: 1,
            metadata: {
              llm: {
                status: 'fallback',
                failureDisposition: 'non_retryable',
                addedTags: [],
                droppedTags: [],
                reason: 'schema validation failed',
                provider: 'mock',
              },
            },
          },
        ],
        {
          status: 'fallback',
          fallbackReason: 'schema validation failed',
          failureDisposition: 'non_retryable',
        },
      ) as unknown as AsyncMaterialAnalyzer,
      new DefaultIntentResolver(),
      new DefaultRecipeValidator(),
      new DefaultEnergyBudgeter(),
      new ProductComposerRegistry(),
      new AffixPoolBuilder(),
      new AffixSelector(),
      DEFAULT_AFFIX_REGISTRY,
    );

    const session = orchestrator.createSession({
      productType: 'skill',
      materials: [
        {
          id: 'mat-1',
          name: '残损玉片',
          type: 'ore',
          rank: '玄品',
          quantity: 1,
        },
      ],
    });

    await orchestrator.analyzeMaterialsWithDefaultsAsync(session);
    expect(events).toEqual(['fallback', 'terminal']);
  });

  it('应在 event-driven workflow 中使用 async 分析并自动推进到 materialized', async () => {
    const eventBus = new CreationEventBus();
    const order: string[] = [];
    [
      'MaterialSubmittedEvent',
      'MaterialAnalyzedEvent',
      'MaterialSemanticEnrichedEvent',
      'IntentResolvedEvent',
      'RecipeValidatedEvent',
      'EnergyBudgetedEvent',
      'AffixPoolBuiltEvent',
      'AffixRolledEvent',
      'BlueprintComposedEvent',
      'OutcomeMaterializedEvent',
    ].forEach((eventType) => {
      eventBus.subscribe(eventType, () => order.push(eventType));
    });

    const orchestrator = new CreationOrchestrator(
      eventBus,
      new CreationAbilityAdapter(),
      new DefaultMaterialAnalyzer(),
      new StubAsyncMaterialAnalyzer(
        [
          {
            materialId: 'mat-1',
            materialName: '赤炎铁',
            materialType: 'ore',
            rank: '玄品',
            quantity: 2,
            explicitTags: ['Material.Type.Ore', 'Material.Element.Fire'],
            semanticTags: ['Material.Semantic.Flame', 'Material.Semantic.Burst'],
            recipeTags: ['Recipe.ProductBias.Skill'],
            energyValue: 24,
            rarityWeight: 3,
            element: '火',
            metadata: {
              description: '赤炎矿',
              llm: {
                status: 'success',
                addedTags: ['Material.Semantic.Burst'],
                droppedTags: [],
                provider: 'mock',
              },
            },
          },
        ],
        { status: 'success' },
      ) as unknown as AsyncMaterialAnalyzer,
      new DefaultIntentResolver(),
      new DefaultRecipeValidator(),
      new DefaultEnergyBudgeter(),
      new ProductComposerRegistry(),
      new AffixPoolBuilder(),
      new AffixSelector(),
      DEFAULT_AFFIX_REGISTRY,
    );

    const session = orchestrator.createSession({
      sessionId: 'async-event-driven-success',
      productType: 'skill',
      materials: [
        {
          id: 'mat-1',
          name: '赤炎铁',
          type: 'ore',
          rank: '玄品',
          quantity: 2,
          element: '火',
          description: '赤炎矿',
        },
      ],
    });

    orchestrator.runEventDrivenWorkflow(session, {
      materialAnalysisMode: 'async',
    });
    const completed = await orchestrator.waitForWorkflowCompletion(session.id);

    expect(completed.state.phase).toBe('outcome_materialized');
    expect(completed.state.materialFingerprints[0].semanticTags).toContain(
      'Material.Semantic.Burst',
    );
    expect(order).toEqual([
      'MaterialSubmittedEvent',
      'MaterialSemanticEnrichedEvent',
      'MaterialAnalyzedEvent',
      'IntentResolvedEvent',
      'RecipeValidatedEvent',
      'EnergyBudgetedEvent',
      'AffixPoolBuiltEvent',
      'AffixRolledEvent',
      'BlueprintComposedEvent',
      'OutcomeMaterializedEvent',
    ]);
  });

  it('应在 event-driven workflow 中处理 async fallback 并继续推进', async () => {
    const eventBus = new CreationEventBus();
    const events: string[] = [];
    [
      'MaterialSemanticEnrichmentFallbackEvent',
      'MaterialSemanticEnrichmentRetryableFallbackEvent',
      'IntentResolvedEvent',
      'OutcomeMaterializedEvent',
    ].forEach((eventType) => {
      eventBus.subscribe(eventType, () => events.push(eventType));
    });

    const orchestrator = new CreationOrchestrator(
      eventBus,
      new CreationAbilityAdapter(),
      new DefaultMaterialAnalyzer(),
      new StubAsyncMaterialAnalyzer(
        [
          {
            materialId: 'mat-1',
            materialName: '赤炎铁',
            materialType: 'ore',
            rank: '玄品',
            quantity: 2,
            explicitTags: ['Material.Type.Ore', 'Material.Element.Fire'],
            semanticTags: ['Material.Semantic.Flame'],
            recipeTags: ['Recipe.ProductBias.Skill'],
            energyValue: 24,
            rarityWeight: 3,
            element: '火',
            metadata: {
              description: '赤炎矿',
              llm: {
                status: 'fallback',
                addedTags: [],
                droppedTags: [],
                reason: 'timeout',
                provider: 'mock',
              },
            },
          },
        ],
        {
          status: 'fallback',
          fallbackReason: 'timeout',
          failureDisposition: 'retryable',
        },
      ) as unknown as AsyncMaterialAnalyzer,
      new DefaultIntentResolver(),
      new DefaultRecipeValidator(),
      new DefaultEnergyBudgeter(),
      new ProductComposerRegistry(),
      new AffixPoolBuilder(),
      new AffixSelector(),
      DEFAULT_AFFIX_REGISTRY,
    );

    const session = orchestrator.createSession({
      sessionId: 'async-event-driven-fallback',
      productType: 'skill',
      materials: [
        {
          id: 'mat-1',
          name: '赤炎铁',
          type: 'ore',
          rank: '玄品',
          quantity: 2,
          element: '火',
          description: '赤炎矿',
        },
      ],
    });

    orchestrator.runEventDrivenWorkflow(session, {
      materialAnalysisMode: 'async',
    });
    const completed = await orchestrator.waitForWorkflowCompletion(session.id);

    expect(completed.state.phase).toBe('outcome_materialized');
    expect(completed.state.materialFingerprints[0].metadata?.llm?.status).toBe('fallback');
    expect(events).toEqual([
      'MaterialSemanticEnrichmentFallbackEvent',
      'MaterialSemanticEnrichmentRetryableFallbackEvent',
      'IntentResolvedEvent',
      'OutcomeMaterializedEvent',
    ]);
  });

  it('waitForWorkflowCompletion 应对同一 session 幂等，重复调用返回同一 promise', async () => {
    const orchestrator = new CreationOrchestrator(
      new CreationEventBus(),
      new CreationAbilityAdapter(),
      new DefaultMaterialAnalyzer(),
      new StubAsyncMaterialAnalyzer(
        [
          {
            materialId: 'mat-1',
            materialName: '赤炎铁',
            materialType: 'ore',
            rank: '玄品',
            quantity: 2,
            explicitTags: ['Material.Type.Ore', 'Material.Element.Fire'],
            semanticTags: ['Material.Semantic.Flame'],
            recipeTags: ['Recipe.ProductBias.Skill'],
            energyValue: 24,
            rarityWeight: 3,
            element: '火',
          },
        ],
        { status: 'success' },
      ) as unknown as AsyncMaterialAnalyzer,
      new DefaultIntentResolver(),
      new DefaultRecipeValidator(),
      new DefaultEnergyBudgeter(),
      new ProductComposerRegistry(),
      new AffixPoolBuilder(),
      new AffixSelector(),
      DEFAULT_AFFIX_REGISTRY,
    );

    const session = orchestrator.createSession({
      sessionId: 'async-idempotent-wait',
      productType: 'skill',
      materials: [
        {
          id: 'mat-1',
          name: '赤炎铁',
          type: 'ore',
          rank: '玄品',
          quantity: 2,
          element: '火',
        },
      ],
    });

    orchestrator.runEventDrivenWorkflow(session, {
      materialAnalysisMode: 'async',
    });

    const first = orchestrator.waitForWorkflowCompletion(session.id);
    const second = orchestrator.waitForWorkflowCompletion(session.id);

    expect(first).toBe(second);

    const completed = await first;
    expect(completed.state.phase).toBe('outcome_materialized');
  });

  it('应隔离并发 workflow 的状态与完成结果', async () => {
    const orchestrator = new CreationOrchestrator(
      new CreationEventBus(),
      new CreationAbilityAdapter(),
      new DefaultMaterialAnalyzer(),
      new StubAsyncMaterialAnalyzer(
        [
          {
            materialId: 'shared',
            materialName: '共鸣矿',
            materialType: 'ore',
            rank: '玄品',
            quantity: 2,
            explicitTags: ['Material.Type.Ore'],
            semanticTags: ['Material.Semantic.Blade'],
            recipeTags: ['Recipe.ProductBias.Skill'],
            energyValue: 24,
            rarityWeight: 3,
          },
        ],
        { status: 'success' },
      ) as unknown as AsyncMaterialAnalyzer,
      new DefaultIntentResolver(),
      new DefaultRecipeValidator(),
      new DefaultEnergyBudgeter(),
      new ProductComposerRegistry(),
      new AffixPoolBuilder(),
      new AffixSelector(),
      DEFAULT_AFFIX_REGISTRY,
    );

    const firstSession = orchestrator.createSession({
      sessionId: 'parallel-a',
      productType: 'skill',
      materials: [{ id: 'a', name: '甲矿', type: 'ore', rank: '玄品', quantity: 2 }],
    });
    const secondSession = orchestrator.createSession({
      sessionId: 'parallel-b',
      productType: 'skill',
      materials: [{ id: 'b', name: '乙矿', type: 'ore', rank: '玄品', quantity: 2 }],
    });

    orchestrator.runEventDrivenWorkflow(firstSession, {
      materialAnalysisMode: 'async',
    });
    orchestrator.runEventDrivenWorkflow(secondSession, {
      materialAnalysisMode: 'async',
    });

    const [completedA, completedB] = await Promise.all([
      orchestrator.waitForWorkflowCompletion(firstSession.id),
      orchestrator.waitForWorkflowCompletion(secondSession.id),
    ]);

    expect(completedA.id).toBe('parallel-a');
    expect(completedB.id).toBe('parallel-b');
    expect(completedA.state.phase).toBe('outcome_materialized');
    expect(completedB.state.phase).toBe('outcome_materialized');
    expect(completedA.state.outcome?.blueprint.productModel.slug).not.toBe(
      completedB.state.outcome?.blueprint.productModel.slug,
    );
  });

  it('waitForWorkflowCompletion 应对未知 session 直接拒绝', async () => {
    const orchestrator = new CreationOrchestrator();

    await expect(
      orchestrator.waitForWorkflowCompletion('missing-session'),
    ).rejects.toThrow('Unknown workflow session: missing-session');
  });

  it('waitForWorkflowCompletion 应对未激活 workflow 的 session 立即返回当前 session', async () => {
    const orchestrator = new CreationOrchestrator();
    const session = orchestrator.createSession({
      sessionId: 'inactive-session',
      productType: 'skill',
      materials: [{ id: 'mat-1', name: '青铜矿', type: 'ore', rank: '凡品', quantity: 1 }],
    });

    const completed = await orchestrator.waitForWorkflowCompletion(session.id);

    expect(completed).toBe(session);
    expect(completed.state.phase).toBe('init');
  });
});