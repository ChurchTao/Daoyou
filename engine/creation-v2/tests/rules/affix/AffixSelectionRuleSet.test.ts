import { matchAll } from '@/engine/creation-v2/affixes';
import type { ExclusiveGroup } from '@/engine/creation-v2/affixes/exclusiveGroups';
import { AffixCandidate } from '@/engine/creation-v2/types';
import { AffixSelectionRuleSet } from '@/engine/creation-v2/rules/affix/AffixSelectionRuleSet';
import { AffixSelectionFacts } from '@/engine/creation-v2/rules/contracts';

function candidate(
  overrides: Omit<AffixCandidate, 'match'> & Partial<Pick<AffixCandidate, 'match'>>,
): AffixCandidate {
  return {
    ...overrides,
    match: overrides.match ?? matchAll([]),
  };
}

describe('AffixSelectionRuleSet', () => {
  const ruleSet = new AffixSelectionRuleSet();

  it('应过滤预算不足和 exclusive group 冲突的候选', () => {
    const facts: AffixSelectionFacts = {
      productType: 'skill',
      candidates: [
        candidate({
          id: 'blocked-budget',
          name: 'blocked-budget',
          category: 'skill_variant',
          tags: [],
          weight: 10,
          energyCost: 9,
          effectTemplate: { type: "damage", params: { value: 10 } } as any,
        }),
        candidate({
          id: 'blocked-group',
          name: 'blocked-group',
          category: 'skill_variant',
          tags: [],
          weight: 10,
          energyCost: 4,
          effectTemplate: { type: "damage", params: { value: 10 } } as any,
          exclusiveGroup: 'grp' as ExclusiveGroup,
        }),
        candidate({
          id: 'eligible',
          name: 'eligible',
          category: 'skill_variant',
          tags: [],
          weight: 10,
          energyCost: 4,
          effectTemplate: { type: "damage", params: { value: 10 } } as any,
        }),
      ],
      remainingEnergy: 4,
      inputTags: [],
      maxSelections: 4,
      selectionCount: 1,
      selectedAffixIds: ['picked-a'],
      selectedExclusiveGroups: ['grp'],
      selectedCategoryCounts: { skill_core: 1 },
      selectionConstraints: {
        categoryCaps: { skill_core: 1, skill_variant: 4, skill_rare: 1 },
      },
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
        candidate({
          id: 'blocked-budget',
          name: 'blocked-budget',
          category: 'skill_core',
          tags: [],
          weight: 10,
          energyCost: 9,
          effectTemplate: { type: "damage", params: { value: 10 } } as any,
        }),
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
    };

    const decision = ruleSet.evaluate(facts);

    expect(decision.candidatePool).toEqual([]);
    expect(decision.exhaustionReason).toBe('budget_exhausted');
  });

  it('应过滤超过分类配额的候选', () => {
    const facts: AffixSelectionFacts = {
      productType: 'skill',
      candidates: [
        candidate({
          id: 'prefix-over-cap',
          name: 'prefix-over-cap',
          category: 'skill_core',
          tags: [],
          weight: 10,
          energyCost: 4,
          effectTemplate: { type: "damage", params: { value: 10 } } as any,
        }),
        candidate({
          id: 'suffix-ok',
          name: 'suffix-ok',
          category: 'skill_variant',
          tags: [],
          weight: 10,
          energyCost: 4,
          effectTemplate: { type: "damage", params: { value: 10 } } as any,
        }),
      ],
      remainingEnergy: 10,
      inputTags: [],
      maxSelections: 5,
      selectionCount: 2,
      selectedAffixIds: ['a', 'b'],
      selectedExclusiveGroups: [],
      selectedCategoryCounts: { skill_core: 1 },
      selectionConstraints: {
        categoryCaps: { skill_core: 1, skill_variant: 4, skill_rare: 1 },
      },
    };

    const decision = ruleSet.evaluate(facts);

    expect(decision.candidatePool).toEqual([
      expect.objectContaining({ id: 'suffix-ok' }),
    ]);
    expect(decision.rejections).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          affixId: 'prefix-over-cap',
          reason: 'category_quota_reached',
        }),
      ]),
    );
  });

  it('未显式分配配额的高阶类别不应再视为无限制', () => {
    const facts: AffixSelectionFacts = {
      productType: 'skill',
      candidates: [
        candidate({
          id: 'mythic-unassigned',
          name: 'mythic-unassigned',
          category: 'skill_rare',
          tags: [],
          weight: 10,
          energyCost: 8,
          effectTemplate: { type: "damage", params: { value: 10 } } as any,
        }),
      ],
      remainingEnergy: 10,
      inputTags: [],
      maxSelections: 5,
      selectionCount: 1,
      selectedAffixIds: ['core-picked'],
      selectedExclusiveGroups: [],
      selectedCategoryCounts: { skill_core: 1 },
      selectionConstraints: {
        categoryCaps: {
          skill_core: 1,
          skill_variant: 2,
          skill_rare: 0,
        },
      },
    };

    const decision = ruleSet.evaluate(facts);

    expect(decision.candidatePool).toEqual([]);
    expect(decision.rejections).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          affixId: 'mythic-unassigned',
          reason: 'category_quota_reached',
        }),
      ]),
    );
  });

  it('应过滤超过高阶桶上限的候选', () => {
    const facts: AffixSelectionFacts = {
      productType: 'skill',
      candidates: [
        candidate({
          id: 'signature-over-bucket',
          name: 'signature-over-bucket',
          category: 'skill_rare',
          tags: [],
          weight: 10,
          energyCost: 8,
          effectTemplate: { type: "damage", params: { value: 10 } } as any,
        }),
        candidate({
          id: 'resonance-ok',
          name: 'resonance-ok',
          category: 'skill_variant',
          tags: [],
          weight: 10,
          energyCost: 7,
          effectTemplate: { type: "damage", params: { value: 10 } } as any,
        }),
      ],
      remainingEnergy: 12,
      inputTags: [],
      maxSelections: 5,
      selectionCount: 3,
      selectedAffixIds: ['core-picked', 'prefix-picked', 'signature-picked'],
      selectedExclusiveGroups: [],
      selectedCategoryCounts: { skill_core: 1, skill_variant: 1, skill_rare: 1 },
      selectionConstraints: {
        categoryCaps: {
          skill_core: 1,
          skill_variant: 3,
          skill_rare: 1,
        },
        bucketCaps: { highTierTotal: 1 },
      },
    };

    const decision = ruleSet.evaluate(facts);

    expect(decision.candidatePool).toEqual([
      expect.objectContaining({ id: 'resonance-ok' }),
    ]);
    expect(decision.rejections).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          affixId: 'signature-over-bucket',
          reason: 'category_quota_reached',
        }),
      ]),
    );
  });

  it('应过滤超过 mythic 桶上限的候选', () => {
    const facts: AffixSelectionFacts = {
      productType: 'skill',
      candidates: [
        candidate({
          id: 'mythic-over-bucket',
          name: 'mythic-over-bucket',
          category: 'skill_rare',
          tags: [],
          weight: 10,
          energyCost: 8,
          effectTemplate: { type: "damage", params: { value: 10 } } as any,
        }),
        candidate({
          id: 'suffix-ok',
          name: 'suffix-ok',
          category: 'skill_variant',
          tags: [],
          weight: 10,
          energyCost: 6,
          effectTemplate: { type: "damage", params: { value: 10 } } as any,
        }),
      ],
      remainingEnergy: 12,
      inputTags: [],
      maxSelections: 5,
      selectionCount: 4,
      selectedAffixIds: ['core-picked', 'prefix-picked', 'res-picked', 'mythic-picked'],
      selectedExclusiveGroups: [],
      selectedCategoryCounts: { skill_core: 1, skill_variant: 2, skill_rare: 1 },
      selectionConstraints: {
        categoryCaps: {
          skill_core: 1,
          skill_variant: 3,
          skill_rare: 1,
        },
        bucketCaps: { highTierTotal: 1 },
      },
    };

    const decision = ruleSet.evaluate(facts);

    expect(decision.candidatePool).toEqual([
      expect.objectContaining({ id: 'suffix-ok' }),
    ]);
    expect(decision.rejections).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          affixId: 'mythic-over-bucket',
          reason: 'category_quota_reached',
        }),
      ]),
    );
  });
});