import { MaterialFactsBuilder } from '@/engine/creation-v2/analysis/MaterialFactsBuilder';
import { MaterialFingerprint } from '@/engine/creation-v2/types';

describe('MaterialFactsBuilder', () => {
  const builder = new MaterialFactsBuilder();

  it('材料语义应优先于用户请求标签，但请求标签仍可保留在 dominantTags 中', () => {
    const fingerprints: MaterialFingerprint[] = Array.from({ length: 5 }).map(
      (_, index) => ({
        materialName: `赤炎材料-${index}`,
        materialType: index % 2 === 0 ? 'ore' : 'monster',
        rank: '玄品',
        quantity: 1,
        explicitTags: ['Material.Type.Ore'],
        semanticTags: ['Material.Semantic.Flame'],
        recipeTags: ['Recipe.ProductBias.Skill'],
        energyValue: 6,
        rarityWeight: 2,
        element: '火',
      }),
    );

    const facts = builder.build('skill', fingerprints, ['Material.Semantic.Burst']);

    expect(facts.dominantTags[0]).toBe('Material.Semantic.Flame');
    expect(facts.dominantTags).toContain('Material.Semantic.Burst');
  });

  it('多材料 spread 投入时 unlock score 应低于 spendable energy', () => {
    const fingerprints: MaterialFingerprint[] = [
      {
        materialName: '主材',
        materialType: 'ore',
        rank: '地品',
        quantity: 2,
        explicitTags: ['Material.Type.Ore'],
        semanticTags: ['Material.Semantic.Blade'],
        recipeTags: ['Recipe.ProductBias.Skill'],
        energyValue: 11,
        rarityWeight: 4,
      },
      {
        materialName: '辅材一',
        materialType: 'monster',
        rank: '玄品',
        quantity: 2,
        explicitTags: ['Material.Type.Monster'],
        semanticTags: ['Material.Semantic.Blade'],
        recipeTags: ['Recipe.ProductBias.Skill'],
        energyValue: 8,
        rarityWeight: 2,
      },
      {
        materialName: '辅材二',
        materialType: 'herb',
        rank: '玄品',
        quantity: 1,
        explicitTags: ['Material.Type.Herb'],
        semanticTags: ['Material.Semantic.Spirit'],
        recipeTags: ['Recipe.ProductBias.Skill'],
        energyValue: 6,
        rarityWeight: 2,
      },
    ];

    const facts = builder.build('skill', fingerprints, []);

    expect(facts.energyProfile.effectiveEnergy).toBe(31);
    expect(facts.unlockScore).toBe(27);
    expect(facts.unlockScore).toBeLessThan(facts.energyProfile.effectiveEnergy);
  });
});