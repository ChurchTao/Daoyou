import generation from '../../engine/combat-v6/tower/data/generation.json';
import { towerStrategyPreview } from '../../engine/combat-v6/tower/strategy';
import { expandTowerFloor } from '../../engine/combat-v6/tower/strategy-templates';
import {
  allowedTowerFormations,
  type TowerEnemyRole,
  type TowerFormationId,
  type TowerKeyFormation,
} from './formations';
import { hashTowerSeed } from './helpers';
import type { TowerSeasonMeta } from './types';

export const TOWER_CONTENT_VERSION = 'combat-v6-tower-v7' as const;
export const TOWER_KEY_FLOORS = [5, 10, 15, 20] as const;
export const TOWER_COMBINATIONS = generation.combinations;
export type TowerCombination = (typeof TOWER_COMBINATIONS)[number];
export type TowerCombinationId = TowerCombination['id'];
export interface TowerWeek {
  version: typeof TOWER_CONTENT_VERSION;
  seasonKey: string;
  floors: Array<{
    floor: number;
    combinationId: TowerCombinationId;
    formationId?: TowerKeyFormation;
    encounterId?: string;
  }>;
}

export const TOWER_GENERATOR_VERSION = 'tower-week-v2';
export const TOWER_ENCOUNTERS = TOWER_COMBINATIONS.flatMap((combo) =>
  allowedTowerFormations('boss', combo).map((formationId) => ({
    id: `${combo.id}:${formationId}`,
    combinationId: combo.id,
    formationId,
    kinds: allowedTowerFormations('elite', combo).includes(formationId)
      ? (['elite', 'boss'] as const)
      : (['boss'] as const),
  })),
);

/** Enumerate the small legal pool; soft preferences never relax combat constraints. */
export function createTowerWeek(
  season: TowerSeasonMeta,
  history: readonly TowerWeek[] = [],
  strategyScoring?: {
    history: readonly {
      seasonKey: string;
      floors: { floor: number; signature: string; formation: string }[];
    }[];
    identity: (row: TowerWeek['floors'][number]) => {
      signature: string;
      formation: string;
    };
  },
): TowerWeek {
  const index = Math.floor(Date.parse(season.seasonStartedAt) / (7 * 86400000));
  if (!Number.isFinite(index)) throw new Error('幻境周标识无效');
  const recent = history
    .filter((w) => w.seasonKey < season.seasonKey)
    .sort((a, b) => b.seasonKey.localeCompare(a.seasonKey))
    .slice(0, 3);
  const previous = recent[0];
  const slots = TOWER_KEY_FLOORS.map((floor, slot) => {
    const style = (['physical', 'spell', 'seal'] as const)[
      (((index + [0, 1, 1, 2][slot]) % 3) + 3) % 3
    ];
    return TOWER_ENCOUNTERS.filter(
      (e) =>
        e.kinds.some((k) => k === (floor % 10 === 0 ? 'boss' : 'elite')) &&
        towerCombination(e.combinationId).style === style,
    );
  });
  const strategyHistory = strategyScoring?.history
    .filter((w) => w.seasonKey < season.seasonKey)
    .sort((a, b) => b.seasonKey.localeCompare(a.seasonKey))
    .slice(0, 3);
  const identity = (r: TowerWeek['floors'][number]) =>
    `${r.combinationId}:${r.formationId ?? 'solo'}`;
  let best: TowerWeek['floors'] | undefined;
  let bestScore: number[] | undefined;
  function visit(rows: TowerWeek['floors']) {
    if (rows.length < 4) {
      for (const candidate of slots[rows.length]) {
        if (rows.some((r) => r.combinationId === candidate.combinationId))
          continue;
        visit([
          ...rows,
          {
            floor: TOWER_KEY_FLOORS[rows.length],
            combinationId: candidate.combinationId,
            formationId: candidate.formationId,
            encounterId: candidate.id,
          },
        ]);
      }
      return;
    }
    if (rows.every((r) => r.formationId === 'solo')) return;
    const repeats = (bossOnly: boolean) =>
      strategyScoring && strategyHistory
        ? rows.reduce(
            (n, r) =>
              n +
              (bossOnly && r.floor % 10 !== 0
                ? 0
                : strategyHistory.reduce(
                    (m, w) =>
                      m +
                      w.floors.filter(
                        (old) =>
                          old.signature ===
                          strategyScoring.identity(r).signature,
                      ).length,
                    0,
                  )),
            0,
          )
        : rows.reduce(
            (n, r) =>
              n +
              (bossOnly && r.floor % 10 !== 0
                ? 0
                : recent.reduce(
                    (m, w) =>
                      m +
                      w.floors.filter((old) => identity(old) === identity(r))
                        .length,
                    0,
                  )),
            0,
          );
    const signature = rows.map(identity).join('|');
    const score = [
      repeats(true),
      repeats(false),
      rows.filter((r) =>
        strategyScoring && strategyHistory
          ? strategyHistory[0]?.floors.find((p) => p.floor === r.floor)
              ?.formation === strategyScoring.identity(r).formation
          : previous?.floors.find((p) => p.floor === r.floor)?.formationId ===
            r.formationId,
      ).length,
      4 - new Set(rows.map((r) => r.formationId)).size,
      hashTowerSeed(
        `${season.seasonKey}:${TOWER_GENERATOR_VERSION}:${signature}`,
      ),
    ];
    const firstDifference = score.findIndex((n, i) => n !== bestScore?.[i]);
    if (
      !bestScore ||
      (firstDifference >= 0 &&
        score[firstDifference] < bestScore[firstDifference])
    ) {
      best = rows;
      bestScore = score;
    }
  }
  visit([]);
  if (!best) throw new Error('幻境周组合池无法满足编排规则');
  return {
    version: TOWER_CONTENT_VERSION,
    seasonKey: season.seasonKey,
    floors: best,
  };
}
export function towerCombination(id: TowerCombinationId): TowerCombination {
  const found = TOWER_COMBINATIONS.find((c) => c.id === id);
  if (!found) throw new Error('幻境组合版本无法恢复');
  return found;
}
export interface TowerEnemyMember {
  id: string;
  name: string;
  icon: string;
  role: TowerEnemyRole;
  details: string[];
}
export interface TowerEnemyPreview {
  floor: number;
  kind: 'normal' | 'elite' | 'boss';
  name: string;
  icon: string;
  labels: string[];
  details: string[];
  formationId?: TowerFormationId;
  members: TowerEnemyMember[];
}
export function towerEnemyPreview(
  floor: number,
  week: TowerWeek,
): TowerEnemyPreview {
  return towerStrategyPreview(expandTowerFloor(week, floor));
}
