import {
  BODY_CULTIVATION_REALM_ORDER,
  BODY_CULTIVATION_REALM_REQUIREMENTS,
  BODY_CULTIVATION_TRACK_KEYS,
  type BodyCultivationRealmRequirement,
  createEmptyProgressTrack,
  isCultivationRealmAtLeast,
} from '@shared/lib/bodyCultivation/config';
import type {
  BodyCultivationRealm,
  BodyCultivationTrackKey,
} from '@shared/types/condition';
import { REALM_ORDER, type EnemyRace } from '@shared/types/constants';
import type {
  BodyCultivationTrackLevels,
  EnemyBodyCultivationPlan,
  NormalizedEnemyGenerationInput,
} from './types';
import { hashText } from './utils';

type BodyTrackWeights = Record<BodyCultivationTrackKey, number>;

export const ENEMY_BODY_CULTIVATION_TRACK_WEIGHTS: Record<
  EnemyRace,
  BodyTrackWeights
> = {
  人族: {
    skin: 1,
    sinew_bone: 1,
    organs: 1.15,
    qi_blood: 1,
    primordial_spirit: 1.12,
  },
  妖族: {
    skin: 1.18,
    sinew_bone: 1.3,
    organs: 0.78,
    qi_blood: 1.35,
    primordial_spirit: 0.72,
  },
  鬼魂: {
    skin: 0.72,
    sinew_bone: 0.72,
    organs: 1.18,
    qi_blood: 0.78,
    primordial_spirit: 1.5,
  },
  魔族: {
    skin: 1.08,
    sinew_bone: 0.9,
    organs: 1.32,
    qi_blood: 1.2,
    primordial_spirit: 0.85,
  },
  古兽: {
    skin: 1.35,
    sinew_bone: 1.45,
    organs: 0.68,
    qi_blood: 1.22,
    primordial_spirit: 0.65,
  },
  灵族: {
    skin: 1.08,
    sinew_bone: 0.78,
    organs: 1.28,
    qi_blood: 0.86,
    primordial_spirit: 1.24,
  },
};

function clamp(value: number, min: number, max: number): number {
  return Math.max(min, Math.min(max, value));
}

function createEmptyTrackLevels(): BodyCultivationTrackLevels {
  return {
    skin: 0,
    sinew_bone: 0,
    organs: 0,
    qi_blood: 0,
    primordial_spirit: 0,
  };
}

function sumTrackLevels(levels: BodyCultivationTrackLevels): number {
  return BODY_CULTIVATION_TRACK_KEYS.reduce(
    (sum, key) => sum + levels[key],
    0,
  );
}

function sortTracksByRacePreference(
  race: EnemyRace,
  variantKey: string,
): BodyCultivationTrackKey[] {
  const weights = ENEMY_BODY_CULTIVATION_TRACK_WEIGHTS[race];
  return [...BODY_CULTIVATION_TRACK_KEYS].sort((left, right) => {
    const weightDiff = weights[right] - weights[left];
    if (weightDiff !== 0) return weightDiff;
    return (
      hashText(`${variantKey}:body:${left}`) -
      hashText(`${variantKey}:body:${right}`)
    );
  });
}

function pickNextTrack(
  levels: BodyCultivationTrackLevels,
  race: EnemyRace,
  variantKey: string,
): BodyCultivationTrackKey {
  const weights = ENEMY_BODY_CULTIVATION_TRACK_WEIGHTS[race];
  return [...BODY_CULTIVATION_TRACK_KEYS].sort((left, right) => {
    const leftScore = levels[left] / weights[left];
    const rightScore = levels[right] / weights[right];
    if (leftScore !== rightScore) return leftScore - rightScore;

    const weightDiff = weights[right] - weights[left];
    if (weightDiff !== 0) return weightDiff;

    return (
      hashText(`${variantKey}:body:${left}`) -
      hashText(`${variantKey}:body:${right}`)
    );
  })[0];
}

function resolveTotalLevel(input: NormalizedEnemyGenerationInput): number {
  return clamp(
    Math.floor(
      Math.max(0, input.difficulty - 20) * 0.45 +
        (REALM_ORDER[input.realm] ?? 0) * 8 +
        (input.isBoss ? 10 : 0),
    ),
    0,
    220,
  );
}

function resolveBodyRealm(
  input: NormalizedEnemyGenerationInput,
  totalLevel: number,
): BodyCultivationRealm {
  let selected: BodyCultivationRealm = 'mortal_body';

  for (const realm of BODY_CULTIVATION_REALM_ORDER) {
    const requirement = BODY_CULTIVATION_REALM_REQUIREMENTS[realm];
    if (
      totalLevel >= requirement.totalLevel &&
      isCultivationRealmAtLeast(input.realm, requirement.minCultivationRealm)
    ) {
      selected = realm;
    }
  }

  return selected;
}

function applyRealmRequirements(
  levels: BodyCultivationTrackLevels,
  race: EnemyRace,
  variantKey: string,
  realm: BodyCultivationRealm,
): void {
  const requirement = BODY_CULTIVATION_REALM_REQUIREMENTS[
    realm
  ] as BodyCultivationRealmRequirement;

  if (requirement.minAllTracksLevel) {
    for (const track of BODY_CULTIVATION_TRACK_KEYS) {
      levels[track] = Math.max(levels[track], requirement.minAllTracksLevel);
    }
  }

  for (const [track, level] of Object.entries(
    requirement.requiredTrackLevels ?? {},
  ) as Array<[BodyCultivationTrackKey, number]>) {
    levels[track] = Math.max(levels[track], level);
  }

  if (requirement.requiredAnyTracks) {
    const preferredTracks = sortTracksByRacePreference(race, variantKey).slice(
      0,
      requirement.requiredAnyTracks.count,
    );
    for (const track of preferredTracks) {
      levels[track] = Math.max(
        levels[track],
        requirement.requiredAnyTracks.minLevel,
      );
    }
  }
}

export class EnemyBodyCultivationPlanner {
  plan(args: {
    input: NormalizedEnemyGenerationInput;
    variantKey: string;
  }): EnemyBodyCultivationPlan {
    const { input, variantKey } = args;
    const totalLevel = resolveTotalLevel(input);
    const realm = resolveBodyRealm(input, totalLevel);
    const trackLevels = createEmptyTrackLevels();

    applyRealmRequirements(trackLevels, input.race, variantKey, realm);

    while (sumTrackLevels(trackLevels) < totalLevel) {
      const track = pickNextTrack(trackLevels, input.race, variantKey);
      trackLevels[track] += 1;
    }

    const focusTracks = [...BODY_CULTIVATION_TRACK_KEYS]
      .filter((track) => trackLevels[track] > 0)
      .sort((left, right) => {
        const levelDiff = trackLevels[right] - trackLevels[left];
        if (levelDiff !== 0) return levelDiff;
        return sortTracksByRacePreference(input.race, variantKey).indexOf(left) -
          sortTracksByRacePreference(input.race, variantKey).indexOf(right);
      })
      .slice(0, 3);

    return {
      state: {
        version: 1,
        realm,
        tracks: {
          skin: { ...createEmptyProgressTrack(), level: trackLevels.skin },
          sinew_bone: {
            ...createEmptyProgressTrack(),
            level: trackLevels.sinew_bone,
          },
          organs: { ...createEmptyProgressTrack(), level: trackLevels.organs },
          qi_blood: {
            ...createEmptyProgressTrack(),
            level: trackLevels.qi_blood,
          },
          primordial_spirit: {
            ...createEmptyProgressTrack(),
            level: trackLevels.primordial_spirit,
          },
        },
        milestones: {},
      },
      summary: {
        realm,
        totalLevel: sumTrackLevels(trackLevels),
        focusTracks,
        trackLevels,
      },
    };
  }
}
