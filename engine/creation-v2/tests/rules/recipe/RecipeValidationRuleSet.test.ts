import { RecipeValidationRuleSet } from '@/engine/creation-v2/rules/recipe/RecipeValidationRuleSet';
import { RecipeFacts } from '@/engine/creation-v2/rules/contracts';

describe('RecipeValidationRuleSet', () => {
  const ruleSet = new RecipeValidationRuleSet();

  it('应输出与当前默认 validator 一致的 recipe decision', () => {
    const facts: RecipeFacts = {
      productType: 'skill',
      material: {
        productType: 'skill',
        fingerprints: [],
        normalizedTags: ['Material.Element.Fire'],
        recipeTags: ['Recipe.ProductBias.Skill'],
        requestedTags: ['burst'],
        dominantTags: ['burst'],
        totalEnergy: 24,
      },
      intent: {
        productType: 'skill',
        outcomeKind: 'active_skill',
        dominantTags: ['burst'],
        requestedTags: ['burst'],
        elementBias: '火',
      },
    };

    const decision = ruleSet.evaluate(facts);

    expect(decision.valid).toBe(true);
    expect(decision.recipeId).toBe('skill-default');
    expect(decision.matchedTags).toEqual(
      expect.arrayContaining(['burst', 'Material.Element.Fire']),
    );
    expect(decision.unlockedAffixCategories).toEqual([
      'core',
      'prefix',
      'suffix',
    ]);
    expect(decision.reservedEnergy).toBe(6);
  });

  it('应在材料不支持目标产物时返回 invalid 但保留阈值结果', () => {
    const facts: RecipeFacts = {
      productType: 'artifact',
      material: {
        productType: 'artifact',
        fingerprints: [],
        normalizedTags: [],
        recipeTags: ['Recipe.ProductBias.Skill'],
        requestedTags: [],
        dominantTags: [],
        totalEnergy: 12,
      },
      intent: {
        productType: 'artifact',
        outcomeKind: 'artifact',
        dominantTags: [],
        requestedTags: [],
      },
    };

    const decision = ruleSet.evaluate(facts);

    expect(decision.valid).toBe(false);
    expect(decision.notes).toContain('当前材料组合不足以支持 artifact 产物');
    expect(decision.unlockedAffixCategories).toEqual(['core', 'prefix']);
    expect(decision.reservedEnergy).toBe(4);
  });
});