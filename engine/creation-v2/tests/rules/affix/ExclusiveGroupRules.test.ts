import { matchAll } from '@/engine/creation-v2/affixes';
import { RuleSet } from '@/engine/creation-v2';
import { AffixSelectionDecision, AffixSelectionFacts } from '@/engine/creation-v2/rules/contracts';
import { ExclusiveGroupRules } from '@/engine/creation-v2/rules/affix/ExclusiveGroupRules';

describe('ExclusiveGroupRules', () => {
  const createDecision = (facts: AffixSelectionFacts): AffixSelectionDecision => ({
    candidatePool: [...facts.candidates],
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
          match: matchAll([]),
          tags: [],
          weight: 10,
          energyCost: 4,
          effectTemplate: { type: "damage", params: { value: 10 } } as any,
          exclusiveGroup: 'grp',
        },
      ],
      remainingEnergy: 10,
      inputTags: [],
      maxSelections: 4,
      selectionCount: 1,
      selectedAffixIds: [],
      selectedExclusiveGroups: ['grp'],
      selectedCategoryCounts: { core: 1 },
      selectionConstraints: {
        categoryCaps: { core: 1, prefix: 2, suffix: 2 },
      },
    });

    expect(decision.candidatePool).toEqual([]);
    expect(decision.rejections).toEqual([
      expect.objectContaining({ reason: 'exclusive_group_conflict' }),
    ]);
  });
});