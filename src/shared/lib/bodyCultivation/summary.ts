import type {
  BodyCultivationRealm,
  BodyCultivationTrackKey,
  BodyCultivationTrackPath,
  CultivatorCondition,
} from '@shared/types/condition';
import type { RealmType } from '@shared/types/constants';
import {
  BODY_CULTIVATION_TRACK_KEYS,
  BODY_CULTIVATION_REALM_REQUIREMENTS,
  BODY_TRACK_LABELS,
  type BodyCultivationRealmRequirement,
  getNextBodyCultivationRealm,
  getBodyCultivationThresholdByLevel,
  isCultivationRealmAtLeast,
} from './config';
import { normalizeBodyCultivationState } from './normalize';

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
  softTrackCap: number;
  unlockText: string;
}

export interface BodyCultivationBreakthroughRequirementSummary {
  label: string;
  met: boolean;
}

export interface BodyCultivationNextRealmSummary
  extends BodyCultivationRealmSummary {
  canAttempt: boolean;
  requirements: BodyCultivationBreakthroughRequirementSummary[];
}

export interface BodyCultivationSummary {
  realm: BodyCultivationRealmSummary;
  totalLevel: number;
  tracks: BodyCultivationTrackSummary[];
  nextRealm: BodyCultivationNextRealmSummary | null;
}

function getEffectTexts(key: BodyCultivationTrackKey, level: number): string[] {
  const safeLevel = Math.max(0, Math.floor(level));
  switch (key) {
    case 'skin':
      return [`防御修炼 Lv.${safeLevel}`];
    case 'sinew_bone':
      return [`攻法修炼 Lv.${safeLevel}`];
    case 'organs':
      return [`法术修炼 Lv.${safeLevel}`];
    case 'qi_blood':
      return [
        `裸身气血 +${Number((safeLevel * 0.5).toFixed(1))}%`,
        `固定治疗强度 +${Math.floor(safeLevel / 2)}`,
      ];
    case 'primordial_spirit':
      return [`抗法修炼 Lv.${safeLevel}`];
  }
}

function getNextMilestoneLevel(level: number): number {
  return Math.max(5, Math.ceil((Math.max(0, level) + 1) / 5) * 5);
}

function buildNextRealmSummary(options: {
  currentRealm: BodyCultivationRealm;
  totalLevel: number;
  cultivatorRealm?: RealmType;
}): BodyCultivationNextRealmSummary | null {
  const nextRealm = getNextBodyCultivationRealm(options.currentRealm);
  if (!nextRealm) return null;

  const config: BodyCultivationRealmRequirement =
    BODY_CULTIVATION_REALM_REQUIREMENTS[nextRealm];
  const requirements: BodyCultivationBreakthroughRequirementSummary[] = [
    {
      label: `总炼体 Lv.${options.totalLevel}/${config.totalLevel}`,
      met: options.totalLevel >= config.totalLevel,
    },
    {
      label: `修为境界达到${config.minCultivationRealm}`,
      met: isCultivationRealmAtLeast(
        options.cultivatorRealm,
        config.minCultivationRealm,
      ),
    },
  ];

  return {
    key: config.realm,
    label: config.label,
    softTrackCap: config.softTrackCap,
    unlockText: config.unlockText,
    canAttempt: requirements.every((requirement) => requirement.met),
    requirements,
  };
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
      currentEffects: getEffectTexts(key, progress.level),
      nextLevelEffects: getEffectTexts(key, progress.level + 1),
    };
  });
  const totalLevel = tracks.reduce((sum, track) => sum + track.level, 0);

  return {
    realm: {
      key: realmConfig.realm,
      label: realmConfig.label,
      softTrackCap: realmConfig.softTrackCap,
      unlockText: realmConfig.unlockText,
    },
    totalLevel,
    tracks,
    nextRealm: buildNextRealmSummary({
      currentRealm: state.realm,
      totalLevel,
      cultivatorRealm: options.cultivatorRealm,
    }),
  };
}
