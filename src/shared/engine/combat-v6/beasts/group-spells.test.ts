import { expect, it } from 'vitest';
import {
  CommandType,
  DamageKind,
  EventType,
  createBattle,
  restoreBattle,
} from '../core';
import { createDaoyouRuleset } from '../rules-daoyou';
import { COMBAT_V6_PHASE_7C_VERSIONS } from '../version';
import { BEAST_SKILLS } from './content';

const groupIds = [
  'beast.thunderstorm',
  'beast.mountain-crush',
  'beast.flood',
  'beast.wildfire',
];
const ruleset = createDaoyouRuleset({
  formulas: {
    spellHitChance: () => 1,
    fluctuationMin: 1,
    fluctuationMax: 1,
    baseDamage: ({ kind, power, coeff }) =>
      kind === DamageKind.Fixed ? Math.max(1, power) : 100 * coeff,
  },
});
function input(level = 60, passives: string[] = [], reflection = false) {
  return {
    seed: 42,
    versions: COMBAT_V6_PHASE_7C_VERSIONS,
    ruleset,
    skills: BEAST_SKILLS.map((skill) =>
      reflection && skill.id === 'beast.spell-reflection'
        ? { ...skill, hooks: skill.hooks?.map((h) => ({ ...h, chance: 1 })) }
        : skill,
    ),
    units: [
      {
        id: 'caster',
        name: '群法灵兽',
        side: 0 as const,
        kind: 'pet' as const,
        ownerId: 'owner',
        level,
        skills: groupIds,
        passives,
        attrs: { hp: reflection ? 10 : 1000, mp: 100, maxMp: 100, speed: 100 },
      },
      {
        id: 'owner',
        name: '主人',
        side: 0 as const,
        kind: 'player' as const,
        attrs: { hp: 1000 },
      },
      ...Array.from({ length: 4 }, (_, i) => ({
        id: `enemy${i}`,
        name: '敌方',
        side: 1 as const,
        kind: 'npc' as const,
        passives: reflection ? ['beast.spell-reflection'] : [],
        attrs: { hp: 1000, speed: 1 },
      })),
    ],
  };
}
function resolve(b: ReturnType<typeof createBattle>, skillId = groupIds[0]) {
  b.submit('caster', {
    type: CommandType.Skill,
    skillId,
    targets: ['enemy2', 'enemy2'],
  });
  for (const unit of b.snapshot().units)
    if (unit.id !== 'caster' && !unit.flags.dead)
      b.submit(unit.id, { type: CommandType.Defend });
  b.lockAndResolve();
}
it.each(groupIds)('%s 的等级边界、主目标、去重、费用都正确', (skillId) => {
  for (const [level, count] of [
    [29, 1],
    [30, 2],
    [59, 2],
    [60, 3],
    [180, 3],
  ]) {
    const b = createBattle(input(level));
    expect(
      b.queryCommands('caster').skills.find((s) => s.skillId === skillId)
        ?.targetCount,
    ).toBe(count);
    resolve(b, skillId);
    const damage = b
      .log()
      .filter((e) => e.type === EventType.Damage && e.sourceId === 'caster');
    expect(damage).toHaveLength(count);
    expect(damage[0].targetId).toBe('enemy2');
    expect(new Set(damage.map((e) => e.targetId)).size).toBe(count);
    expect(b.unit('caster').attrs.mp).toBe(80);
  }
});
it('目标不足或已死亡时只选可用目标，不重复命中', () => {
  const b = createBattle(input());
  b.unit('enemy0').flags.dead = true;
  b.unit('enemy0').attrs.hp = 0;
  b.unit('enemy1').flags.dead = true;
  b.unit('enemy1').attrs.hp = 0;
  resolve(b);
  expect(
    b
      .log()
      .filter((e) => e.type === EventType.Damage && e.sourceId === 'caster')
      .map((e) => e.targetId),
  ).toEqual(['enemy2', 'enemy3']);
});
it('群法遇到反震致死时停止剩余目标和命中', () => {
  const b = createBattle(input(60, [], true));
  resolve(b);
  expect(
    b
      .log()
      .filter((e) => e.type === EventType.Damage && e.sourceId === 'caster'),
  ).toHaveLength(1);
  expect(b.unit('caster').flags.dead).toBe(true);
});
it('群法与慧根、精通、暴击、抵抗分别结算，并可从快照继续', () => {
  const data = input(60, ['beast.wisdom', 'beast.spell-mastery']);
  data.units[4].passives = ['beast.spell-resistance'];
  const b = createBattle(data);
  b.unit('caster').attrs.spellCritRate = 1;
  const restored = restoreBattle(data, b.snapshot(), b.log());
  resolve(b);
  resolve(restored);
  expect(restored.snapshot()).toEqual(b.snapshot());
  expect(restored.log()).toEqual(b.log());
  expect(b.unit('caster').attrs.mp).toBe(85);
  const hits = b
    .log()
    .filter((e) => e.type === EventType.Hit && e.sourceId === 'caster');
  expect(hits).toHaveLength(3);
  expect(hits.every((e) => e.crit)).toBe(true);
  const damage = b
    .log()
    .filter((e) => e.type === EventType.Damage && e.sourceId === 'caster');
  expect(damage[0].amount).toBeLessThan(damage[1].amount);
});

it('Fill人数修复仍保留明确配置的额外目标', () => {
  const b = createBattle(input(29));
  const skill = BEAST_SKILLS.find((s) => s.id === groupIds[0])!;
  b.unit('caster').skillOverrides[skill.id] = {
    ...skill,
    targeting: { ...skill.targeting, extraCount: 1, extraChance: 1 },
  };
  resolve(b);
  expect(
    b
      .log()
      .filter((e) => e.type === EventType.Damage && e.sourceId === 'caster'),
  ).toHaveLength(2);
});

it.each(['beast.spell-combo', 'beast.advanced-spell-combo'])(
  '%s 整次施法只追加一次，目标不变、伤害减半、不另扣费',
  (id) => {
    const data = input(60, [id]);
    data.skills = data.skills.map((s) =>
      s.id === id
        ? { ...s, innate: { spellRepeat: { chance: 1, factor: 0.5 } } }
        : s,
    );
    const b = createBattle(data);
    resolve(b);
    const damage = b
      .log()
      .filter((e) => e.type === EventType.Damage && e.sourceId === 'caster');
    expect(damage.map((e) => e.targetId)).toEqual([
      'enemy2',
      'enemy0',
      'enemy1',
      'enemy2',
      'enemy0',
      'enemy1',
    ]);
    expect(damage.map((e) => e.amount)).toEqual([80, 80, 80, 40, 40, 40]);
    expect(b.unit('caster').attrs.mp).toBe(80);
    expect(
      b.log().filter((e) => e.type === EventType.MechanicTriggered),
    ).toHaveLength(1);
  },
);
it('灵力相续不补已死亡目标，施法者首次反震死亡后不追加', () => {
  const data = input(60, ['beast.spell-combo']);
  data.skills = data.skills.map((s) =>
    s.id === 'beast.spell-combo'
      ? { ...s, innate: { spellRepeat: { chance: 1, factor: 0.5 } } }
      : s,
  );
  const b = createBattle(data);
  b.unit('enemy2').attrs.hp = 1;
  resolve(b);
  const damage = b
    .log()
    .filter((e) => e.type === EventType.Damage && e.sourceId === 'caster');
  expect(damage.map((e) => e.targetId)).toEqual([
    'enemy2',
    'enemy0',
    'enemy1',
    'enemy0',
    'enemy1',
  ]);
  const dead = createBattle(input(60, ['beast.spell-combo'], true));
  resolve(dead);
  expect(dead.log().some((e) => e.type === EventType.MechanicTriggered)).toBe(
    false,
  );
});
it('追加法术仍可触发反震，施法者中途死亡后停止', () => {
  const data = input(60, ['beast.spell-combo'], true);
  data.skills = data.skills.map((s) =>
    s.id === 'beast.spell-combo'
      ? { ...s, innate: { spellRepeat: { chance: 1, factor: 0.5 } } }
      : s,
  );
  const b = createBattle(data);
  b.unit('caster').attrs.hp = 65;
  resolve(b);
  expect(b.unit('caster').flags.dead).toBe(true);
  expect(
    b
      .log()
      .filter((e) => e.type === EventType.Damage && e.sourceId === 'caster'),
  ).toHaveLength(4);
});
it.each([
  ['beast.spell-fluctuation', 64, 100],
  ['beast.advanced-spell-fluctuation', 40, 128],
] as const)('%s 波动范围正确、固定种子可恢复', (id, min, max) => {
  const results = new Set<number>();
  for (let seed = 1; seed <= 32; seed++) {
    const data = { ...input(60, [id]), seed };
    const b = createBattle(data);
    const restored = restoreBattle(data, b.snapshot(), b.log());
    resolve(b);
    resolve(restored);
    expect(b.log()).toEqual(restored.log());
    const damage = b
      .log()
      .filter((e) => e.type === EventType.Damage && e.sourceId === 'caster');
    for (const e of damage) {
      expect(e.amount).toBeGreaterThanOrEqual(min);
      expect(e.amount).toBeLessThanOrEqual(max);
      results.add(e.amount);
    }
  }
  expect(results.size).toBeGreaterThan(5);
});
it('高级灵息不定免灵息反震，普通版本不免', () => {
  const ordinary = createBattle(input(60, ['beast.spell-fluctuation'], true));
  resolve(ordinary);
  expect(ordinary.unit('caster').flags.dead).toBe(true);
  const advanced = createBattle(
    input(60, ['beast.advanced-spell-fluctuation'], true),
  );
  resolve(advanced);
  expect(advanced.unit('caster').attrs.hp).toBe(10);
  expect(
    advanced
      .log()
      .filter((e) => e.type === EventType.Damage && e.sourceId !== 'caster'),
  ).toHaveLength(0);
});

it('单灵力相续击不重复收费，普通概率既有触发也有未触发', () => {
  const counts = new Set<number>();
  for (let seed = 1; seed <= 64; seed++) {
    const data = { ...input(29, ['beast.spell-combo']), seed };
    data.units[0].skills = ['beast.spirit-flame'];
    const b = createBattle(data);
    resolve(b, 'beast.spirit-flame');
    counts.add(
      b
        .log()
        .filter((e) => e.type === EventType.Damage && e.sourceId === 'caster')
        .length,
    );
    expect(b.unit('caster').attrs.mp).toBe(90);
  }
  expect([...counts].sort()).toEqual([1, 2]);
});
