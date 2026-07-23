import type {
  SectFacilityState,
  SectMapHotspot,
  SectPermissionState,
} from '@shared/engine/sect';

export type SectMapMode = 'member' | 'visitor';

export interface SectMapHotspotState {
  facility?: SectFacilityState;
  locked: boolean;
  selectable: boolean;
  reason?: string;
}

export function resolveSectMapHotspotState(
  spot: SectMapHotspot,
  mode: SectMapMode,
  facilities: ReadonlyMap<string, SectFacilityState>,
  permissions?: Readonly<Record<string, SectPermissionState>>,
): SectMapHotspotState {
  if (mode === 'visitor') {
    const selectable = Boolean(spot.visitor);
    return {
      locked: !selectable,
      selectable,
      reason:
        spot.visitor?.description ?? '外宗重地只可远观，访客不得越过禁制。',
    };
  }

  const facility = spot.facility ? facilities.get(spot.facility) : undefined;
  const access = spot.permission ? permissions?.[spot.permission] : undefined;
  const locked = spot.locked || !spot.route || access?.granted === false;

  return {
    facility,
    locked,
    selectable: true,
    reason: access?.granted === false ? access.reason : undefined,
  };
}
