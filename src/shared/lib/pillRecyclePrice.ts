import {
  PILL_RECYCLE_BASE_FACTOR,
  PILL_RECYCLE_CRAFT_COST_DIVISOR,
  PILL_RECYCLE_PRICE_FACTOR_CAP,
  PILL_RECYCLE_SCORE_MODIFIER_MAX,
  PILL_RECYCLE_SCORE_MODIFIER_MIN,
} from '@shared/config/marketConfig';
import { calculateCraftCost } from '@shared/engine/creation-v2/CraftCostCalculator';
import { BASE_PRICES } from '@shared/engine/material/creation/config';
import { PILL_QUALITY_BASE_SCORE } from '@shared/lib/pillScore';
import { PILL_APPEARANCE_EFFECT_MULTIPLIER } from '@shared/config/alchemyEssenceConfig';
import type { PillAppearanceGrade } from '@shared/types/consumable';
import type { Quality } from '@shared/types/constants';

function clamp(value: number, min: number, max: number): number {
  return Math.max(min, Math.min(max, value));
}

export function calculatePillRecycleUnitPrice(
  quality: Quality,
  score: number,
  appearance?: PillAppearanceGrade,
): number {
  const materialAnchorPrice = BASE_PRICES[quality] ?? BASE_PRICES.凡品;
  const craftCost = calculateCraftCost(quality, 'spiritStone');
  const economicAnchor =
    materialAnchorPrice + craftCost / PILL_RECYCLE_CRAFT_COST_DIVISOR;
  const qualityBaseScore =
    PILL_QUALITY_BASE_SCORE[quality] ?? PILL_QUALITY_BASE_SCORE.凡品;
  const normalizedScore = Number.isFinite(score) ? Math.max(0, score) : 0;
  const scoreModifier = clamp(
    normalizedScore / qualityBaseScore,
    PILL_RECYCLE_SCORE_MODIFIER_MIN,
    PILL_RECYCLE_SCORE_MODIFIER_MAX,
  );
  const quotedPrice = Math.floor(
    economicAnchor * PILL_RECYCLE_BASE_FACTOR * scoreModifier *
      (appearance ? PILL_APPEARANCE_EFFECT_MULTIPLIER[appearance] : 1),
  );
  const priceCap = Math.floor(
    economicAnchor * PILL_RECYCLE_PRICE_FACTOR_CAP,
  );

  return Math.max(1, Math.min(quotedPrice, priceCap));
}
