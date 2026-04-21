import { MaterialFactsBuilder } from '../analysis/MaterialFactsBuilder';
import {
  MaterialDecision,
  MaterialFacts,
  RecipeDecision,
  RecipeFacts,
} from './contracts';
import {
  CreationIntent,
  CreationProductType,
  MaterialFingerprint,
  RecipeMatch,
  conflictedRecipeId,
} from '../types';
import { MaterialRuleSet } from './material/MaterialRuleSet';
import { RecipeValidationRuleSet } from './recipe/RecipeValidationRuleSet';

/*
 * DefaultRecipeValidator: 配方校验门面。
 * 逻辑：先将材料指纹聚合为 MaterialFacts，交由 MaterialRuleSet 校验材料有效性；
 * 若材料不合法则返回 conflicted recipe；否则构建 RecipeFacts 并交由 RecipeValidationRuleSet 生成最终 RecipeMatch。
 */
export class DefaultRecipeValidator {
  constructor(
    private readonly materialFactsBuilder = new MaterialFactsBuilder(),
    private readonly materialRuleSet = new MaterialRuleSet(),
    private readonly recipeRuleSet = new RecipeValidationRuleSet(),
  ) {}

  validate(
    productType: CreationProductType,
    fingerprints: MaterialFingerprint[],
    intent: CreationIntent,
  ): RecipeMatch {
    const materialFacts = this.materialFactsBuilder.build(
      productType,
      fingerprints,
    );
    const materialDecision = this.materialRuleSet.evaluate(materialFacts);

    if (!materialDecision.valid) {
      return this.toConflictRecipeMatch(productType, materialFacts, materialDecision);
    }

    const recipeFacts: RecipeFacts = {
      productType,
      material: materialFacts,
      intent,
    };

    return this.toRecipeMatch(this.recipeRuleSet.evaluate(recipeFacts));
  }

  private toConflictRecipeMatch(
    productType: CreationProductType,
    materialFacts: MaterialFacts,
    decision: MaterialDecision,
  ): RecipeMatch {
    return {
      recipeId: conflictedRecipeId(productType),
      valid: false,
      matchedTags: materialFacts.dominantTags,
      unlockedAffixCategories: [],
      notes: [...decision.notes],
    };
  }

  private toRecipeMatch(decision: RecipeDecision): RecipeMatch {
    return {
      recipeId: decision.recipeId,
      valid: decision.valid,
      matchedTags: decision.matchedTags,
      unlockedAffixCategories: decision.unlockedAffixCategories,
      reservedEnergy: decision.reservedEnergy,
      notes: decision.notes,
    };
  }
}