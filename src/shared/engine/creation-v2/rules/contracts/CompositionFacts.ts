import {
  CreationIntent,
  CreationProductType,
  MaterialFingerprint,
  RecipeMatch,
  RolledAffix,
} from '../../types';
import { RealmStage, RealmType } from '@shared/types/constants';
import type { ProjectionQualityProfile } from '../../analysis/ProjectionQualityProfile';

export interface CompositionEnergySummary {
  effectiveTotal: number;
  reserved: number;
  startingAffixEnergy: number;
  spentAffixEnergy: number;
  remainingAffixEnergy: number;
}

export interface CompositionFacts {
  productType: CreationProductType;
  intent: CreationIntent;
  recipeMatch: RecipeMatch;
  energySummary: CompositionEnergySummary;
  /** 数值投影品质（权威来源）：用于词条数值、蓝耗/冷却、展示品质等。 */
  projectionQualityProfile: ProjectionQualityProfile;
  affixes: RolledAffix[];
  inputTags: string[];
  materialFingerprints: MaterialFingerprint[];
  materialNames: string[];
  /**
   * effectTemplate.type of the core affix (e.g. 'damage', 'heal', 'apply_buff').
   * Populated by buildCompositionFacts when a registry is available.
   * If absent, rules should fall back to 'damage'.
   */
  coreEffectType?: string;
  anchorRealm?: RealmType;
  anchorRealmStage?: RealmStage;
}