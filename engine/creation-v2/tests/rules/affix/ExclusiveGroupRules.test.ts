import { matchAll } from '@/engine/creation-v2/affixes';
import type { ExclusiveGroup } from '@/engine/creation-v2/affixes/exclusiveGroups';
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

  it.each([
    {
      label: 'artifact',
      productType: 'artifact' as const,
      group: 'artifact-core-stat',
    },
    {
      label: 'gongfa',
      productType: 'gongfa' as const,
      group: 'gongfa-core-stat',
    },
    {
      label: 'skill',
      productType: 'skill' as const,
      group: 'skill-core-damage-type',
    },
  ])('应过滤已命中的 exclusive group 候选（$label）', ({ productType, group }) => {
    const ruleSet = new RuleSet([new ExclusiveGroupRules()], createDecision);
    const decision = ruleSet.evaluate({
      productType,
      candidates: [
        {
          id: `${productType}-same-group`,
          name: `${productType}-same-group`,
          category: 'skill_core',
          match: matchAll([]),
          tags: [],
          weight: 10,
          energyCost: 4,
          effectTemplate: { type: 'damage', params: { value: 10 } } as any,
          exclusiveGroup: group as ExclusiveGroup,
        },
      ],
      remainingEnergy: 10,
      inputTags: [],
      maxSelections: 4,
      selectionCount: 1,
      selectedAffixIds: [],
      selectedExclusiveGroups: [group],
      selectedCategoryCounts: { skill_core: 1 },
      selectionConstraints: {
        categoryCaps: { skill_core: 1, skill_variant: 4, skill_rare: 1 },
      },
    });

    expect(decision.candidatePool).toEqual([]);
    expect(decision.rejections).toEqual([
      expect.objectContaining({ reason: 'exclusive_group_conflict' }),
    ]);
  });
});