import { CreationTags } from '../../core/GameplayTags';
import { ELEMENT_TAG_TOKENS } from '../../config/CreationMappings';
import { AFFIX_CATEGORIES, CREATION_PHASES, defaultRecipeId } from '../../types';
import { RecipeDecision, RecipeFacts } from '../contracts';
import { RuleSet } from '../core';
import { AffixUnlockRules } from './AffixUnlockRules';
import { ProductSupportRules } from './ProductSupportRules';
import { ReservedEnergyRules } from './ReservedEnergyRules';

export class RecipeValidationRuleSet {
  private readonly ruleSet = new RuleSet<RecipeFacts, RecipeDecision>(
    [
      new ProductSupportRules(),
      new AffixUnlockRules(),
      new ReservedEnergyRules(),
    ],
    (facts) => ({
      recipeId: defaultRecipeId(facts.productType),
      valid: true,
      matchedTags: this.buildMatchedTags(facts),
      unlockedAffixCategories: [AFFIX_CATEGORIES.CORE],
      reservedEnergy: undefined,
      notes: [],
      reasons: [],
      warnings: [],
      trace: [],
    }),
  );

  evaluate(facts: RecipeFacts): RecipeDecision {
    return this.ruleSet.evaluate(facts, {
      metadata: {
        phase: CREATION_PHASES.RECIPE_VALIDATION,
      },
    });
  }

  private buildMatchedTags(facts: RecipeFacts): string[] {
    const matchedTags = [...facts.intent.dominantTags];

    if (facts.intent.elementBias) {
      const token = ELEMENT_TAG_TOKENS[facts.intent.elementBias];
      if (token) {
        matchedTags.push(`${CreationTags.MATERIAL.ELEMENT}.${token}`);
      }
    }

    return Array.from(new Set(matchedTags));
  }
}