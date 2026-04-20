import {
  CreationIntent,
  CreationOutcomeKind,
  CreationProductType,
  MaterialFingerprint,
  MaterialQualityProfile,
  RecipeMatch,
  RolledAffix,
} from '../../types';

export interface CompositionEnergySummary {
  effectiveTotal: number;
  reserved: number;
  startingAffixEnergy: number;
  spentAffixEnergy: number;
  remainingAffixEnergy: number;
}

export interface CompositionFacts {
  productType: CreationProductType;
  outcomeKind: CreationOutcomeKind;
  intent: CreationIntent;
  recipeMatch: RecipeMatch;
  energySummary: CompositionEnergySummary;
  affixes: RolledAffix[];
  inputTags: string[];
  materialFingerprints: MaterialFingerprint[];
  materialQualityProfile: MaterialQualityProfile;
  materialNames: string[];
  /**
   * effectTemplate.type of the core affix (e.g. 'damage', 'heal', 'apply_buff').
   * Populated by buildCompositionFacts when a registry is available.
   * If absent, rules should fall back to 'damage'.
   */
  coreEffectType?: string;
}