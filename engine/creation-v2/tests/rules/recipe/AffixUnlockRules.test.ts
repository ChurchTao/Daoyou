import { RuleSet } from '@/engine/creation-v2';
import { RecipeDecision, RecipeFacts } from '@/engine/creation-v2/rules/contracts';
import { AffixUnlockRules } from '@/engine/creation-v2/rules/recipe/AffixUnlockRules';

describe('AffixUnlockRules', () => {
  const createFacts = (
    effectiveEnergy: number,
    unlockScore: number = effectiveEnergy,
  ): RecipeFacts => ({
    productType: 'skill',
    material: {
      productType: 'skill',
      fingerprints: [],
      normalizedTags: [],
      recipeTags: ['Recipe.ProductBias.Skill'],
      requestedTags: [],
      dominantTags: [],
      energyProfile: {
        baseEnergy: effectiveEnergy,
        diversityBonus: 0,
        coherenceBonus: 0,
        effectiveEnergy,
        unlockScore,
      },
      qualityProfile: {
        maxQuality: '凡品',
        weightedAverageQuality: '凡品',
        minQuality: '凡品',
        maxQualityOrder: 0,
        weightedAverageOrder: 0,
        minQualityOrder: 0,
        qualitySpread: 0,
        totalQuantity: 0,
      },
      unlockScore,
    },
    intent: {
      productType: 'skill',
      outcomeKind: 'active_skill',
      dominantTags: [],
      requestedTags: [],
    },
  });

  const createDecision = (): RecipeDecision => ({
    recipeId: 'skill-default',
    valid: true,
    matchedTags: [],
    unlockedAffixCategories: ['core'],
    reservedEnergy: undefined,
    notes: [],
    reasons: [],
    warnings: [],
    trace: [],
  });

  it('应在不同能量阈值下解锁对应 affix 分类', () => {
    const ruleSet = new RuleSet([new AffixUnlockRules()], createDecision);

    expect(ruleSet.evaluate(createFacts(12)).unlockedAffixCategories).toEqual(['core']);
    expect(ruleSet.evaluate(createFacts(16)).unlockedAffixCategories).toEqual([
      'core',
      'prefix',
    ]);
    expect(ruleSet.evaluate(createFacts(24)).unlockedAffixCategories).toEqual([
      'core',
      'prefix',
      'suffix',
    ]);
    expect(ruleSet.evaluate(createFacts(42)).unlockedAffixCategories).toEqual([
      'core',
      'prefix',
      'suffix',
      'resonance',
      'signature',
    ]);
  });

  it('应显式使用 unlock score，而不是 spendable energy', () => {
    const ruleSet = new RuleSet([new AffixUnlockRules()], createDecision);

    expect(ruleSet.evaluate(createFacts(48, 16)).unlockedAffixCategories).toEqual([
      'core',
      'prefix',
    ]);
  });
});