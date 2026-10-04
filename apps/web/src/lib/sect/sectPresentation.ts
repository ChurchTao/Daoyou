import type { SectFacilityEffectSnapshot } from '@daoyou/game-rules/sect-organization';
import { PRODUCTION_SECT_IDS, PRODUCTION_SECT_PRESENTATIONS } from '@daoyou/game-rules/sect-organization/production';

export type {
  ResolvedSectPresentation,
  SectMapHotspot,
  SectPresentationTheme,
  SectSceneKey,
} from '@daoyou/game-rules/sect-organization';

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
