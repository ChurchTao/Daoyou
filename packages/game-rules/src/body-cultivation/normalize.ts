import {
  BODY_CULTIVATION_PACK,
  BODY_CULTIVATION_TRACK_KEYS,
} from '@daoyou/game-content/body-cultivation';
import type {
  BodyCultivationState,
  BodyCultivationTrackKey,
  ConditionProgressTrack,
  CultivatorCondition,
} from '@daoyou/game-domain/condition';
import {
  LEGACY_TEMPERING_TO_BODY_TRACK,
  createEmptyProgressTrack,
} from './config.js';

function normalizeProgressTrack(
  value: ConditionProgressTrack | undefined,
): ConditionProgressTrack {
  return {
    level: Math.max(0, Math.floor(value?.level ?? 0)),
    progress: Math.max(0, Math.floor(value?.progress ?? 0)),
  };
}

function createEmptyBodyTracks(): Record<
  BodyCultivationTrackKey,
  ConditionProgressTrack
> {
  return {
    skin: createEmptyProgressTrack(),
    sinew_bone: createEmptyProgressTrack(),
    organs: createEmptyProgressTrack(),
    qi_blood: createEmptyProgressTrack(),
    primordial_spirit: createEmptyProgressTrack(),
  };
}

export function createDefaultBodyCultivationState(): BodyCultivationState {
  return {
    version: 1,
    realm: 'mortal_body',
    tracks: createEmptyBodyTracks(),
    milestones: {},
  };
}

export function normalizeBodyCultivationState(
  conditionInput: CultivatorCondition | undefined,
): BodyCultivationState {
  const rawBody = conditionInput?.tracks?.bodyCultivation;
  const legacyTempering = conditionInput?.tracks?.tempering;
  const tracks = createEmptyBodyTracks();

  for (const key of BODY_CULTIVATION_TRACK_KEYS) {
    tracks[key] = normalizeProgressTrack(rawBody?.tracks?.[key]);
  }

  if (!rawBody && legacyTempering) {
    for (const [legacyKey, bodyKey] of Object.entries(
      LEGACY_TEMPERING_TO_BODY_TRACK,
    ) as Array<
      [keyof typeof LEGACY_TEMPERING_TO_BODY_TRACK, BodyCultivationTrackKey]
    >) {
      tracks[bodyKey] = normalizeProgressTrack(legacyTempering[legacyKey]);
    }
  }

  const totalLevel = Object.values(tracks).reduce(
    (sum, track) => sum + track.level,
    0,
  );
  const realm = BODY_CULTIVATION_PACK.realms
    .toReversed()
    .find((row) => totalLevel >= row.totalLevel)!.realm;
  return {
    version: 1,
    realm,
    tracks,
    milestones: rawBody?.milestones ?? {},
  };
}
