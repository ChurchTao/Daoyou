import {
  AffixCandidate,
  AffixCategory,
  CreationProductType,
  EnergyBudget,
  RecipeMatch,
} from '../../types';

export interface AffixEligibilityFacts {
  productType: CreationProductType;
  recipeMatch: RecipeMatch;
  energyBudget: EnergyBudget;
  candidatePool: AffixCandidate[];
  allowedCategories: AffixCategory[];
  sessionTags: string[];
  maxQualityOrder: number;
}