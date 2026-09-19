import { z } from 'zod';
import type { TowerSeasonMeta } from '../../../lib/tower/types';
import {
  createTowerWeek,
  TOWER_CONTENT_VERSION,
  TOWER_GENERATOR_VERSION,
  type TowerWeek,
} from '../../../lib/tower/weekly';
import type { RealmType } from '../../../types/constants';
import {
  TOWER_STRATEGY_VERSION,
  TowerFloorStrategySchema,
  towerStrategyPreview,
  towerStrategySignature,
  validateTowerFloorStrategy,
} from './strategy';
import { compileTowerStrategy } from './strategy-compiler';
import { expandTowerFloor, expandTowerWeek } from './strategy-templates';

const PublishedTowerWeekSchema = z.strictObject({
  schemaVersion: z.literal(3),
  contentVersion: z.literal(TOWER_STRATEGY_VERSION),
  generatorVersion: z.string().min(1),
  season: z.strictObject({
    seasonKey: z.string().min(1),
    seasonStartedAt: z.iso.datetime(),
    seasonEndsAt: z.iso.datetime(),
    nextResetAt: z.iso.datetime(),
  }),
  floors: z.array(TowerFloorStrategySchema).length(20),
});
export type PublishedTowerWeek = z.infer<typeof PublishedTowerWeekSchema>;
export type StoredTowerWeek = PublishedTowerWeek;

export function validatePublishedTowerWeek(
  input: unknown,
): asserts input is PublishedTowerWeek {
  const pack = PublishedTowerWeekSchema.parse(input);
  pack.floors.forEach((f, i) => {
    if (f.floor !== i + 1) throw new Error('幻境发布配置缺层或顺序无效');
    validateTowerFloorStrategy(f);
  });
}
export function publishTowerWeek(
  season: TowerSeasonMeta,
  history: readonly PublishedTowerWeek[] = [],
): PublishedTowerWeek {
  const identities = new Map<
    string,
    { signature: string; formation: string }
  >();
  const week = createTowerWeek(season, [], {
    history: history.map((w) => ({
      seasonKey: w.season.seasonKey,
      floors: w.floors
        .filter((f) => f.kind !== 'normal')
        .map((f) => ({
          floor: f.floor,
          signature: towerStrategySignature(f),
          formation: towerStrategySignature(f, true),
        })),
    })),
    identity: (row) => {
      const key = `${row.floor}:${row.combinationId}:${row.formationId}`;
      let result = identities.get(key);
      if (!result) {
        const template: TowerWeek = {
          version: TOWER_CONTENT_VERSION,
          seasonKey: season.seasonKey,
          floors: [row],
        };
        const floor = expandTowerFloor(template, row.floor);
        result = {
          signature: towerStrategySignature(floor),
          formation: towerStrategySignature(floor, true),
        };
        identities.set(key, result);
      }
      return result;
    },
  });
  const pack: PublishedTowerWeek = {
    schemaVersion: 3,
    contentVersion: TOWER_STRATEGY_VERSION,
    generatorVersion: TOWER_GENERATOR_VERSION,
    season: structuredClone(season),
    floors: expandTowerWeek(week),
  };
  validatePublishedTowerWeek(pack);
  return pack;
}
export function publishedTowerEncounter(
  pack: PublishedTowerWeek,
  realm: string,
  floor: number,
) {
  if (
    pack.schemaVersion !== 3 ||
    !Number.isInteger(floor) ||
    floor < 1 ||
    floor > 20 ||
    pack.floors[floor - 1]?.floor !== floor
  )
    throw new Error('幻境发布配置无法读取');
  return compileTowerStrategy(
    realm as RealmType,
    pack.floors[floor - 1],
    pack.contentVersion,
  );
}
export function publishedTowerPreviews(pack: PublishedTowerWeek) {
  validatePublishedTowerWeek(pack);
  return pack.floors.map(towerStrategyPreview);
}
