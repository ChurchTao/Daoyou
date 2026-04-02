import { AffixSelectionRuleSet } from '@/engine/creation-v2/rules/affix/AffixSelectionRuleSet';
import { AffixSelectionFacts } from '@/engine/creation-v2/rules/contracts';

describe('AffixSelectionRuleSet', () => {
  const ruleSet = new AffixSelectionRuleSet();

  it('应过滤预算不足和 exclusive group 冲突的候选', () => {
    const facts: AffixSelectionFacts = {
      productType: 'skill',
      candidates: [
        {
          id: 'blocked-budget',
          name: 'blocked-budget',
          category: 'core',
          tags: [],
          weight: 10,
          energyCost: 9,
        },
        {
          id: 'blocked-group',
          name: 'blocked-group',
          category: 'core',
          tags: [],
          weight: 10,
          energyCost: 4,
          exclusiveGroup: 'grp',
        },
        {
          id: 'eligible',
          name: 'eligible',
          category: 'core',
          tags: [],
          weight: 10,
          energyCost: 4,
        },
      ],
      remainingEnergy: 4,
      sessionTags: [],
      maxSelections: 4,
      selectionCount: 1,
      selectedAffixIds: ['picked-a'],
      selectedExclusiveGroups: ['grp'],
    };

    const decision = ruleSet.evaluate(facts);

    expect(decision.candidatePool).toEqual([
      expect.objectContaining({ id: 'eligible' }),
    ]);
    expect(decision.rejections).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ affixId: 'blocked-budget', reason: 'budget_exhausted' }),
        expect.objectContaining({ affixId: 'blocked-group', reason: 'exclusive_group_conflict' }),
      ]),
    );
  });

  it('应在无可用候选时输出停机原因', () => {
    const facts: AffixSelectionFacts = {
      productType: 'skill',
      candidates: [
        {
          id: 'blocked-budget',
          name: 'blocked-budget',
          category: 'core',
          tags: [],
          weight: 10,
          energyCost: 9,
        },
      ],
      remainingEnergy: 4,
      sessionTags: [],
      maxSelections: 4,
      selectionCount: 0,
      selectedAffixIds: [],
      selectedExclusiveGroups: [],
    };

    const decision = ruleSet.evaluate(facts);

    expect(decision.candidatePool).toEqual([]);
    expect(decision.exhaustionReason).toBe('budget_exhausted');
  });
});