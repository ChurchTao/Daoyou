import { Material } from '@/types/cultivator';
import { MaterialFingerprint } from '../types';
import { MaterialTagNormalizer } from './MaterialTagNormalizer';

/*
 * DefaultMaterialAnalyzer: 同步材料分析实现（不依赖 LLM）。
 * 职责：从输入的 Material 列表提取指纹（MaterialFingerprint），包括显式标签、语义标签（基于规则）、配方标签、能量值等。
 * 注意：更复杂的语义增强由 AsyncMaterialAnalyzer 提供。
 */
export class DefaultMaterialAnalyzer {
  constructor(private readonly normalizer = new MaterialTagNormalizer()) {}

  analyze(materials: Material[]): MaterialFingerprint[] {
    return materials.map((material) => ({
      materialId: material.id,
      materialName: material.name,
      materialType: material.type,
      rank: material.rank,
      quantity: material.quantity,
      explicitTags: this.normalizer.normalizeExplicitTags(material),
      semanticTags: this.normalizer.normalizeSemanticTags(material),
      recipeTags: this.normalizer.normalizeRecipeTags(material),
      energyValue: this.normalizer.calculateEnergyValue(material),
      rarityWeight: this.normalizer.calculateRarityWeight(material),
      element: material.element,
      metadata: {
        description: material.description,
      },
    }));
  }
}