import type { RealmType } from './constants';

export type BattleMode = 'persistent_pve' | 'standard_pvp' | 'training';

export type ConditionResourceKey = 'hp' | 'mp';

export interface ConditionResourcePoint {
  current: number;
  max?: number;
}

export interface ConditionProgressTrack {
  level: number;
  progress: number;
}

export type LegacyTemperingTrackKey =
  | 'vitality'
  | 'spirit'
  | 'wisdom'
  | 'speed'
  | 'willpower';

export type TemperingTrackKey = LegacyTemperingTrackKey;

export type BodyCultivationTrackKey =
  | 'skin'
  | 'sinew_bone'
  | 'organs'
  | 'qi_blood'
  | 'primordial_spirit';

export type LegacyTemperingTrackPath = `tempering.${LegacyTemperingTrackKey}`;

export type BodyCultivationTrackPath = `body.${BodyCultivationTrackKey}`;

export type ConditionTrackPath =
  | BodyCultivationTrackPath
  | LegacyTemperingTrackPath
  | 'marrow_wash';

export type BodyCultivationRealm =
  | 'mortal_body'
  | 'bronze_skin'
  | 'iron_bone'
  | 'jade_marrow'
  | 'golden_body'
  | 'dharma_body'
  | 'dao_body';

export interface BodyCultivationState {
  version: 1;
  realm: BodyCultivationRealm;
  tracks: Record<BodyCultivationTrackKey, ConditionProgressTrack>;
  milestones: Partial<Record<string, boolean>>;
  breakthrough?: {
    targetRealm: BodyCultivationRealm;
    progress: number;
    failedAttempts: number;
  };
}

export type ConditionStatusKey =
  | 'weakness'
  | 'minor_wound'
  | 'major_wound'
  | 'near_death'
  | 'breakthrough_focus'
  | 'protect_meridians'
  | 'clear_mind'
  | 'cultivation_boost';

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
    bodyCultivation?: BodyCultivationState;
    tempering: Record<TemperingTrackKey, ConditionProgressTrack>;
    marrowWash: ConditionProgressTrack;
  };
  counters: {
    longTermPillUsesByRealm: Partial<Record<RealmType, number>>;
    cultivationPillUsesByRealm: Partial<Record<RealmType, number>>;
    longevityPillUsesByRealm: Partial<Record<RealmType, number>>;
    bodyCultivationPillUses?: number;
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
