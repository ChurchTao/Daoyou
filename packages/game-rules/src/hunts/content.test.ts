import { describe, expect, it } from 'vitest';
import { type HuntBossId } from '@daoyou/game-domain/hunts';
import {
  HUNT_BOSSES,
  HUNT_SKILLS,
  HUNT_STATUSES,
} from '@daoyou/game-content/hunts';
import { huntEventsAt } from './config.js';
import { createBattle, restoreBattle } from '@daoyou/combat-core/session';
import { type Command, type LineupUnit, type Unit } from '@daoyou/combat-core/types';
import { presetEnemyAttrs } from '../combat/encounter/preset-enemy.js';
import { createDaoyouRuleset, daoyouRulesetV6 } from '../combat/daoyou/index.js';
import { COMBAT_V6_SEAL_CURVE_ARENA_VERSIONS } from '@daoyou/game-domain/combat';
import { huntEnemies, huntNpcCommand } from './content.js';
const ruleset = createDaoyouRuleset({
  formulas: {
    physicalHitChance: () => 1,
    fluctuationMin: 1,
    fluctuationMax: 1,
  },
});
function fixture(bossId: HuntBossId) {
  const event = { ...huntEventsAt(100000)[0], bossId };
  const players: LineupUnit[] = ['p0', 'p1'].map((id, slot) => ({
    id,
    name: id,
    side: 0,
    slot,
    kind: 'player',
    level: event.level,
    attrs: {
      hp: 100000,
      maxHp: 100000,
      mp: 1000,
      speed: 9999,
      physicalAtk: 400,
      physicalDef: 100,
    },
  }));
  const input = {
    seed: 9,
    ruleset,
    versions: COMBAT_V6_SEAL_CURVE_ARENA_VERSIONS,
    units: [...players, ...huntEnemies(event, 2)],
    skills: HUNT_SKILLS,
    statusDefs: HUNT_STATUSES,
  };
  return { input, battle: createBattle(input) };
}
function round(
  battle: ReturnType<typeof createBattle>,
  playerCommands: Record<string, Command> = {},
) {
  const state = battle.snapshot();
  for (const unit of state.units)
    if (battle.queryCommands(unit.id).canSubmit)
      battle.submit(
        unit.id,
        unit.side === 1
          ? huntNpcCommand({ state }, unit.id)
          : (playerCommands[unit.id] ?? { type: 'defend' }),
      );
  battle.lockAndResolve();
}
describe('讨伐遭遇机制', () => {
  it('古魔先标记，下一回合重击可由队友保护；恢复快照保留目标与结果', () => {
    const { battle, input } = fixture('demon');
    round(battle);
    expect(
      battle.unit('p0').statuses.some((s) => s.id === 'hunt.demon.mark'),
    ).toBe(true);
    const restored = restoreBattle(input, battle.snapshot(), battle.log());
    const commands: Record<string, Command> = {
      p0: { type: 'defend' },
      p1: { type: 'protect', target: 'p0' },
    };
    round(battle, commands);
    round(restored, commands);
    expect(battle.log().some((e) => e.type === 'protectTrigger')).toBe(true);
    expect(battle.unit('p1').attrs.hp).toBeLessThan(100000);
    expect(battle.snapshot()).toEqual(restored.snapshot());
    expect(battle.log()).toEqual(restored.log());
  });
  it('邪修受伤后护法恢复其气血，护法阵亡后不再提供恢复', () => {
    const { battle } = fixture('heretic');
    const boss = battle.unit('hunt.enemy.0');
    boss.attrs.hp = Math.floor(boss.attrs.maxHp / 2);
    const before = boss.attrs.hp;
    round(battle);
    expect(battle.unit('hunt.enemy.0').attrs.hp).toBeGreaterThan(before);
    const state = battle.snapshot();
    const guard = state.units.find((u) => u.id === 'hunt.enemy.1')!;
    guard.flags.dead = true;
    guard.attrs.hp = 0;
    const restored = restoreBattle(
      fixture('heretic').input,
      state,
      battle.log(),
    );
    const hp = restored.unit('hunt.enemy.0').attrs.hp;
    round(restored);
    expect(restored.unit('hunt.enemy.0').attrs.hp).toBe(hp);
  });
  it('双生冥虎给同伴护体，状态为可驱散增益', () => {
    const { battle } = fixture('beast');
    round(battle);
    expect(
      battle
        .unit('hunt.enemy.0')
        .statuses.some((s) => s.id === 'hunt.beast.ward'),
    ).toBe(true);
    const ward = HUNT_STATUSES.find((s) => s.id === 'hunt.beast.ward')!;
    expect(ward.category).toBe('buff');
    expect(ward.dispellable).not.toBe(false);
  });
  it('另一只冥虎阵亡后，不给填充的小怪施加护体', () => {
    const { battle } = fixture('beast');
    const state = battle.snapshot();
    state.round = 3;
    const mate = state.units.find((u) => u.id === 'hunt.enemy.1')!;
    mate.flags.dead = true;
    mate.attrs.hp = 0;
    expect(huntNpcCommand({ state }, 'hunt.enemy.0').type).toBe('attack');
  });
  it('旧战局冻结的普通攻击和妖焰仍可执行，不引用新增技能', () => {
    const { input } = fixture('heretic');
    const isNew = (id: string) =>
      id === 'hunt.strike' || id.startsWith('hunt.minion.');
    const legacy = {
      ...input,
      skills: input.skills.filter((s) => !isNew(s.id)),
      units: input.units.map((u) => ({
        ...u,
        skills:
          u.slot >= 6 && u.side === 1
            ? ['hunt.bolt']
            : u.skills?.filter((id) => !isNew(id)),
      })),
    };
    const battle = createBattle(legacy);
    for (let turn = 0; turn < 4; turn++) {
      const state = battle.snapshot();
      expect(huntNpcCommand({ state }, 'hunt.enemy.2')).toMatchObject({
        type: 'attack',
      });
      expect(huntNpcCommand({ state }, 'hunt.enemy.6')).toMatchObject({
        type: 'skill',
        skillId: 'hunt.bolt',
      });
      round(battle);
    }
    expect(battle.snapshot().round).toBe(5);
  });
  it('人数缩放不足等比例，增加队友仍有收益；拒绝单人装配', () => {
    const event = huntEventsAt(100000)[0];
    const two = huntEnemies(event, 2)[0].attrs!.maxHp!;
    expect(huntEnemies(event, 4)[0].attrs!.maxHp!).toBeLessThan(two * 2);
    expect(() => huntEnemies(event, 1)).toThrow();
  });
});

const bosses = Object.keys(HUNT_BOSSES) as HuntBossId[];
describe('八人讨伐敌阵', () => {
  it.each(bosses)(
    '%s 在七个境界、2～4人挑战时均有完整且可执行的八人敌阵',
    (bossId) => {
      for (const event of huntEventsAt(100000)) {
        for (const players of [2, 3, 4]) {
          const enemies = huntEnemies({ ...event, bossId }, players);
          expect(enemies).toHaveLength(8);
          expect(enemies.map((u) => u.slot)).toEqual([0, 1, 2, 3, 4, 5, 6, 7]);
          expect(new Set(enemies.map((u) => u.id)).size).toBe(8);
          for (const [role, count] of [
            ['boss', 1],
            ['elite', 1],
            ['normal', 6],
          ] as const)
            expect(
              enemies.filter((u) => u.tags?.includes(`hunt.${role}`)),
            ).toHaveLength(count);
          const { input } = fixture(bossId);
          const battle = createBattle({
            ...input,
            ruleset: daoyouRulesetV6,
            units: [
              ...Array.from({ length: players }, (_, slot) => ({
                ...input.units[0],
                id: `p${slot}`,
                slot,
                level: event.level,
              })),
              ...enemies,
            ],
          });
          for (const enemy of enemies) {
            expect(enemy.attrs!.hp).toBeGreaterThan(0);
            expect(enemy.attrs!.hp).toBe(enemy.attrs!.maxHp);
            expect(enemy.attrs!.physicalAtk).toBeGreaterThan(0);
            expect(enemy.attrs!.magicAtk).toBeGreaterThan(0);
            const command = huntNpcCommand(
              { state: battle.snapshot() },
              enemy.id!,
            );
            expect(() => battle.submit(enemy.id!, command)).not.toThrow();
          }
          battle.lockAndResolve();
          expect(battle.snapshot().round).toBe(2);
        }
      }
    },
  );
  it.each(bosses)('%s 补满小怪后仍可确定性恢复战斗', (bossId) => {
    const { battle, input } = fixture(bossId);
    round(battle);
    const restored = restoreBattle(input, battle.snapshot(), battle.log());
    for (let i = 0; i < 3; i++) {
      round(battle);
      round(restored);
    }
    expect(restored.snapshot()).toEqual(battle.snapshot());
    expect(restored.log()).toEqual(battle.log());
  });
  it('七个境界均保留五种属性弱点，物理与法术小怪均有较低气血和输出', () => {
    const formulas = daoyouRulesetV6.formulas;
    for (const event of huntEventsAt(100000)) {
      const { input } = fixture('heretic');
      const unit = (bossId: HuntBossId) =>
        createBattle({
          ...input,
          units: [input.units[0], ...huntEnemies({ ...event, bossId }, 2)],
        }).unit('hunt.enemy.0');
      const ordinary = unit('heretic');
      const source = {
        ...ordinary,
        kind: 'player' as const,
        attrs: {
          ...ordinary.attrs,
          ...presetEnemyAttrs(event.level, 'normal'),
        },
      };
      const damage = (target: Unit, kind: 'physical' | 'spell' | 'fixed') =>
        formulas.baseDamage({
          source,
          target,
          kind,
          family: kind,
          coeff: 1,
          power: kind === 'fixed' ? 500 : 0,
          fury: false,
        });
      const turtle = unit('ironTurtle'),
        toad = unit('mistToad'),
        corpse = unit('gildedCorpse');
      expect(unit('bloodPython').attrs.maxHp).toBeGreaterThan(
        ordinary.attrs.maxHp * 2.5,
      );
      expect(damage(turtle, 'physical')).toBeLessThan(
        damage(ordinary, 'physical') * 0.3,
      );
      expect(damage(turtle, 'spell')).toBeGreaterThan(
        damage(ordinary, 'spell'),
      );
      expect(damage(toad, 'spell')).toBeLessThan(
        damage(ordinary, 'spell') * 0.3,
      );
      expect(damage(toad, 'physical')).toBeGreaterThan(
        damage(ordinary, 'physical'),
      );
      expect(corpse.attrs.maxHp).toBeLessThan(ordinary.attrs.maxHp * 0.5);
      expect(damage(corpse, 'physical')).toBeLessThan(
        damage(ordinary, 'physical') * 0.3,
      );
      expect(damage(corpse, 'spell')).toBeLessThan(
        damage(ordinary, 'spell') * 0.3,
      );
      expect(damage(corpse, 'fixed')).toBe(damage(ordinary, 'fixed'));
      const marten = unit('shadowMarten');
      expect(formulas.physicalHitChance(source, marten)).toBe(0.45);
      expect(
        formulas.physicalHitChance(source, ordinary),
      ).toBeGreaterThanOrEqual(0.9);
      expect(formulas.spellHitChance(source, marten)).toBe(1);
      const enemies = huntEnemies({ ...event, bossId: 'heretic' }, 2);
      for (const minion of enemies.slice(2)) {
        expect(minion.attrs!.maxHp!).toBeLessThan(enemies[1].attrs!.maxHp!);
        expect(minion.attrs!.physicalAtk!).toBeLessThan(
          enemies[1].attrs!.physicalAtk!,
        );
        expect(minion.attrs!.magicAtk!).toBeLessThan(
          enemies[1].attrs!.magicAtk!,
        );
      }
    }
  });
});
