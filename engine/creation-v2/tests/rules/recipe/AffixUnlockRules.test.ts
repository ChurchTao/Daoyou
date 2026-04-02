import { RuleSet } from '@/engine/creation-v2';
import { RecipeDecision, RecipeFacts } from '@/engine/creation-v2/rules/contracts';
import { AffixUnlockRules } from '@/engine/creation-v2/rules/recipe/AffixUnlockRules';

describe('AffixUnlockRules', () => {
  const createFacts = (totalEnergy: number): RecipeFacts => ({
    productType: 'skill',
    material: {
      productType: 'skill',
      fingerprints: [],
      normalizedTags: [],
      recipeTags: ['Recipe.ProductBias.Skill'],
      requestedTags: [],
      dominantTags: [],
      totalEnergy,
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

    expect(ruleSet.evaluate(createFacts(8)).unlockedAffixCategories).toEqual(['core']);
    expect(ruleSet.evaluate(createFacts(12)).unlockedAffixCategories).toEqual([
      'core',
      'prefix',
    ]);
    expect(ruleSet.evaluate(createFacts(20)).unlockedAffixCategories).toEqual([
      'core',
      'prefix',
      'suffix',
    ]);
    expect(ruleSet.evaluate(createFacts(32)).unlockedAffixCategories).toEqual([
      'core',
      'prefix',
      'suffix',
      'signature',
    ]);
  });
});