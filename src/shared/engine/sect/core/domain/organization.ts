import { getRealmStageRank } from '@shared/config/realmProgression';
import type { RealmStage, RealmType } from '@shared/types/constants';

export const SECT_DISCIPLE_RANKS = [
  'registered',
  'outer',
  'inner',
  'true',
] as const;

export type SectDiscipleRank = (typeof SECT_DISCIPLE_RANKS)[number];
export type SectOffice = 'none' | 'steward' | 'protector' | 'elder';

export type SectFacilityKey = string;
export type UpgradeableSectFacilityKey = string;

export const SECT_RANK_ORDER: Record<SectDiscipleRank, number> = {
  registered: 0,
  outer: 1,
  inner: 2,
  true: 3,
};

export const SECT_RANK_LABELS: Record<SectDiscipleRank, string> = {
  registered: '记名弟子',
  outer: '外门弟子',
  inner: '内门弟子',
  true: '真传弟子',
};

export const SECT_RANK_METHOD_CAP: Record<SectDiscipleRank, number> = {
  registered: 5,
  outer: 20,
  inner: 40,
  true: Number.MAX_SAFE_INTEGER,
};

export interface SectFacilityState {
  key: SectFacilityKey;
  level: number;
  updatedAt?: string;
}

export interface SectConstructionProjectState {
  id: string;
  sectId: string;
  facilityKey: string;
  targetLevel: number;
  progress: number;
  target: number;
  status: 'active' | 'completed';
  startedWeekKey: string;
  completedAt?: string;
}

export interface SectRankRequirement {
  rank: SectDiscipleRank;
  minRealm: RealmType;
  contribution: number;
  dailyCompletions?: number;
  requiredTaskTags?: readonly { tag: string; label: string }[];
}

export function hasSectRank(
  actual: SectDiscipleRank,
  required: SectDiscipleRank,
): boolean {
  return SECT_RANK_ORDER[actual] >= SECT_RANK_ORDER[required];
}

export function getEffectiveSectMethodLevelCap(args: {
  realmCap: number;
  rank: SectDiscipleRank;
  facilityCap: number;
  rankCap?: number;
}): number {
  return Math.min(
    args.realmCap,
    args.rankCap ?? SECT_RANK_METHOD_CAP[args.rank],
    args.facilityCap,
  );
}

export function realmMeetsSectRank(
  realm: RealmType,
  stage: RealmStage,
  requiredRealm: RealmType,
): boolean {
  return (
    getRealmStageRank(realm, stage) >=
    getRealmStageRank(requiredRealm, '初期')
  );
}
