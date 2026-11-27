import type { RealmType } from '@daoyou/constants/realms';
import type { TowerBlessingId } from './blessings.js';

export type TowerFloorKind = 'normal' | 'elite' | 'boss';

export type TowerMilestoneTier = 'C' | 'B' | 'A' | 'S';

export interface TowerSeasonMeta {
  seasonKey: string;
  seasonStartedAt: string;
  seasonEndsAt: string;
  nextResetAt: string;
}

export interface TowerBlessingChoice {
  id: TowerBlessingId;
  name: string;
  description: string;
  currentStacks: number;
  nextStacks: number;
  maxStacks: number;
}

export interface TowerWeeklyRecord {
  cultivatorId: string;
  recordedRealm: RealmType;
  highestFloor: number;
  firstReachedAt: string;
}

export interface TowerLeaderboardEntry {
  cultivatorId: string;
  rank: number;
  name: string;
  title: string | null;
  realm: string;
  realmStage: string;
  gender: string | null;
  origin: string | null;
  highestFloor: number;
  recordedRealm: RealmType;
  firstReachedAt: string;
  isSelf: boolean;
}
