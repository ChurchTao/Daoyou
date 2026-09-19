import type {
  BodyCultivationRealm,
  BodyCultivationTrackKey,
  BodyCultivationTrackPath,
  ConditionProgressTrack,
  LegacyTemperingTrackKey,
  LegacyTemperingTrackPath,
} from '@shared/types/condition';
import { REALM_ORDER, type RealmType } from '@shared/types/constants';
import { BODY_CULTIVATION_PACK, BODY_CULTIVATION_TRACK_KEYS, bodyCultivationThreshold } from './pack';
export { BODY_CULTIVATION_TRACK_KEYS } from './pack';


export const BODY_CULTIVATION_TRACK_PATHS = BODY_CULTIVATION_TRACK_KEYS.map(
  (key) => `body.${key}` as BodyCultivationTrackPath,
);

export const LEGACY_TEMPERING_TO_BODY_TRACK = {
  vitality: 'qi_blood',
  spirit: 'organs',
  wisdom: 'primordial_spirit',
  speed: 'skin',
  willpower: 'sinew_bone',
} as const satisfies Record<LegacyTemperingTrackKey, BodyCultivationTrackKey>;

export const BODY_TRACK_LABELS = Object.fromEntries(BODY_CULTIVATION_TRACK_KEYS.map(key => {
  const { name, layerName, shortDesc } = BODY_CULTIVATION_PACK.tracks[key];
  return [key, { name, layerName, shortDesc }];
})) as Record<BodyCultivationTrackKey, { name: string; layerName: string; shortDesc: string }>;

export const BODY_REALM_LABELS = Object.fromEntries(BODY_CULTIVATION_PACK.realms.map(row => [row.realm, row.label])) as Record<BodyCultivationRealm, string>;
export const BODY_CULTIVATION_REALM_ORDER = BODY_CULTIVATION_PACK.realms.map(row => row.realm);

export interface BodyCultivationRealmRequirement {
  realm: BodyCultivationRealm;
  label: string;
  minCultivationRealm: RealmType;
  totalLevel: number;
  softTrackCap: number;
  unlockText: string;
}

export const BODY_CULTIVATION_REALM_REQUIREMENTS = Object.fromEntries(BODY_CULTIVATION_PACK.realms.map((row, index) => [row.realm, {
  ...row,
  unlockText: `五轨单轨上限${index === 0 ? ' ' : '提升至 '}Lv.${row.softTrackCap}`,
}])) as Record<BodyCultivationRealm, BodyCultivationRealmRequirement>;

export function createEmptyProgressTrack(): ConditionProgressTrack {
  return { level: 0, progress: 0 };
}

export function getBodyCultivationThresholdByLevel(level: number): number {
  return bodyCultivationThreshold(level);
}

export function getNextBodyCultivationRealm(
  realm: BodyCultivationRealm,
): BodyCultivationRealm | null {
  const index = BODY_CULTIVATION_REALM_ORDER.indexOf(realm);
  return BODY_CULTIVATION_REALM_ORDER[index + 1] ?? null;
}

export function isCultivationRealmAtLeast(
  current: RealmType | undefined,
  required: RealmType,
): boolean {
  if (!current) return false;
  return REALM_ORDER[current] >= REALM_ORDER[required];
}

export function isBodyCultivationTrackPath(
  value: string,
): value is BodyCultivationTrackPath {
  return BODY_CULTIVATION_TRACK_PATHS.includes(
    value as BodyCultivationTrackPath,
  );
}

export function isLegacyTemperingTrackPath(
  value: string,
): value is LegacyTemperingTrackPath {
  return value.startsWith('tempering.');
}

export function getBodyTrackKeyFromPath(
  path: BodyCultivationTrackPath | LegacyTemperingTrackPath,
): BodyCultivationTrackKey {
  if (isBodyCultivationTrackPath(path)) {
    return path.replace('body.', '') as BodyCultivationTrackKey;
  }

  const legacyKey = path.replace(
    'tempering.',
    '',
  ) as LegacyTemperingTrackKey;
  return LEGACY_TEMPERING_TO_BODY_TRACK[legacyKey];
}
