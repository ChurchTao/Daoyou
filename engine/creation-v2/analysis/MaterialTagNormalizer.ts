/*
 * MaterialTagNormalizer: 材料标签规范化工具。
 * 责任：从原始 Material 文本与元数据中提取 explicit/semantic/recipe 标签，并计算能量值与稀有度权重。
 */
import { QUALITY_ORDER } from '@/types/constants';
import { Material } from '@/types/cultivator';
import { CREATION_MATERIAL_ENERGY } from '../config/CreationBalance';
import { ELEMENT_TO_MATERIAL_TAG } from '../config/CreationMappings';
import { CreationTags } from '../core/GameplayTags';

const TYPE_TAGS: Record<Material['type'], string> = {
  herb: CreationTags.MATERIAL.TYPE_HERB,
  ore: CreationTags.MATERIAL.TYPE_ORE,
  monster: CreationTags.MATERIAL.TYPE_MONSTER,
  tcdb: CreationTags.MATERIAL.TYPE_SPECIAL,
  aux: CreationTags.MATERIAL.TYPE_AUXILIARY,
  gongfa_manual: CreationTags.MATERIAL.TYPE_MANUAL,
  skill_manual: CreationTags.MATERIAL.TYPE_MANUAL,
  manual: CreationTags.MATERIAL.TYPE_MANUAL,
};

const SEMANTIC_PATTERNS: Array<{ tag: string; pattern: RegExp }> = [
  { tag: CreationTags.MATERIAL.SEMANTIC_FLAME, pattern: /火|炎|焰|灼|赤炎/u },
  { tag: CreationTags.MATERIAL.SEMANTIC_FREEZE, pattern: /冰|寒|霜|冻/u },
  { tag: CreationTags.MATERIAL.SEMANTIC_THUNDER, pattern: /雷|霆|电/u },
  { tag: CreationTags.MATERIAL.SEMANTIC_WIND, pattern: /风|岚/u },
  { tag: CreationTags.MATERIAL.SEMANTIC_BLADE, pattern: /锋|刃|剑|枪|铁/u },
  { tag: CreationTags.MATERIAL.SEMANTIC_GUARD, pattern: /守|护|甲|盾/u },
  { tag: CreationTags.MATERIAL.SEMANTIC_BURST, pattern: /爆|烈|怒|狂/u },
  { tag: CreationTags.MATERIAL.SEMANTIC_SUSTAIN, pattern: /生|息|养|愈/u },
  { tag: CreationTags.MATERIAL.SEMANTIC_MANUAL, pattern: /诀|经|录|卷/u },
  { tag: CreationTags.MATERIAL.SEMANTIC_SPIRIT, pattern: /魂|魄|灵/u },
];

export class MaterialTagNormalizer {
  normalizeExplicitTags(material: Material): string[] {
    const tags = new Set<string>();

    tags.add(TYPE_TAGS[material.type]);
    tags.add(`${CreationTags.MATERIAL.QUALITY}.${material.rank}`);

    if (material.element) {
      tags.add(ELEMENT_TO_MATERIAL_TAG[material.element]);
    }

    return Array.from(tags);
  }

  normalizeSemanticTags(material: Material): string[] {
    const sourceText = `${material.name} ${material.description ?? ''}`;

    return SEMANTIC_PATTERNS.filter(({ pattern }) => pattern.test(sourceText)).map(
      ({ tag }) => tag,
    );
  }

  normalizeRecipeTags(material: Material): string[] {
    const tags = new Set<string>();

    switch (material.type) {
      case 'ore':
        tags.add(CreationTags.RECIPE.PRODUCT_BIAS_ARTIFACT);
        tags.add(CreationTags.RECIPE.PRODUCT_BIAS_SKILL);
        break;
      case 'monster':
        tags.add(CreationTags.RECIPE.PRODUCT_BIAS_ARTIFACT);
        tags.add(CreationTags.RECIPE.PRODUCT_BIAS_SKILL);
        break;
      case 'herb':
        tags.add(CreationTags.RECIPE.PRODUCT_BIAS_SKILL);
        break;
      case 'gongfa_manual':
        tags.add(CreationTags.RECIPE.PRODUCT_BIAS_GONGFA);
        break;
      case 'skill_manual':
        tags.add(CreationTags.RECIPE.PRODUCT_BIAS_SKILL);
        break;
      case 'manual':
        tags.add(CreationTags.RECIPE.PRODUCT_BIAS_SKILL);
        tags.add(CreationTags.RECIPE.PRODUCT_BIAS_GONGFA);
        break;
      default:
        tags.add(CreationTags.RECIPE.PRODUCT_BIAS_UTILITY);
        break;
    }

    if ((material.description ?? '').includes('护')) {
      tags.add(CreationTags.RECIPE.INTENT_DEFENSIVE);
    }

    return Array.from(tags);
  }

  calculateEnergyValue(material: Material): number {
    const qualityFactor = QUALITY_ORDER[material.rank] + 1;
    const typeBonus =
      material.type === 'gongfa_manual' || material.type === 'skill_manual'
        ? CREATION_MATERIAL_ENERGY.specializedManualBonus
        : material.type === 'manual'
          ? CREATION_MATERIAL_ENERGY.manualBonus
          : 0;

    return (
      qualityFactor *
        material.quantity *
        CREATION_MATERIAL_ENERGY.quantityFactor +
      typeBonus
    );
  }

  calculateRarityWeight(material: Material): number {
    return QUALITY_ORDER[material.rank] + 1;
  }
}