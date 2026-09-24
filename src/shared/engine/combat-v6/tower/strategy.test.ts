import { describe, expect, it } from 'vitest';
import { TOWER_ELIGIBLE_REALMS } from '../../../lib/tower/helpers';
import { getTowerSeasonMeta } from '../../../lib/tower/season';
import { createTowerWeek, TOWER_ENCOUNTERS } from '../../../lib/tower/weekly';
import {
  hasTowerTrait,
  TOWER_STRATEGY_VERSION,
  towerStrategySignature,
  validateTowerFloorStrategy,
  type TowerFloorStrategy,
} from './strategy';
import { compileTowerStrategy } from './strategy-compiler';
import { expandTowerWeek } from './strategy-templates';
const week = createTowerWeek(getTowerSeasonMeta(new Date('2026-09-19')));
const compile = (f: TowerFloorStrategy) =>
  compileTowerStrategy('金丹', f, TOWER_STRATEGY_VERSION);
const sample = (): TowerFloorStrategy => ({
  floor: 10,
  kind: 'boss',
  budget: { hpScale: 0.9 },
  enemies: [
    {
      id: 'main',
      archetype: 'warrior',
      behaviorId: 'strike',
      role: 'leader',
      traits: [{ id: 'magic_ward' }, { id: 'swift' }],
      budgetShare: { hp: 0.7, output: 0.85 },
    },
    {
      id: 'support',
      archetype: 'attendant',
      behaviorId: 'healing',
      role: 'support',
      traits: [{ id: 'limited_healing' }],
      budgetShare: { hp: 0.3, output: 0.15 },
    },
  ],
});
describe('独立策略编译', () => {
  it('全部生成候选和普通层可在所有境界编译，输入不受污染', () => {
    for (const floor of [5, 10, 15, 20]) {
      for (const candidate of TOWER_ENCOUNTERS.filter((e) =>
        e.kinds.some((k) => k === (floor % 10 === 0 ? 'boss' : 'elite')),
      )) {
        const custom = {
          ...week,
          floors: week.floors.map((r) =>
            r.floor === floor ? { ...r, ...candidate, floor } : r,
          ),
        };
        for (const f of expandTowerWeek(custom)) {
          for (const realm of TOWER_ELIGIBLE_REALMS) {
            const before = structuredClone(f);
            const result = compileTowerStrategy(
              realm,
              f,
              TOWER_STRATEGY_VERSION,
            );
            expect(f).toEqual(before);
            expect(result.units).toHaveLength(f.enemies.length);
            expect(result.units.every((u) => u.attrs.maxHp! > 0)).toBe(true);
            expect(
              Object.values(result.plans).every((p) => p.cycle.length > 0),
            ).toBe(true);
          }
        }
      }
    }
  });
  it('模板外组合可以出现在任意关键层；辅助属性词条只修改自身', () => {
    for (const floor of [5, 10, 15, 20]) {
      const f = sample();
      f.floor = floor;
      f.kind = floor % 10 === 0 ? 'boss' : 'elite';
      const before = compile(f);
      f.enemies[1].traits.push({ id: 'swift' }, { id: 'magic_ward' });
      const after = compile(f);
      expect(after.units[0]).toEqual(before.units[0]);
      expect(after.units[1].attrs.speed).toBeGreaterThan(
        before.units[1].attrs.speed!,
      );
      expect(after.units[1].attrs.magicDef).toBeGreaterThan(
        before.units[1].attrs.magicDef!,
      );
      expect(after.plans).toEqual(before.plans);
    }
  });
  it('独立厚血不影响同伴，首领机制由词条显式提供', () => {
    const f = sample();
    const before = compile(f);
    f.enemies[1].traits.push({ id: 'vital' });
    const after = compile(f);
    expect(after.units[0]).toEqual(before.units[0]);
    expect(after.units[1].attrs.maxHp).toBeGreaterThan(
      before.units[1].attrs.maxHp!,
    );
    expect(after.units[0].passives).not.toContain('tower.last-stand');
    f.enemies[1].traits.push({ id: 'last_stand' });
    expect(compile(f).units[1].passives).toContain('tower.last-stand');
  });
  it('规范化签名忽略ID和词条顺序，保留指向关系', () => {
    const f = sample();
    f.enemies[1].traits = [{ id: 'guard', targetEnemyId: 'main' }];
    f.enemies[1].behaviorId = 'support';
    const renamed = structuredClone(f);
    renamed.enemies[0].id = 'a';
    renamed.enemies[1].id = 'b';
    renamed.enemies[1].traits = [{ id: 'guard', targetEnemyId: 'a' }];
    renamed.enemies[0].traits.reverse();
    expect(towerStrategySignature(f)).toBe(towerStrategySignature(renamed));
  });
  it('护卫可以保护非首位敌人而非隐式主敌', () => {
    const f = sample();
    f.enemies[0].traits = [{ id: 'guard', targetEnemyId: 'support' }];
    const result = compile(f);
    expect(result.units[1].passives).toContain('tower.mirror-master.target.1');
    expect(result.units[0].passives).toContain('tower.mirror-guard.target.1');
    const guard = result.skills.find(
      (s) => s.id === 'tower.mirror-guard.target.1',
    )!;
    expect(guard.hooks![0].targeting!.requireStatusIds).toEqual([
      'tower.mirror-anchor.target.1',
    ]);
    expect(result.units[0].passives).not.toContain('tower.mirror-master');
  });
});
it('非法策略在编译前拒绝', () => {
  const invalid: Array<(f: TowerFloorStrategy) => void> = [
    (f) => {
      f.enemies[1].id = f.enemies[0].id;
    },
    (f) => {
      f.enemies[0].budgetShare.hp = 0.9;
    },
    (f) => {
      f.enemies[0].traits.push({ id: 'swift' });
    },
    (f) => {
      f.enemies[0].traits = [{ id: 'charge' }, { id: 'limited_healing' }];
    },
    (f) => {
      f.enemies[1].traits = [{ id: 'guard', targetEnemyId: 'missing' }];
    },
    (f) => {
      f.enemies[1].traits = [{ id: 'guard', targetEnemyId: 'support' }];
    },
    (f) => {
      f.enemies[1].traits = [{ id: 'guard', targetEnemyId: 'main' }];
      f.enemies[1].behaviorId = 'support';
      f.enemies[0].traits = [{ id: 'guard', targetEnemyId: 'support' }];
    },
    (f) => {
      f.enemies[0].archetype = 'binder';
    },
    (f) => {
      f.floor = 5;
    },
  ];
  for (const mutate of invalid) {
    const f = sample();
    mutate(f);
    expect(() => validateTowerFloorStrategy(f)).toThrow();
  }
  expect(hasTowerTrait(sample().enemies[1], 'limited_healing')).toBe(true);
});
