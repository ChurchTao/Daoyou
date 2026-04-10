import { CreationTags } from '@/engine/shared/tag-domain';
import { ELEMENT_TAG_TOKENS } from '../../config/CreationMappings';
import { AFFIX_CATEGORIES, CREATION_PHASES, defaultRecipeId } from '../../types';
import { RecipeDecision, RecipeFacts } from '../contracts';
import { RuleSet } from '../core';
import { AffixUnlockRules } from './AffixUnlockRules';
import { ProductSupportRules } from './ProductSupportRules';
import { ReservedEnergyRules } from './ReservedEnergyRules';

/*
 * RecipeValidationRuleSet: 配方校验规则集合门面。
 * 包含 ProductSupport / AffixUnlock / ReservedEnergy 等规则，负责输出 RecipeDecision（包括解锁词缀分类与保留能量）。
 */
export class RecipeValidationRuleSet {
  // intentional: all rules run even when valid=false — callers may want to inspect
  // unlocked affix categories and reserved energy even for invalid recipes (e.g., to
  // display "what would happen if the recipe were valid" in the UI).
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