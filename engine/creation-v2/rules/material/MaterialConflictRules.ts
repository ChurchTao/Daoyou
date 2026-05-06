import { Material } from '@/types/cultivator';
import { CreationTags } from '@/engine/shared/tag-domain';
import { isMaterialTypeAllowedForProduct } from '../../config/CreationCraftPolicy';
import { ELEMENT_TO_MATERIAL_TAG } from '../../config/CreationMappings';
import { CreationProductType, MaterialFingerprint } from '../../types';
import { Rule } from '../core';
import { MaterialDecision, MaterialFacts } from '../contracts';

// Using Material['type'] directly ensures this stays in sync with the canonical type.
// If the type enum changes, TypeScript will report a compile error here.
type SpecializedManualMaterialType = Extract<
  Material['type'],
  'skill_manual' | 'gongfa_manual'
>;

const SPECIALIZED_MANUAL_MATERIAL_TYPES: Record<
  string,
  SpecializedManualMaterialType
> = {
  SKILL: 'skill_manual',
  GONGFA: 'gongfa_manual',
} as const;

const CONFLICT_IDS = {
  ELEMENT_FIRE_ICE: 'element-fire-ice',
  MANUAL_SPLIT_INTENT: 'manual-split-intent',
  ARTIFACT_HERB_FORBIDDEN: 'artifact-herb-forbidden',
  ARTIFACT_MANUAL_FORBIDDEN: 'artifact-manual-forbidden',
  SKILL_ORE_FORBIDDEN: 'skill-ore-forbidden',
  SKILL_GONGFA_MANUAL_FORBIDDEN: 'skill-gongfa-manual-forbidden',
  GONGFA_ORE_FORBIDDEN: 'gongfa-ore-forbidden',
  GONGFA_SKILL_MANUAL_FORBIDDEN: 'gongfa-skill-manual-forbidden',
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

function buildForbiddenTypeConflict(
  productType: CreationProductType,
  materialType: Material['type'],
): MaterialConflict | null {
  if (productType === 'artifact') {
    if (materialType === 'herb') {
      return {
        id: CONFLICT_IDS.ARTIFACT_HERB_FORBIDDEN,
        reason: '灵药不可用于炼制法宝',
        relatedTags: [CreationTags.MATERIAL.TYPE_HERB],
      };
    }

    if (
      materialType === SPECIALIZED_MANUAL_MATERIAL_TYPES.GONGFA ||
      materialType === SPECIALIZED_MANUAL_MATERIAL_TYPES.SKILL
    ) {
      return {
        id: CONFLICT_IDS.ARTIFACT_MANUAL_FORBIDDEN,
        reason: '功法、神通秘籍不可用于炼制法宝',
        relatedTags: [CreationTags.MATERIAL.TYPE_MANUAL],
      };
    }

  }

  if (productType === 'skill') {
    if (materialType === 'ore') {
      return {
        id: CONFLICT_IDS.SKILL_ORE_FORBIDDEN,
        reason: '矿石不可直接用于推演神通',
        relatedTags: [CreationTags.MATERIAL.TYPE_ORE],
      };
    }

    if (materialType === SPECIALIZED_MANUAL_MATERIAL_TYPES.GONGFA) {
      return {
        id: CONFLICT_IDS.SKILL_GONGFA_MANUAL_FORBIDDEN,
        reason: '功法秘籍不可用于推演神通',
        relatedTags: [CreationTags.MATERIAL.TYPE_GONGFA_MANUAL],
      };
    }

  }

  if (productType === 'gongfa') {
    if (materialType === 'ore') {
      return {
        id: CONFLICT_IDS.GONGFA_ORE_FORBIDDEN,
        reason: '矿石不可直接用于参悟功法',
        relatedTags: [CreationTags.MATERIAL.TYPE_ORE],
      };
    }

    if (materialType === SPECIALIZED_MANUAL_MATERIAL_TYPES.SKILL) {
      return {
        id: CONFLICT_IDS.GONGFA_SKILL_MANUAL_FORBIDDEN,
        reason: '神通秘籍不可用于参悟功法',
        relatedTags: [CreationTags.MATERIAL.TYPE_SKILL_MANUAL],
      };
    }

  }

  return null;
}

function collectForbiddenTypeConflicts(
  fingerprints: MaterialFingerprint[],
  productType: CreationProductType,
): MaterialConflict[] {
  const conflictsById = new Map<string, MaterialConflict>();
  const presentTypes = new Set(
    fingerprints.map((fingerprint) => fingerprint.materialType),
  );

  for (const materialType of presentTypes) {
    if (isMaterialTypeAllowedForProduct(productType, materialType)) {
      continue;
    }

    const conflict = buildForbiddenTypeConflict(productType, materialType);
    if (conflict) {
      conflictsById.set(conflict.id, conflict);
    }
  }

  return Array.from(conflictsById.values());
}

/*
 * MaterialConflictRules: 检测材料之间的冲突（如元素互斥、手工材料意图分裂等），并将冲突信息记录到 decision.notes/valid=false。
 */
export function detectMaterialConflicts(
  fingerprints: MaterialFingerprint[],
  productType: CreationProductType,
): MaterialConflict[] {
  const conflicts = collectForbiddenTypeConflicts(fingerprints, productType);

  if (
    hasTag(fingerprints, ELEMENT_TO_MATERIAL_TAG.火) &&
    hasTag(fingerprints, ELEMENT_TO_MATERIAL_TAG.冰)
  ) {
    conflicts.push({
      id: CONFLICT_IDS.ELEMENT_FIRE_ICE,
      reason: '火、冰材料不可同炉炼制',
      relatedTags: [ELEMENT_TO_MATERIAL_TAG.火, ELEMENT_TO_MATERIAL_TAG.冰],
    });
  }

  if (
    hasTag(fingerprints, CreationTags.RECIPE.PRODUCT_BIAS_SKILL) &&
    hasTag(fingerprints, CreationTags.RECIPE.PRODUCT_BIAS_GONGFA) &&
    fingerprints.some((fingerprint) =>
      fingerprint.materialType === SPECIALIZED_MANUAL_MATERIAL_TYPES.GONGFA ||
      fingerprint.materialType === SPECIALIZED_MANUAL_MATERIAL_TYPES.SKILL,
    )
  ) {
    const hasSkillManual = fingerprints.some(
      (fingerprint) =>
        fingerprint.materialType === SPECIALIZED_MANUAL_MATERIAL_TYPES.SKILL,
    );
    const hasGongfaManual = fingerprints.some(
      (fingerprint) =>
        fingerprint.materialType === SPECIALIZED_MANUAL_MATERIAL_TYPES.GONGFA,
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

  return conflicts;
}

export class MaterialConflictRules implements Rule<MaterialFacts, MaterialDecision> {
  readonly id = 'material.conflict';

  apply({ facts, decision }: Parameters<Rule<MaterialFacts, MaterialDecision>['apply']>[0]): void {
    const conflicts = detectMaterialConflicts(
      facts.fingerprints,
      facts.productType,
    );

    if (conflicts.length === 0) {
      decision.trace.push({
        ruleId: this.id,
        outcome: 'applied',
        message: '未发现材料冲突',
      });
      return;
    }

    decision.valid = false;
    decision.notes.push(...conflicts.map((conflict) => conflict.reason));

    conflicts.forEach((conflict) => {
      decision.reasons.push({
        code: conflict.id,
        message: conflict.reason,
        details: {
          relatedTags: conflict.relatedTags,
        },
      });
      decision.trace.push({
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
