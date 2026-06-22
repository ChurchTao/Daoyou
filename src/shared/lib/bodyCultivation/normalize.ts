import type {
  BodyCultivationState,
  BodyCultivationTrackKey,
  ConditionProgressTrack,
  CultivatorCondition,
} from '@shared/types/condition';
import {
  BODY_CULTIVATION_TRACK_KEYS,
  BODY_REALM_LABELS,
  LEGACY_TEMPERING_TO_BODY_TRACK,
  createEmptyProgressTrack,
} from './config';

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
  const defaults = createDefaultBodyCultivationState();
  const rawBody = conditionInput?.tracks?.bodyCultivation;
  const legacyTempering = conditionInput?.tracks?.tempering;
  const tracks = createEmptyBodyTracks();

  for (const key of BODY_CULTIVATION_TRACK_KEYS) {
    tracks[key] = normalizeProgressTrack(rawBody?.tracks?.[key]);
  }

  if (!rawBody && legacyTempering) {
    for (const [legacyKey, bodyKey] of Object.entries(
      LEGACY_TEMPERING_TO_BODY_TRACK,
    ) as Array<[keyof typeof LEGACY_TEMPERING_TO_BODY_TRACK, BodyCultivationTrackKey]>) {
      tracks[bodyKey] = normalizeProgressTrack(legacyTempering[legacyKey]);
    }
  }

  const realm =
    rawBody?.realm && rawBody.realm in BODY_REALM_LABELS
      ? rawBody.realm
      : defaults.realm;

  return {
    version: 1,
    realm,
    tracks,
    milestones: rawBody?.milestones ?? {},
    breakthrough:
      rawBody?.breakthrough &&
      rawBody.breakthrough.targetRealm in BODY_REALM_LABELS
        ? {
            targetRealm: rawBody.breakthrough.targetRealm,
            progress: Math.max(
              0,
              Math.min(100, Math.floor(rawBody.breakthrough.progress ?? 0)),
            ),
            failedAttempts: Math.max(
              0,
              Math.floor(rawBody.breakthrough.failedAttempts ?? 0),
            ),
          }
        : undefined,
  };
}
