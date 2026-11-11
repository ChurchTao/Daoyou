import type { Quality } from '@daoyou/constants/qualities';
import type { SpiritGardenSpecies } from '@daoyou/game-domain/spirit-field';
import data from './data/garden.json' with { type: 'json' };
import { loadSpiritGardenCatalog } from './garden-schema.js';

const catalog = loadSpiritGardenCatalog(data);
export const SPIRIT_GARDEN_OFFLINE_CAP_MS = catalog.offlineCapMs;
export const SPIRIT_GARDEN_PRODUCTION_LIFETIME_MS = 28 * 86_400_000;
export const SPIRIT_GARDEN_INCIDENT_INTERVAL_MS = 86_400_000;
export const SPIRIT_GARDEN_INCIDENT_CHANCE = 0.08;
export const SPIRIT_GARDEN_PEST_RECOVERY_MS = 6 * 3_600_000;
export const SPIRIT_GARDEN_BEAST_RECOVERY_MS = 2 * 3_600_000;
export const SPIRIT_GARDEN_COLLECTION_LIMIT = catalog.collectionLimit;
/** Final periods are selected by output quality; no additional quality multiplier. */
export const SPIRIT_GARDEN_PRODUCTION_BY_QUALITY = catalog.productionByQuality;
export const SPIRIT_GARDEN_MATURE_QI_COSTS: Record<Quality, number> = {
  凡品: 2,
  灵品: 3,
  玄品: 4,
  真品: 6,
  地品: 8,
  天品: 12,
  仙品: 16,
  神品: 20,
};
export const SPIRIT_GARDEN_BRANCH_QI_COSTS: Record<Quality, number> = {
  凡品: 3,
  灵品: 5,
  玄品: 6,
  真品: 9,
  地品: 12,
  天品: 18,
  仙品: 24,
  神品: 30,
};
export const SPIRIT_GARDEN_EVOLUTION_SUCCESS_CHANCES: Record<Quality, number> =
  {
    凡品: 0.9,
    灵品: 0.85,
    玄品: 0.8,
    真品: 0.75,
    地品: 0.7,
    天品: 0.6,
    仙品: 0.5,
    神品: 0,
  };
export const SPIRIT_GARDEN_EVOLUTION_ATTEMPT_LIMIT = 3;
export const SPIRIT_GARDEN_EVOLUTION_COOLDOWN_MS = 24 * 3_600_000;
export const SPIRIT_GARDEN_EVOLUTION_QI_COSTS: Record<Quality, number> = {
  凡品: 12,
  灵品: 18,
  玄品: 24,
  真品: 32,
  地品: 40,
  天品: 50,
  仙品: 60,
  神品: 0,
};
export const SPIRIT_GARDEN_EVOLUTION_STONE_RATIO = 0.35;
export const SPIRIT_GARDEN_SPECIES: readonly SpiritGardenSpecies[] =
  catalog.species;
