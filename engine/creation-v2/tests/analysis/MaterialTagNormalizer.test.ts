import { MaterialTagNormalizer } from '@/engine/creation-v2/analysis/MaterialTagNormalizer';
import { CreationTags } from '@/engine/creation-v2/core/GameplayTags';
import { Material } from '@/types/cultivator';

describe('MaterialTagNormalizer semantic extraction', () => {
  const normalizer = new MaterialTagNormalizer();

  it('应覆盖 20 个 canonical 语义标签命中', () => {
    const material: Material = {
      id: 'mat-all-semantic',
      name: '火冰雷风锋护爆养诀魂土金水木毒圣混空时命',
      type: 'ore',
      rank: '玄品',
      quantity: 1,
      description: '全语义测试材料',
    };

    const tags = normalizer.normalizeSemanticTags(material);

    expect(tags).toEqual([
      CreationTags.MATERIAL.SEMANTIC_FLAME,
      CreationTags.MATERIAL.SEMANTIC_FREEZE,
      CreationTags.MATERIAL.SEMANTIC_THUNDER,
      CreationTags.MATERIAL.SEMANTIC_WIND,
      CreationTags.MATERIAL.SEMANTIC_BLADE,
      CreationTags.MATERIAL.SEMANTIC_GUARD,
      CreationTags.MATERIAL.SEMANTIC_BURST,
      CreationTags.MATERIAL.SEMANTIC_SUSTAIN,
      CreationTags.MATERIAL.SEMANTIC_MANUAL,
      CreationTags.MATERIAL.SEMANTIC_SPIRIT,
      CreationTags.MATERIAL.SEMANTIC_EARTH,
      CreationTags.MATERIAL.SEMANTIC_METAL,
      CreationTags.MATERIAL.SEMANTIC_WATER,
      CreationTags.MATERIAL.SEMANTIC_WOOD,
      CreationTags.MATERIAL.SEMANTIC_POISON,
      CreationTags.MATERIAL.SEMANTIC_DIVINE,
      CreationTags.MATERIAL.SEMANTIC_CHAOS,
      CreationTags.MATERIAL.SEMANTIC_SPACE,
      CreationTags.MATERIAL.SEMANTIC_TIME,
      CreationTags.MATERIAL.SEMANTIC_LIFE,
    ]);
  });
});
