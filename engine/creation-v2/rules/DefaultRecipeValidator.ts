import { CreationIntent, CreationProductType, MaterialFingerprint, RecipeMatch } from '../types';
import {
  CREATION_AFFIX_UNLOCK_THRESHOLDS,
  CREATION_RESERVED_ENERGY,
} from '../config/CreationBalance';
import { CreationTags } from '../core/GameplayTags';
import { detectMaterialConflicts } from './MaterialConflictRules';

export class DefaultRecipeValidator {
  validate(
    productType: CreationProductType,
    fingerprints: MaterialFingerprint[],
    intent: CreationIntent,
  ): RecipeMatch {
    const conflicts = detectMaterialConflicts(fingerprints, productType);
    if (conflicts.length > 0) {
      return {
        recipeId: `${productType}-conflicted`,
        valid: false,
        matchedTags: [],
        unlockedAffixCategories: [],
        notes: conflicts.map((conflict) => conflict.reason),
      };
    }

    const recipeTags = new Set(fingerprints.flatMap((fingerprint) => fingerprint.recipeTags));
    const totalEnergy = fingerprints.reduce(
      (sum, fingerprint) => sum + fingerprint.energyValue,
      0,
    );

    const valid = this.supportsProductType(productType, recipeTags);
    const unlockedAffixCategories = ['core'] as RecipeMatch['unlockedAffixCategories'];

    if (totalEnergy >= CREATION_AFFIX_UNLOCK_THRESHOLDS.prefix) {
      unlockedAffixCategories.push('prefix');
    }
    if (totalEnergy >= CREATION_AFFIX_UNLOCK_THRESHOLDS.suffix) {
      unlockedAffixCategories.push('suffix');
    }
    if (totalEnergy >= CREATION_AFFIX_UNLOCK_THRESHOLDS.signature) {
      unlockedAffixCategories.push('signature');
    }

    return {
      recipeId: `${productType}-default`,
      valid,
      matchedTags: [...intent.dominantTags, ...(intent.elementBias ? [`Element.${intent.elementBias}`] : [])],
      unlockedAffixCategories,
      reservedEnergy: CREATION_RESERVED_ENERGY[productType],
      notes: valid ? [] : [`当前材料组合不足以支持 ${productType} 产物`],
    };
  }

  private supportsProductType(
    productType: CreationProductType,
    recipeTags: Set<string>,
  ): boolean {
    if (productType === 'artifact') {
      return recipeTags.has(CreationTags.RECIPE.PRODUCT_BIAS_ARTIFACT);
    }

    if (productType === 'gongfa') {
      return recipeTags.has(CreationTags.RECIPE.PRODUCT_BIAS_GONGFA);
    }

    return recipeTags.has(CreationTags.RECIPE.PRODUCT_BIAS_SKILL);
  }
}