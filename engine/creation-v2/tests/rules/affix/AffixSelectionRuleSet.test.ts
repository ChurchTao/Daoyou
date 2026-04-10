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
          category: 'suffix',
          tags: [],
          weight: 10,
          energyCost: 9,
          effectTemplate: { type: "damage", params: { value: 10 } } as any,
        },
        {
          id: 'blocked-group',
          name: 'blocked-group',
          category: 'prefix',
          tags: [],
          weight: 10,
          energyCost: 4,
          effectTemplate: { type: "damage", params: { value: 10 } } as any,
          exclusiveGroup: 'grp',
        },
        {
          id: 'eligible',
          name: 'eligible',
          category: 'suffix',
          tags: [],
          weight: 10,
          energyCost: 4,
          effectTemplate: { type: "damage", params: { value: 10 } } as any,
        },
      ],
      remainingEnergy: 4,
      sessionTags: [],
      maxSelections: 4,
      selectionCount: 1,
      selectedAffixIds: ['picked-a'],
      selectedExclusiveGroups: ['grp'],
      selectedCategoryCounts: { core: 1 },
      selectionConstraints: {
        categoryCaps: { core: 1, prefix: 2, suffix: 2 },
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
        {
          id: 'blocked-budget',
          name: 'blocked-budget',
          category: 'core',
          tags: [],
          weight: 10,
          energyCost: 9,
          effectTemplate: { type: "damage", params: { value: 10 } } as any,
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
    };

    const decision = ruleSet.evaluate(facts);

    expect(decision.candidatePool).toEqual([]);
    expect(decision.exhaustionReason).toBe('budget_exhausted');
  });

  it('应过滤超过分类配额的候选', () => {
    const facts: AffixSelectionFacts = {
      productType: 'skill',
      candidates: [
        {
          id: 'prefix-over-cap',
          name: 'prefix-over-cap',
          category: 'prefix',
          tags: [],
          weight: 10,
          energyCost: 4,
          effectTemplate: { type: "damage", params: { value: 10 } } as any,
        },
        {
          id: 'suffix-ok',
          name: 'suffix-ok',
          category: 'suffix',
          tags: [],
          weight: 10,
          energyCost: 4,
          effectTemplate: { type: "damage", params: { value: 10 } } as any,
        },
      ],
      remainingEnergy: 10,
      sessionTags: [],
      maxSelections: 5,
      selectionCount: 2,
      selectedAffixIds: ['a', 'b'],
      selectedExclusiveGroups: [],
      selectedCategoryCounts: { prefix: 1 },
      selectionConstraints: {
        categoryCaps: { core: 1, prefix: 1, suffix: 2 },
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
        {
          id: 'mythic-unassigned',
          name: 'mythic-unassigned',
          category: 'mythic',
          tags: [],
          weight: 10,
          energyCost: 8,
          effectTemplate: { type: "damage", params: { value: 10 } } as any,
        },
      ],
      remainingEnergy: 10,
      sessionTags: [],
      maxSelections: 5,
      selectionCount: 1,
      selectedAffixIds: ['core-picked'],
      selectedExclusiveGroups: [],
      selectedCategoryCounts: { core: 1 },
      selectionConstraints: {
        categoryCaps: {
          core: 1,
          prefix: 1,
          suffix: 1,
          resonance: 1,
          signature: 0,
          synergy: 0,
          mythic: 0,
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
        {
          id: 'signature-over-bucket',
          name: 'signature-over-bucket',
          category: 'signature',
          tags: [],
          weight: 10,
          energyCost: 8,
          effectTemplate: { type: "damage", params: { value: 10 } } as any,
        },
        {
          id: 'resonance-ok',
          name: 'resonance-ok',
          category: 'resonance',
          tags: [],
          weight: 10,
          energyCost: 7,
          effectTemplate: { type: "damage", params: { value: 10 } } as any,
        },
      ],
      remainingEnergy: 12,
      sessionTags: [],
      maxSelections: 5,
      selectionCount: 3,
      selectedAffixIds: ['core-picked', 'prefix-picked', 'signature-picked'],
      selectedExclusiveGroups: [],
      selectedCategoryCounts: { core: 1, prefix: 1, signature: 1 },
      selectionConstraints: {
        categoryCaps: {
          core: 1,
          prefix: 2,
          suffix: 2,
          resonance: 1,
          signature: 1,
          synergy: 1,
          mythic: 1,
        },
        bucketCaps: { highTierTotal: 1, mythic: 1 },
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
        {
          id: 'mythic-over-bucket',
          name: 'mythic-over-bucket',
          category: 'mythic',
          tags: [],
          weight: 10,
          energyCost: 8,
          effectTemplate: { type: "damage", params: { value: 10 } } as any,
        },
        {
          id: 'suffix-ok',
          name: 'suffix-ok',
          category: 'suffix',
          tags: [],
          weight: 10,
          energyCost: 6,
          effectTemplate: { type: "damage", params: { value: 10 } } as any,
        },
      ],
      remainingEnergy: 12,
      sessionTags: [],
      maxSelections: 5,
      selectionCount: 4,
      selectedAffixIds: ['core-picked', 'prefix-picked', 'res-picked', 'mythic-picked'],
      selectedExclusiveGroups: [],
      selectedCategoryCounts: { core: 1, prefix: 1, resonance: 1, mythic: 1 },
      selectionConstraints: {
        categoryCaps: {
          core: 1,
          prefix: 2,
          suffix: 2,
          resonance: 1,
          signature: 1,
          synergy: 1,
          mythic: 1,
        },
        bucketCaps: { highTierTotal: 1, mythic: 1 },
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