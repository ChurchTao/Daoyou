import { createHash } from 'node:crypto';
import { describe, expect, it } from 'vitest';
import { z } from 'zod';
import raw from './data/encounters.json';
import schema from './data/encounters.schema.json';
import { TowerEncounterPackShape, loadTowerEncounterPack } from './encounter-pack';
import { TOWER_ELIGIBLE_REALMS } from './helpers';
import { compileTowerEnemies } from '@shared/engine/combat-v6/tower/content';

describe('幻境楼层与敌人配置', () => {
  it('Schema 同步', () => expect(z.toJSONSchema(TowerEncounterPackShape, { reused: 'ref' })).toEqual(schema));
  it('七境界全部20层敌人与原Host输入基线一致', () => {
    const enemies = TOWER_ELIGIBLE_REALMS.flatMap(realm => Array.from({ length: 20 }, (_, i) => compileTowerEnemies(realm, i + 1)));
    expect(createHash('sha256').update(JSON.stringify(enemies)).digest('hex')).toBe('185651a3f3906a8e4e10f9890cde6f55bcd9260cb190807006b2d3f0c9883067');
  });
  it('配置模板数目、基础属性与成长进入敌人编组', () => {
    const data = structuredClone(raw);
    data.enemies.templates.normal.count = 3;
    data.enemies.hpBase = 500;
    data.enemies.baseAttrs.maxMp = 200;
    data.enemies.baseAttrs.mp = 200;
    const enemies = compileTowerEnemies('金丹', 1, loadTowerEncounterPack(data));
    expect(enemies).toHaveLength(3);
    expect(enemies[0].attrs.maxHp).toBe(compileTowerEnemies('金丹', 1)[0].attrs.maxHp! + 300);
    expect(enemies[0].attrs.mp).toBe(200);
  });
  it('拒绝缺层、重复里程碑和非法概率', () => {
    const floor = structuredClone(raw);
    floor.floors[1].floor = 3;
    expect(() => loadTowerEncounterPack(floor)).toThrow('连续递增');
    const milestone = structuredClone(raw);
    milestone.floors[9].milestone = 'C';
    expect(() => loadTowerEncounterPack(milestone)).toThrow('里程碑');
    const rate = structuredClone(raw);
    rate.enemies.baseAttrs.critRate = 2;
    expect(() => loadTowerEncounterPack(rate)).toThrow('概率');
  });
});
