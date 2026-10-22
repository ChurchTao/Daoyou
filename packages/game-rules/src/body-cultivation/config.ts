import { REALM_ORDER, type RealmType } from '@daoyou/constants/realms';
import {
  BODY_CULTIVATION_PACK,
  BODY_CULTIVATION_TRACK_KEYS,
} from '@daoyou/game-content/body-cultivation';
import type {
  BodyCultivationRealm,
  BodyCultivationTrackKey,
  BodyCultivationTrackPath,
  ConditionProgressTrack,
  LegacyTemperingTrackKey,
  LegacyTemperingTrackPath,
} from '@daoyou/game-domain/condition';
import { bodyCultivationThreshold } from './threshold.js';
export { BODY_CULTIVATION_TRACK_KEYS } from '@daoyou/game-content/body-cultivation';

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

export const BODY_TRACK_LABELS = Object.fromEntries(
  BODY_CULTIVATION_TRACK_KEYS.map((key) => {
    const { name, layerName, shortDesc } = BODY_CULTIVATION_PACK.tracks[key];
    return [key, { name, layerName, shortDesc }];
  }),
) as Record<
  BodyCultivationTrackKey,
  { name: string; layerName: string; shortDesc: string }
>;

export const BODY_REALM_LABELS = Object.fromEntries(
  BODY_CULTIVATION_PACK.realms.map((row) => [row.realm, row.label]),
) as Record<BodyCultivationRealm, string>;
export interface BodyCultivationRealmRequirement {
  realm: BodyCultivationRealm;
  label: string;
  totalLevel: number;
}

export const BODY_CULTIVATION_REALM_REQUIREMENTS = Object.fromEntries(
  BODY_CULTIVATION_PACK.realms.map(({ realm, label, totalLevel }) => [
    realm,
    { realm, label, totalLevel },
  ]),
) as Record<BodyCultivationRealm, BodyCultivationRealmRequirement>;

export function getBodyCultivationLevelCapByCultivationRealm(
  realm: RealmType | undefined,
): number {
  const current = realm ?? '炼气';
  return Math.max(
    ...BODY_CULTIVATION_PACK.realms
      .filter(
        (row) => REALM_ORDER[current] >= REALM_ORDER[row.minCultivationRealm],
      )
      .map((row) => row.softTrackCap),
  );
}

export function createEmptyProgressTrack(): ConditionProgressTrack {
  return { level: 0, progress: 0 };
}

export function getBodyCultivationThresholdByLevel(level: number): number {
  return bodyCultivationThreshold(level);
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

  const legacyKey = path.replace('tempering.', '') as LegacyTemperingTrackKey;
  return LEGACY_TEMPERING_TO_BODY_TRACK[legacyKey];
}
