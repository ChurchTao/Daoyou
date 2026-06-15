import { QUALITY_ORDER, type Quality } from '@shared/types/constants';
import type {
  PillAppearanceGrade,
  WeightedAlchemyProperty,
} from '@shared/types/consumable';

export interface PillAppearanceConfig {
  grade: PillAppearanceGrade;
  label: string;
  effectMultiplier: number;
  toxicityMultiplier: number;
  colorClass: string;
}

export const PILL_APPEARANCE_CONFIG: Record<
  PillAppearanceGrade,
  PillAppearanceConfig
> = {
  low: {
    grade: 'low',
    label: '下品',
    effectMultiplier: 0.75,
    toxicityMultiplier: 1.5,
    colorClass: 'text-tier-fan',
  },
  middle: {
    grade: 'middle',
    label: '中品',
    effectMultiplier: 1,
    toxicityMultiplier: 1,
    colorClass: 'text-tier-xuan',
  },
  high: {
    grade: 'high',
    label: '上品',
    effectMultiplier: 1.25,
    toxicityMultiplier: 0.6,
    colorClass: 'text-tier-tian',
  },
  perfect: {
    grade: 'perfect',
    label: '完美',
    effectMultiplier: 1.8,
    toxicityMultiplier: 0,
    colorClass: 'text-tier-shen',
  },
};

const APPEARANCE_THRESHOLDS: Array<{
  maxExclusive: number;
  grade: PillAppearanceGrade;
}> = [
  { maxExclusive: 0.3, grade: 'low' },
  { maxExclusive: 0.75, grade: 'middle' },
  { maxExclusive: 0.95, grade: 'high' },
  { maxExclusive: 1, grade: 'perfect' },
];

function clamp(value: number, min: number, max: number): number {
  return Math.max(min, Math.min(max, value));
}

function qualityIndex(quality: Quality): number {
  return QUALITY_ORDER[quality] ?? 0;
}

export function getLinearQualityValue(
  quality: Quality,
  min: number,
  max: number,
): number {
  const index = qualityIndex(quality);
  return min + ((max - min) * index) / 7;
}

export function rollPillAppearance(options: {
  stability: number;
  propertyVector: WeightedAlchemyProperty[];
  rng?: () => number;
  masteryLevel?: number;
}): PillAppearanceGrade {
  const rng = options.rng ?? Math.random;
  const stabilityAdjustment = clamp((options.stability - 60) / 250, -0.18, 0.16);
  const primaryWeight = options.propertyVector[0]?.weight ?? 0;
  const propertyFocusAdjustment = clamp((primaryWeight - 0.5) * 0.18, -0.06, 0.08);
  const masteryAdjustment = clamp((options.masteryLevel ?? 0) * 0.015, 0, 0.15);
  const roll = clamp(
    rng() + stabilityAdjustment + propertyFocusAdjustment + masteryAdjustment,
    0,
    0.999999,
  );

  return (
    APPEARANCE_THRESHOLDS.find((entry) => roll < entry.maxExclusive)?.grade ??
    'perfect'
  );
}

export function getPillAppearanceLabel(
  appearance: PillAppearanceGrade | undefined,
): string {
  return appearance ? PILL_APPEARANCE_CONFIG[appearance].label : '旧制';
}

export function getPillAppearanceEffectMultiplier(
  appearance: PillAppearanceGrade | undefined,
): number {
  return appearance
    ? PILL_APPEARANCE_CONFIG[appearance].effectMultiplier
    : 1;
}

export function getPillAppearanceToxicityMultiplier(
  appearance: PillAppearanceGrade | undefined,
): number {
  return appearance
    ? PILL_APPEARANCE_CONFIG[appearance].toxicityMultiplier
    : 1;
}

export function getPillAppearanceColorClass(
  appearance: PillAppearanceGrade | undefined,
): string {
  return appearance
    ? PILL_APPEARANCE_CONFIG[appearance].colorClass
    : 'text-ink-secondary';
}
