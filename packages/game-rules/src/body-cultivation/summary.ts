import type { RealmType } from '@daoyou/constants/realms';
import {
  BODY_CULTIVATION_PACK,
  BODY_CULTIVATION_TRACK_KEYS,
} from '@daoyou/game-content/body-cultivation';
import type {
  BodyCultivationRealm,
  BodyCultivationTrackKey,
  BodyCultivationTrackPath,
  CultivatorCondition,
} from '@daoyou/game-domain/condition';
import { bodyCultivationEffectTexts } from './benefits.js';
import {
  BODY_CULTIVATION_REALM_REQUIREMENTS,
  BODY_TRACK_LABELS,
  getBodyCultivationLevelCapByCultivationRealm,
  getBodyCultivationThresholdByLevel,
} from './config.js';
import { normalizeBodyCultivationState } from './normalize.js';

export interface BodyCultivationTrackSummary {
  key: BodyCultivationTrackKey;
  path: BodyCultivationTrackPath;
  name: string;
  layerName: string;
  shortDesc: string;
  level: number;
  progress: number;
  threshold: number;
  nextMilestoneLevel: number;
  levelsToNextMilestone: number;
  currentEffects: string[];
  nextLevelEffects: string[];
}

export interface BodyCultivationRealmSummary {
  key: BodyCultivationRealm;
  label: string;
}

export interface BodyCultivationSummary {
  realm: BodyCultivationRealmSummary;
  totalLevel: number;
  tracks: BodyCultivationTrackSummary[];
  trackLevelCap: number;
  nextTitle: { label: string; totalLevel: number } | null;
}

function getNextMilestoneLevel(level: number): number {
  const interval = BODY_CULTIVATION_PACK.progress.milestoneInterval;
  return Math.max(
    interval,
    Math.ceil((Math.max(0, level) + 1) / interval) * interval,
  );
}

export function getBodyCultivationSummary(
  condition: CultivatorCondition | undefined,
  options: { cultivatorRealm?: RealmType } = {},
): BodyCultivationSummary {
  const state = normalizeBodyCultivationState(condition);
  const realmConfig = BODY_CULTIVATION_REALM_REQUIREMENTS[state.realm];
  const tracks = BODY_CULTIVATION_TRACK_KEYS.map((key) => {
    const progress = state.tracks[key];
    const labels = BODY_TRACK_LABELS[key];
    const nextMilestoneLevel = getNextMilestoneLevel(progress.level);
    return {
      key,
      path: `body.${key}` as BodyCultivationTrackPath,
      name: labels.name,
      layerName: labels.layerName,
      shortDesc: labels.shortDesc,
      level: progress.level,
      progress: progress.progress,
      threshold: getBodyCultivationThresholdByLevel(progress.level),
      nextMilestoneLevel,
      levelsToNextMilestone: nextMilestoneLevel - progress.level,
      currentEffects: bodyCultivationEffectTexts(key, progress.level),
      nextLevelEffects: bodyCultivationEffectTexts(key, progress.level + 1),
    };
  });
  const totalLevel = tracks.reduce((sum, track) => sum + track.level, 0);

  return {
    realm: {
      key: realmConfig.realm,
      label: realmConfig.label,
    },
    totalLevel,
    tracks,
    trackLevelCap: getBodyCultivationLevelCapByCultivationRealm(
      options.cultivatorRealm,
    ),
    nextTitle:
      BODY_CULTIVATION_PACK.realms.find((row) => row.totalLevel > totalLevel) ??
      null,
  };
}
