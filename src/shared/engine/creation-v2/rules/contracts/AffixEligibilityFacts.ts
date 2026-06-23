import {
  AffixCandidate,
  AffixRarity,
  CreationContextTagBias,
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
  unlockedRarities: AffixRarity[];
  inputTagSignals: CreationTagSignal[];
  inputTags: string[];
  tagSignalScores: Record<string, number>;
  negativeTagBiases?: CreationContextTagBias[];
}
