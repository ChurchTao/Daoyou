import { CreationTags } from '@/engine/shared/tag-domain';
import { CreationProductType } from '../../types';
import { Rule } from '../core';
import { RecipeDecision, RecipeFacts } from '../contracts';

export function supportsProductType(
  productType: CreationProductType,
  recipeTags: readonly string[],
): boolean {
  const recipeTagSet = new Set(recipeTags);

  switch (productType) {
    case 'artifact':
      return recipeTagSet.has(CreationTags.RECIPE.PRODUCT_BIAS_ARTIFACT);
    case 'gongfa':
      return recipeTagSet.has(CreationTags.RECIPE.PRODUCT_BIAS_GONGFA);
    case 'skill':
      return recipeTagSet.has(CreationTags.RECIPE.PRODUCT_BIAS_SKILL);
    default: {
      const _exhaustive: never = productType;
      return false;
    }
  }
}

export class ProductSupportRules implements Rule<RecipeFacts, RecipeDecision> {
  readonly id = 'recipe.product.support';

  apply({ facts, decision }: Parameters<Rule<RecipeFacts, RecipeDecision>['apply']>[0]): void {
    const supported = supportsProductType(
      facts.productType,
      facts.material.recipeTags,
    );

    if (!supported) {
      decision.valid = false;
      decision.notes.push(`当前材料组合不足以支持 ${facts.productType} 产物`);
      decision.reasons.push({
        code: 'recipe_product_unsupported',
        message: `当前材料组合不足以支持 ${facts.productType} 产物`,
        details: {
          productType: facts.productType,
          recipeTags: facts.material.recipeTags,
        },
      });
      decision.trace.push({
        ruleId: this.id,
        outcome: 'blocked',
        message: 'recipe bias 未命中当前产物类型',
      });
      return;
    }

    decision.trace.push({
      ruleId: this.id,
      outcome: 'applied',
      message: 'recipe bias 已支持当前产物类型',
    });
  }
}