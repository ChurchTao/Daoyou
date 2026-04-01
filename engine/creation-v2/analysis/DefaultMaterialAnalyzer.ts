import { Material } from '@/types/cultivator';
import { MaterialFingerprint } from '../types';
import { MaterialTagNormalizer } from './MaterialTagNormalizer';

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