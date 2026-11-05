import { describe, expect, it } from 'vitest';
import { automaticCommands } from '../combat/auto.js';
import { type HuntBossId } from '@daoyou/game-domain/hunts';
import {
  HUNT_SKILLS,
  HUNT_STATUSES,
} from '@daoyou/game-content/hunts';
import { huntEventsAt } from './config.js';
import { BEAST_SKILLS, BEAST_STATUS_DEFS } from '@daoyou/game-content/beasts';
import { projectBeastRoster } from '../beasts/projection.js';
import { createBattle } from '@daoyou/combat-core/session';
import { type CreateBattleInput } from '@daoyou/combat-core/types';
import { projectCharacterToCombatV6 } from '../combat/projection/project-character.js';
import { daoyouRulesetV6 } from '../combat/daoyou/index.js';
import { towerReferenceBuild } from '../tower/reference-fixtures.js';
import { huntEnemies, huntNpcCommand } from './content.js';

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
  it.each([
    {
      event: events[0],
      bossId: 'demon',
      count: 2,
      actor: 'p0',
      skillId: 'lingxiao.skill.triple',
      target: 'hunt.enemy.0',
    },
    {
      event: events[0],
      bossId: 'gildedCorpse',
      count: 4,
      actor: 'p1',
      skillId: 'jiujie.skill.thunderstorm',
      target: 'hunt.enemy.1',
    },
    {
      event: events[events.length - 1],
      bossId: 'ironTurtle',
      count: 4,
      actor: 'p1',
      skillId: 'jiujie.skill.thunderstorm',
      target: 'hunt.enemy.0',
    },
  ] as const)(
    '$event.realm $bossId 首轮暴击仍留下目标与至少六个敌方单位',
    ({ event, bossId, count, actor, skillId, target }) => {
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
        .skills.find((skill) => skill.skillId === skillId);
      expect(choice?.ready).toBe(true);
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

      expect(battle.unit(target).attrs.hp).toBeGreaterThan(0);
      const survivors = battle
        .snapshot()
        .units.filter((unit) => unit.side === 1 && unit.attrs.hp > 0);
      expect(survivors.length).toBeGreaterThanOrEqual(6);
    },
  );

  it.each([
    { event: events[0], bossId: 'demon', count: 2, maxRounds: 50 },
    { event: events[0], bossId: 'gildedCorpse', count: 4, maxRounds: 30 },
    {
      event: events[events.length - 1],
      bossId: 'ironTurtle',
      count: 4,
      maxRounds: 30,
    },
  ] as const)(
    '$event.realm $bossId 的 $count 人队可在 $maxRounds 回合内获胜',
    ({ event, bossId, count, maxRounds }) => {
      const { battle, input } = encounter(
        { ...event, bossId },
        count,
        42,
        true,
      );
      let turns = 0;
      while (!battle.snapshot().result && turns < maxRounds) {
        const state = battle.snapshot();
        const enemies = state.units.filter((unit) => unit.side === 1);
        const target = enemies
          .filter((unit) => unit.attrs.hp > 0)
          .sort(
            (a, b) =>
              Number(a.slot < 2) - Number(b.slot < 2) ||
              a.attrs.hp - b.attrs.hp,
          )[0];
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
            const skillId =
              unit.name === 'lingxiao'
                ? 'lingxiao.skill.triple'
                : unit.name === 'jiujie'
                  ? 'jiujie.skill.thunderstorm'
                  : undefined;
            const skill = battle
              .queryCommands(unit.id)
              .skills.find((item) => item.skillId === skillId && item.ready);
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
                  (ally) =>
                    ally.kind === 'player' &&
                    ally.side === 0 &&
                    ally.attrs.hp > 0 &&
                    !ally.flags.downed,
                )
                .sort(
                  (a, b) =>
                    a.attrs.hp / a.attrs.maxHp - b.attrs.hp / b.attrs.maxHp,
                )[0];
              const heal = battle
                .queryCommands(unit.id)
                .skills.find(
                  (item) => item.skillId === 'wuxiang.skill.nectar' && item.ready,
                );
              if (injured && injured.attrs.hp < injured.attrs.maxHp * 0.75 && heal)
                entry.command = {
                  type: 'skill',
                  skillId: heal.skillId,
                  targets: [injured.id],
                };
            }
            if (unit.statuses.some((status) => status.id === 'hunt.demon.mark'))
              entry.command = { type: 'defend' };
            battle.submit(entry.unitId, entry.command);
          }
        }
        for (const unit of enemies) {
          if (battle.queryCommands(unit.id).canSubmit)
            battle.submit(unit.id, huntNpcCommand({ state }, unit.id));
        }
        battle.lockAndResolve();
        turns++;
      }

      expect(battle.snapshot().result?.winner).toBe(0);
      expect(turns).toBeGreaterThanOrEqual(4);
    },
  );
});
