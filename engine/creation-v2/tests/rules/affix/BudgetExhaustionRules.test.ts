import { matchAll } from '@/engine/creation-v2/affixes';
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
          category: 'skill_core',
          match: matchAll([]),
          tags: [],
          weight: 10,
          energyCost: 9,
          effectTemplate: { type: "damage", params: { value: 10 } } as any,
        },
        {
          id: 'cheap',
          name: 'cheap',
          category: 'skill_core',
          match: matchAll([]),
          tags: [],
          weight: 10,
          energyCost: 4,
          effectTemplate: { type: "damage", params: { value: 10 } } as any,
        },
      ],
      remainingEnergy: 4,
      inputTags: [],
      maxSelections: 4,
      selectionCount: 0,
      selectedAffixIds: [],
      selectedExclusiveGroups: [],
      selectedCategoryCounts: {},
      selectionConstraints: {
        categoryCaps: { skill_core: 1, skill_variant: 4, skill_rare: 1 },
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