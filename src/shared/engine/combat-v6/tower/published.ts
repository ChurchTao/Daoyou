import { z } from 'zod';
import { TOWER_ELIGIBLE_REALMS } from '../../../lib/tower/helpers';
import type { TowerSeasonMeta } from '../../../lib/tower/types';
import {
  createTowerWeek,
  TOWER_CONTENT_VERSION,
  TOWER_GENERATOR_VERSION,
  type TowerWeek,
} from '../../../lib/tower/weekly';
import type { RealmType } from '../../../types/constants';
import {
  validateLegacyPublishedTowerWeek,
  type LegacyPublishedTowerWeek,
} from './legacy-publication';
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
  schemaVersion: z.literal(2),
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
export type StoredTowerWeek = PublishedTowerWeek | LegacyPublishedTowerWeek;

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
    schemaVersion: 2,
    contentVersion: TOWER_STRATEGY_VERSION,
    generatorVersion: `${TOWER_GENERATOR_VERSION}-strategy-v2`,
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
    pack.schemaVersion !== 2 ||
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

/** Compare every authored fact before replacing an existing row; never reroll it. */
export function upgradeTowerPublication(
  old: LegacyPublishedTowerWeek,
): PublishedTowerWeek {
  if (old.week.version !== 'combat-v6-tower-v4')
    throw new Error('幻境旧内容版本不支持策略转换');
  validateLegacyPublishedTowerWeek(old);
  const next: PublishedTowerWeek = {
    schemaVersion: 2,
    contentVersion: TOWER_STRATEGY_VERSION,
    generatorVersion: old.generatorVersion,
    season: structuredClone(old.season),
    floors: expandTowerWeek(old.week),
  };
  validatePublishedTowerWeek(next);
  const canonical = (value: unknown): string => {
    if (Array.isArray(value)) return `[${value.map(canonical).join(',')}]`;
    if (value && typeof value === 'object')
      return `{${Object.entries(value)
        .sort(([a], [b]) => a.localeCompare(b))
        .map(([k, v]) => `${JSON.stringify(k)}:${canonical(v)}`)
        .join(',')}}`;
    return JSON.stringify(value);
  };
  for (const realm of TOWER_ELIGIBLE_REALMS) {
    for (let floor = 1; floor <= 20; floor++) {
      const compiled = publishedTowerEncounter(next, realm, floor);
      const previous = old.encounters[realm]?.[floor - 1];
      if (!previous) throw new Error(`幻境转换缺少 ${realm} 第${floor}层`);
      for (const key of ['units', 'plans', 'skills', 'statusDefs'] as const) {
        const expected =
          key === 'units' || key === 'plans' ? previous[key] : old[key];
        if (canonical(compiled[key]) !== canonical(expected))
          throw new Error(`幻境转换不等价：${realm} 第${floor}层 ${key}`);
      }
    }
  }
  return next;
}
