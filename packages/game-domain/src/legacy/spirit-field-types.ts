import type { ElementType } from '@daoyou/constants/elements';
import type { Quality } from '@daoyou/constants/qualities';
import type { RealmType } from '@daoyou/constants/realms';
import type { PillFamily } from '../consumable.js';
import type {
  SpiritSeedGrowthForm,
  SpiritSeedHarvestPart,
} from '../spirit-field/types.js';
import type { CreationMaterialSemanticTag } from './tags/creationTags.js';

export const LEGACY_SPIRIT_FIELD_STAGES = [
  'germination',
  'nourishing',
  'forming',
] as const;
export type LegacySpiritFieldStage =
  (typeof LEGACY_SPIRIT_FIELD_STAGES)[number];

export const LEGACY_SPIRIT_FIELD_CULTIVATION_METHODS = [
  'seasonal_nurture',
  'qi_sprout',
  'stone_soil',
  'sun_wake',
  'shade_dew',
  'ore_soil',
  'aux_formation',
  'rest_nurture',
  'intrinsic_infusion',
  'qi_growth',
  'herb_companion',
  'monster_blood',
  'pill_nourish',
  'tcdb_return',
  'aux_gather',
  'leaf_medicine',
  'flower_fruit',
  'return_treasure',
  'natural_form',
] as const;
export type LegacySpiritFieldCultivationMethod =
  (typeof LEGACY_SPIRIT_FIELD_CULTIVATION_METHODS)[number];

/** Retained only to parse historical domain-event payloads. */
export const LEGACY_SPIRIT_FIELD_CARE_ACTIONS =
  LEGACY_SPIRIT_FIELD_CULTIVATION_METHODS;
export type LegacySpiritFieldCareAction = LegacySpiritFieldCultivationMethod;

export const LEGACY_SPIRIT_SEED_HABITAT_TAGS = [
  'mountain',
  'valley',
  'forest',
  'cave',
  'wetland',
  'waterside',
  'rocky',
  'volcanic',
  'cold',
  'warm',
  'shaded',
  'sunny',
] as const;
export type LegacySpiritSeedHabitatTag =
  (typeof LEGACY_SPIRIT_SEED_HABITAT_TAGS)[number];
export const LEGACY_SPIRIT_SEED_GROWTH_TRAITS = [
  'slow-rooting',
  'quick-sprouting',
  'qi-sensitive',
  'stone-loving',
  'companion-loving',
  'blood-fed',
  'sun-seeking',
  'dew-seeking',
] as const;
export type LegacySpiritSeedGrowthTrait =
  (typeof LEGACY_SPIRIT_SEED_GROWTH_TRAITS)[number];
export const LEGACY_SPIRIT_SEED_USE_TAGS = [
  'alchemy',
  'beast-nurturing',
  'healing',
  'qi-restoration',
  'spirit-nourishing',
  'body-tempering',
  'marrow-wash',
  'longevity',
  'breakthrough',
  'detox',
  'meridian',
  'formation',
] as const;
export type LegacySpiritSeedUseTag =
  (typeof LEGACY_SPIRIT_SEED_USE_TAGS)[number];
export const LEGACY_SPIRIT_FIELD_OUTCOME_KINDS = [
  'herb',
  'tcdb',
  'spirit_fruit',
] as const;
export type LegacySpiritFieldOutcomeKind =
  (typeof LEGACY_SPIRIT_FIELD_OUTCOME_KINDS)[number];

/** Frozen facts from the retired seed system, retained only for asset conversion. */
export interface LegacySpiritSeedIdentity {
  seedName: string;
  seedDescription: string;
  clueTexts: string[];
  element: ElementType;
  growthForm: SpiritSeedGrowthForm;
  harvestPart: SpiritSeedHarvestPart;
  preferredMethods: LegacySpiritFieldCultivationMethod[];
  avoidedMethods: LegacySpiritFieldCultivationMethod[];
  preferredHabitats: LegacySpiritSeedHabitatTag[];
  avoidedHabitats: LegacySpiritSeedHabitatTag[];
  growthTraits: LegacySpiritSeedGrowthTrait[];
  useTags: LegacySpiritSeedUseTag[];
  outcomeBiases: LegacySpiritFieldOutcomeKind[];
  creationTags: CreationMaterialSemanticTag[];
}

export interface LegacySpiritFieldPlantSnapshot extends LegacySpiritSeedIdentity {
  id: string;
  quality: Quality;
  minRealm: RealmType;
  stageDurationMs: Record<LegacySpiritFieldStage, number>;
  baseYieldMin: number;
  baseYieldMax: number;
}

export interface LegacySpiritFieldSeedSpec {
  version: 1;
  fingerprint: string;
  plant: LegacySpiritFieldPlantSnapshot;
}
export type LegacySpiritFieldStageAffinity =
  'excellent' | 'good' | 'neutral' | 'strained';
export interface LegacySpiritFieldStageHistory {
  stage: LegacySpiritFieldStage;
  method: LegacySpiritFieldCultivationMethod;
  affinity: LegacySpiritFieldStageAffinity;
  score: number;
  feedback: string;
  resourceName?: string;
  completedAt: string;
}
export interface LegacySpiritFieldPlotState {
  index: number;
  plantId: string | null;
  plant: LegacySpiritFieldPlantSnapshot | null;
  plantedAt: string | null;
  stageIndex: number;
  stageStartedAt: string | null;
  stageEndsAt: string | null;
  history: LegacySpiritFieldStageHistory[];
}
export interface LegacySpiritFieldHarvestSettlement {
  outcomeKind: LegacySpiritFieldOutcomeKind;
  quality: Quality;
  quantity: number;
  score: number;
  mutated: boolean;
  degraded: boolean;
  fruitFamily?: PillFamily;
}
