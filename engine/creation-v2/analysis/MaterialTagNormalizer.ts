/*
 * MaterialTagNormalizer: 材料标签规范化工具。
 * 责任：从原始 Material 文本与元数据中提取 explicit/semantic/recipe 标签，并计算能量值与稀有度权重。
 */
import { QUALITY_ORDER } from '@/types/constants';
import { Material } from '@/types/cultivator';
import { CREATION_MATERIAL_ENERGY } from '../config/CreationBalance';
import { getAllowedMaterialTypesForProduct } from '../config/CreationCraftPolicy';
import { ELEMENT_TO_MATERIAL_TAG } from '../config/CreationMappings';
import { CreationTags } from '@/engine/shared/tag-domain';
import { CreationProductType } from '../types';
import { extractSemanticTagsFromText } from './SemanticTagAllowlist';

const TYPE_TAGS: Record<Material['type'], string> = {
  herb: CreationTags.MATERIAL.TYPE_HERB,
  ore: CreationTags.MATERIAL.TYPE_ORE,
  monster: CreationTags.MATERIAL.TYPE_MONSTER,
  tcdb: CreationTags.MATERIAL.TYPE_SPECIAL,
  aux: CreationTags.MATERIAL.TYPE_AUXILIARY,
  gongfa_manual: CreationTags.MATERIAL.TYPE_GONGFA_MANUAL,
  skill_manual: CreationTags.MATERIAL.TYPE_SKILL_MANUAL,
  manual: CreationTags.MATERIAL.TYPE_MANUAL,
};

const RECIPE_BIAS_TAG_BY_PRODUCT: Record<CreationProductType, string> = {
  artifact: CreationTags.RECIPE.PRODUCT_BIAS_ARTIFACT,
  skill: CreationTags.RECIPE.PRODUCT_BIAS_SKILL,
  gongfa: CreationTags.RECIPE.PRODUCT_BIAS_GONGFA,
};

export class MaterialTagNormalizer {
  normalizeExplicitTags(material: Material): string[] {
    const tags = new Set<string>();

    tags.add(TYPE_TAGS[material.type]);

    // Keep parent tag for manual-family materials to preserve existing aggregated rules.
    if (material.type === 'gongfa_manual' || material.type === 'skill_manual') {
      tags.add(CreationTags.MATERIAL.TYPE_MANUAL);
    }

    tags.add(`${CreationTags.MATERIAL.QUALITY}.${material.rank}`);

    if (material.element) {
      tags.add(ELEMENT_TO_MATERIAL_TAG[material.element]);
    }

    return Array.from(tags);
  }

  normalizeSemanticTags(material: Material): string[] {
    const sourceText = `${material.name} ${material.description ?? ''}`;
    return extractSemanticTagsFromText(sourceText);
  }

  normalizeRecipeTags(material: Material): string[] {
    const tags = new Set<string>();

    (Object.entries(RECIPE_BIAS_TAG_BY_PRODUCT) as Array<
      [CreationProductType, string]
    >).forEach(([productType, recipeBiasTag]) => {
      if (getAllowedMaterialTypesForProduct(productType).includes(material.type)) {
        tags.add(recipeBiasTag);
      }
    });

    if (tags.size === 0) {
      tags.add(CreationTags.RECIPE.PRODUCT_BIAS_UTILITY);
    }

    return Array.from(tags);
  }

  calculateEnergyValue(material: Material): number {
    const qualityOrder = QUALITY_ORDER[material.rank];
    const qualityWeight =
      CREATION_MATERIAL_ENERGY.qualityWeights[qualityOrder] ??
      CREATION_MATERIAL_ENERGY.qualityWeights[0];
    const typeBonus =
      material.type === 'gongfa_manual' || material.type === 'skill_manual'
        ? CREATION_MATERIAL_ENERGY.specializedManualBonus
        : material.type === 'manual'
          ? CREATION_MATERIAL_ENERGY.manualBonus
          : 0;

    const quantityTerm = Math.sqrt(material.quantity);
    return Math.round(qualityWeight * quantityTerm + typeBonus);
  }

  calculateRarityWeight(material: Material): number {
    return QUALITY_ORDER[material.rank] + 1;
  }
}