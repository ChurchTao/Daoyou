import { describe, expect, it } from 'vitest';
import { automaticCommands } from '../../../combat-v6/auto.js';
import {
  HUNT_BOSSES,
  huntEventsAt,
  type HuntBossId,
} from '../../../hunts/config.js';
import { BEAST_SKILLS, BEAST_STATUS_DEFS, projectBeastRoster } from '../beasts/index.js';
import { createBattle, type CreateBattleInput } from '../core/index.js';
import { projectCharacterToCombatV6 } from '../projection/index.js';
import { daoyouRulesetV6 } from '../rules-daoyou/index.js';
import { towerReferenceBuild } from '../tower/reference-fixtures.js';
import {
  HUNT_SKILLS,
  HUNT_STATUSES,
  huntEnemies,
  huntNpcCommand,
} from './content.js';

const events = huntEventsAt(100000);
function encounter(
  event: (typeof events)[number],
  count: number,
  seed = 42,
  support = false,
) {
  const builds = Array.from({ length: count }, (_, slot) => {
    const magical = ['ironTurtle', 'shadowMarten'].includes(event.bossId);
    const input = towerReferenceBuild(
      (support
        ? ([
            magical ? 'jiujie' : 'lingxiao',
            'wuxiang',
            magical ? 'lingxiao' : 'jiujie',
            'youdu',
          ] as const)
        : (['lingxiao', 'jiujie', 'wuxiang', 'youdu'] as const))[slot],
      event.realm,
    );
    const projected = projectCharacterToCombatV6({
      ...input,
      side: 0,
      slot,
      resourcePolicy: 'full',
    });
    if (!projected.ok) throw new Error('参考构筑无效');
    const id = `p${slot}`;
    return {
      ...projected,
      unit: { ...projected.unit, id },
      pets: projectBeastRoster(
        input.beasts,
        input.cultivator.id,
        0,
        slot + 4,
        event.level,
      ).map((pet) => ({ ...pet, id: `pet${slot}`, ownerId: id })),
    };
  });
  const input: CreateBattleInput = {
    seed,
    ruleset: daoyouRulesetV6,
    units: [
      ...builds.flatMap((p) => [p.unit, ...p.pets]),
      ...huntEnemies(event, count),
    ],
    skills: [
      ...new Map(
        [
          ...builds.flatMap((p) => p.skills),
          ...BEAST_SKILLS,
          ...HUNT_SKILLS,
        ].map((s) => [s.id, s]),
      ).values(),
    ],
    statusDefs: [
      ...new Map(
        [
          ...builds.flatMap((p) => p.statusDefs),
          ...BEAST_STATUS_DEFS,
          ...HUNT_STATUSES,
        ].map((s) => [s.id, s]),
      ).values(),
    ],
  };
  return { input, battle: createBattle(input) };
}

describe('同境界合法构筑的讨伐平衡', () => {
  it.each(events)('$realm 怪物对正常养成与高防角色仍有有效伤害', (event) => {
    const { battle } = encounter(event, 4);
    const formulas = daoyouRulesetV6.formulas;
    for (const target of battle
      .snapshot()
      .units.filter((u) => u.kind === 'player')) {
      for (const slot of [0, 2, 6]) {
        const source = battle.unit(`hunt.enemy.${slot}`);
        const kind = slot === 6 ? 'spell' : 'physical';
        const damage = formulas.baseDamage({
          source,
          target,
          kind,
          family: kind,
          coeff: 1,
          power: 0,
          fury: false,
        });
        expect(damage, `${target.name}/${slot}`).toBeGreaterThan(
          target.attrs.maxHp * 0.015,
        );
        expect(damage).toBeLessThan(target.attrs.maxHp * 0.5);
      }
    }
  });
  it.each(events)('$realm 特色防御对真实角色的减伤与弱点足够鲜明', (event) => {
    const { battle } = encounter({ ...event, bossId: 'heretic' }, 2);
    const ordinary = battle.unit('hunt.enemy.0');
    const boss = (bossId: HuntBossId) =>
      encounter({ ...event, bossId }, 2).battle.unit('hunt.enemy.0');
    const damage = (
      target: typeof ordinary,
      kind: 'physical' | 'spell' | 'fixed',
    ) =>
      daoyouRulesetV6.formulas.baseDamage({
        source: battle.unit(kind === 'physical' ? 'p0' : 'p1'),
        target,
        kind,
        family: kind,
        coeff: 1,
        power: kind === 'fixed' ? event.level * 3 : 0,
        fury: false,
      });
    for (const [id, strong, weak] of [
      ['ironTurtle', 'physical', 'spell'],
      ['mistToad', 'spell', 'physical'],
    ] as const) {
      expect(damage(boss(id), strong)).toBeLessThan(
        damage(ordinary, strong) * 0.25,
      );
      expect(damage(boss(id), weak)).toBeGreaterThan(
        damage(ordinary, weak) * 1.15,
      );
    }
    for (const kind of ['physical', 'spell'] as const)
      expect(damage(boss('gildedCorpse'), kind)).toBeLessThan(
        damage(ordinary, kind) * 0.25,
      );
    expect(damage(boss('gildedCorpse'), 'fixed')).toBe(
      damage(ordinary, 'fixed'),
    );
    expect(boss('gildedCorpse').attrs.maxHp).toBeLessThan(
      ordinary.attrs.maxHp * 0.5,
    );
    expect(boss('bloodPython').attrs.maxHp).toBeGreaterThan(
      ordinary.attrs.maxHp * 2.5,
    );
    expect(
      daoyouRulesetV6.formulas.physicalHitChance(
        battle.unit('p0'),
        boss('shadowMarten'),
      ),
    ).toBe(0.45);
    expect(
      daoyouRulesetV6.formulas.spellHitChance(
        battle.unit('p1'),
        boss('shadowMarten'),
      ),
    ).toBe(1);
  });
  it.each(events)(
    '$realm 单人全暴击爆发不能秒掉首领或精英，群攻不能清空杂兵',
    (event) => {
      for (const bossId of Object.keys(HUNT_BOSSES) as HuntBossId[]) {
        for (const count of [2, 3, 4]) {
          for (const target of ['hunt.enemy.0', 'hunt.enemy.1']) {
            for (const [actor, skillId] of [
              ['p0', 'lingxiao.skill.triple'],
              ['p1', 'jiujie.skill.thunderstorm'],
            ]) {
              const { input } = encounter({ ...event, bossId }, count);
              const battle = createBattle({
                ...input,
                ruleset: {
                  ...daoyouRulesetV6,
                  formulas: {
                    ...daoyouRulesetV6.formulas,
                    physicalHitChance: () => 1,
                    fluctuationMin: 1.1,
                    fluctuationMax: 1.1,
                    physicalFluctuationMin: 1.1,
                    physicalFluctuationMax: 1.1,
                  },
                },
              });
              battle.unit(actor).attrs.critRate = 1;
              battle.unit(actor).attrs.spellCritRate = 1;
              const choice = battle
                .queryCommands(actor)
                .skills.find((s) => s.skillId === skillId);
              expect(choice?.ready, skillId).toBe(true);
              for (const unit of battle.snapshot().units) {
                if (!battle.queryCommands(unit.id).canSubmit) continue;
                battle.submit(
                  unit.id,
                  unit.id === actor
                    ? { type: 'skill', skillId, targets: [target] }
                    : unit.side === 1
                      ? { type: 'attack', target: actor === 'p0' ? 'p1' : 'p0' }
                      : { type: 'defend' },
                );
              }
              battle.lockAndResolve();
              expect(
                battle.unit(target).attrs.hp,
                `${event.realm}/${bossId}/${count}/${target}/${skillId}`,
              ).toBeGreaterThan(0);
              const survivors = battle
                .snapshot()
                .units.filter((u) => u.side === 1 && u.attrs.hp > 0);
              expect(survivors.length).toBeGreaterThanOrEqual(6);
            }
          }
        }
      }
    },
    20000,
  );
  it.each(events)(
    '$realm 对应弱点的混合队伍可完成八类讨伐，双人队允许少量败局',
    (event) => {
      const duoWins = new Map<HuntBossId, number>();
      for (const seed of [7, 42, 101]) {
        for (const bossId of Object.keys(HUNT_BOSSES) as HuntBossId[]) {
          for (const count of [2, 3, 4]) {
            const { battle, input } = encounter(
              { ...event, bossId },
              count,
              seed,
              true,
            );
            let turns = 0;
            while (!battle.snapshot().result && turns++ < 55) {
              const state = battle.snapshot();
              for (let slot = 0; slot < count; slot++) {
                const commands = automaticCommands(
                  state,
                  `p${slot}`,
                  input.skills!,
                  (id) => battle.queryCommands(id),
                  { statusDefs: input.statusDefs },
                );
                for (const entry of commands) {
                  const unit = battle.unit(entry.unitId);
                  const target = state.units
                    .filter((u) => u.side === 1 && u.attrs.hp > 0)
                    .sort(
                      (a, b) =>
                        Number(a.slot < 2) - Number(b.slot < 2) ||
                        a.attrs.hp - b.attrs.hp,
                    )[0];
                  const skillId =
                    unit.name === 'lingxiao'
                      ? 'lingxiao.skill.triple'
                      : unit.name === 'jiujie'
                        ? 'jiujie.skill.thunderstorm'
                        : undefined;
                  const skill = battle
                    .queryCommands(unit.id)
                    .skills.find((s) => s.skillId === skillId && s.ready);
                  if (target && skill)
                    entry.command = {
                      type: 'skill',
                      skillId: skill.skillId,
                      targets: [target.id],
                    };
                  else if (target && unit.kind === 'pet')
                    entry.command = { type: 'attack', target: target.id };
                  if (unit.name === 'wuxiang') {
                    const injured = state.units
                      .filter(
                        (u) =>
                          u.kind === 'player' &&
                          u.side === 0 &&
                          u.attrs.hp > 0 &&
                          !u.flags.downed,
                      )
                      .sort(
                        (a, b) =>
                          a.attrs.hp / a.attrs.maxHp -
                          b.attrs.hp / b.attrs.maxHp,
                      )[0];
                    const heal = battle
                      .queryCommands(unit.id)
                      .skills.find(
                        (s) => s.skillId === 'wuxiang.skill.nectar' && s.ready,
                      );
                    if (
                      injured &&
                      injured.attrs.hp < injured.attrs.maxHp * 0.75 &&
                      heal
                    )
                      entry.command = {
                        type: 'skill',
                        skillId: heal.skillId,
                        targets: [injured.id],
                      };
                  }
                  if (unit.statuses.some((s) => s.id === 'hunt.demon.mark'))
                    entry.command = { type: 'defend' };
                  battle.submit(entry.unitId, entry.command);
                }
              }
              for (const unit of state.units.filter((u) => u.side === 1))
                if (battle.queryCommands(unit.id).canSubmit)
                  battle.submit(unit.id, huntNpcCommand({ state }, unit.id));
              battle.lockAndResolve();
            }
            console.info(
              'hunt-balance',
              event.realm,
              bossId,
              count,
              seed,
              turns,
              battle.snapshot().result,
            );
            if (count === 2) {
              duoWins.set(
                bossId,
                (duoWins.get(bossId) ?? 0) +
                  Number(battle.snapshot().result?.winner === 0),
              );
            } else {
              expect(
                battle.snapshot().result?.winner,
                `${event.realm}/${bossId}/${count}/${seed}/${turns}`,
              ).toBe(0);
            }
            expect(turns).toBeGreaterThanOrEqual(4);
            expect
              .soft(turns, `${event.realm}/${bossId}/${count}`)
              .toBeLessThanOrEqual(count === 2 ? 50 : 30);
          }
        }
      }
      for (const bossId of Object.keys(HUNT_BOSSES) as HuntBossId[])
        expect(
          duoWins.get(bossId),
          `${event.realm}/${bossId} 双人胜局`,
        ).toBeGreaterThanOrEqual(2);
    },
    20000,
  );
});
