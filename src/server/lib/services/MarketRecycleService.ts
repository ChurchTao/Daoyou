import { calculateSingleElixirScore } from '@server/utils/rankingUtils';
import {
  APPRAISAL_KEYWORD_BONUS_MAX,
  APPRAISAL_KEYWORD_BONUS_MIN,
  APPRAISAL_KEYWORD_WEIGHTS,
  APPRAISAL_RATING_MULTIPLIER,
  HIGH_TIER_BASE_FACTOR,
  LOW_TIER_ANCHOR_FACTOR,
  PRODUCE_PRICE_FACTOR_MIN,
  RECYCLE_PRICE_FACTOR_CAP,
} from '@shared/config/marketConfig';
import {
  BASE_PRICES,
  TYPE_MULTIPLIERS,
} from '@shared/engine/material/creation/config';
import { getMaterialTypeLabel } from '@shared/lib/gameConceptDisplay';
import { calculatePillRecycleUnitPrice as calculatePillRecyclePrice } from '@shared/lib/pillRecyclePrice';
import { QUALITY_ORDER, type Quality } from '@shared/types/constants';
import type { Consumable, Material } from '@shared/types/cultivator';
import type { HighTierAppraisal } from '@shared/types/market';

const APPRAISAL_RATING_STEPS: HighTierAppraisal['rating'][] = [
  'C',
  'B',
  'A',
  'S',
];
const HIGH_TIER_MATERIAL_BASE_RATING = {
  真品: 'C',
  地品: 'B',
  天品: 'A',
  仙品: 'S',
  神品: 'S',
} as const satisfies Record<
  '真品' | '地品' | '天品' | '仙品' | '神品',
  HighTierAppraisal['rating']
>;

type HighTierMaterialRank = keyof typeof HIGH_TIER_MATERIAL_BASE_RATING;
export class MarketRecycleError extends Error {
  constructor(
    public status: number,
    message: string,
  ) {
    super(message);
    this.name = 'MarketRecycleError';
  }
}

function clamp(value: number, min: number, max: number): number {
  return Math.min(max, Math.max(min, value));
}

export function calculateKeywordBonus(keywords: string[]): number {
  let bonus = 0;
  for (const raw of keywords) {
    const keyword = String(raw || '').trim();
    if (!keyword) continue;

    for (const [token, weight] of Object.entries(APPRAISAL_KEYWORD_WEIGHTS)) {
      if (keyword.includes(token)) {
        bonus += weight;
      }
    }
  }
  return Math.min(
    APPRAISAL_KEYWORD_BONUS_MAX,
    Math.max(APPRAISAL_KEYWORD_BONUS_MIN, bonus),
  );
}

export function calculateLowTierUnitPrice(
  material: Pick<Material, 'rank' | 'type'>,
): number {
  const basePrice = BASE_PRICES[material.rank];
  const typeMultiplier = TYPE_MULTIPLIERS[material.type] || 1;
  const rankFactor =
    material.rank === '凡品'
      ? LOW_TIER_ANCHOR_FACTOR.凡品
      : material.rank === '灵品'
        ? LOW_TIER_ANCHOR_FACTOR.灵品
        : LOW_TIER_ANCHOR_FACTOR.玄品;
  const recycleFactor = Math.min(
    RECYCLE_PRICE_FACTOR_CAP,
    Math.max(0.22, rankFactor),
  );
  return Math.max(1, Math.floor(basePrice * typeMultiplier * recycleFactor));
}

export function calculateHighTierUnitPrice(
  material: Pick<Material, 'rank' | 'type'>,
  appraisal: HighTierAppraisal,
): number {
  const basePrice = BASE_PRICES[material.rank];
  const typeMultiplier = TYPE_MULTIPLIERS[material.type] || 1;
  const rankFactor =
    material.rank === '真品'
      ? HIGH_TIER_BASE_FACTOR.真品
      : material.rank === '地品'
        ? HIGH_TIER_BASE_FACTOR.地品
        : material.rank === '天品'
          ? HIGH_TIER_BASE_FACTOR.天品
          : material.rank === '仙品'
            ? HIGH_TIER_BASE_FACTOR.仙品
            : HIGH_TIER_BASE_FACTOR.神品;
  const ratingMultiplier = APPRAISAL_RATING_MULTIPLIER[appraisal.rating] || 1;
  const keywordBonus = calculateKeywordBonus(appraisal.keywords || []);
  const rawFactor = rankFactor * ratingMultiplier * (1 + keywordBonus);
  const factor = Math.min(rawFactor, RECYCLE_PRICE_FACTOR_CAP);
  if (factor >= PRODUCE_PRICE_FACTOR_MIN) {
    return Math.max(
      1,
      Math.floor(
        basePrice * typeMultiplier * (PRODUCE_PRICE_FACTOR_MIN - 0.01),
      ),
    );
  }
  return Math.max(1, Math.floor(basePrice * typeMultiplier * factor));
}

export function calculatePillRecycleUnitPrice(
  consumable: Pick<Consumable, 'quality' | 'score' | 'spec'>,
): number {
  const score = calculateSingleElixirScore(consumable as Consumable);
  return calculatePillRecyclePrice(
    getConsumableQuality(consumable),
    score,
    consumable.spec.kind === 'pill'
      ? consumable.spec.alchemyMeta.appearance
      : undefined,
  );
}

function getConsumableQuality(
  consumable: Pick<Consumable, 'quality'>,
): Quality {
  const value = consumable.quality || '凡品';
  return value in QUALITY_ORDER ? value : '凡品';
}

function shiftAppraisalRating(
  rating: HighTierAppraisal['rating'],
  delta: number,
): HighTierAppraisal['rating'] {
  const index = APPRAISAL_RATING_STEPS.indexOf(rating);
  return APPRAISAL_RATING_STEPS[
    clamp(index + delta, 0, APPRAISAL_RATING_STEPS.length - 1)
  ];
}

function getMaterialKeywordSource(
  material: Pick<Material, 'name' | 'description' | 'details'>,
): string {
  return [
    material.name,
    material.description || '',
    JSON.stringify(material.details || {}),
  ].join(' ');
}

function extractMaterialAppraisalKeywords(
  material: Pick<Material, 'name' | 'description' | 'details'>,
): string[] {
  const keywordSource = getMaterialKeywordSource(material);
  return Object.entries(APPRAISAL_KEYWORD_WEIGHTS)
    .filter(([token]) => keywordSource.includes(token))
    .sort((a, b) => Math.abs(b[1]) - Math.abs(a[1]))
    .map(([token]) => token)
    .slice(0, 4);
}

function getMaterialAppraisalAdjustment(keywords: string[]): number {
  let positiveScore = 0;
  let negativeScore = 0;

  for (const keyword of keywords) {
    const weight = APPRAISAL_KEYWORD_WEIGHTS[keyword] ?? 0;
    if (weight > 0) positiveScore += weight;
    if (weight < 0) negativeScore += Math.abs(weight);
  }

  if (positiveScore >= 0.05 && positiveScore > negativeScore) return 1;
  if (negativeScore >= 0.04 && negativeScore > positiveScore) return -1;
  return 0;
}

function getMaterialAppraisalFeatureText(keywords: string[]): string {
  const positiveKeywords = keywords.filter(
    (keyword) => (APPRAISAL_KEYWORD_WEIGHTS[keyword] ?? 0) > 0,
  );
  const negativeKeywords = keywords.filter(
    (keyword) => (APPRAISAL_KEYWORD_WEIGHTS[keyword] ?? 0) < 0,
  );

  if (
    positiveKeywords.length > 0 &&
    positiveKeywords.length >= negativeKeywords.length
  ) {
    return `尤见${positiveKeywords.slice(0, 2).join('、')}之象`;
  }
  if (negativeKeywords.length > 0) {
    return `惜有${negativeKeywords.slice(0, 2).join('、')}之痕`;
  }
  return '气机收束，异象未尽显';
}

function getMaterialRankTone(rank: HighTierMaterialRank): string {
  switch (rank) {
    case '真品':
      return '已脱凡材，可入稳价之列';
    case '地品':
      return '底蕴稳固，足作上乘炼材';
    case '天品':
      return '灵机昂藏，已有高阶宝材气象';
    case '仙品':
      return '仙蕴昭然，难得一见';
    case '神品':
      return '神华内敛，非寻常坊市所能久留';
  }
}

export function buildMaterialHighTierAppraisal(
  material: Pick<
    Material,
    'name' | 'type' | 'rank' | 'element' | 'description' | 'details'
  >,
): HighTierAppraisal {
  const rank =
    material.rank in HIGH_TIER_MATERIAL_BASE_RATING
      ? (material.rank as HighTierMaterialRank)
      : '真品';
  const keywords = extractMaterialAppraisalKeywords(material);
  const rating = shiftAppraisalRating(
    HIGH_TIER_MATERIAL_BASE_RATING[rank],
    getMaterialAppraisalAdjustment(keywords),
  );
  const typeLabel = getMaterialTypeLabel(material.type);
  const elementText = material.element
    ? `${material.element}灵息流转`
    : '灵息内敛';
  const featureText = getMaterialAppraisalFeatureText(keywords);
  const comment = `此${rank}${typeLabel}「${material.name}」${elementText}，${featureText}。按坊市旧例称量，${getMaterialRankTone(rank)}，今可定为${rating}级回收。`;

  return {
    rating,
    comment,
    keywords,
  };
}
