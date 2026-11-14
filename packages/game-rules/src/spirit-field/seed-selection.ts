import { QUALITY_VALUES, type Quality } from '@daoyou/constants/qualities';
import { SPIRIT_GARDEN_MARKET_SEED_QUALITY_WEIGHTS } from '@daoyou/game-content/spirit-field/config';
import type { SpiritGardenSeedRandomOptions } from '@daoyou/game-domain/spirit-field';

/** Roll only catalog quality; species selection and asset construction belong to the host. */
export function pickSpiritGardenSeedQuality(
  options: SpiritGardenSeedRandomOptions = {},
  rng: () => number = Math.random,
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
  const weights =
    options.qualityChanceMap ?? SPIRIT_GARDEN_MARKET_SEED_QUALITY_WEIGHTS;
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
