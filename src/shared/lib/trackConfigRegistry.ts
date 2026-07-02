import type { Attributes } from '@shared/types/cultivator';
import type { ConditionTrackPath } from '@shared/types/condition';
import {
  BODY_CULTIVATION_TRACK_KEYS,
  BODY_TRACK_LABELS,
  LEGACY_TEMPERING_TO_BODY_TRACK,
  getBodyCultivationThresholdByLevel,
  getBodyTrackKeyFromPath,
  isBodyCultivationTrackPath,
  isLegacyTemperingTrackPath,
} from './bodyCultivation/config';

export type TrackReward =
  | {
      kind: 'none';
    }
  | {
      kind: 'body_modifier';
    }
  | {
      kind: 'attribute';
      attribute: keyof Attributes;
      amount: number;
    }
  | {
      kind: 'spiritual_root';
      mode: 'all';
      amount: number;
      cap: number;
    };

export interface TrackConfig {
  key: ConditionTrackPath;
  name: string;
  shortDesc: string;
  thresholdByLevel: (level: number) => number;
  reward: TrackReward;
}

const trackConfigs = {
  ...Object.fromEntries(
    BODY_CULTIVATION_TRACK_KEYS.map((key) => {
      const labels = BODY_TRACK_LABELS[key];
      return [
        `body.${key}`,
        {
          key: `body.${key}`,
          name: labels.name,
          shortDesc: labels.shortDesc,
          thresholdByLevel: getBodyCultivationThresholdByLevel,
          reward: {
            kind: 'body_modifier',
          },
        },
      ];
    }),
  ),
  ...Object.fromEntries(
    Object.entries(LEGACY_TEMPERING_TO_BODY_TRACK).map(([legacyKey, bodyKey]) => {
      const labels = BODY_TRACK_LABELS[bodyKey];
      return [
        `tempering.${legacyKey}`,
        {
          key: `tempering.${legacyKey}`,
          name: labels.name,
          shortDesc: `${labels.shortDesc}（旧炼体进度已重铸）`,
          thresholdByLevel: getBodyCultivationThresholdByLevel,
          reward: {
            kind: 'body_modifier',
          },
        },
      ];
    }),
  ),
  marrow_wash: {
    key: 'marrow_wash',
    name: '洗髓',
    shortDesc: '升级后获得 1 点自由属性点，破限后强化后天灵根强度',
    thresholdByLevel: (level) => 100 * (level + 1),
    reward: {
      kind: 'none',
    },
  },
} as Record<ConditionTrackPath, TrackConfig>;

export function getTrackConfig(key: ConditionTrackPath): TrackConfig {
  if (isLegacyTemperingTrackPath(key)) {
    const bodyKey = getBodyTrackKeyFromPath(key);
    return trackConfigs[`body.${bodyKey}`];
  }
  return trackConfigs[key];
}

export function getAllTrackConfigs(): TrackConfig[] {
  return Object.values(trackConfigs).filter(
    (config) => config.key === 'marrow_wash' || isBodyCultivationTrackPath(config.key),
  );
}
