import { Rule } from '../core';
import { RecipeDecision, RecipeFacts } from '../contracts';

/*
 * AffixUnlockRules: recipe 阶段只保留默认 common。
 * 预算相关的 rarity 解锁在 affix pool 阶段根据 EnergyBudget.effectiveTotal 计算。
 */
export class AffixUnlockRules implements Rule<RecipeFacts, RecipeDecision> {
  readonly id = 'recipe.affix.unlock';

  apply({ facts, decision }: Parameters<Rule<RecipeFacts, RecipeDecision>['apply']>[0]): void {
    decision.unlockedAffixRarities = Array.from(
      new Set([...decision.unlockedAffixRarities, 'common']),
    );
    decision.trace.push({
      ruleId: this.id,
      outcome: 'applied',
      message: 'recipe 阶段保留默认 common 词缀稀有度',
      details: {
        baseEnergy: facts.material.energyProfile.baseEnergy,
        effectiveEnergy: facts.material.energyProfile.effectiveEnergy,
        unlockedAffixRarities: decision.unlockedAffixRarities,
      },
    });
  }
}
