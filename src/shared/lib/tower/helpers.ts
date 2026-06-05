import {
  ENEMY_RACE_VALUES,
  REALM_ORDER,
  type EnemyRace,
  type RealmStage,
  type RealmType,
} from '@shared/types/constants';
import {
  TOWER_BLESSING_DEFINITIONS,
  TOWER_BLESSING_IDS,
  type TowerBlessingId,
} from './blessings';
import type {
  TowerBlessingChoice,
  TowerMilestoneTier,
  TowerFloorKind,
} from './types';

export const TOWER_MAX_FLOOR = 20;
export const TOWER_DIFFICULTY_STEP = 5;
export const TOWER_LEADERBOARD_SCORE_UNIT = 1_000_000_000;
export const TOWER_ELIGIBLE_REALMS = [
  '金丹',
  '元婴',
  '化神',
  '炼虚',
  '合体',
  '大乘',
  '渡劫',
] as const satisfies readonly RealmType[];
export const TOWER_MIN_REALM: RealmType = '金丹';

export function isTowerRealmEligible(realm: RealmType): boolean {
  return REALM_ORDER[realm] >= REALM_ORDER[TOWER_MIN_REALM];
}

export function clampTowerFloor(floor: number) {
  return Math.max(1, Math.min(TOWER_MAX_FLOOR, Math.floor(floor)));
}

export function resolveTowerDifficulty(floor: number) {
  return clampTowerFloor(floor) * TOWER_DIFFICULTY_STEP;
}

export function resolveTowerFloorKind(floor: number): TowerFloorKind {
  const safeFloor = clampTowerFloor(floor);
  if (safeFloor % 10 === 0) return 'boss';
  if (safeFloor % 5 === 0) return 'elite';
  return 'normal';
}

export function resolveTowerRealmStage(floor: number): RealmStage {
  const normalized = ((clampTowerFloor(floor) - 1) % 10) + 1;
  if (normalized <= 3) return '初期';
  if (normalized <= 6) return '中期';
  if (normalized <= 9) return '后期';
  return '圆满';
}

export function resolveTowerMilestoneTier(
  floor: number,
): TowerMilestoneTier | null {
  const normalizedFloor = Math.floor(floor);
  switch (normalizedFloor) {
    case 5:
      return 'C';
    case 10:
      return 'B';
    case 15:
      return 'A';
    case 20:
      return 'S';
    default:
      return null;
  }
}

export function hashTowerSeed(seed: string) {
  let hash = 2166136261;
  for (const char of seed) {
    hash ^= char.charCodeAt(0);
    hash = Math.imul(hash, 16777619);
  }
  return Math.abs(hash >>> 0);
}

export function pickTowerRace(runId: string, floor: number): EnemyRace {
  return ENEMY_RACE_VALUES[hashTowerSeed(`${runId}:${floor}:race`) % ENEMY_RACE_VALUES.length];
}

export function buildTowerEnemyVariantSeed(args: {
  seasonKey: string;
  realm: RealmType;
  floor: number;
}) {
  return `tower:${args.seasonKey}:${args.realm}:${clampTowerFloor(args.floor)}`;
}

export function packTowerLeaderboardScore(
  highestFloor: number,
  firstReachedAtMs: number,
  seasonEndAtMs: number,
) {
  return (
    clampTowerFloor(highestFloor) * TOWER_LEADERBOARD_SCORE_UNIT +
    Math.max(0, seasonEndAtMs - Math.floor(firstReachedAtMs))
  );
}

export function unpackTowerLeaderboardScore(
  score: number,
  seasonEndAtMs: number,
) {
  const floor = Math.floor(score / TOWER_LEADERBOARD_SCORE_UNIT);
  const tieValue =
    Math.round(score) - floor * TOWER_LEADERBOARD_SCORE_UNIT;

  return {
    highestFloor: floor,
    firstReachedAtMs: seasonEndAtMs - tieValue,
  };
}

export function buildTowerBlessingChoices(args: {
  runId: string;
  clearedFloor: number;
  blessings: Partial<Record<TowerBlessingId, number>>;
  currentHp: number;
  maxHp: number;
  currentMp: number;
  maxMp: number;
}): TowerBlessingChoice[] {
  const available = TOWER_BLESSING_IDS.filter((id) => {
    const currentStacks = args.blessings[id] ?? 0;
    return currentStacks < TOWER_BLESSING_DEFINITIONS[id].maxStacks;
  });

  if (available.length === 0) {
    return [];
  }

  const forced = new Set<TowerBlessingId>();
  if (
    args.maxHp > 0 &&
    args.currentHp / args.maxHp <= 0.5 &&
    available.includes('breathing_technique')
  ) {
    forced.add('breathing_technique');
  }
  if (
    args.maxMp > 0 &&
    args.currentMp / args.maxMp <= 0.35 &&
    available.includes('meridian_cycle')
  ) {
    forced.add('meridian_cycle');
  }

  const sorted = [...available].sort(
    (left, right) =>
      hashTowerSeed(`${args.runId}:${args.clearedFloor}:${left}`) -
      hashTowerSeed(`${args.runId}:${args.clearedFloor}:${right}`),
  );

  const ordered = [
    ...Array.from(forced),
    ...sorted.filter((id) => !forced.has(id)),
  ].slice(0, Math.min(3, available.length));

  return ordered.map((id) => {
    const definition = TOWER_BLESSING_DEFINITIONS[id];
    const currentStacks = args.blessings[id] ?? 0;
    return {
      id,
      name: definition.name,
      description: definition.description,
      currentStacks,
      nextStacks: Math.min(definition.maxStacks, currentStacks + 1),
      maxStacks: definition.maxStacks,
    };
  });
}
