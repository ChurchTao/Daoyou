import type { SpiritGardenSpecies } from '@daoyou/game-domain/spirit-field';
import data from './data/garden.json' with { type: 'json' };
import { loadSpiritGardenCatalog } from './garden-schema.js';

const catalog = loadSpiritGardenCatalog(data);
export const SPIRIT_GARDEN_OFFLINE_CAP_MS = catalog.offlineCapMs;
export const SPIRIT_GARDEN_COLLECTION_LIMIT = catalog.collectionLimit;
export const SPIRIT_GARDEN_SPECIES: readonly SpiritGardenSpecies[] =
  catalog.species;
