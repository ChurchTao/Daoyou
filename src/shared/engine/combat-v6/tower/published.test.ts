import { describe, expect, it } from 'vitest';
import { TOWER_ELIGIBLE_REALMS } from '../../../lib/tower/helpers';
import { getTowerSeasonMeta } from '../../../lib/tower/season';
import { createTowerWeek, TOWER_ENCOUNTERS } from '../../../lib/tower/weekly';
import { publishLegacyTowerWeek } from './legacy-publication';
import {
  publishedTowerEncounter,
  publishedTowerPreviews,
  publishTowerWeek,
  upgradeTowerPublication,
  validatePublishedTowerWeek,
} from './published';
import { expandTowerFloor } from './strategy-templates';

describe('完整遭遇与冻结周配置', () => {
  it('精英十套、首领十二套；稳定ID无重复', () => {
    expect(new Set(TOWER_ENCOUNTERS.map((e) => e.id)).size).toBe(
      TOWER_ENCOUNTERS.length,
    );
    expect(
      TOWER_ENCOUNTERS.filter((e) => e.kinds.some((k) => k === 'elite')),
    ).toHaveLength(10);
    expect(
      TOWER_ENCOUNTERS.filter((e) => e.kinds.some((k) => k === 'boss')),
    ).toHaveLength(12);
  });
  it('有限历史驱动确定性编排，池中全部遭遇在连续周中有机会出现', () => {
    const history: ReturnType<typeof createTowerWeek>[] = [];
    const seen = new Set<string>();
    for (let i = 0; i < 110; i++) {
      const season = getTowerSeasonMeta(
        new Date(Date.UTC(2025, 11, 1) + i * 7 * 86400000),
      );
      const week = createTowerWeek(season, history.slice(-3));
      expect(createTowerWeek(season, history.slice(-3).reverse())).toEqual(
        week,
      );
      expect(new Set(week.floors.map((r) => r.combinationId)).size).toBe(4);
      expect(week.floors.some((r) => r.formationId !== 'solo')).toBe(true);
      week.floors.forEach((r) => seen.add(r.encounterId!));
      history.push(week);
    }
    expect(seen.size).toBe(TOWER_ENCOUNTERS.length);
  });
});

it('20层紧凑策略跨110周保持确定性并小于16KiB', () => {
  const history: ReturnType<typeof publishTowerWeek>[] = [];
  let maxBytes = 0;
  for (let i = 0; i < 110; i++) {
    const season = getTowerSeasonMeta(
      new Date(Date.UTC(2025, 11, 1) + i * 7 * 86400000),
    );
    const pack = publishTowerWeek(season, history.slice(-3));
    expect(pack).toEqual(publishTowerWeek(season, history.slice(-3).reverse()));
    expect(pack.floors).toHaveLength(20);
    maxBytes = Math.max(
      maxBytes,
      new TextEncoder().encode(JSON.stringify(pack)).length,
    );
    expect(Object.keys(pack).sort()).toEqual(
      [
        'schemaVersion',
        'contentVersion',
        'generatorVersion',
        'season',
        'floors',
      ].sort(),
    );
    history.push(pack);
  }
  expect(maxBytes).toBeLessThan(16384);
  console.info('tower strategy maximum bytes (110 weeks):', maxBytes);
});
it('旧周转换保留所有境界20层的实际战斗内容，拒绝内容漂移', () => {
  const old = publishLegacyTowerWeek(
    getTowerSeasonMeta(new Date('2026-09-19')),
  );
  const pack = upgradeTowerPublication(old);
  for (const realm of TOWER_ELIGIBLE_REALMS) {
    for (let floor = 1; floor <= 20; floor++) {
      expect(publishedTowerEncounter(pack, realm, floor)).toEqual({
        ...old.encounters[realm][floor - 1],
        skills: old.skills,
        statusDefs: old.statusDefs,
      });
    }
  }
  const previews = publishedTowerPreviews(pack);
  expect(previews.map((p) => p.members.map((m) => m.name))).toEqual(
    old.previews.map((p) => p.members.map((m) => m.name)),
  );
  old.encounters['金丹'][0].units[0].attrs.maxHp = 1;
  expect(() => upgradeTowerPublication(old)).toThrow('第1层 units');
});
it('拒绝缺层和未知版本，编译结果修改不会污染周配置', () => {
  const pack = publishTowerWeek(getTowerSeasonMeta(new Date('2026-09-19')));
  expect(() =>
    validatePublishedTowerWeek({ ...pack, contentVersion: 'unknown' }),
  ).toThrow();
  expect(() =>
    validatePublishedTowerWeek({ ...pack, floors: pack.floors.slice(1) }),
  ).toThrow();
  const first = publishedTowerEncounter(pack, '金丹', 1);
  const original = structuredClone(first);
  first.units[0].attrs.maxHp = 1;
  first.skills.length = 0;
  expect(publishedTowerEncounter(pack, '金丹', 1)).toEqual(original);
  expect(() => publishedTowerEncounter(pack, '筑基', 1)).toThrow();
  expect(() => publishedTowerEncounter(pack, '金丹', 21)).toThrow();
});

it('全部当前模板的逐层体积上界低于16KiB', () => {
  const season = getTowerSeasonMeta(new Date('2026-09-19'));
  const original = createTowerWeek(season);
  const pack = publishTowerWeek(season);
  const size = (value: unknown) =>
    new TextEncoder().encode(JSON.stringify(value)).length;
  for (const floor of [5, 10, 15, 20]) {
    const candidates = TOWER_ENCOUNTERS.filter((e) =>
      e.kinds.some((k) => k === (floor % 10 === 0 ? 'boss' : 'elite')),
    ).map((e) =>
      expandTowerFloor({ ...original, floors: [{ ...e, floor }] }, floor),
    );
    pack.floors[floor - 1] = candidates.sort((a, b) => size(b) - size(a))[0];
  }
  expect(size(pack)).toBeLessThan(16384);
});
