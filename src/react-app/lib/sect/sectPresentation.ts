import {
  registerSectPresentation,
  sectPresentationRegistry,
} from './presentation/compositionRoot';
import type { SectFacilityEffectSnapshot } from '@shared/engine/sect';

export { registerSectPresentation };
export { SECT_MAP_HOTSPOTS } from './presentation/lingxiao/module';
export type {
  SectMapHotspot,
  SectPresentationModule,
} from './presentation/core/registry';

export function getSectPresentation(sectId: string) {
  return sectPresentationRegistry().presentation(sectId);
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
