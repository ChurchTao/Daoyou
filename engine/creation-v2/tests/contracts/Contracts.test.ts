import { beforeEach, describe, expect, it } from '@jest/globals';
import { matchAll } from '@/engine/creation-v2/affixes';
import { DefaultEnergyBudgeter } from '@/engine/creation-v2/budgeting/DefaultEnergyBudgeter';
import { AffixSelectionRuleSet } from '@/engine/creation-v2/rules/affix/AffixSelectionRuleSet';
import type { AffixSelectionFacts } from '@/engine/creation-v2/rules/contracts';
import { TestableCreationOrchestrator } from '@/engine/creation-v2/tests/helpers/TestableCreationOrchestrator';
import { TestableCreationOrchestrator as CreationOrchestrator } from '@/engine/creation-v2/tests/helpers/TestableCreationOrchestrator';
import { projectAbilityConfig } from '@/engine/creation-v2/models';
import { CompositionRuleSet } from '@/engine/creation-v2/rules/composition/CompositionRuleSet';
import type { CompositionFacts } from '@/engine/creation-v2/rules/contracts/CompositionFacts';
import {
  DEFAULT_AFFIX_REGISTRY,
  flattenAffixMatcherTags,
} from '@/engine/creation-v2/affixes';
import { CreationError } from '@/engine/creation-v2/errors';
import type { AffixDefinition } from '@/engine/creation-v2/affixes/types';
import type { RolledAffix } from '@/engine/creation-v2/types';
import { GameplayTags } from '@/engine/shared/tag-domain';

// ── Helpers ─────────────────────────────────────────────────────────

function toRolledAffix(def: AffixDefinition): RolledAffix {
  return {
    id: def.id,
    name: def.displayName,
    category: def.category,
    energyCost: def.energyCost,
    rollScore: 1,
    rollEfficiency: 1,
    finalMultiplier: 1,
    isPerfect: false,
    effectTemplate: def.effectTemplate,
    weight: def.weight,
    match: def.match,
    tags: flattenAffixMatcherTags(def.match),
    grantedAbilityTags: def.grantedAbilityTags,
    exclusiveGroup: def.exclusiveGroup,
  };
}

function buildMinimalFacts(
  productType: 'skill' | 'artifact' | 'gongfa',
): CompositionFacts {
  const outcomeKind =
    productType === 'skill'
      ? 'active_skill'
      : productType === 'artifact'
        ? 'artifact'
        : 'gongfa';

  const skillCore = DEFAULT_AFFIX_REGISTRY.queryById('skill-core-damage');

  return {
    productType,
    outcomeKind: outcomeKind as CompositionFacts['outcomeKind'],
    intent: {
      productType,
      outcomeKind: outcomeKind as CompositionFacts['intent']['outcomeKind'],
      dominantTags: [],
      requestedTags: [],
      elementBias: '火',
      slotBias: 'weapon',
    },
    recipeMatch: {
      recipeId: `default.${productType}`,
      valid: true,
      matchedTags: [],
      unlockedAffixCategories: [],
    },
    energySummary: {
      effectiveTotal: 30,
      reserved: 6,
      startingAffixEnergy: 24,
      spentAffixEnergy: 8,
      remainingAffixEnergy: 16,
    },
    materialNames: ['测试材料'],
    affixes:
      productType === 'skill' && skillCore ? [toRolledAffix(skillCore)] : [],
    materialQualityProfile: {
      maxQuality: '灵品',
      weightedAverageQuality: '灵品',
      minQuality: '灵品',
      maxQualityOrder: 1,
      weightedAverageOrder: 1,
      minQualityOrder: 1,
      qualitySpread: 0,
      totalQuantity: 1,
    },
    inputTags: [],
    materialFingerprints: [],
  };
}

// ── BudgetLedger contract boundary ──────────────────────────────────

describe('BudgetLedger contract boundary', () => {
  it('AffixSelectionDecision 应保持为单轮规则过滤结果，不承载结算字段', () => {
    const ruleSet = new AffixSelectionRuleSet();
    const decision = ruleSet.evaluate({
      productType: 'skill',
      candidates: [
        {
          id: 'core-a',
          name: 'core-a',
          category: 'skill_core',
          match: matchAll([]),
          tags: [],
          weight: 10,
          energyCost: 6,
          effectTemplate: { type: 'damage', params: { value: { base: 10, attribute: 'magicAtk' } } } as any,
        },
      ],
      remainingEnergy: 12,
      inputTags: [],
      maxSelections: 3,
      selectionCount: 0,
      selectedAffixIds: [],
      selectedExclusiveGroups: [],
      selectedCategoryCounts: {},
      selectionConstraints: {
        categoryCaps: { skill_core: 1, skill_variant: 1 },
      },
    } satisfies AffixSelectionFacts);

    expect('spent' in decision).toBe(false);
    expect('remaining' in decision).toBe(false);
    expect('allocations' in decision).toBe(false);
    expect(decision.candidatePool).toHaveLength(1);
  });

  it('EnergyBudget 应遵循 allocation -> finalize 的两阶段边界', () => {
    const budgeter = new DefaultEnergyBudgeter();
    const allocated = budgeter.allocate(
      [
        {
          materialName: '赤炎铁',
          materialType: 'ore',
          rank: '玄品',
          quantity: 1,
          explicitTags: [],
          semanticTags: ['Material.Semantic.Flame'],
          recipeTags: [],
          energyValue: 8,
          rarityWeight: 2,
        },
      ],
      {
        recipeId: 'skill-default',
        valid: true,
        matchedTags: [],
        unlockedAffixCategories: ['skill_core'],
        reservedEnergy: 3,
      },
    );

    expect(allocated.spent).toBe(0);
    expect(allocated.remaining).toBe(allocated.initialRemaining);

    const finalized = budgeter.finalizeSelection(allocated, {
      rounds: [],
      affixes: [],
      spent: 5,
      remaining: (allocated.initialRemaining ?? 0) - 5,
      allocations: [{ affixId: 'core-a', amount: 5 }],
      rejections: [],
    });

    expect(finalized.spent).toBe(5);
    expect(finalized.remaining).toBe((allocated.initialRemaining ?? 0) - 5);
    expect(finalized.effectiveTotal).toBe(
      finalized.reserved + finalized.spent + finalized.remaining,
    );
  });

  it('手动 roll 路径在 audit 不匹配时应回退到显式 affix 结算', () => {
    const orchestrator = new TestableCreationOrchestrator();
    const session = orchestrator.createSession({
      sessionId: 'manual-roll-contract',
      productType: 'skill',
      materials: [],
    });

    orchestrator.budgetEnergy(session, {
      baseTotal: 20,
      effectiveTotal: 20,
      reserved: 4,
      spent: 0,
      remaining: 16,
      initialRemaining: 16,
      allocations: [],
      rejections: [],
      sources: [{ source: '测试材料', amount: 20 }],
    });

    session.state.affixSelectionAudit = {
      rounds: [],
      affixes: [
        {
          id: 'stale-core',
          name: 'stale-core',
          category: 'skill_core',
          match: matchAll([]),
          tags: [],
          weight: 10,
          energyCost: 8,
          rollScore: 1,
          rollEfficiency: 1,
          finalMultiplier: 1,
          isPerfect: false,
          effectTemplate: { type: 'damage', params: { value: { base: 10, attribute: 'magicAtk' } } } as any,
        },
      ],
      spent: 8,
      remaining: 8,
      allocations: [{ affixId: 'stale-core', amount: 8 }],
      rejections: [],
    };

    orchestrator.rollAffixes(session, [
      {
        id: 'manual-core',
        name: 'manual-core',
        category: 'skill_core',
        match: matchAll([]),
        tags: [],
        weight: 10,
        energyCost: 6,
        rollScore: 1,
        rollEfficiency: 1,
        finalMultiplier: 1,
        isPerfect: false,
        effectTemplate: { type: 'damage', params: { value: { base: 10, attribute: 'magicAtk' } } } as any,
      },
    ]);

    expect(session.state.affixSelectionAudit).toBeUndefined();
    expect(session.state.energyBudget).toMatchObject({
      spent: 6,
      remaining: 10,
      allocations: [{ affixId: 'manual-core', amount: 6 }],
    });
  });
});

// ── WorkflowDecisionBoundary — CompositionRuleSet 契约验证 ─────────

describe('WorkflowDecisionBoundary — CompositionRuleSet 契约验证', () => {
  let ruleSet: CompositionRuleSet;

  beforeEach(() => {
    ruleSet = new CompositionRuleSet(DEFAULT_AFFIX_REGISTRY);
  });

  describe('decision 字段填充完整性', () => {
    it('skill 流程结束后 decision 应包含 outcomeKind / name / outcomeTags / projectionPolicy', () => {
      const decision = ruleSet.evaluate(buildMinimalFacts('skill'));

      expect(decision.outcomeKind).toBe('active_skill');
      expect(decision.name).toBeTruthy();
      expect(decision.outcomeTags).toContain('Outcome.ActiveSkill');
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
        expect(policy.abilityTags).toEqual(
          expect.arrayContaining([
            GameplayTags.ABILITY.FUNCTION.DAMAGE,
            GameplayTags.ABILITY.CHANNEL.MAGIC,
          ]),
        );
      }
    });
  });

  describe('完整编排器集成（composition 阶段）', () => {
    it('composeBlueprintWithDefaults 应因为缺少词缀而抛出错误 (断言机制生效)', () => {
      const orchestrator = new CreationOrchestrator();
      const session = orchestrator.createSession({
        sessionId: 'boundary-composition-fail',
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

      expect(() => {
        orchestrator.rollAffixesWithDefaults(session);
      }).toThrow(CreationError);
    });
  });
});
