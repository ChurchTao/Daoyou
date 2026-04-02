import { TestableCreationOrchestrator as CreationOrchestrator } from '@/engine/creation-v2/tests/helpers/TestableCreationOrchestrator';
import { projectAbilityConfig } from '@/engine/creation-v2/models';
import { CompositionRuleSet } from '@/engine/creation-v2/rules/composition/CompositionRuleSet';
import type { CompositionFacts } from '@/engine/creation-v2/rules/contracts/CompositionFacts';
import { CREATION_FALLBACK_MARKERS } from '@/engine/creation-v2/config/CreationFallbackPolicy';
import { DEFAULT_AFFIX_REGISTRY } from '@/engine/creation-v2/affixes';

function buildMinimalFacts(
  productType: 'skill' | 'artifact' | 'gongfa',
): CompositionFacts {
  const outcomeKind =
    productType === 'skill'
      ? 'active_skill'
      : productType === 'artifact'
        ? 'artifact'
        : 'gongfa';

  return {
    productType,
    outcomeKind: outcomeKind as CompositionFacts['outcomeKind'],
    intent: {
      productType,
      outcomeKind: outcomeKind as CompositionFacts['intent']['outcomeKind'],
      dominantTags: [],
      requestedTags: [],
    },
    recipeMatch: {
      recipeId: `default.${productType}`,
      valid: true,
      matchedTags: [],
      unlockedAffixCategories: [],
    },
    materialNames: ['测试材料'],
    affixes: [],
    dominantQuality: '灵品',
    sessionTags: [],
    materialFingerprints: [],
    energyBudget: {
      total: 30,
      reserved: 6,
      spent: 8,
      remaining: 16,
      initialRemaining: 24,
      allocations: [],
      rejections: [],
      sources: [{ source: '测试', amount: 30 }],
    },
  };
}

describe('WorkflowDecisionBoundary — CompositionRuleSet 契约验证', () => {
  let ruleSet: CompositionRuleSet;

  beforeEach(() => {
    ruleSet = new CompositionRuleSet(DEFAULT_AFFIX_REGISTRY);
  });

  describe('decision 字段填充完整性', () => {
    it('skill 流程结束后 decision 应包含 outcomeKind / name / tags / projectionPolicy', () => {
      const decision = ruleSet.evaluate(buildMinimalFacts('skill'));

      expect(decision.outcomeKind).toBe('active_skill');
      expect(decision.name).toBeTruthy();
      expect(decision.tags.length).toBeGreaterThan(0);
      expect(decision.projectionPolicy).toBeDefined();
      expect(decision.projectionPolicy?.kind).toBe('active_skill');
    });

    it('artifact 流程结束后 projectionPolicy.kind 应为 artifact_passive', () => {
      const decision = ruleSet.evaluate(buildMinimalFacts('artifact'));
      expect(decision.projectionPolicy?.kind).toBe('artifact_passive');
    });

    it('gongfa 流程结束后 projectionPolicy.kind 应为 gongfa_passive', () => {
      const decision = ruleSet.evaluate(buildMinimalFacts('gongfa'));
      expect(decision.projectionPolicy?.kind).toBe('gongfa_passive');
    });
  });

  describe('energyConversion 中间决策传递', () => {
    it('skill 词缀为空时 energyConversion 应被 EnergyConversionRules 填充', () => {
      const decision = ruleSet.evaluate(buildMinimalFacts('skill'));

      expect(decision.energyConversion).toBeDefined();
      expect(typeof decision.energyConversion?.mpCost).toBe('number');
      expect(typeof decision.energyConversion?.priority).toBe('number');
    });

    it('artifact 不应产生 energyConversion', () => {
      const decision = ruleSet.evaluate(buildMinimalFacts('artifact'));
      expect(decision.energyConversion).toBeUndefined();
    });

    it('gongfa 不应产生 energyConversion', () => {
      const decision = ruleSet.evaluate(buildMinimalFacts('gongfa'));
      expect(decision.energyConversion).toBeUndefined();
    });
  });

  describe('defaultsApplied 保底标记', () => {
    it('词缀为空的 skill 应记录 skill_damage_fallback 标记', () => {
      const decision = ruleSet.evaluate(buildMinimalFacts('skill'));
      expect(decision.defaultsApplied).toContain(
        CREATION_FALLBACK_MARKERS.skillDamageFallback,
      );
    });

    it('词缀为空的 artifact 应记录 artifact_shield_fallback 标记', () => {
      const decision = ruleSet.evaluate(buildMinimalFacts('artifact'));
      expect(decision.defaultsApplied).toContain(
        CREATION_FALLBACK_MARKERS.artifactShieldFallback,
      );
    });

    it('词缀为空的 gongfa 应记录 gongfa_spirit_fallback 标记', () => {
      const decision = ruleSet.evaluate(buildMinimalFacts('gongfa'));
      expect(decision.defaultsApplied).toContain(
        CREATION_FALLBACK_MARKERS.gongfaSpiritFallback,
      );
    });
  });

  describe('skill projectionPolicy mpCost / priority 计算', () => {
    it('mpCost 应不小于最小阈值 (10)', () => {
      const decision = ruleSet.evaluate(buildMinimalFacts('skill'));
      const policy = decision.projectionPolicy;

      expect(policy?.kind).toBe('active_skill');
      if (policy?.kind === 'active_skill') {
        expect(policy.mpCost).toBeGreaterThanOrEqual(10);
      }
    });

    it('priority 应为正整数', () => {
      const decision = ruleSet.evaluate(buildMinimalFacts('skill'));
      const policy = decision.projectionPolicy;

      if (policy?.kind === 'active_skill') {
        expect(Number.isInteger(policy.priority)).toBe(true);
        expect(policy.priority).toBeGreaterThan(0);
      }
    });
  });

  describe('完整编排器集成（composition 阶段）', () => {
    it('composeBlueprintWithDefaults 应返回完整蓝图', () => {
      const orchestrator = new CreationOrchestrator();
      const session = orchestrator.createSession({
        sessionId: 'boundary-composition',
        productType: 'skill',
        materials: [
          {
            id: 'mat-1',
            name: '赤炎精铁',
            type: 'ore',
            rank: '灵品',
            quantity: 1,
            element: '火',
          },
        ],
      });

      orchestrator.submitMaterials(session);
      orchestrator.analyzeMaterialsWithDefaults(session);
      orchestrator.resolveIntentWithDefaults(session);
      orchestrator.validateRecipeWithDefaults(session);
      orchestrator.budgetEnergyWithDefaults(session);
      orchestrator.buildAffixPool(session, []);
      orchestrator.rollAffixesWithDefaults(session);
      const blueprint = orchestrator.composeBlueprintWithDefaults(session);

      expect(blueprint).toBeDefined();
      expect(projectAbilityConfig(blueprint.productModel)).toBeDefined();
      expect(blueprint.productModel.tags.length).toBeGreaterThan(0);
    });
  });
});
