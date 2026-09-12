import { expect, it } from 'vitest';
import { CommandType, DamageKind, EventType, createBattle } from '../core';
import { createDaoyouRuleset } from '../rules-daoyou';
import { COMBAT_V6_PHASE_7C_VERSIONS } from '../version';
import { BEAST_SKILLS } from './content';
import { captureMp, captureSkill, nextBeastExp } from './progression';

it.each([
  [10, 110],
  [30, 130],
])('灵火等级%d消耗10法力并造成%d单体法伤', (level, damage) => {
  const skill = BEAST_SKILLS.find((s) => s.id === 'beast.spirit-flame')!;
  expect(skill).toBeDefined();
  const battle = createBattle({
    seed: 42,
    versions: COMBAT_V6_PHASE_7C_VERSIONS,
    ruleset: createDaoyouRuleset({
      formulas: {
        spellHitChance: () => 1,
        fluctuationMin: 1,
        fluctuationMax: 1,
      },
    }),
    skills: [skill],
    units: [
      {
        id: 'source',
        name: '施法者',
        side: 0,
        kind: 'player',
        skills: [skill.id],
        skillLevels: { [skill.id]: level },
        attrs: {
          hp: 1000,
          mp: 100,
          maxMp: 100,
          magicAtk: 100,
          spellCritRate: 0,
          speed: 100,
        },
      },
      {
        id: 'target',
        name: '目标',
        side: 1,
        kind: 'npc',
        attrs: { hp: 1000, magicDef: 10, speed: 1 },
      },
      {
        id: 'other',
        name: '旁观目标',
        side: 1,
        kind: 'npc',
        attrs: { hp: 1000, magicDef: 10, speed: 1 },
      },
    ],
  });
  battle.submit('source', {
    type: CommandType.Skill,
    skillId: skill.id,
    targets: ['target'],
  });
  for (const id of ['target', 'other'])
    battle.submit(id, { type: CommandType.Defend });
  battle.lockAndResolve();
  expect(battle.unit('source').attrs.mp).toBe(90);
  expect(battle.unit('target').attrs.hp).toBe(1000 - damage);
  expect(battle.unit('other').attrs.hp).toBe(1000);
  expect(battle.log().filter((e) => e.type === EventType.Damage)).toMatchObject(
    [
      {
        sourceId: 'source',
        targetId: 'target',
        amount: damage,
        kind: DamageKind.Spell,
      },
    ],
  );
  expect(battle.log().some((e) => e.type === EventType.ActionFailed)).toBe(
    false,
  );
});

it('preserves capture identity, MP costs, formula and progression boundaries', () => {
  const skill = captureSkill(
    [{ unitId: 'fox', speciesId: 'combat.wild.species.spirit-fox' }],
    5,
    0,
  );
  expect(skill.capture?.targetMpCosts).toEqual({ fox: 15 });
  expect(skill.capture?.chance).toBe(
    'min(0.85, max(0.1, 0.35 + 0.4 * (1 - target.hp / target.maxHp) + 0.01 * (source.level - target.level)))',
  );
  expect(
    captureSkill(
      [{ unitId: 'fox', speciesId: 'combat.wild.species.spirit-fox' }],
      4,
      24,
    ).capture,
  ).toMatchObject({ capacity: 0, targetMpCosts: {} });
  expect(captureMp(5)).toBe(15);
  expect([0, 10, 179, 180].map(nextBeastExp)).toEqual([100, 300, 3680, 3700]);
});
