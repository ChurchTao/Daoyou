import { matchAll, matchAny } from '@/engine/creation-v2/affixes';
import { AffixPoolRuleSet } from '@/engine/creation-v2/rules/affix/AffixPoolRuleSet';
import { AffixEligibilityFacts } from '@/engine/creation-v2/rules/contracts';
import { AffixCandidate } from '@/engine/creation-v2/types';

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

  return {
    ...overrides,
    tags,
    match,
  };
}

describe('AffixPoolRuleSet', () => {
  const ruleSet = new AffixPoolRuleSet();

  it('应过滤未达到 minQuality 的词缀', () => {
    const facts: AffixEligibilityFacts = {
      productType: 'gongfa',
      recipeMatch: {
        recipeId: 'gongfa-default',
        valid: true,
        matchedTags: [],
        unlockedAffixCategories: ['core', 'signature'],
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
          category: 'core',
          tags: [],
          weight: 10,
          energyCost: 6,
          effectTemplate: { type: 'damage', params: { value: 10 } } as any,
        }),
        buildCandidate({
          id: 'gated-signature',
          name: 'gated-signature',
          category: 'signature',
          tags: [],
          weight: 10,
          energyCost: 8,
          minQuality: '玄品',
          effectTemplate: { type: 'damage', params: { value: 10 } } as any,
        }),
      ],
      allowedCategories: ['core', 'signature'],
      inputTagSignals: toSignals(['Material.Semantic.Spirit']),
      inputTags: ['Material.Semantic.Spirit'],
      tagSignalScores: {},
      maxQualityOrder: 0,
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
        unlockedAffixCategories: ['core', 'signature'],
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
          category: 'core',
          tags: [],
          weight: 10,
          energyCost: 6,
          effectTemplate: { type: 'damage', params: { value: 10 } } as any,
        }),
        buildCandidate({
          id: 'low-quality-only',
          name: 'low-quality-only',
          category: 'signature',
          tags: [],
          weight: 10,
          energyCost: 8,
          // 只允许出现在凡品材料（order=0）的创造物中
          maxQuality: '凡品',
          effectTemplate: { type: 'damage', params: { value: 10 } } as any,
        }),
      ],
      allowedCategories: ['core', 'signature'],
      inputTagSignals: toSignals(['Material.Semantic.Spirit']),
      inputTags: ['Material.Semantic.Spirit'],
      tagSignalScores: {},
      // 材料品质为玄品（order=2），超过 maxQuality 上限
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
        unlockedAffixCategories: ['core'],
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
          category: 'core',
          tags: [],
          weight: 0,
          energyCost: 4,
          effectTemplate: { type: 'damage', params: { value: 10 } } as any,
        }),
      ],
      allowedCategories: ['core'],
      inputTagSignals: [],
      inputTags: [],
      tagSignalScores: {},
      maxQualityOrder: 3,
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
        unlockedAffixCategories: ['signature'],
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
          category: 'signature',
          tags: ['a', 'b', 'c'],
          weight: 20,
          energyCost: 10,
          effectTemplate: { type: 'damage', params: { value: 10 } } as any,
        }),
      ],
      allowedCategories: ['signature'],
      inputTagSignals: toSignals(['a']),
      inputTags: ['a'],
      tagSignalScores: { a: 0.7 },
      maxQualityOrder: 5,
    };

    const decision = ruleSet.evaluate(facts);
    expect(decision.candidates).toHaveLength(0);
    expect(decision.rejectedCandidates).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          affixId: 'sig-low-hit',
          reason: 'match_unmet',
        }),
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
        unlockedAffixCategories: ['prefix'],
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
          category: 'prefix',
          tags: ['x', 'y'],
          weight: 10,
          energyCost: 4,
          effectTemplate: { type: 'damage', params: { value: 10 } } as any,
        }),
      ],
      allowedCategories: ['prefix'],
      inputTagSignals: toSignals(['x', 'y']),
      inputTags: ['x', 'y'],
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
        unlockedAffixCategories: ['mythic'],
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
          category: 'mythic',
          tags: ['x', 'y', 'z'],
          match: matchAny(['x', 'y', 'z']),
          weight: 10,
          energyCost: 4,
          minQuality: '天品',
          effectTemplate: { type: 'damage', params: { value: 10 } } as any,
        }),
      ],
      allowedCategories: ['mythic'],
      inputTagSignals: toSignals(['x']),
      inputTags: ['x'],
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