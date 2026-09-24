import { compileTowerEncounter } from '@shared/engine/combat-v6/tower/content';
import { describe, expect, it } from 'vitest';
import { z } from 'zod';
import raw from './data/encounters.json';
import schema from './data/encounters.schema.json';
import {
  TowerEncounterPackShape,
  loadTowerEncounterPack,
} from './encounter-pack';
import { allowedTowerFormations } from './formations';
import { TOWER_ELIGIBLE_REALMS } from './helpers';
import { getTowerSeasonMeta } from './season';
import { createTowerWeek, towerCombination } from './weekly';

describe('幻境内容与固定周表', () => {
  it('Schema 同步', () =>
    expect(z.toJSONSchema(TowerEncounterPackShape, { reused: 'ref' })).toEqual(
      schema,
    ));
  it('跨年连续周的主套路改变，同周不重复组合，同类型关键层套路不同', () => {
    let previous: ReturnType<typeof createTowerWeek> | undefined;
    for (let i = 0; i < 110; i++) {
      const season = getTowerSeasonMeta(
        new Date(Date.UTC(2025, 11, 1) + i * 7 * 86400000),
      );
      const week = createTowerWeek(season);
      expect(createTowerWeek(season)).toEqual(week);
      expect(new Set(week.floors.map((f) => f.combinationId)).size).toBe(4);
      expect(towerCombination(week.floors[0].combinationId).style).not.toBe(
        towerCombination(week.floors[2].combinationId).style,
      );
      expect(towerCombination(week.floors[1].combinationId).style).not.toBe(
        towerCombination(week.floors[3].combinationId).style,
      );
      expect(week.floors.some((f) => f.formationId !== 'solo')).toBe(true);
      week.floors.forEach((f, slot) => {
        expect(
          allowedTowerFormations(
            f.floor % 10 === 0 ? 'boss' : 'elite',
            towerCombination(f.combinationId),
          ),
        ).toContain(f.formationId);
        if (previous)
          expect(towerCombination(f.combinationId).style).not.toBe(
            towerCombination(previous.floors[slot].combinationId).style,
          );
      });
      previous = week;
    }
  });
  it('全部境界楼层均可编译，境界内等级固定，无第11层等级重置', () => {
    const week = createTowerWeek(getTowerSeasonMeta(new Date('2026-09-19')));
    for (const realm of TOWER_ELIGIBLE_REALMS) {
      const level = compileTowerEncounter(realm, 1, week).units[0].level;
      for (let floor = 1; floor <= 20; floor++) {
        const encounter = compileTowerEncounter(realm, floor, week);
        for (const unit of encounter.units) {
          expect(unit.level).toBe(level);
          expect(unit.attrs.hp).toBeGreaterThan(0);
          expect(unit.attrs.speed).toBeGreaterThan(0);
        }
      }
    }
    const first = compileTowerEncounter('金丹', 1, week).units[0].attrs.hp;
    const pair = compileTowerEncounter('金丹', 2, week).units;
    expect(pair.reduce((sum, u) => sum + u.attrs.hp, 0)).toBe(
      Math.round(first * 1.025),
    );
  });
  it('拒绝缺层、错误里程碑与过快防御成长', () => {
    const floor = structuredClone(raw);
    floor.floors[1].floor = 3;
    expect(() => loadTowerEncounterPack(floor)).toThrow('连续递增');
    const milestone = structuredClone(raw);
    milestone.floors[9].milestone = 'C';
    expect(() => loadTowerEncounterPack(milestone)).toThrow('里程碑');
    const defense = structuredClone(raw);
    defense.scaling.defenseGrowth = 0.5;
    expect(() => loadTowerEncounterPack(defense)).toThrow();
  });
});
