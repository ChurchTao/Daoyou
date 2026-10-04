import { QUALITY_VALUES, type Quality } from '@daoyou/constants/qualities';
import { type ElementType } from '@daoyou/constants/elements';
import { SPIRIT_SEED_QUALITY_CHANCE_MAP } from '@daoyou/game-content/spirit-field/config';
import type {
  SpiritSeedRandomOptions,
  SpiritSeedSkeleton,
} from '@daoyou/game-domain/spirit-field';
export interface SpiritSeedBatchSpec {
  rank: Quality;
  quantity: number;
  element?: ElementType;
  regionTags?: string[];
}

function pickWeightedQuality(
  options: SpiritSeedRandomOptions,
  rng: () => number,
): Quality {
  if (options.guaranteedRank) return options.guaranteedRank;
  const min = options.rankRange
    ? QUALITY_VALUES.indexOf(options.rankRange.min)
    : 0;
  const max = options.rankRange
    ? QUALITY_VALUES.indexOf(options.rankRange.max)
    : QUALITY_VALUES.length - 1;
  const candidates = QUALITY_VALUES.slice(
    Math.min(min, max),
    Math.max(min, max) + 1,
  );
  const weights = options.qualityChanceMap ?? SPIRIT_SEED_QUALITY_CHANCE_MAP;
  const total = candidates.reduce(
    (sum, quality) => sum + Math.max(0, weights[quality]),
    0,
  );
  let cursor = rng() * total;
  for (const quality of candidates) {
    cursor -= Math.max(0, weights[quality]);
    if (cursor <= 0) return quality;
  }
  return candidates[candidates.length - 1] ?? '凡品';
}

export class SpiritSeedGenerator {
  static generateRandomSkeletons(
    count: number,
    options: SpiritSeedRandomOptions = {},
    rng: () => number = Math.random,
  ): SpiritSeedSkeleton[] {
    return Array.from({ length: Math.max(0, Math.floor(count)) }, () => ({
      rank: pickWeightedQuality(options, rng),
      quantity: 1,
      forcedElement: options.specifiedElement,
      regionTags: options.regionTags?.slice(0, 8),
    }));
  }
}
