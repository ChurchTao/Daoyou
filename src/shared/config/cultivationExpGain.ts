import type { Quality, RealmType } from '@shared/types/constants';

export const EXP_GAIN_REALM_PACE_MULTIPLIER = {
  炼气: 3.0,
  筑基: 2.0,
  金丹: 1.4,
  元婴: 1.0,
  化神: 0.78,
  炼虚: 0.62,
  合体: 0.5,
  大乘: 0.42,
  渡劫: 0.35,
} satisfies Record<RealmType, number>;

export const RETREAT_EXP_BUDGET = {
  percentByRealm: {
    炼气: 0.04,
    筑基: 0.01667,
    金丹: 0.00667,
    元婴: 0.00273,
    化神: 0.00106,
    炼虚: 0.000471,
    合体: 0.000333,
    大乘: 0.00025,
    渡劫: 0.00016,
  } satisfies Record<RealmType, number>,
  maxYears: 200,
  minBaseExp: 1,
} as const;

export const OFFLINE_YIELD_EXP_BUDGET = {
  percentPerUnit: 0.004,
  hoursPerUnit: 6,
  maxUnits: 4,
  minBaseExp: 1,
  randomFactor: {
    min: 0.8,
    range: 0.4,
  },
} as const;

export const BATTLE_VICTORY_EXP_BUDGET = {
  percent: 0.006,
  minBaseExp: 1,
  realmDiffMultiplier: {
    weaker: 0.25,
    same: 1,
    oneAbove: 1.4,
    twoOrMoreAbove: 1.8,
  },
  victoryMultiplier: {
    normal: 1,
    perfect: 1.15,
    challenged: 1.1,
  },
} as const;

export const DUNGEON_EXP_BUDGET = {
  minBaseExp: 1,
  tierPercent: {
    S: 0.085,
    A: 0.055,
    B: 0.032,
    C: 0.016,
    D: 0.008,
  },
  resultPercent: {
    perfect: 0.085,
    good: 0.055,
    normal: 0.032,
    failed: 0.008,
  },
  dangerBonusScale: 0.2,
} as const;

export const DAILY_TASK_EXP_BUDGET = {
  minBaseExp: 1,
  difficultyPercent: {
    easy: 0.012,
    normal: 0.022,
    hard: 0.038,
    elite: 0.06,
  },
} as const;

export const PILL_EXP_BUDGET = {
  percentByQuality: {
    凡品: 0.002,
    灵品: 0.0035,
    玄品: 0.006,
    真品: 0.01,
    地品: 0.017,
    天品: 0.028,
    仙品: 0.045,
    神品: 0.07,
  } satisfies Record<Quality, number>,
  minBaseExp: 1,
} as const;

export const EVENT_EXP_BUDGET = {
  minBaseExp: 1,
  percentByWeight: {
    minor: 0.004,
    normal: 0.008,
    major: 0.016,
  },
} as const;

export const SYSTEM_REWARD_EXP_BUDGET = {
  minBaseExp: 1,
  maxPercent: 0.08,
  percentByWeight: {
    minor: 0.005,
    normal: 0.01,
    major: 0.025,
  },
} as const;
