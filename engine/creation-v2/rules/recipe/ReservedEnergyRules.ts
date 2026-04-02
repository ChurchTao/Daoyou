import { CREATION_RESERVED_ENERGY } from '../../config/CreationBalance';
import { Rule } from '../core';
import { RecipeDecision, RecipeFacts } from '../contracts';

export class ReservedEnergyRules implements Rule<RecipeFacts, RecipeDecision> {
  readonly id = 'recipe.reserved-energy';

  apply({ facts, decision, diagnostics }: Parameters<Rule<RecipeFacts, RecipeDecision>['apply']>[0]): void {
    decision.reservedEnergy = CREATION_RESERVED_ENERGY[facts.productType];

    diagnostics.addTrace({
      ruleId: this.id,
      outcome: 'applied',
      message: '已写入产物保留能量',
      details: {
        productType: facts.productType,
        reservedEnergy: decision.reservedEnergy,
      },
    });
  }
}