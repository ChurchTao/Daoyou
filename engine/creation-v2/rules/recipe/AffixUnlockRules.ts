import { CREATION_AFFIX_UNLOCK_THRESHOLDS } from '../../config/CreationBalance';
import { AFFIX_CATEGORIES } from '../../types';
import { Rule } from '../core';
import { RecipeDecision, RecipeFacts } from '../contracts';

/*
 * AffixUnlockRules: 根据材料总能量判断可解锁的词缀类别
 * （prefix/suffix/resonance/signature/synergy/mythic）。
 */
export class AffixUnlockRules implements Rule<RecipeFacts, RecipeDecision> {
  readonly id = 'recipe.affix.unlock';

  apply({ facts, decision, diagnostics }: Parameters<Rule<RecipeFacts, RecipeDecision>['apply']>[0]): void {
    const unlocked = new Set(decision.unlockedAffixCategories);
    const unlockScore = facts.material.unlockScore;

    if (unlockScore >= CREATION_AFFIX_UNLOCK_THRESHOLDS.prefix) {
      unlocked.add(AFFIX_CATEGORIES.PREFIX);
    }

    if (unlockScore >= CREATION_AFFIX_UNLOCK_THRESHOLDS.suffix) {
      unlocked.add(AFFIX_CATEGORIES.SUFFIX);
    }

    if (unlockScore >= CREATION_AFFIX_UNLOCK_THRESHOLDS.resonance) {
      unlocked.add(AFFIX_CATEGORIES.RESONANCE);
    }

    if (unlockScore >= CREATION_AFFIX_UNLOCK_THRESHOLDS.signature) {
      unlocked.add(AFFIX_CATEGORIES.SIGNATURE);
    }

    if (unlockScore >= CREATION_AFFIX_UNLOCK_THRESHOLDS.synergy) {
      unlocked.add(AFFIX_CATEGORIES.SYNERGY);
    }

    if (unlockScore >= CREATION_AFFIX_UNLOCK_THRESHOLDS.mythic) {
      unlocked.add(AFFIX_CATEGORIES.MYTHIC);
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