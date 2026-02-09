import { REALM_VALUES, type RealmType } from '@/types/constants';

const REALM_INDEX = new Map<RealmType, number>(
  REALM_VALUES.map((realm, index) => [realm, index]),
);

export function getRealmOrder(realm: RealmType): number {
  return REALM_INDEX.get(realm) ?? -1;
}

export function isRealmInRange(
  realm: RealmType,
  minRealm?: RealmType,
  maxRealm?: RealmType,
): boolean {
  const order = getRealmOrder(realm);
  if (order < 0) return false;

  if (minRealm && order < getRealmOrder(minRealm)) return false;
  if (maxRealm && order > getRealmOrder(maxRealm)) return false;
  return true;
}

export function toRealmType(value: string): RealmType | null {
  if ((REALM_VALUES as readonly string[]).includes(value)) {
    return value as RealmType;
  }
  return null;
}
