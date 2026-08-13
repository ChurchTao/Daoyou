import { QUALITY_ORDER, type Quality } from '@shared/types/constants';
import type {
  PillAppearanceGrade,
} from '@shared/types/consumable';
import { PILL_APPEARANCE_EFFECT_MULTIPLIER } from '@shared/config/alchemyEssenceConfig';

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
    effectMultiplier: 0.9,
    toxicityMultiplier: 1.35,
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
    effectMultiplier: 1.1,
    toxicityMultiplier: 0.65,
    colorClass: 'text-tier-tian',
  },
  perfect: {
    grade: 'perfect',
    label: '完美',
    effectMultiplier: 1.3,
    toxicityMultiplier: 0,
    colorClass: 'text-tier-shen',
  },
};

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

export function getPillAppearanceLabel(
  appearance: PillAppearanceGrade | undefined,
): string {
  return appearance ? PILL_APPEARANCE_CONFIG[appearance].label : '旧制';
}

export function getPillAppearanceEffectMultiplier(
  appearance: PillAppearanceGrade | undefined,
): number {
  return appearance ? PILL_APPEARANCE_EFFECT_MULTIPLIER[appearance] : 1;
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
