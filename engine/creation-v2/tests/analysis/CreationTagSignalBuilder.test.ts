import {
  buildCreationTagSignals,
  buildCreationTagSignalScoreMap,
} from '@/engine/creation-v2/analysis/CreationTagSignalBuilder';
import type {
  CreationIntent,
  MaterialFingerprint,
  RecipeMatch,
} from '@/engine/creation-v2/types';

describe('CreationTagSignalBuilder', () => {
  it('应按来源生成结构化输入信号并保留重复语义的独立贡献', () => {
    const fingerprints: MaterialFingerprint[] = [
      {
        materialName: '赤炎矿',
        materialType: 'ore',
        rank: '玄品',
        quantity: 1,
        explicitTags: ['Material.Type.Ore', 'Material.Element.Fire'],
        semanticTags: ['Material.Semantic.Flame'],
        recipeTags: ['Recipe.ProductBias.Skill'],
        energyValue: 6,
        rarityWeight: 2,
        element: '火',
      },
      {
        materialName: '焚心妖核',
        materialType: 'monster',
        rank: '玄品',
        quantity: 1,
        explicitTags: ['Material.Type.Monster', 'Material.Element.Fire'],
        semanticTags: ['Material.Semantic.Flame', 'Material.Semantic.Burst'],
        recipeTags: ['Recipe.ProductBias.Skill'],
        energyValue: 7,
        rarityWeight: 2,
        element: '火',
      },
    ];

    const intent: CreationIntent = {
      productType: 'skill',
      outcomeKind: 'active_skill',
      dominantTags: ['Material.Semantic.Flame'],
      elementBias: '火',
    };

    const recipeMatch: RecipeMatch = {
      recipeId: 'skill-default',
      valid: true,
      matchedTags: ['Recipe.ProductBias.Skill'],
      unlockedAffixCategories: ['skill_core', 'skill_variant'],
    };

    const signals = buildCreationTagSignals({
      materialFingerprints: fingerprints,
      intent,
      recipeMatch,
    });

    expect(signals).toEqual(
      expect.arrayContaining([
        {
          tag: 'Material.Semantic.Flame',
          source: 'material_semantic',
          weight: 0.55,
        },
        {
          tag: 'Material.Semantic.Flame',
          source: 'intent_dominant',
          weight: 0.55,
        },
        {
          tag: 'Recipe.ProductBias.Skill',
          source: 'recipe_matched',
          weight: 0.6,
        },
      ]),
    );

    expect(
      signals.filter((signal) => signal.tag === 'Material.Semantic.Flame'),
    ).toHaveLength(3);
  });

  it('应在 score map 中按来源累计并遵守单标签上限', () => {
    const scores = buildCreationTagSignalScoreMap([
      {
        tag: 'Material.Semantic.Flame',
        source: 'material_semantic',
        weight: 0.55,
      },
      {
        tag: 'Material.Semantic.Flame',
        source: 'material_semantic',
        weight: 0.55,
      },
      {
        tag: 'Material.Semantic.Flame',
        source: 'intent_dominant',
        weight: 0.55,
      },
      {
        tag: 'Material.Semantic.Flame',
        source: 'recipe_matched',
        weight: 2,
      },
    ]);

    expect(scores['Material.Semantic.Flame']).toBe(2.5);
  });
});