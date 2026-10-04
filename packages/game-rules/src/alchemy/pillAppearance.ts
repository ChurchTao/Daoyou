import {
  PILL_APPEARANCE_CONFIG,
  PILL_APPEARANCE_EFFECT_MULTIPLIER,
} from '@daoyou/game-content/alchemy';
import { QUALITY_ORDER, type Quality } from '@daoyou/constants/qualities';

import type { PillAppearanceGrade } from '@daoyou/game-domain/consumables';


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
  return appearance ? PILL_APPEARANCE_CONFIG[appearance].toxicityMultiplier : 1;
}

export function getPillAppearanceColorClass(
  appearance: PillAppearanceGrade | undefined,
): string {
  return appearance
    ? PILL_APPEARANCE_CONFIG[appearance].colorClass
    : 'text-ink-secondary';
}
