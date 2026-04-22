import { MaterialFactsBuilder } from '@/engine/creation-v2/analysis/MaterialFactsBuilder';
import { MaterialRuleSet } from '@/engine/creation-v2/rules/material/MaterialRuleSet';
import { MaterialFingerprint } from '@/engine/creation-v2/types';

describe('MaterialRuleSet', () => {
  const factsBuilder = new MaterialFactsBuilder();
  const ruleSet = new MaterialRuleSet();

  it('应从材料事实中提取 dominant tags 与 recipe tags', () => {
    const fingerprints: MaterialFingerprint[] = [
      {
        materialName: '赤焰妖骨',
        materialType: 'monster',
        rank: '玄品',
        quantity: 1,
        explicitTags: ['Material.Type.Monster', 'Material.Element.Fire'],
        semanticTags: ['Material.Semantic.Flame'],
        recipeTags: ['Recipe.ProductBias.Skill', 'Recipe.ProductBias.GongFa'],
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
    expect(decision.notes).toContain('火、冰材料不可同炉炼制');
    expect(decision.reasons).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ code: 'skill-ore-forbidden' }),
        expect.objectContaining({ code: 'element-fire-ice' }),
      ]),
    );
  });

  it('应允许无秘籍的功法材料继续通过，并给出预算削减警告', () => {
    const fingerprints: MaterialFingerprint[] = [
      {
        materialName: '玄阴藤',
        materialType: 'herb',
        rank: '玄品',
        quantity: 1,
        explicitTags: ['Material.Type.Herb'],
        semanticTags: ['Material.Semantic.Shadow'],
        recipeTags: ['Recipe.ProductBias.GongFa'],
        energyValue: 8,
        rarityWeight: 2,
      },
      {
        materialName: '幽冥骨粉',
        materialType: 'aux',
        rank: '灵品',
        quantity: 1,
        explicitTags: ['Material.Type.Auxiliary'],
        semanticTags: ['Material.Semantic.Shadow'],
        recipeTags: ['Recipe.ProductBias.GongFa'],
        energyValue: 7,
        rarityWeight: 2,
      },
    ];

    const facts = factsBuilder.build('gongfa', fingerprints);
    const decision = ruleSet.evaluate(facts);

    expect(decision.valid).toBe(true);
    expect(decision.recipeTags).toContain('Recipe.ProductBias.GongFa');
    expect(decision.warnings).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ code: 'gongfa-missing-manual' }),
      ]),
    );
  });

  it('应拒绝旧版通用秘籍参与神通推演', () => {
    const fingerprints: MaterialFingerprint[] = [
      {
        materialName: '百炼器经',
        materialType: 'manual',
        rank: '玄品',
        quantity: 1,
        explicitTags: ['Material.Type.Manual'],
        semanticTags: ['Material.Semantic.Focus'],
        recipeTags: ['Recipe.ProductBias.Utility'],
        energyValue: 8,
        rarityWeight: 2,
      },
    ];

    const facts = factsBuilder.build('skill', fingerprints);
    const decision = ruleSet.evaluate(facts);

    expect(decision.valid).toBe(false);
    expect(decision.reasons).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ code: 'skill-legacy-manual-forbidden' }),
      ]),
    );
  });
});