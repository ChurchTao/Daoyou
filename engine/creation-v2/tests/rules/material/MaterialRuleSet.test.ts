import { MaterialFactsBuilder } from '@/engine/creation-v2/analysis/MaterialFactsBuilder';
import { MaterialRuleSet } from '@/engine/creation-v2/rules/material/MaterialRuleSet';
import { MaterialFingerprint } from '@/engine/creation-v2/types';

describe('MaterialRuleSet', () => {
  const factsBuilder = new MaterialFactsBuilder();
  const ruleSet = new MaterialRuleSet();

  it('应从材料事实中提取 dominant tags 与 recipe tags', () => {
    const fingerprints: MaterialFingerprint[] = [
      {
        materialName: '赤炎精铁',
        materialType: 'ore',
        rank: '玄品',
        quantity: 1,
        explicitTags: ['Material.Type.Ore', 'Material.Element.Fire'],
        semanticTags: ['Material.Semantic.Flame'],
        recipeTags: ['Recipe.ProductBias.Skill', 'Recipe.ProductBias.Artifact'],
        energyValue: 8,
        rarityWeight: 2,
        element: '火',
      },
    ];

    const facts = factsBuilder.build('skill', fingerprints);
    const decision = ruleSet.evaluate(facts);

    expect(decision.valid).toBe(true);
    expect(decision.normalizedTags).toContain('Material.Element.Fire');
    expect(decision.recipeTags).toContain('Recipe.ProductBias.Skill');
    expect(decision.dominantTags[0]).toBe('Material.Semantic.Flame');
  });

  it('应在冲突材料下返回 invalid decision', () => {
    const fingerprints: MaterialFingerprint[] = [
      {
        materialName: '赤炎精铁',
        materialType: 'ore',
        rank: '玄品',
        quantity: 1,
        explicitTags: ['Material.Type.Ore', 'Material.Element.Fire'],
        semanticTags: ['Material.Semantic.Flame'],
        recipeTags: ['Recipe.ProductBias.Skill'],
        energyValue: 8,
        rarityWeight: 2,
        element: '火',
      },
      {
        materialName: '玄冰玉髓',
        materialType: 'ore',
        rank: '玄品',
        quantity: 1,
        explicitTags: ['Material.Type.Ore', 'Material.Element.Ice'],
        semanticTags: ['Material.Semantic.Freeze'],
        recipeTags: ['Recipe.ProductBias.Skill'],
        energyValue: 8,
        rarityWeight: 2,
        element: '冰',
      },
    ];

    const facts = factsBuilder.build('skill', fingerprints);
    const decision = ruleSet.evaluate(facts);

    expect(decision.valid).toBe(false);
    expect(decision.notes).toContain('火、冰材料在首版规则中不可同炉炼制');
    expect(decision.reasons).toEqual([
      expect.objectContaining({ code: 'element-fire-ice' }),
    ]);
  });
});