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

function formatPercent(value: number): string {
  const percent = Number((value * 100).toFixed(1));
  return `${Number.isInteger(percent) ? percent.toFixed(0) : percent}%`;
}

function clamp(value: number, min: number, max: number): number {
  return Math.max(min, Math.min(max, value));
}

function getEffectTexts(key: BodyCultivationTrackKey, level: number): string[] {
  switch (key) {
    case 'skin':
      return [
        `物防 +${formatPercent(clamp(level * 0.006, 0, 0.45))}`,
        `法防 +${formatPercent(clamp(level * 0.004, 0, 0.3))}`,
        `受到直接伤害 -${formatPercent(clamp(level * 0.006, 0, 0.45))}`,
        ...(level >= 5
          ? [`中毒持续 -${clamp(Math.floor(level / 5), 1, 3)} 回合`]
          : []),
      ];
    case 'sinew_bone':
      return [
        `气血上限 +${formatPercent(clamp(level * 0.008, 0, 1.1))}`,
        `暴击伤害减免 +${formatPercent(clamp(level * 0.008, 0, 0.5))}`,
        `自然恢复 +${formatPercent(clamp(level * 0.006, 0, 0.75))}`,
        `突破失败修为损失 -${formatPercent(clamp(level * 0.006, 0, 0.42))}`,
      ];
    case 'organs':
      return [
        `物攻 +${formatPercent(clamp(level * 0.005, 0, 0.35))}`,
        `法攻 +${formatPercent(clamp(level * 0.004, 0, 0.3))}`,
        `秘境气血损耗 -${formatPercent(clamp(level * 0.002, 0, 0.3))}`,
        ...(level >= 5
          ? [
              `首次高耗蓝技能回蓝 ${formatPercent(
                clamp(0.08 + Math.floor(level / 5) * 0.02, 0.1, 0.24),
              )}`,
            ]
          : []),
      ];
    case 'qi_blood':
      return [
        `气血上限 +${formatPercent(clamp(level * 0.012, 0, 1.1))}`,
        `治疗效果 +${formatPercent(clamp(level * 0.004, 0, 0.25))}`,
        `自然恢复 +${formatPercent(clamp(level * 0.008, 0, 0.75))}`,
        `突破失败感悟损失 -${formatPercent(clamp(level * 0.004, 0, 0.32))}`,
      ];
    case 'primordial_spirit':
      return [
        `控制抗性 +${formatPercent(clamp(level * 0.008, 0, 0.45))}`,
        `抗暴 +${formatPercent(clamp(level * 0.005, 0, 0.3))}`,
        `心魔概率 -${formatPercent(clamp(level * 0.004, 0, 0.38))}`,
        `秘境灵力损耗 -${formatPercent(clamp(level * 0.003, 0, 0.2))}`,
      ];
  }
}

function getNextMilestoneLevel(level: number): number {
  return Math.max(5, Math.ceil((Math.max(0, level) + 1) / 5) * 5);
}

function getTrackLabel(key: BodyCultivationTrackKey): string {
  return BODY_TRACK_LABELS[key].name.replace('炼体·', '');
}

function buildNextRealmSummary(options: {
  currentRealm: BodyCultivationRealm;
  totalLevel: number;
  trackLevels: Record<BodyCultivationTrackKey, number>;
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

  if (config.requiredAnyTracks) {
    const reachedCount = BODY_CULTIVATION_TRACK_KEYS.filter(
      (key) => options.trackLevels[key] >= config.requiredAnyTracks!.minLevel,
    ).length;
    requirements.push({
      label: `任意${config.requiredAnyTracks.count}轨 Lv.${config.requiredAnyTracks.minLevel}（${reachedCount}/${config.requiredAnyTracks.count}）`,
      met: reachedCount >= config.requiredAnyTracks.count,
    });
  }

  for (const [key, level] of Object.entries(
    config.requiredTrackLevels ?? {},
  ) as Array<[BodyCultivationTrackKey, number]>) {
    requirements.push({
      label: `${getTrackLabel(key)} Lv.${options.trackLevels[key]}/${level}`,
      met: options.trackLevels[key] >= level,
    });
  }

  if (config.minAllTracksLevel) {
    const lowest = Math.min(
      ...BODY_CULTIVATION_TRACK_KEYS.map((key) => options.trackLevels[key]),
    );
    requirements.push({
      label: `五轨最低 Lv.${lowest}/${config.minAllTracksLevel}`,
      met: lowest >= config.minAllTracksLevel,
    });
  }

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
  const trackLevels = Object.fromEntries(
    BODY_CULTIVATION_TRACK_KEYS.map((key) => [key, state.tracks[key].level]),
  ) as Record<BodyCultivationTrackKey, number>;
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
      trackLevels,
      cultivatorRealm: options.cultivatorRealm,
    }),
  };
}
