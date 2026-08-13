import {
  PILL_APPEARANCE_EFFECT_MULTIPLIER,
  PILL_UNIT_ESSENCE_BY_QUALITY,
} from '@shared/config/alchemyEssenceConfig';
import { PILL_QUALITY_BASE_SCORE } from '@shared/lib/pillScore';
import type { PillAppearanceGrade } from '@shared/types/consumable';
import type { Quality } from '@shared/types/constants';

export const PILL_ESSENCE_SPIRIT_STONE_RATE: Record<Quality, number> = {
  凡品: 87.5,
  灵品: 117,
  玄品: 78,
  真品: 99,
  地品: 126,
  天品: 149,
  仙品: 156,
  神品: 223,
};

const PILL_RECYCLE_PROFIT_FACTOR = 0.6;
const SCORE_MODIFIER_MIN = 0.75;
const SCORE_MODIFIER_MAX = 1.25;

function clamp(value: number, min: number, max: number): number {
  return Math.max(min, Math.min(max, value));
}

export function calculatePillRecycleUnitPrice(
  quality: Quality,
  score: number,
  appearance?: PillAppearanceGrade,
): number {
  const economicAnchor =
    (PILL_UNIT_ESSENCE_BY_QUALITY[quality] ?? PILL_UNIT_ESSENCE_BY_QUALITY.凡品) *
    (PILL_ESSENCE_SPIRIT_STONE_RATE[quality] ?? PILL_ESSENCE_SPIRIT_STONE_RATE.凡品);
  const qualityBaseScore =
    PILL_QUALITY_BASE_SCORE[quality] ?? PILL_QUALITY_BASE_SCORE.凡品;
  const normalizedScore = Number.isFinite(score) ? Math.max(0, score) : 0;
  const scoreModifier = clamp(
    normalizedScore / qualityBaseScore,
    SCORE_MODIFIER_MIN,
    SCORE_MODIFIER_MAX,
  );
  const quotedPrice = Math.floor(
    economicAnchor * PILL_RECYCLE_PROFIT_FACTOR * scoreModifier *
      (appearance ? PILL_APPEARANCE_EFFECT_MULTIPLIER[appearance] : 1),
  );
  const priceCap = Math.floor(economicAnchor * PILL_RECYCLE_PROFIT_FACTOR);

  return Math.max(1, Math.min(quotedPrice, priceCap));
}
