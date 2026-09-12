import { expect, it } from 'vitest';
import {
  CommandType,
  EventType,
  HookName,
  createBattle,
  type SkillDef,
} from '../core';
import { createDaoyouRuleset } from '../rules-daoyou';
import { COMBAT_V6_PHASE_7C_VERSIONS } from '../version';
import { BEAST_SKILLS, BEAST_SKILL_CONTENT } from './content';
const physical: SkillDef = {
  id: 'test.physical',
  name: '主动物攻',
  tags: ['physical'],
  targeting: { side: 'enemy' },
  effects: [{ type: 'physicalHit' }],
};
function run(
  id: string,
  enemy: string[] = [],
  basic = true,
  sneak = false,
  forced = true,
  seed = 1,
) {
  const skills = [...BEAST_SKILLS, physical].map((s) =>
    s.id === id && forced
      ? {
          ...s,
          hooks: s.hooks?.map((h) =>
            h.on === HookName.AfterHit ? { ...h, chance: 1 } : h,
          ),
        }
      : s,
  );
  const b = createBattle({
    seed,
    versions: COMBAT_V6_PHASE_7C_VERSIONS,
    skills,
    ruleset: createDaoyouRuleset({
      formulas: {
        physicalHitChance: () => 1,
        physicalFluctuationMin: 1,
        physicalFluctuationMax: 1,
        defendPhysicalFactor: 1,
        baseDamage: () => 100,
      },
    }),
    units: [
      {
        id: 'a',
        name: 'a',
        side: 0,
        kind: 'player',
        passives: [id, ...(sneak ? ['beast.sneak-attack'] : [])],
        skills: [physical.id],
        attrs: { hp: 1000, speed: 100 },
      },
      {
        id: 'b',
        name: 'b',
        side: 1,
        kind: 'npc',
        passives: enemy,
        attrs: { hp: 1000, speed: 1 },
      },
    ],
  });
  b.submit(
    'a',
    basic
      ? { type: CommandType.Attack, target: 'b' }
      : { type: CommandType.Skill, skillId: physical.id, targets: ['b'] },
  );
  b.submit('b', { type: CommandType.Defend });
  b.lockAndResolve();
  return b;
}
it.each([
  ['beast.combo', 0.45, 75],
  ['beast.advanced-combo', 0.55, 80],
] as const)('%s 对齐概率、两次普攻伤害和主动物理代价', (id, chance, damage) => {
  const effect = BEAST_SKILL_CONTENT.find((s) => s.id === id)!.effect;
  expect(effect).toMatchObject({
    chance,
    coefficient: 1,
    physicalFactor: damage / 100,
  });
  expect(run(id).unit('b').attrs.hp).toBe(1000 - 2 * damage);
  expect(run(id, [], false).unit('b').attrs.hp).toBe(1000 - damage);
  const counts = new Set<number>();
  for (let seed = 1; seed <= 32; seed++) {
    const b = run(id, [], true, false, false, seed);
    counts.add(
      b.log().filter((e) => e.type === EventType.Damage && e.sourceId === 'a')
        .length,
    );
    expect(run(id, [], true, false, false, seed).snapshot()).toEqual(
      b.snapshot(),
    );
  }
  expect([...counts].sort()).toEqual([1, 2]);
});
it.each(['beast.reflection', 'beast.advanced-reflection'])(
  '%s 无论反伤是否触发、是否偷袭，都阻止连击',
  (id) => {
    for (const sneak of [false, true])
      for (let seed = 1; seed <= 8; seed++) {
        const b = run('beast.advanced-combo', [id], true, sneak, true, seed);
        expect(
          b
            .log()
            .filter((e) => e.type === EventType.Damage && e.sourceId === 'a'),
        ).toHaveLength(1);
        if (sneak) expect(b.unit('a').attrs.hp).toBe(1000);
      }
  },
);
it('法术反震不阻止物理连击', () => {
  expect(
    run('beast.combo', ['beast.spell-reflection']).unit('b').attrs.hp,
  ).toBe(850);
});
