import type { ElementType } from '@daoyou/constants/elements';
import type { Quality } from '@daoyou/constants/qualities';
import type { RealmType } from '@daoyou/constants/realms';
import type {
  LegacySpiritFieldPlantSnapshot,
  LegacySpiritFieldSeedSpec,
} from '../legacy/spirit-field-types.js';

export const SPIRIT_SEED_GROWTH_FORMS = [
  'herb',
  'flower',
  'vine',
  'shrub',
  'tree',
  'fungus',
  'aquatic',
  'root',
] as const;
export type SpiritSeedGrowthForm = (typeof SPIRIT_SEED_GROWTH_FORMS)[number];
export const SPIRIT_SEED_HARVEST_PARTS = [
  'leaf',
  'flower',
  'fruit',
  'root',
  'rhizome',
  'whole',
  'spore',
  'seedpod',
] as const;
export type SpiritSeedHarvestPart = (typeof SPIRIT_SEED_HARVEST_PARTS)[number];

/** A catalog seed carries display facts and its stable species identity. */
export interface SpiritGardenSeedPlant {
  id: string;
  speciesId: string;
  seedName: string;
  seedDescription: string;
  clueTexts: string[];
  quality: Quality;
  element: ElementType;
  minRealm: RealmType;
  growthForm: SpiritSeedGrowthForm;
  harvestPart: SpiritSeedHarvestPart;
}

export interface SpiritGardenSeedSpec {
  version: 2;
  plant: SpiritGardenSeedPlant;
}

/** Existing seed assets remain readable until they are converted. */
export type SpiritSeedSpec = SpiritGardenSeedSpec | LegacySpiritFieldSeedSpec;
export type SpiritSeedPlant =
  SpiritGardenSeedPlant | LegacySpiritFieldPlantSnapshot;

export interface SpiritGardenSeedRandomOptions {
  guaranteedRank?: Quality;
  specifiedElement?: ElementType;
  qualityChanceMap?: Record<Quality, number>;
  rankRange?: { min: Quality; max: Quality };
}
