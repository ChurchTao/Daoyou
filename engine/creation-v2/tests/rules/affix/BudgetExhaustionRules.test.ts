import { RuleSet } from '@/engine/creation-v2';
import { AffixSelectionDecision, AffixSelectionFacts } from '@/engine/creation-v2/rules/contracts';
import { BudgetExhaustionRules } from '@/engine/creation-v2/rules/affix/BudgetExhaustionRules';

describe('BudgetExhaustionRules', () => {
  const createDecision = (facts: AffixSelectionFacts): AffixSelectionDecision => ({
    candidatePool: [...facts.candidates],
    rejections: [],
    exhaustionReason: undefined,
    reasons: [],
    warnings: [],
    trace: [],
  });

  it('应过滤超出剩余预算的候选', () => {
    const ruleSet = new RuleSet([new BudgetExhaustionRules()], createDecision);
    const decision = ruleSet.evaluate({
      productType: 'skill',
      candidates: [
        {
          id: 'expensive',
          name: 'expensive',
          category: 'core',
          tags: [],
          weight: 10,
          energyCost: 9,
        },
        {
          id: 'cheap',
          name: 'cheap',
          category: 'core',
          tags: [],
          weight: 10,
          energyCost: 4,
        },
      ],
      remainingEnergy: 4,
      sessionTags: [],
      maxSelections: 4,
      selectionCount: 0,
      selectedAffixIds: [],
      selectedExclusiveGroups: [],
      selectedCategoryCounts: {},
      selectionConstraints: {
        categoryCaps: { core: 1, prefix: 2, suffix: 2 },
      },
    });

    expect(decision.candidatePool).toEqual([
      expect.objectContaining({ id: 'cheap' }),
    ]);
    expect(decision.rejections).toEqual([
      expect.objectContaining({ affixId: 'expensive', reason: 'budget_exhausted' }),
    ]);
  });
});