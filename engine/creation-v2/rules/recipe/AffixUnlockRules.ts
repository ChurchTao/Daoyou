import { CREATION_AFFIX_UNLOCK_THRESHOLDS } from '../../config/CreationBalance';
import { AFFIX_CATEGORIES } from '../../types';
import { Rule } from '../core';
import { RecipeDecision, RecipeFacts } from '../contracts';

/*
 * AffixUnlockRules: 根据材料总能量判断可解锁的词缀类别（prefix/suffix/signature）。
 */
export class AffixUnlockRules implements Rule<RecipeFacts, RecipeDecision> {
  readonly id = 'recipe.affix.unlock';

  apply({ facts, decision, diagnostics }: Parameters<Rule<RecipeFacts, RecipeDecision>['apply']>[0]): void {
    const unlocked = new Set(decision.unlockedAffixCategories);
    const totalEnergy = facts.material.totalEnergy;

    if (totalEnergy >= CREATION_AFFIX_UNLOCK_THRESHOLDS.prefix) {
      unlocked.add(AFFIX_CATEGORIES.PREFIX);
    }

    if (totalEnergy >= CREATION_AFFIX_UNLOCK_THRESHOLDS.suffix) {
      unlocked.add(AFFIX_CATEGORIES.SUFFIX);
    }

    if (totalEnergy >= CREATION_AFFIX_UNLOCK_THRESHOLDS.signature) {
      unlocked.add(AFFIX_CATEGORIES.SIGNATURE);
    }

    decision.unlockedAffixCategories = Array.from(unlocked);
    diagnostics.addTrace({
      ruleId: this.id,
      outcome: 'applied',
      message: '已根据能量阈值更新可解锁词缀分类',
      details: {
        totalEnergy,
        unlockedAffixCategories: decision.unlockedAffixCategories,
      },
    });
  }
}