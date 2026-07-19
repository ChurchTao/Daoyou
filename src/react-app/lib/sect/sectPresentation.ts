import {
  registerSectPresentation,
  sectPresentationRegistry,
} from './presentation/compositionRoot';

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
