import { createTowerHost, projectTowerPlayer } from './host.js';
import { towerReferenceBuild } from './reference-fixtures.js';
import { createTowerWeek } from './weekly.js';
import { getTowerSeasonMeta } from './season.js';
import { describe, expect, it } from 'vitest';
import { z } from 'zod';
import {
  TowerBlessingsPackShape,
  loadTowerBlessingsPack,
  compileTowerBlessingDefinitions,
} from '@daoyou/game-content/tower';
import {
  TOWER_BLESSINGS_DATA as raw,
  TOWER_BLESSINGS_SCHEMA as schema,
} from '@daoyou/game-content/authoring/tower';

const player = {
  cultivator: {
    id: 'p',
    name: '基准',
    realm: '金丹' as const,
    realm_stage: '中期' as const,
    attributes: {
      vitality: 90,
      strength: 160,
      spirit: 60,
      endurance: 90,
      speed: 90,
      willpower: 120,
    },
  },
  equipment: {},
  manuals: {
    version: 1 as const,
    revision: 0,
    learned: [],
    build: { slots: [] },
  },
};
describe('可叠加的通用祝福', () => {
  it('Schema 同步', () =>
    expect(z.toJSONSchema(TowerBlessingsPackShape, { reused: 'ref' })).toEqual(
      schema,
    ));
  it('物攻、气血和承伤可以同时叠层，不改输入', () => {
    const before = structuredClone(player);
    const base = projectTowerPlayer(player, {}).unit;
    const buffed = projectTowerPlayer(player, {
      might: 3,
      vigor: 2,
      shell: 2,
    }).unit;
    expect(buffed.attrs.physicalAtk).toBe(Math.floor(base.attrs.physicalAtk * 1.36));
    expect(buffed.attrs.magicAtk).toBe(base.attrs.magicAtk);
    expect(buffed.attrs.maxHp).toBe(Math.floor(base.attrs.maxHp * 1.24));
    expect(buffed.attrs.hp).toBe(buffed.attrs.maxHp);
    expect(buffed.passives).toContain('tower.blessing.shell');
    expect(player).toEqual(before);
  });
  it('人物输出和灵兽攻击可以叠进同一场战斗', () => {
    const host = createTowerHost(
      towerReferenceBuild('lingxiao'),
      '金丹',
      5,
      { might: 2, edge: 2, shell: 1, beast: 2, beastHaste: 1 },
      createTowerWeek(getTowerSeasonMeta(new Date('2026-09-19'))),
      7,
    );
    const playerUnit = host.state.units.find((unit) => unit.id === host.playerId)!;
    const pet = host.state.units.find((unit) => unit.kind === 'pet')!;
    expect(playerUnit.passives).toEqual(
      expect.arrayContaining(['tower.blessing.edge', 'tower.blessing.shell']),
    );
    expect(pet.attrs.speed).toBeGreaterThan(0);
    const skillIds = host.runtimeSnapshot().input.skills?.map((skill) => skill.id);
    expect(skillIds).toEqual(
      expect.arrayContaining(['tower.blessing.edge', 'tower.blessing.shell']),
    );
  });
  it('说明来自配置，重复 ID 被拒绝', () => {
    const changed = structuredClone(raw);
    changed.blessings[0].description = '物攻三成';
    const pack = loadTowerBlessingsPack(changed);
    expect(compileTowerBlessingDefinitions(pack).might.description).toBe(
      '物攻三成',
    );
    changed.blessings[1].id = changed.blessings[0].id;
    expect(() => loadTowerBlessingsPack(changed)).toThrow('唯一');
  });
});
