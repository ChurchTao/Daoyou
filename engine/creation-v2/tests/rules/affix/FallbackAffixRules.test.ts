import { RuleSet } from '@/engine/creation-v2';
import { AffixSelectionDecision, AffixSelectionFacts } from '@/engine/creation-v2/rules/contracts';
import { FallbackAffixRules } from '@/engine/creation-v2/rules/affix/FallbackAffixRules';

describe('FallbackAffixRules', () => {
  const createDecision = (facts: AffixSelectionFacts): AffixSelectionDecision => ({
    candidatePool: [...facts.candidates],
    rejections: [],
    exhaustionReason: undefined,
    reasons: [],
    warnings: [],
    trace: [],
  });

  it('应在无 rejection 且无候选时标记 pool_exhausted', () => {
    const ruleSet = new RuleSet([new FallbackAffixRules()], createDecision);
    const decision = ruleSet.evaluate({
      productType: 'skill',
      candidates: [],
      remainingEnergy: 10,
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

    expect(decision.exhaustionReason).toBe('pool_exhausted');
  });
});