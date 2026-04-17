import { CREATION_AFFIX_UNLOCK_THRESHOLDS } from '../../config/CreationBalance';
import { type AffixCategory } from '../../types';
import { Rule } from '../core';
import { RecipeDecision, RecipeFacts } from '../contracts';

/*
 * AffixUnlockRules: 根据材料总能量判断可解锁的词缀类别。
 * 三段阶梯：核心池(0) / 中层池(20) / 稀有池(40)。
 */
export class AffixUnlockRules implements Rule<RecipeFacts, RecipeDecision> {
  readonly id = 'recipe.affix.unlock';

  apply({ facts, decision, diagnostics }: Parameters<Rule<RecipeFacts, RecipeDecision>['apply']>[0]): void {
    const unlocked = new Set(decision.unlockedAffixCategories);
    const unlockScore = facts.material.unlockScore;

    for (const [cat, threshold] of Object.entries(CREATION_AFFIX_UNLOCK_THRESHOLDS) as [AffixCategory, number][]) {
      if (unlockScore >= threshold) {
        unlocked.add(cat);
      }
    }

    decision.unlockedAffixCategories = Array.from(unlocked);
    diagnostics.addTrace({
      ruleId: this.id,
      outcome: 'applied',
      message: '已根据 unlock score 更新可解锁词缀分类',
      details: {
        baseEnergy: facts.material.energyProfile.baseEnergy,
        effectiveEnergy: facts.material.energyProfile.effectiveEnergy,
        unlockScore,
        unlockedAffixCategories: decision.unlockedAffixCategories,
      },
    });
  }
}