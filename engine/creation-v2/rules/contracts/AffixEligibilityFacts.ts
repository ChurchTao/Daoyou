import {
  AffixCandidate,
  AffixCategory,
  CreationTagSignal,
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
  inputTagSignals: CreationTagSignal[];
  inputTags: string[];
  tagSignalScores: Record<string, number>;
  maxQualityOrder: number;
}