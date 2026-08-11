import {
  PILL_RECYCLE_BASE_FACTOR,
  PILL_RECYCLE_SCORE_MODIFIER_MAX,
  PILL_RECYCLE_SCORE_MODIFIER_MIN,
  RECYCLE_PRICE_FACTOR_CAP,
} from '@shared/config/marketConfig';
import { BASE_PRICES } from '@shared/engine/material/creation/config';
import { PILL_QUALITY_BASE_SCORE } from '@shared/lib/pillScore';
import type { Quality } from '@shared/types/constants';

function clamp(value: number, min: number, max: number): number {
  return Math.max(min, Math.min(max, value));
}

export function calculatePillRecycleUnitPrice(
  quality: Quality,
  score: number,
): number {
  const anchorPrice = BASE_PRICES[quality] ?? BASE_PRICES.凡品;
  const qualityBaseScore =
    PILL_QUALITY_BASE_SCORE[quality] ?? PILL_QUALITY_BASE_SCORE.凡品;
  const normalizedScore = Number.isFinite(score) ? Math.max(0, score) : 0;
  const scoreModifier = clamp(
    normalizedScore / qualityBaseScore,
    PILL_RECYCLE_SCORE_MODIFIER_MIN,
    PILL_RECYCLE_SCORE_MODIFIER_MAX,
  );
  const quotedPrice = Math.floor(
    anchorPrice * PILL_RECYCLE_BASE_FACTOR * scoreModifier,
  );
  const safePriceCap = Math.floor(anchorPrice * RECYCLE_PRICE_FACTOR_CAP);

  return Math.max(1, Math.min(quotedPrice, safePriceCap));
}
