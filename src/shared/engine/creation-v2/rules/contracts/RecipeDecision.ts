import { AffixRarity } from '../../types';
import { RuleDecisionMeta } from '../core';

export interface RecipeDecision extends RuleDecisionMeta {
  recipeId: string;
  valid: boolean;
  matchedTags: string[];
  unlockedAffixRarities: AffixRarity[];
  reservedEnergy?: number;
  notes: string[];
}
