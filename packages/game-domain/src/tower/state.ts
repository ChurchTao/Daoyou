import type { ResourceOperation } from '../resources/operations.js';
import type { CultivatorCondition } from '../condition.js';
import type { EnemyRace } from '../character.js';
import type { RealmStage, RealmType } from '@daoyou/constants/realms';
import type { TowerBlessingId } from './blessings.js';

export type TowerRunStatus =
  | 'READY'
  | 'WAITING_BATTLE'
  | 'CHOOSING_BLESSING'
  | 'FINISHED';

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

export interface TowerEncounter {
  floor: number;
  kind: TowerFloorKind;
  difficulty: number;
  race: EnemyRace;
  realm: RealmType;
  realmStage: RealmStage;
  isBoss: boolean;
}

export interface TowerMilestoneReward {
  floor: number;
  tier: TowerMilestoneTier;
  realm: RealmType;
  grantedAt: string;
  rewards: ResourceOperation[];
}

export interface TowerSettlement {
  seasonKey: string;
  highestFloorCleared: number;
  finalFloor: number;
  endReason: 'defeat' | 'clear';
  milestoneRewards: TowerMilestoneReward[];
  blessings: Partial<Record<TowerBlessingId, number>>;
}

export interface TowerState {
  runId: string;
  seasonKey: string;
  challengeRealm: RealmType;
  status: TowerRunStatus;
  currentFloor: number;
  highestFloorCleared: number;
  condition: CultivatorCondition;
  blessings: Partial<Record<TowerBlessingId, number>>;
  pendingBlessingChoices: TowerBlessingChoice[];
  claimedMilestones: number[];
  milestoneRewardLog: TowerMilestoneReward[];
  activeBattleId?: string;
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
