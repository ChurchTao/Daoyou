import type { SectFacilityEffectSnapshot } from '@shared/engine/sect';
import {
  PRODUCTION_SECT_IDS,
  PRODUCTION_SECT_PRESENTATIONS,
} from '@shared/engine/sect/content';

export type {
  ResolvedSectPresentation,
  SectMapHotspot,
  SectPresentationTheme,
  SectSceneKey,
} from '@shared/engine/sect';

export function getSectPresentation(sectId: string) {
  if (!PRODUCTION_SECT_IDS.includes(sectId)) {
    throw new Error(`未知宗门：${sectId}`);
  }
  return PRODUCTION_SECT_PRESENTATIONS[sectId];
}

export function getSectFacilityLabel(
  sectId: string,
  facilityKey: string,
): string {
  return getSectPresentation(sectId).facilityLabels[facilityKey] ?? facilityKey;
}

export function getSectBenefitMetric(
  effect: SectFacilityEffectSnapshot | undefined,
  key: string,
  fallback = 0,
): number {
  const value = effect?.metrics.find((metric) => metric.key === key)?.value;
  return typeof value === 'number' && Number.isFinite(value) ? value : fallback;
}
