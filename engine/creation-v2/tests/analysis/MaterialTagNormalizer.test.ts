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

  it('应按 V2 公式计算普通材料能量（品质权重 * sqrt(数量)）', () => {
    const material: Material = {
      id: 'mat-energy-v2-normal',
      name: '试炼铁',
      type: 'ore',
      rank: '玄品',
      quantity: 3,
    };

    // 玄品 qualityWeight=6, sqrt(3)=1.732... => round(10.392)=10
    expect(normalizer.calculateEnergyValue(material)).toBe(10);
  });

  it('应为专属秘籍附加类型奖励', () => {
    const material: Material = {
      id: 'mat-energy-v2-manual',
      name: '天阶秘卷',
      type: 'skill_manual',
      rank: '天品',
      quantity: 1,
    };

    // 天品 qualityWeight=10, sqrt(1)=1, specialized bonus=3 => 13
    expect(normalizer.calculateEnergyValue(material)).toBe(13);
  });
});
