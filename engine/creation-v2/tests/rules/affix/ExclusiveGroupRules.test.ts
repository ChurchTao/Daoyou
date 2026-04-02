import { RuleSet } from '@/engine/creation-v2';
import { AffixSelectionDecision, AffixSelectionFacts } from '@/engine/creation-v2/rules/contracts';
import { ExclusiveGroupRules } from '@/engine/creation-v2/rules/affix/ExclusiveGroupRules';

describe('ExclusiveGroupRules', () => {
  const createDecision = (facts: AffixSelectionFacts): AffixSelectionDecision => ({
    candidatePool: [...facts.candidates],
    affixes: [],
    spent: 0,
    remaining: facts.remainingEnergy,
    allocations: [],
    rejections: [],
    exhaustionReason: undefined,
    reasons: [],
    warnings: [],
    trace: [],
  });

  it('应过滤已命中的 exclusive group 候选', () => {
    const ruleSet = new RuleSet([new ExclusiveGroupRules()], createDecision);
    const decision = ruleSet.evaluate({
      productType: 'skill',
      candidates: [
        {
          id: 'same-group',
          name: 'same-group',
          category: 'core',
          tags: [],
          weight: 10,
          energyCost: 4,
          exclusiveGroup: 'grp',
        },
      ],
      remainingEnergy: 10,
      sessionTags: [],
      maxSelections: 4,
      selectionCount: 1,
      selectedAffixIds: [],
      selectedExclusiveGroups: ['grp'],
    });

    expect(decision.candidatePool).toEqual([]);
    expect(decision.rejections).toEqual([
      expect.objectContaining({ reason: 'exclusive_group_conflict' }),
    ]);
  });
});