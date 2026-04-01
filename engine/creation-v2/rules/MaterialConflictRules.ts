import { CreationProductType, MaterialFingerprint } from '../types';
import { ELEMENT_TO_MATERIAL_TAG } from '../config/CreationMappings';
import { CreationTags } from '../core/GameplayTags';

export interface MaterialConflict {
  id: string;
  reason: string;
  relatedTags: string[];
}

function hasTag(fingerprints: MaterialFingerprint[], tag: string): boolean {
  return fingerprints.some((fingerprint) =>
    [...fingerprint.explicitTags, ...fingerprint.semanticTags, ...fingerprint.recipeTags].includes(tag),
  );
}

export function detectMaterialConflicts(
  fingerprints: MaterialFingerprint[],
  productType: CreationProductType,
): MaterialConflict[] {
  const conflicts: MaterialConflict[] = [];

  if (
    hasTag(fingerprints, ELEMENT_TO_MATERIAL_TAG.火) &&
    hasTag(fingerprints, ELEMENT_TO_MATERIAL_TAG.冰)
  ) {
    conflicts.push({
      id: 'element-fire-ice',
      reason: '火、冰材料在首版规则中不可同炉炼制',
      relatedTags: [ELEMENT_TO_MATERIAL_TAG.火, ELEMENT_TO_MATERIAL_TAG.冰],
    });
  }

  if (
    hasTag(fingerprints, CreationTags.RECIPE.PRODUCT_BIAS_SKILL) &&
    hasTag(fingerprints, CreationTags.RECIPE.PRODUCT_BIAS_GONGFA) &&
    fingerprints.some((fingerprint) =>
      ['gongfa_manual', 'skill_manual'].includes(fingerprint.materialType),
    )
  ) {
    // 仅当同时存在 skill_manual 和 gongfa_manual 时才冲突
    // herb / ore 等材料携带 Recipe.ProductBias.Skill 是正常的，不应触发此规则
    const hasSkillManual = fingerprints.some((fp) =>
      fp.materialType === 'skill_manual',
    );
    const hasGongfaManual = fingerprints.some((fp) =>
      fp.materialType === 'gongfa_manual',
    );
    if (hasSkillManual && hasGongfaManual) {
      conflicts.push({
        id: 'manual-split-intent',
        reason: '技能秘籍与功法秘籍不可在同一次造物中混用',
        relatedTags: [
          CreationTags.RECIPE.PRODUCT_BIAS_SKILL,
          CreationTags.RECIPE.PRODUCT_BIAS_GONGFA,
        ],
      });
    }
  }

  if (
    productType === 'artifact' &&
    fingerprints.every((fingerprint) =>
      ['gongfa_manual', 'skill_manual', 'manual'].includes(fingerprint.materialType),
    )
  ) {
    conflicts.push({
      id: 'artifact-manual-only',
      reason: '纯秘籍材料无法直接炼成法宝',
      relatedTags: [CreationTags.RECIPE.PRODUCT_BIAS_ARTIFACT],
    });
  }

  return conflicts;
}