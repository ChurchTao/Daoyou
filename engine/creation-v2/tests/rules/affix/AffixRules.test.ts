import { matchAll, matchAny } from '@/engine/creation-v2/affixes';
import type { ExclusiveGroup } from '@/engine/creation-v2/affixes/exclusiveGroups';
import { RuleSet } from '@/engine/creation-v2';
import {
  AffixSelectionDecision,
  AffixSelectionFacts,
  AffixEligibilityFacts,
} from '@/engine/creation-v2/rules/contracts';
import { BudgetExhaustionRules } from '@/engine/creation-v2/rules/affix/BudgetExhaustionRules';
import { ExclusiveGroupRules } from '@/engine/creation-v2/rules/affix/ExclusiveGroupRules';
import { AffixPoolRuleSet } from '@/engine/creation-v2/rules/affix/AffixPoolRuleSet';
import { AffixSelectionRuleSet } from '@/engine/creation-v2/rules/affix/AffixSelectionRuleSet';
import { AffixCandidate } from '@/engine/creation-v2/types';

// ── Shared helpers ──────────────────────────────────────────────────

function toSignals(tags: string[]) {
  return tags.map((tag) => ({
    tag,
    source: 'material_semantic' as const,
    weight: 0.55,
  }));
}

function buildCandidate(
  overrides: Omit<AffixCandidate, 'match'> & Partial<Pick<AffixCandidate, 'match'>>,
): AffixCandidate {
  const tags = overrides.tags ?? [];
  const match = overrides.match ?? matchAll(tags);
  return { ...overrides, tags, match };
}

const createSelectionDecision = (facts: AffixSelectionFacts): AffixSelectionDecision => ({
  candidatePool: [...facts.candidates],
  rejections: [],
  exhaustionReason: undefined,
  reasons: [],
  warnings: [],
  trace: [],
});

// ── BudgetExhaustionRules ───────────────────────────────────────────

describe('BudgetExhaustionRules', () => {
  it('应过滤超出剩余预算的候选', () => {
    const ruleSet = new RuleSet([new BudgetExhaustionRules()], createSelectionDecision);
    const decision = ruleSet.evaluate({
      productType: 'skill',
      candidates: [
        buildCandidate({
          id: 'expensive',
          name: 'expensive',
          category: 'skill_core',
          tags: [],
          weight: 10,
          energyCost: 9,
          effectTemplate: { type: 'damage', params: { value: 10 } } as any,
        }),
        buildCandidate({
          id: 'cheap',
          name: 'cheap',
          category: 'skill_core',
          tags: [],
          weight: 10,
          energyCost: 4,
          effectTemplate: { type: 'damage', params: { value: 10 } } as any,
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
    });

    expect(decision.candidatePool).toEqual([
      expect.objectContaining({ id: 'cheap' }),
    ]);
    expect(decision.rejections).toEqual([
      expect.objectContaining({ affixId: 'expensive', reason: 'budget_exhausted' }),
    ]);
  });
});

// ── ExclusiveGroupRules ─────────────────────────────────────────────

describe('ExclusiveGroupRules', () => {
  it.each([
    { label: 'artifact', productType: 'artifact' as const, group: 'artifact-core-stat' },
    { label: 'gongfa', productType: 'gongfa' as const, group: 'gongfa-core-stat' },
    { label: 'skill', productType: 'skill' as const, group: 'skill-core-damage-type' },
  ])('应过滤已命中的 exclusive group 候选（$label）', ({ productType, group }) => {
    const ruleSet = new RuleSet([new ExclusiveGroupRules()], createSelectionDecision);
    const decision = ruleSet.evaluate({
      productType,
      candidates: [
        buildCandidate({
          id: `${productType}-same-group`,
          name: `${productType}-same-group`,
          category: 'skill_core',
          tags: [],
          weight: 10,
          energyCost: 4,
          effectTemplate: { type: 'damage', params: { value: 10 } } as any,
          exclusiveGroup: group as ExclusiveGroup,
        }),
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

// ── AffixPoolRuleSet ────────────────────────────────────────────────

describe('AffixPoolRuleSet', () => {
  const ruleSet = new AffixPoolRuleSet();

  it('应过滤未达到 minQuality 的词缀', () => {
    const facts: AffixEligibilityFacts = {
      productType: 'gongfa',
      recipeMatch: {
        recipeId: 'gongfa-default',
        valid: true,
        matchedTags: [],
        unlockedAffixCategories: ['gongfa_foundation', 'gongfa_secret'],
      },
      energyBudget: {
        baseTotal: 20,
        effectiveTotal: 20,
        reserved: 4,
        spent: 0,
        remaining: 16,
        allocations: [],
        sources: [],
      },
      candidatePool: [
        buildCandidate({
          id: 'eligible-core',
          name: 'eligible-core',
          category: 'gongfa_foundation',
          tags: [],
          weight: 10,
          energyCost: 6,
          effectTemplate: { type: 'damage', params: { value: 10 } } as any,
        }),
        buildCandidate({
          id: 'gated-signature',
          name: 'gated-signature',
          category: 'gongfa_secret',
          tags: [],
          weight: 10,
          energyCost: 8,
          minQuality: '玄品',
          effectTemplate: { type: 'damage', params: { value: 10 } } as any,
        }),
      ],
      allowedCategories: ['gongfa_foundation', 'gongfa_secret'],
      inputTagSignals: [],
      inputTags: [],
      tagSignalScores: {},
      maxQualityOrder: 1,
    };

    const decision = ruleSet.evaluate(facts);
    expect(decision.candidates).toHaveLength(1);
    expect(decision.candidates[0].id).toBe('eligible-core');
    expect(decision.rejectedCandidates).toEqual([
      expect.objectContaining({ affixId: 'gated-signature', reason: 'min_quality_unmet' }),
    ]);
  });

  it('应过滤超出 maxQuality 上限的词缀', () => {
    const facts: AffixEligibilityFacts = {
      productType: 'gongfa',
      recipeMatch: {
        recipeId: 'gongfa-default',
        valid: true,
        matchedTags: [],
        unlockedAffixCategories: ['gongfa_foundation', 'gongfa_secret'],
      },
      energyBudget: {
        baseTotal: 20,
        effectiveTotal: 20,
        reserved: 4,
        spent: 0,
        remaining: 16,
        allocations: [],
        sources: [],
      },
      candidatePool: [
        buildCandidate({
          id: 'eligible-core',
          name: 'eligible-core',
          category: 'gongfa_foundation',
          tags: [],
          weight: 10,
          energyCost: 6,
          effectTemplate: { type: 'damage', params: { value: 10 } } as any,
        }),
        buildCandidate({
          id: 'low-quality-only',
          name: 'low-quality-only',
          category: 'gongfa_secret',
          tags: [],
          weight: 10,
          energyCost: 8,
          maxQuality: '凡品',
          effectTemplate: { type: 'damage', params: { value: 10 } } as any,
        }),
      ],
      allowedCategories: ['gongfa_foundation', 'gongfa_secret'],
      inputTagSignals: toSignals(['Material.Semantic.Spirit']),
      inputTags: ['Material.Semantic.Spirit'],
      tagSignalScores: {},
      maxQualityOrder: 2,
    };

    const decision = ruleSet.evaluate(facts);
    expect(decision.candidates).toHaveLength(1);
    expect(decision.candidates[0].id).toBe('eligible-core');
    expect(decision.rejectedCandidates).toEqual([
      expect.objectContaining({ affixId: 'low-quality-only', reason: 'max_quality_exceeded' }),
    ]);
  });

  it('应过滤非正权重词缀', () => {
    const facts: AffixEligibilityFacts = {
      productType: 'skill',
      recipeMatch: {
        recipeId: 'skill-default',
        valid: true,
        matchedTags: [],
        unlockedAffixCategories: ['skill_core'],
      },
      energyBudget: {
        baseTotal: 12,
        effectiveTotal: 12,
        reserved: 4,
        spent: 0,
        remaining: 8,
        allocations: [],
        sources: [],
      },
      candidatePool: [
        buildCandidate({
          id: 'bad-weight',
          name: 'bad-weight',
          category: 'skill_core',
          tags: [],
          weight: 0,
          energyCost: 4,
          effectTemplate: { type: 'damage', params: { value: 10 } } as any,
        }),
      ],
      allowedCategories: ['skill_core'],
      inputTagSignals: [],
      inputTags: [],
      tagSignalScores: {},
      maxQualityOrder: 2,
    };

    const decision = ruleSet.evaluate(facts);
    expect(decision.candidates).toEqual([]);
    expect(decision.rejectedCandidates).toEqual([
      expect.objectContaining({ affixId: 'bad-weight', reason: 'non_positive_weight' }),
    ]);
  });

  it('高阶词缀在 match 条件未满足时应被过滤', () => {
    const facts: AffixEligibilityFacts = {
      productType: 'skill',
      recipeMatch: {
        recipeId: 'skill-default',
        valid: true,
        matchedTags: [],
        unlockedAffixCategories: ['skill_rare'],
      },
      energyBudget: {
        baseTotal: 30,
        effectiveTotal: 30,
        reserved: 4,
        spent: 0,
        remaining: 26,
        allocations: [],
        sources: [],
      },
      candidatePool: [
        buildCandidate({
          id: 'sig-low-hit',
          name: 'sig-low-hit',
          category: 'skill_rare',
          tags: ['a', 'b', 'c'],
          weight: 20,
          energyCost: 10,
          effectTemplate: { type: 'damage', params: { value: 10 } } as any,
        }),
      ],
      allowedCategories: ['skill_rare'],
      inputTagSignals: toSignals(['a']),
      inputTags: ['a'],
      tagSignalScores: { a: 0.7 },
      maxQualityOrder: 5,
    };

    const decision = ruleSet.evaluate(facts);
    expect(decision.candidates).toHaveLength(0);
    expect(decision.rejectedCandidates).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ affixId: 'sig-low-hit', reason: 'match_unmet' }),
      ]),
    );
  });

  it('应根据标签命中率提升候选权重', () => {
    const facts: AffixEligibilityFacts = {
      productType: 'skill',
      recipeMatch: {
        recipeId: 'skill-default',
        valid: true,
        matchedTags: [],
        unlockedAffixCategories: ['skill_variant'],
      },
      energyBudget: {
        baseTotal: 20,
        effectiveTotal: 20,
        reserved: 4,
        spent: 0,
        remaining: 16,
        allocations: [],
        sources: [],
      },
      candidatePool: [
        buildCandidate({
          id: 'prefix-score',
          name: 'prefix-score',
          category: 'skill_variant',
          tags: ['x', 'y'],
          weight: 10,
          energyCost: 4,
          effectTemplate: { type: 'damage', params: { value: 10 } } as any,
        }),
      ],
      allowedCategories: ['skill_variant'],
      inputTags: ['x', 'y'],
      inputTagSignals: toSignals(['x', 'y']),
      tagSignalScores: { x: 0.7, y: 0.7 },
      maxQualityOrder: 4,
    };

    const decision = ruleSet.evaluate(facts);
    expect(decision.candidates).toHaveLength(1);
    expect(decision.candidates[0].weight).toBeGreaterThan(10);
    expect(decision.candidates[0].evaluationScore).toBeGreaterThanOrEqual(0.45);
  });

  it('mythic 词缀在弱信号且刚好踩线品质时应被 admission score 过滤', () => {
    const facts: AffixEligibilityFacts = {
      productType: 'skill',
      recipeMatch: {
        recipeId: 'skill-default',
        valid: true,
        matchedTags: [],
        unlockedAffixCategories: ['skill_rare'],
      },
      energyBudget: {
        baseTotal: 20,
        effectiveTotal: 20,
        reserved: 4,
        spent: 0,
        remaining: 16,
        allocations: [],
        sources: [],
      },
      candidatePool: [
        buildCandidate({
          id: 'mythic-weak-score',
          name: 'mythic-weak-score',
          category: 'skill_rare',
          tags: ['x', 'y', 'z'],
          match: matchAny(['x', 'y', 'z']),
          weight: 10,
          energyCost: 4,
          minQuality: '天品',
          effectTemplate: { type: 'damage', params: { value: 10 } } as any,
        }),
      ],
      allowedCategories: ['skill_rare'],
      inputTags: ['x'],
      inputTagSignals: toSignals(['x']),
      tagSignalScores: { x: 0.25 },
      maxQualityOrder: 5,
    };

    const decision = ruleSet.evaluate(facts);
    expect(decision.candidates).toEqual([]);
    expect(decision.rejectedCandidates).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          affixId: 'mythic-weak-score',
          reason: 'insufficient_admission_score',
        }),
      ]),
    );
  });
});

// ── AffixSelectionRuleSet ───────────────────────────────────────────

describe('AffixSelectionRuleSet', () => {
  const ruleSet = new AffixSelectionRuleSet();

  it('应过滤预算不足和 exclusive group 冲突的候选', () => {
    const facts: AffixSelectionFacts = {
      productType: 'skill',
      candidates: [
        buildCandidate({
          id: 'blocked-budget',
          name: 'blocked-budget',
          category: 'skill_variant',
          tags: [],
          weight: 10,
          energyCost: 9,
          effectTemplate: { type: 'damage', params: { value: 10 } } as any,
        }),
        buildCandidate({
          id: 'blocked-group',
          name: 'blocked-group',
          category: 'skill_variant',
          tags: [],
          weight: 10,
          energyCost: 4,
          effectTemplate: { type: 'damage', params: { value: 10 } } as any,
          exclusiveGroup: 'grp' as ExclusiveGroup,
        }),
        buildCandidate({
          id: 'eligible',
          name: 'eligible',
          category: 'skill_variant',
          tags: [],
          weight: 10,
          energyCost: 4,
          effectTemplate: { type: 'damage', params: { value: 10 } } as any,
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
    const decision = ruleSet.evaluate({
      productType: 'skill',
      candidates: [
        buildCandidate({
          id: 'blocked-budget',
          name: 'blocked-budget',
          category: 'skill_core',
          tags: [],
          weight: 10,
          energyCost: 9,
          effectTemplate: { type: 'damage', params: { value: 10 } } as any,
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
    });

    expect(decision.candidatePool).toEqual([]);
    expect(decision.exhaustionReason).toBe('budget_exhausted');
  });

  it('应过滤超过分类配额的候选', () => {
    const decision = ruleSet.evaluate({
      productType: 'skill',
      candidates: [
        buildCandidate({
          id: 'prefix-over-cap',
          name: 'prefix-over-cap',
          category: 'skill_core',
          tags: [],
          weight: 10,
          energyCost: 4,
          effectTemplate: { type: 'damage', params: { value: 10 } } as any,
        }),
        buildCandidate({
          id: 'suffix-ok',
          name: 'suffix-ok',
          category: 'skill_variant',
          tags: [],
          weight: 10,
          energyCost: 4,
          effectTemplate: { type: 'damage', params: { value: 10 } } as any,
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
    });

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
    const decision = ruleSet.evaluate({
      productType: 'skill',
      candidates: [
        buildCandidate({
          id: 'mythic-unassigned',
          name: 'mythic-unassigned',
          category: 'skill_rare',
          tags: [],
          weight: 10,
          energyCost: 8,
          effectTemplate: { type: 'damage', params: { value: 10 } } as any,
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
        categoryCaps: { skill_core: 1, skill_variant: 2, skill_rare: 0 },
      },
    });

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
    const decision = ruleSet.evaluate({
      productType: 'skill',
      candidates: [
        buildCandidate({
          id: 'signature-over-bucket',
          name: 'signature-over-bucket',
          category: 'skill_rare',
          tags: [],
          weight: 10,
          energyCost: 8,
          effectTemplate: { type: 'damage', params: { value: 10 } } as any,
        }),
        buildCandidate({
          id: 'resonance-ok',
          name: 'resonance-ok',
          category: 'skill_variant',
          tags: [],
          weight: 10,
          energyCost: 7,
          effectTemplate: { type: 'damage', params: { value: 10 } } as any,
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
        categoryCaps: { skill_core: 1, skill_variant: 3, skill_rare: 1 },
        bucketCaps: { highTierTotal: 1 },
      },
    });

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
    const decision = ruleSet.evaluate({
      productType: 'skill',
      candidates: [
        buildCandidate({
          id: 'mythic-over-bucket',
          name: 'mythic-over-bucket',
          category: 'skill_rare',
          tags: [],
          weight: 10,
          energyCost: 8,
          effectTemplate: { type: 'damage', params: { value: 10 } } as any,
        }),
        buildCandidate({
          id: 'suffix-ok',
          name: 'suffix-ok',
          category: 'skill_variant',
          tags: [],
          weight: 10,
          energyCost: 6,
          effectTemplate: { type: 'damage', params: { value: 10 } } as any,
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
        categoryCaps: { skill_core: 1, skill_variant: 3, skill_rare: 1 },
        bucketCaps: { highTierTotal: 1 },
      },
    });

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
