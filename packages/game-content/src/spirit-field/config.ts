import type { Quality } from '@daoyou/constants/qualities';
import type { RealmType } from '@daoyou/constants/realms';

/** Market weights preserve lower-tier ratios and give divine seeds 2% in 地–神 shelves. */
export const SPIRIT_GARDEN_MARKET_SEED_QUALITY_WEIGHTS: Record<
  Quality,
  number
> = {
  凡品: 1470,
  灵品: 1470,
  玄品: 980,
  真品: 490,
  地品: 196,
  天品: 147,
  仙品: 98,
  神品: 9,
};
export const SPIRIT_GARDEN_CLEAR_SEED_CHANCE = 0.25;
/** Minimum character realm for each native seed and produced quality. */
export const SPIRIT_GARDEN_MIN_REALM: Record<Quality, RealmType> = {
  凡品: '炼气',
  灵品: '筑基',
  玄品: '金丹',
  真品: '元婴',
  地品: '化神',
  天品: '炼虚',
  仙品: '合体',
  神品: '大乘',
};

export {
  SPIRIT_GARDEN_BEAST_RECOVERY_MS,
  SPIRIT_GARDEN_BRANCH_QI_COSTS,
  SPIRIT_GARDEN_COLLECTION_LIMIT,
  SPIRIT_GARDEN_EVOLUTION_ATTEMPT_LIMIT,
  SPIRIT_GARDEN_EVOLUTION_COOLDOWN_MS,
  SPIRIT_GARDEN_EVOLUTION_QI_COSTS,
  SPIRIT_GARDEN_EVOLUTION_STONE_RATIO,
  SPIRIT_GARDEN_EVOLUTION_SUCCESS_CHANCES,
  SPIRIT_GARDEN_INCIDENT_CHANCE,
  SPIRIT_GARDEN_INCIDENT_INTERVAL_MS,
  SPIRIT_GARDEN_MATURE_QI_COSTS,
  SPIRIT_GARDEN_OFFLINE_CAP_MS,
  SPIRIT_GARDEN_PEST_RECOVERY_MS,
  SPIRIT_GARDEN_PRODUCTION_BY_QUALITY,
  SPIRIT_GARDEN_PRODUCTION_LIFETIME_MS,
  SPIRIT_GARDEN_SPECIES,
} from './garden.js';
