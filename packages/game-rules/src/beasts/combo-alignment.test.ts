import { CommandType, EventType, HookName } from '@daoyou/combat-core/enums';
import { createBattle } from '@daoyou/combat-core/session';
import { type SkillDef } from '@daoyou/combat-core/types';
import {
  BEAST_SKILLS,
  BEAST_SKILL_CONTENT,
  BEAST_STATUS_DEFS,
} from '@daoyou/game-content/beasts';
import { COMBAT_V6_SEAL_CURVE_TRAINING_VERSIONS } from '@daoyou/game-domain/combat';
import { expect, it } from 'vitest';
import { createDaoyouRuleset } from '../combat/daoyou/index.js';
const physical: SkillDef = {
  id: 'test.physical',
  name: '主动物攻',
  tags: ['physical'],
  targeting: { side: 'enemy' },
  effects: [{ type: 'physicalHit' }],
};
function run(
  attacker: string | string[],
  enemy: string[] = [],
  basic = true,
  sneak = false,
  forced = true,
  seed = 1,
) {
  const passives = typeof attacker === 'string' ? [attacker] : attacker;
  const skills = [...BEAST_SKILLS, physical].map((s) =>
    s.id === passives[0] && forced
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
    versions: COMBAT_V6_SEAL_CURVE_TRAINING_VERSIONS,
    skills,
    statusDefs: BEAST_STATUS_DEFS,
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
        passives: [...passives, ...(sneak ? ['beast.sneak-attack'] : [])],
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
it.each([
  ['beast.combo', 'beast.stealth', 75],
  ['beast.advanced-combo', 'beast.advanced-stealth', 80],
] as const)(
  '%s 和 %s 同时生效时，两段普攻与主动物理只取最大降幅',
  (combo, stealth, damage) => {
    const passives = [
      combo,
      stealth,
      'beast.concentration',
      'beast.spell-resistance',
    ];
    const battle = run(passives);
    expect(battle.unit('a').statuses.map((status) => status.id)).toContain(
      `${stealth}.status`,
    );
    expect(
      battle
        .log()
        .filter(
          (event) => event.type === EventType.Damage && event.sourceId === 'a',
        )
        .map((event) => event.amount),
    ).toEqual([damage, damage]);
    expect(run(passives, [], false).unit('b').attrs.hp).toBe(1000 - damage);
    expect(run([combo, stealth], [], false).unit('b').attrs.hp).toBe(
      1000 - damage,
    );
  },
);
it('隐身结束后按仍生效的御法降幅结算', () => {
  const battle = run(['beast.stealth', 'beast.spell-resistance']);
  expect(battle.unit('b').attrs.hp).toBe(920);
  const remaining = battle.unit('a').statuses[0].remainingRounds;
  for (let round = 0; round < remaining; round++) {
    battle.submit('a', { type: CommandType.Defend });
    battle.submit('b', { type: CommandType.Defend });
    battle.lockAndResolve();
  }
  expect(battle.unit('a').statuses).toHaveLength(0);
  battle.submit('a', { type: CommandType.Attack, target: 'b' });
  battle.submit('b', { type: CommandType.Defend });
  battle.lockAndResolve();
  expect(battle.unit('b').attrs.hp).toBe(830);
});
it('蛮力对铁骨的物伤代价取最大降幅，目标招架独立减伤', () => {
  expect(
    run('beast.strength', ['beast.defense'], false).unit('b').attrs.hp,
  ).toBe(920);
  expect(
    run(['beast.combo', 'beast.strength'], ['beast.defense'], false).unit('b')
      .attrs.hp,
  ).toBe(925);
  expect(
    run(['beast.combo', 'beast.stealth'], ['beast.parry'], false).unit('b')
      .attrs.hp,
  ).toBe(933);
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
it('灵息反震不阻止物理连击', () => {
  expect(
    run('beast.combo', ['beast.spell-reflection']).unit('b').attrs.hp,
  ).toBe(850);
});
