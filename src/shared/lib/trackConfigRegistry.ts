import type { Attributes } from '@shared/types/cultivator';
import type { ConditionTrackPath } from '@shared/types/condition';

export type TrackReward =
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

const trackConfigs: Record<ConditionTrackPath, TrackConfig> = {
  'tempering.vitality': {
    key: 'tempering.vitality',
    name: '炼体·体魄',
    shortDesc: '升级后永久提升体魄',
    thresholdByLevel: (level) => 100 * (level + 1),
    reward: {
      kind: 'attribute',
      attribute: 'vitality',
      amount: 1,
    },
  },
  'tempering.spirit': {
    key: 'tempering.spirit',
    name: '炼体·灵力',
    shortDesc: '升级后永久提升灵力',
    thresholdByLevel: (level) => 100 * (level + 1),
    reward: {
      kind: 'attribute',
      attribute: 'spirit',
      amount: 1,
    },
  },
  'tempering.wisdom': {
    key: 'tempering.wisdom',
    name: '炼体·悟性',
    shortDesc: '升级后永久提升悟性',
    thresholdByLevel: (level) => 100 * (level + 1),
    reward: {
      kind: 'attribute',
      attribute: 'wisdom',
      amount: 1,
    },
  },
  'tempering.speed': {
    key: 'tempering.speed',
    name: '炼体·身法',
    shortDesc: '升级后永久提升身法',
    thresholdByLevel: (level) => 100 * (level + 1),
    reward: {
      kind: 'attribute',
      attribute: 'speed',
      amount: 1,
    },
  },
  'tempering.willpower': {
    key: 'tempering.willpower',
    name: '炼体·神识',
    shortDesc: '升级后永久提升神识',
    thresholdByLevel: (level) => 100 * (level + 1),
    reward: {
      kind: 'attribute',
      attribute: 'willpower',
      amount: 1,
    },
  },
  marrow_wash: {
    key: 'marrow_wash',
    name: '洗髓',
    shortDesc: '升级后所有灵根各提升 1 点',
    thresholdByLevel: (level) => 100 * (level + 1),
    reward: {
      kind: 'spiritual_root',
      mode: 'all',
      amount: 1,
      cap: 100,
    },
  },
};

export function getTrackConfig(key: ConditionTrackPath): TrackConfig {
  return trackConfigs[key];
}

export function getAllTrackConfigs(): TrackConfig[] {
  return Object.values(trackConfigs);
}
