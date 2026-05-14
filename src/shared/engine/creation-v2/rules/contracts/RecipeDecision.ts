import { AffixCategory } from '../../types';
import { RuleDecisionMeta } from '../core';

export interface RecipeDecision extends RuleDecisionMeta {
  recipeId: string;
  valid: boolean;
  matchedTags: string[];
  unlockedAffixCategories: AffixCategory[];
  reservedEnergy?: number;
  notes: string[];
}