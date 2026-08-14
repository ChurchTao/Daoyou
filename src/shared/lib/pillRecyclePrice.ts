import {
  MATERIAL_ESSENCE_BY_QUALITY,
  MATERIAL_ESSENCE_TYPE_MULTIPLIER,
  MAX_ALCHEMY_EFFECTIVE_ESSENCE_MULTIPLIER,
  PILL_APPEARANCE_EFFECT_MULTIPLIER,
  PILL_UNIT_ESSENCE_BY_QUALITY,
} from '@shared/config/alchemyEssenceConfig';
import { ALCHEMY_ALLOWED_MATERIAL_TYPES } from '@shared/config/alchemyConfig';
import {
  BASE_PRICES,
  TYPE_MULTIPLIERS,
} from '@shared/engine/material/creation/config';
import { PILL_QUALITY_BASE_SCORE } from '@shared/lib/pillScore';
import type { PillAppearanceGrade } from '@shared/types/consumable';
import type { Quality } from '@shared/types/constants';

const PILL_RECYCLE_RETURN_FACTOR = 0.6;
const SCORE_MODIFIER_MIN = 0.75;
const SCORE_MODIFIER_MAX = 1.25;

function clamp(value: number, min: number, max: number): number {
  return Math.max(min, Math.min(max, value));
}

/**
 * 取同品质可炼丹材料中最低的单位原始药蕴锚定成本。
 * 类型价格倍率与类型药蕴倍率必须同时参与，避免天材地宝等材料失真。
 */
export function calculateMinimumMaterialAnchorCostPerEssence(
  quality: Quality,
): number {
  const qualityEssence = MATERIAL_ESSENCE_BY_QUALITY[quality];
  return Math.min(
    ...ALCHEMY_ALLOWED_MATERIAL_TYPES.map((type) => {
      const materialAnchorPrice = BASE_PRICES[quality] * TYPE_MULTIPLIERS[type];
      const rawEssence = qualityEssence * MATERIAL_ESSENCE_TYPE_MULTIPLIER[type];
      return materialAnchorPrice / rawEssence;
    }),
  );
}

/**
 * 单颗丹药可回收价值的生产锚点。先按最大 120% 药蕴效率折算，确保任何
 * 炉况下整炉回收额都不会超过材料锚定成本的目标比例。
 */
export function calculatePillRecycleEconomicAnchor(quality: Quality): number {
  return (
    PILL_UNIT_ESSENCE_BY_QUALITY[quality] *
    calculateMinimumMaterialAnchorCostPerEssence(quality) /
    MAX_ALCHEMY_EFFECTIVE_ESSENCE_MULTIPLIER
  );
}

export function calculatePillRecycleUnitPrice(
  quality: Quality,
  score: number,
  appearance?: PillAppearanceGrade,
): number {
  const economicAnchor = calculatePillRecycleEconomicAnchor(quality);
  const qualityBaseScore =
    PILL_QUALITY_BASE_SCORE[quality] ?? PILL_QUALITY_BASE_SCORE.凡品;
  const normalizedScore = Number.isFinite(score) ? Math.max(0, score) : 0;
  const scoreModifier = clamp(
    normalizedScore / qualityBaseScore,
    SCORE_MODIFIER_MIN,
    SCORE_MODIFIER_MAX,
  );
  const quotedPrice = Math.floor(
    economicAnchor * PILL_RECYCLE_RETURN_FACTOR * scoreModifier *
      (appearance ? PILL_APPEARANCE_EFFECT_MULTIPLIER[appearance] : 1),
  );
  const priceCap = Math.floor(economicAnchor * PILL_RECYCLE_RETURN_FACTOR);

  return Math.max(1, Math.min(quotedPrice, priceCap));
}
