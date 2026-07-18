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

export const SECT_FACILITY_KEYS = [
  'archive',
  'cultivation_room',
  'workshop',
  'spirit_vein',
  'herb_garden',
  'formation',
] as const;

export type SectFacilityKey = (typeof SECT_FACILITY_KEYS)[number];
export type UpgradeableSectFacilityKey = Exclude<SectFacilityKey, 'formation'>;

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

export const SECT_ARCHIVE_METHOD_CAP = [0, 20, 40, 60, 80, 100] as const;

export const SECT_FACILITY_LABELS: Record<SectFacilityKey, string> = {
  archive: '藏经阁',
  cultivation_room: '修炼室',
  workshop: '丹器坊',
  spirit_vein: '灵脉',
  herb_garden: '药田',
  formation: '护山大阵',
};

export interface SectFacilityState {
  key: SectFacilityKey;
  level: number;
  updatedAt?: string;
}

export interface SectConstructionProjectState {
  id: string;
  sectId: string;
  facilityKey: UpgradeableSectFacilityKey;
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
  requiresTournament?: boolean;
  requiresBounty?: boolean;
  requiresElderTrial?: boolean;
}

export const SECT_RANK_REQUIREMENTS: Record<
  Exclude<SectDiscipleRank, 'registered'>,
  SectRankRequirement
> = {
  outer: {
    rank: 'outer',
    minRealm: '炼气',
    contribution: 100,
    dailyCompletions: 3,
  },
  inner: {
    rank: 'inner',
    minRealm: '筑基',
    contribution: 500,
    requiresTournament: true,
  },
  true: {
    rank: 'true',
    minRealm: '金丹',
    contribution: 3000,
    requiresBounty: true,
    requiresElderTrial: true,
  },
};

export function hasSectRank(
  actual: SectDiscipleRank,
  required: SectDiscipleRank,
): boolean {
  return SECT_RANK_ORDER[actual] >= SECT_RANK_ORDER[required];
}

export function getEffectiveSectMethodLevelCap(args: {
  realmCap: number;
  rank: SectDiscipleRank;
  archiveLevel: number;
}): number {
  const archiveLevel = Math.max(1, Math.min(5, Math.floor(args.archiveLevel)));
  return Math.min(
    args.realmCap,
    SECT_RANK_METHOD_CAP[args.rank],
    SECT_ARCHIVE_METHOD_CAP[archiveLevel],
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

export function getSectFacilityBonus(
  key: SectFacilityKey,
  level: number,
): number {
  const safeLevel = Math.max(0, Math.min(5, Math.floor(level)));
  switch (key) {
    case 'cultivation_room':
    case 'workshop':
      return safeLevel * 0.02;
    case 'spirit_vein':
      return safeLevel * 0.05;
    case 'herb_garden':
      return safeLevel;
    case 'archive':
      return SECT_ARCHIVE_METHOD_CAP[safeLevel] ?? 0;
    case 'formation':
      return 0;
  }
}

export function getSectCraftDiscount(
  rank: SectDiscipleRank,
  workshopLevel: number,
): number {
  const facilityDiscount = getSectFacilityBonus('workshop', workshopLevel);
  const rankDiscount = rank === 'true' ? 0.1 : 0;
  return Math.min(0.2, facilityDiscount + rankDiscount);
}
