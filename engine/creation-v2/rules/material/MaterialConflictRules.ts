import { CreationTags } from '../../core/GameplayTags';
import { ELEMENT_TO_MATERIAL_TAG } from '../../config/CreationMappings';
import { CreationProductType, MaterialFingerprint } from '../../types';
import { Rule } from '../core';
import { MaterialDecision, MaterialFacts } from '../contracts';

const MANUAL_MATERIAL_TYPES = {
  SKILL: 'skill_manual',
  GONGFA: 'gongfa_manual',
  LEGACY: 'manual',
} as const;

const CONFLICT_IDS = {
  ELEMENT_FIRE_ICE: 'element-fire-ice',
  MANUAL_SPLIT_INTENT: 'manual-split-intent',
  ARTIFACT_MANUAL_ONLY: 'artifact-manual-only',
} as const;

export interface MaterialConflict {
  id: string;
  reason: string;
  relatedTags: string[];
}

function hasTag(fingerprints: MaterialFingerprint[], tag: string): boolean {
  return fingerprints.some((fingerprint) =>
    [
      ...fingerprint.explicitTags,
      ...fingerprint.semanticTags,
      ...fingerprint.recipeTags,
    ].includes(tag),
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
      id: CONFLICT_IDS.ELEMENT_FIRE_ICE,
      reason: '火、冰材料在首版规则中不可同炉炼制',
      relatedTags: [ELEMENT_TO_MATERIAL_TAG.火, ELEMENT_TO_MATERIAL_TAG.冰],
    });
  }

  if (
    hasTag(fingerprints, CreationTags.RECIPE.PRODUCT_BIAS_SKILL) &&
    hasTag(fingerprints, CreationTags.RECIPE.PRODUCT_BIAS_GONGFA) &&
    fingerprints.some((fingerprint) =>
      (
        [MANUAL_MATERIAL_TYPES.GONGFA, MANUAL_MATERIAL_TYPES.SKILL] as string[]
      ).includes(fingerprint.materialType),
    )
  ) {
    const hasSkillManual = fingerprints.some(
      (fingerprint) => fingerprint.materialType === MANUAL_MATERIAL_TYPES.SKILL,
    );
    const hasGongfaManual = fingerprints.some(
      (fingerprint) => fingerprint.materialType === MANUAL_MATERIAL_TYPES.GONGFA,
    );

    if (hasSkillManual && hasGongfaManual) {
      conflicts.push({
        id: CONFLICT_IDS.MANUAL_SPLIT_INTENT,
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
      (
        [MANUAL_MATERIAL_TYPES.GONGFA, MANUAL_MATERIAL_TYPES.SKILL, MANUAL_MATERIAL_TYPES.LEGACY] as string[]
      ).includes(fingerprint.materialType),
    )
  ) {
    conflicts.push({
      id: CONFLICT_IDS.ARTIFACT_MANUAL_ONLY,
      reason: '纯秘籍材料无法直接炼成法宝',
      relatedTags: [CreationTags.RECIPE.PRODUCT_BIAS_ARTIFACT],
    });
  }

  return conflicts;
}

export class MaterialConflictRules implements Rule<MaterialFacts, MaterialDecision> {
  readonly id = 'material.conflict';

  apply({ facts, decision, diagnostics }: Parameters<Rule<MaterialFacts, MaterialDecision>['apply']>[0]): void {
    const conflicts = detectMaterialConflicts(
      facts.fingerprints,
      facts.productType,
    );

    if (conflicts.length === 0) {
      diagnostics.addTrace({
        ruleId: this.id,
        outcome: 'applied',
        message: '未发现材料冲突',
      });
      return;
    }

    decision.valid = false;
    decision.notes.push(...conflicts.map((conflict) => conflict.reason));

    conflicts.forEach((conflict) => {
      diagnostics.addReason({
        code: conflict.id,
        message: conflict.reason,
        details: {
          relatedTags: conflict.relatedTags,
        },
      });
      diagnostics.addTrace({
        ruleId: this.id,
        outcome: 'blocked',
        message: conflict.reason,
        details: {
          conflictId: conflict.id,
        },
      });
    });
  }
}