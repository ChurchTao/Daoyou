import { QUALITY_ORDER, type Quality } from '@daoyou/constants/qualities';
import type { RealmType } from '@daoyou/constants/realms';
import {
  CULTIVATION_PILL_MIN_QUALITY_BY_REALM,
  LIFESPAN_PILL_GAIN_RANGE_BY_QUALITY,
} from '@daoyou/game-content/consumables';

export function getMinimumPillQualityByRealm(realm: RealmType): Quality {
  return CULTIVATION_PILL_MIN_QUALITY_BY_REALM[realm] ?? '凡品';
}

export function getConsumableQualityScalar(
  quality: Quality | undefined,
): number {
  return 1 + (QUALITY_ORDER[quality ?? '凡品'] ?? 0) * 0.22;
}

export function rollLifespanPillGain(
  quality: Quality,
  rng: () => number = Math.random,
): number {
  const range = LIFESPAN_PILL_GAIN_RANGE_BY_QUALITY[quality];
  const roll = Math.max(0, Math.min(0.999999, rng()));
  return range.min + Math.floor(roll * (range.max - range.min + 1));
}
