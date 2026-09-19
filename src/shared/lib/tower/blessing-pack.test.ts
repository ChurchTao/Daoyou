import { projectTowerPlayer } from '@shared/engine/combat-v6/tower/host';
import { describe, expect, it } from 'vitest';
import { z } from 'zod';
import {
  TowerBlessingsPackShape,
  loadTowerBlessingsPack,
} from './blessing-pack';
import { compileTowerBlessingDefinitions } from './blessings';
import raw from './data/blessings.json';
import schema from './data/blessings.schema.json';

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
describe('简单战斗属性祝福', () => {
  it('Schema 同步', () =>
    expect(z.toJSONSchema(TowerBlessingsPackShape, { reused: 'ref' })).toEqual(
      schema,
    ));
  it('只改变指定战斗属性，不修改六维、资源上限和输入；同项相加不复利', () => {
    const before = structuredClone(player);
    const base = projectTowerPlayer(player, {}).unit.attrs;
    const buffed = projectTowerPlayer(player, { physical_power: 3 }).unit.attrs;
    expect(buffed.physicalAtk).toBe(Math.floor(base.physicalAtk * 1.24));
    expect(buffed.maxHp).toBe(base.maxHp);
    expect(buffed.magicAtk).toBe(base.magicAtk);
    expect(player).toEqual(before);
    expect(
      projectTowerPlayer(player, { physical_power: 3 }).unit.attrs,
    ).toEqual(buffed);
  });
  it('内容改变同时影响说明与投影，拒绝重复ID', () => {
    const changed = structuredClone(raw);
    changed.blessings[0].effect.perStack = 0.06;
    const pack = loadTowerBlessingsPack(changed);
    expect(
      compileTowerBlessingDefinitions(pack).physical_power.description,
    ).toContain('6%');
    const base = projectTowerPlayer(player, {}).unit.attrs.physicalAtk;
    expect(
      projectTowerPlayer(player, { physical_power: 1 }, pack).unit.attrs
        .physicalAtk,
    ).toBe(Math.floor(base * 1.06));
    changed.blessings[1].id = changed.blessings[0].id;
    expect(() => loadTowerBlessingsPack(changed)).toThrow('唯一');
  });
});
