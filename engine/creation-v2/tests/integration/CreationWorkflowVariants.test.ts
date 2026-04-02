import { CreationOrchestrator } from '@/engine/creation-v2/CreationOrchestrator';
import { AsyncMaterialAnalyzer } from '@/engine/creation-v2/analysis/AsyncMaterialAnalyzer';
import { DefaultMaterialAnalyzer } from '@/engine/creation-v2/analysis/DefaultMaterialAnalyzer';
import { CreationAbilityAdapter } from '@/engine/creation-v2/adapters/CreationAbilityAdapter';
import { CreationEventBus } from '@/engine/creation-v2/core/EventBus';
import { CreationEventPriorityLevel } from '@/engine/creation-v2/core/types';
import { MaterialFingerprint } from '@/engine/creation-v2/types';

/**
 * CreationWorkflowVariants
 * Stage 5 验收测试 — 覆盖三条 workflow 路径：
 *   1. sync  + autoMaterialize=true（默认路径）
 *   2. async + autoMaterialize=true
 *   3. sync  + autoMaterialize=false（需手动触发 materialize）
 */

const FIRE_MATERIAL = {
  id: 'mat-fire',
  name: '赤炎精铁',
  type: 'ore' as const,
  rank: '灵品' as const,
  quantity: 1,
  element: '火' as const,
  description: '蕴含火行意象',
};

class StubAsyncAnalyzer {
  private fingerprints: MaterialFingerprint[];
  constructor(fingerprints: MaterialFingerprint[]) {
    this.fingerprints = fingerprints;
  }

  async analyze() {
    return {
      fingerprints: this.fingerprints,
      enrichment: { status: 'success' as const },
    };
  }
}

function makeFireFingerprints(): MaterialFingerprint[] {
  return [
    {
      materialId: 'mat-fire',
      materialName: '赤炎精铁',
      materialType: 'ore',
      rank: '灵品',
      quantity: 1,
      explicitTags: ['Material.Type.Ore', 'Material.Element.Fire'],
      semanticTags: ['Material.Semantic.Flame'],
      recipeTags: ['Recipe.ProductBias.Skill'],
      energyValue: 12,
      rarityWeight: 2,
      element: '火',
      metadata: { confidence: 0.9, source: 'stub' },
    },
  ];
}

describe('CreationWorkflowVariants — Stage 5 验收测试', () => {
  describe('Variant 1: sync + autoMaterialize=true（默认 event-driven workflow）', () => {
    it('应自动推进所有阶段并发出 OutcomeMaterializedEvent', () => {
      const events: string[] = [];
      const orchestrator = new CreationOrchestrator();

      [
        'MaterialSubmittedEvent',
        'MaterialAnalyzedEvent',
        'IntentResolvedEvent',
        'RecipeValidatedEvent',
        'EnergyBudgetedEvent',
        'AffixPoolBuiltEvent',
        'AffixRolledEvent',
        'BlueprintComposedEvent',
        'OutcomeMaterializedEvent',
      ].forEach((e) => {
        orchestrator.eventBus.subscribe(
          e,
          () => events.push(e),
          CreationEventPriorityLevel.MATERIALIZATION,
        );
      });

      const session = orchestrator.createSession({
        sessionId: 'variant-sync-auto',
        productType: 'skill',
        materials: [FIRE_MATERIAL],
      });

      orchestrator.runEventDrivenWorkflow(session);

      expect(events).toContain('OutcomeMaterializedEvent');
      expect(session.state.phase).toBe('outcome_materialized');
    });

    it('session.state.blueprint 应在 materialized 阶段被填充', () => {
      const orchestrator = new CreationOrchestrator();
      const session = orchestrator.createSession({
        sessionId: 'variant-sync-auto-blueprint',
        productType: 'skill',
        materials: [FIRE_MATERIAL],
      });

      orchestrator.runEventDrivenWorkflow(session);

      expect(session.state.blueprint).toBeDefined();
      expect(session.state.blueprint?.productModel).toBeDefined();
    });
  });

  describe('Variant 2: sync + autoMaterialize=false（手动触发 materialize）', () => {
    it('autoMaterialize=false 时 runEventDrivenWorkflow 不应自动发出 OutcomeMaterializedEvent', () => {
      const events: string[] = [];
      const orchestrator = new CreationOrchestrator();

      orchestrator.eventBus.subscribe(
        'OutcomeMaterializedEvent',
        () => events.push('OutcomeMaterializedEvent'),
        CreationEventPriorityLevel.MATERIALIZATION,
      );
      orchestrator.eventBus.subscribe(
        'BlueprintComposedEvent',
        () => events.push('BlueprintComposedEvent'),
        CreationEventPriorityLevel.MATERIALIZATION,
      );

      const session = orchestrator.createSession({
        sessionId: 'variant-no-auto-materialize',
        productType: 'skill',
        materials: [FIRE_MATERIAL],
      });

      orchestrator.runEventDrivenWorkflow(session, { autoMaterialize: false });

      expect(events).toContain('BlueprintComposedEvent');
      expect(events).not.toContain('OutcomeMaterializedEvent');
      expect(session.state.phase).toBe('blueprint_composed');
    });

    it('autoMaterialize=false 后手动调用 materializeOutcome 应完成 outcome', () => {
      const orchestrator = new CreationOrchestrator();
      const session = orchestrator.createSession({
        sessionId: 'variant-manual-materialize',
        productType: 'skill',
        materials: [FIRE_MATERIAL],
      });

      orchestrator.runEventDrivenWorkflow(session, { autoMaterialize: false });

      expect(session.state.phase).toBe('blueprint_composed');

      const outcome = orchestrator.materializeOutcome(session);

      expect(outcome).toBeDefined();
      expect(outcome.ability).toBeDefined();
      expect(session.state.phase).toBe('outcome_materialized');
    });
  });

  describe('Variant 3: async materialAnalysisMode', () => {
    it('async 模式应发出 MaterialSemanticEnrichedEvent', async () => {
      const events: string[] = [];
      const eventBus = new CreationEventBus();

      eventBus.subscribe(
        'MaterialSemanticEnrichedEvent',
        () => events.push('MaterialSemanticEnrichedEvent'),
        CreationEventPriorityLevel.INTENT_ANALYSIS,
      );

      const orchestrator = new CreationOrchestrator(
        eventBus,
        new CreationAbilityAdapter(),
        new DefaultMaterialAnalyzer(),
        new StubAsyncAnalyzer(makeFireFingerprints()) as unknown as AsyncMaterialAnalyzer,
      );

      const session = orchestrator.createSession({
        sessionId: 'variant-async-enrichment',
        productType: 'skill',
        materials: [FIRE_MATERIAL],
      });

      orchestrator.runEventDrivenWorkflow(session, {
        materialAnalysisMode: 'async',
      });

      // 等待异步分析完成
      await orchestrator.waitForWorkflowCompletion(session.id);

      expect(events).toContain('MaterialSemanticEnrichedEvent');
    });

    it('async 模式完成后 session 应达到 materialized 阶段', async () => {
      const eventBus = new CreationEventBus();
      const orchestrator = new CreationOrchestrator(
        eventBus,
        new CreationAbilityAdapter(),
        new DefaultMaterialAnalyzer(),
        new StubAsyncAnalyzer(makeFireFingerprints()) as unknown as AsyncMaterialAnalyzer,
      );

      const session = orchestrator.createSession({
        sessionId: 'variant-async-complete',
        productType: 'skill',
        materials: [FIRE_MATERIAL],
      });

      orchestrator.runEventDrivenWorkflow(session, {
        materialAnalysisMode: 'async',
        autoMaterialize: true,
      });

      await orchestrator.waitForWorkflowCompletion(session.id);

      expect(session.state.phase).toBe('outcome_materialized');
    });
  });

  describe('不同 productType 的 workflow 覆盖', () => {
    it('gongfa event-driven workflow 应成功推进到 outcome_materialized', () => {
      const orchestrator = new CreationOrchestrator();
      const session = orchestrator.createSession({
        sessionId: 'variant-gongfa-workflow',
        productType: 'gongfa',
        materials: [
          {
            id: 'mat-manual',
            name: '灵魄心经',
            type: 'gongfa_manual',
            rank: '灵品',
            quantity: 1,
            description: '蕴含心法要义',
          },
        ],
      });

      orchestrator.runEventDrivenWorkflow(session);

      expect(session.state.phase).toBe('outcome_materialized');
      expect(session.state.blueprint?.productModel).toBeDefined();
    });

    it('artifact event-driven workflow 应成功推进到 outcome_materialized', () => {
      const orchestrator = new CreationOrchestrator();
      const session = orchestrator.createSession({
        sessionId: 'variant-artifact-workflow',
        productType: 'artifact',
        materials: [
          {
            id: 'mat-jade',
            name: '玄铁矿',
            type: 'ore',
            rank: '灵品',
            quantity: 1,
            element: '金',
            description: '坚硬如铁，蕴含防御之意',
          },
        ],
      });

      orchestrator.runEventDrivenWorkflow(session);

      expect(session.state.phase).toBe('outcome_materialized');
    });
  });
});
