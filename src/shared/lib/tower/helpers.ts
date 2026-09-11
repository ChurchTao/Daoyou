import { TOWER_ENCOUNTER_PACK } from './encounter-pack';
import { TOWER_BLESSINGS_PACK } from './blessing-pack';
import {
  ENEMY_RACE_VALUES,
  REALM_ORDER,
  type EnemyRace,
  type RealmStage,
  type RealmType,
} from '@shared/types/constants';
import {
  compileTowerBlessingDefinitions,
  type TowerBlessingId,
} from './blessings';
import type {
  TowerBlessingChoice,
  TowerMilestoneTier,
  TowerFloorKind,
} from './types';

export const TOWER_MAX_FLOOR = TOWER_ENCOUNTER_PACK.floors.length;
export const TOWER_DIFFICULTY_STEP = TOWER_ENCOUNTER_PACK.difficultyStep;
export const TOWER_LEADERBOARD_SCORE_UNIT = 1_000_000_000;
export const TOWER_MIN_REALM: RealmType = TOWER_ENCOUNTER_PACK.minRealm;
export const TOWER_ELIGIBLE_REALMS = (Object.keys(REALM_ORDER) as RealmType[]).filter(realm => REALM_ORDER[realm] >= REALM_ORDER[TOWER_MIN_REALM]);

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
  return TOWER_ENCOUNTER_PACK.floors[clampTowerFloor(floor) - 1]?.kind ?? 'normal';
}

export function resolveTowerRealmStage(floor: number): RealmStage {
  return TOWER_ENCOUNTER_PACK.floors[clampTowerFloor(floor) - 1]?.realmStage ?? '圆满';
}

export function resolveTowerMilestoneTier(
  floor: number,
): TowerMilestoneTier | null {
  return TOWER_ENCOUNTER_PACK.floors.find(row => row.floor === Math.floor(floor))?.milestone ?? null;
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
}, pack = TOWER_BLESSINGS_PACK): TowerBlessingChoice[] {
  const definitions = compileTowerBlessingDefinitions(pack);
  const available = pack.blessings.map(b => b.id).filter((id) => {
    const currentStacks = args.blessings[id] ?? 0;
    return currentStacks < definitions[id].maxStacks;
  });

  if (available.length === 0) {
    return [];
  }

  const forced = new Set<TowerBlessingId>();
  for (const rule of pack.choices.forced) {
    const max = rule.resource === 'hp' ? args.maxHp : args.maxMp;
    const current = rule.resource === 'hp' ? args.currentHp : args.currentMp;
    if (max > 0 && current / max <= rule.atOrBelow && available.includes(rule.id)) forced.add(rule.id);
  }

  const sorted = [...available].sort(
    (left, right) =>
      hashTowerSeed(`${args.runId}:${args.clearedFloor}:${left}`) -
      hashTowerSeed(`${args.runId}:${args.clearedFloor}:${right}`),
  );

  const ordered = [
    ...Array.from(forced),
    ...sorted.filter((id) => !forced.has(id)),
  ].slice(0, Math.min(pack.choices.count, available.length));

  return ordered.map((id) => {
    const definition = definitions[id];
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
