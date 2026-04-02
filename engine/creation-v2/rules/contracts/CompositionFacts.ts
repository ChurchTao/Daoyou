import {
  CreationIntent,
  CreationOutcomeKind,
  CreationProductType,
  EnergyBudget,
  MaterialFingerprint,
  RecipeMatch,
  RolledAffix,
} from '../../types';
import { Quality } from '@/types/constants';

export interface CompositionFacts {
  productType: CreationProductType;
  outcomeKind: CreationOutcomeKind;
  intent: CreationIntent;
  recipeMatch: RecipeMatch;
  energyBudget: EnergyBudget;
  affixes: RolledAffix[];
  sessionTags: string[];
  materialFingerprints: MaterialFingerprint[];
  dominantQuality: Quality;
  materialNames: string[];
  /**
   * effectTemplate.type of the core affix (e.g. 'damage', 'heal', 'apply_buff').
   * Populated by buildCompositionFacts when a registry is available.
   * If absent, rules should fall back to 'damage'.
   */
  coreEffectType?: string;
}