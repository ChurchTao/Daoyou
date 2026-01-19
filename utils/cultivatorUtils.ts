import { REALM_STAGE_CAPS, RealmStage, RealmType } from '../types/constants';

/**
 * 获取境界属性上限
 */
export function getRealmAttributeCap(realm: RealmType): number {
  const stageCaps = REALM_STAGE_CAPS[realm];
  if (!stageCaps) return 100;
  return (
    stageCaps.圆满 ?? stageCaps.后期 ?? stageCaps.中期 ?? stageCaps.初期 ?? 100
  );
}

export function getRealmStageAttributeCap(
  realm: RealmType,
  realmStage: RealmStage,
): number {
  const stageCaps = REALM_STAGE_CAPS[realm];
  if (!stageCaps) {
    return getRealmAttributeCap(realm);
  }
  return stageCaps[realmStage] ?? getRealmAttributeCap(realm);
}
