import type { RealmType } from './constants';

export type BattleMode = 'persistent_pve' | 'standard_pvp' | 'training';

export type ConditionResourceKey = 'hp' | 'mp';

export interface ConditionResourcePoint {
  current: number;
}

export interface ConditionProgressTrack {
  level: number;
  progress: number;
}

export type TemperingTrackKey =
  | 'vitality'
  | 'spirit'
  | 'wisdom'
  | 'speed'
  | 'willpower';

export type ConditionTrackPath = `tempering.${TemperingTrackKey}` | 'marrow_wash';

export type ConditionStatusKey =
  | 'weakness'
  | 'minor_wound'
  | 'major_wound'
  | 'near_death'
  | 'breakthrough_focus'
  | 'protect_meridians'
  | 'clear_mind';

export type ConditionStatusSource = 'battle' | 'pill' | 'event' | 'system';

export type ConditionStatusDuration =
  | { kind: 'until_removed' }
  | { kind: 'time'; expiresAt: string };

export interface ConditionStatusInstance {
  key: ConditionStatusKey;
  stacks: number;
  source: ConditionStatusSource;
  duration: ConditionStatusDuration;
  usesRemaining?: number;
  payload?: Record<string, number | string | boolean>;
  createdAt: string;
  updatedAt: string;
}

export interface CultivatorCondition {
  version: 1;
  resources: {
    hp: ConditionResourcePoint;
    mp: ConditionResourcePoint;
  };
  gauges: {
    pillToxicity: number;
  };
  tracks: {
    tempering: Record<TemperingTrackKey, ConditionProgressTrack>;
    marrowWash: ConditionProgressTrack;
  };
  counters: {
    longTermPillUsesByRealm: Partial<Record<RealmType, number>>;
  };
  statuses: ConditionStatusInstance[];
  timestamps: {
    lastRecoveryAt?: string;
    lastBattleAt?: string;
    lastPillAt?: string;
    lastBreakthroughAt?: string;
  };
  metrics?: {
    totalRecoveredHp?: number;
    totalRecoveredMp?: number;
  };
}
