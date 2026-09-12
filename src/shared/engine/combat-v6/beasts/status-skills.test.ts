import { expect, it } from 'vitest';
import {
  CommandType,
  StatusCategory,
  createBattle,
  restoreBattle,
  type SkillDef,
  type StatusDef,
} from '../core';
import { createDaoyouRuleset } from '../rules-daoyou';
import { COMBAT_V6_PHASE_7C_VERSIONS } from '../version';
import { BEAST_SKILLS, BEAST_STATUS_DEFS } from './content';
const extra: StatusDef[] = [
  {
    id: 'control',
    name: '控制',
    kind: 'control',
    category: StatusCategory.Control,
    blocksSpell: true,
  },
  {
    id: 'debuff',
    name: '减益',
    kind: 'debuff',
    category: StatusCategory.Debuff,
  },
  {
    id: 'forbidden',
    name: '禁复活',
    kind: 'forbidden',
    category: StatusCategory.Debuff,
    blocksRevive: true,
  },
  {
    id: 'special',
    name: '特殊',
    kind: 'special',
    category: StatusCategory.Debuff,
    dispellable: false,
  },
  { id: 'buff', name: '增益', kind: 'buff', category: StatusCategory.Buff },
  {
    id: 'entry',
    name: '入场增益',
    kind: 'entry',
    category: StatusCategory.Buff,
    extendable: false,
  },
];
function input(own: string[] = [], enemy: string[] = []) {
  return {
    seed: 1,
    versions: COMBAT_V6_PHASE_7C_VERSIONS,
    ruleset: createDaoyouRuleset({
      formulas: {
        physicalHitChance: () => 1,
        physicalFluctuationMin: 1,
        physicalFluctuationMax: 1,
        defendPhysicalFactor: 1,
        baseDamage: () => 100,
      },
    }),
    skills: [
      ...BEAST_SKILLS,
      {
        id: 'test.physical',
        name: '测试物攻',
        tags: ['physical'],
        targeting: { side: 'enemy' as const },
        effects: [{ type: 'physicalHit' as const }],
      } as SkillDef,
    ].map((s) =>
      s.id.includes('poison')
        ? { ...s, hooks: s.hooks?.map((h) => ({ ...h, chance: 1 })) }
        : s,
    ),
    statusDefs: [...BEAST_STATUS_DEFS, ...extra],
    units: [
      {
        id: 'a',
        name: 'a',
        side: 0 as const,
        kind: 'player' as const,
        passives: own,
        skills: ['test.physical'],
        attrs: { hp: 1000, mp: 100, maxMp: 100, speed: 100 },
      },
      {
        id: 'b',
        name: 'b',
        side: 1 as const,
        kind: 'npc' as const,
        passives: enemy,
        attrs: { hp: 1000, mp: 100, maxMp: 100, speed: 1 },
      },
    ],
  };
}
function turn(
  b: ReturnType<typeof createBattle>,
  attack = false,
  skill = false,
) {
  b.submit(
    'a',
    attack
      ? skill
        ? {
            type: CommandType.Skill,
            skillId: 'test.physical',
            targets: ['b'],
          }
        : { type: CommandType.Attack, target: 'b' }
      : { type: CommandType.Defend },
  );
  b.submit('b', { type: CommandType.Defend });
  b.lockAndResolve();
}
it('毒由普攻触发，三回合气血与法力损耗，刷新不叠层', () => {
  const b = createBattle(input(['beast.poison']));
  turn(b, true);
  expect(b.unit('b').attrs).toMatchObject({ hp: 880, mp: 99 });
  turn(b);
  turn(b);
  expect(b.unit('b').attrs).toMatchObject({ hp: 840, mp: 97 });
  expect(b.unit('b').statuses).toHaveLength(0);
  const active = createBattle(input(['beast.poison']));
  turn(active, true, true);
  expect(active.unit('b').statuses).toHaveLength(0);
  const refresh = createBattle(input(['beast.poison']));
  turn(refresh, true);
  turn(refresh, true);
  expect(refresh.unit('b').statuses).toHaveLength(1);
  expect(refresh.unit('b').statuses[0].remainingRounds).toBe(2);
});
it('高级毒免疫普通与高级毒', () => {
  const b = createBattle(input(['beast.poison'], ['beast.advanced-poison']));
  turn(b, true);
  expect(b.unit('b').statuses).toHaveLength(0);
  expect(b.unit('b').attrs.mp).toBe(100);
  b.applyStatus('b', 'beast.advanced-poison.status', 3, 'a');
  expect(b.unit('b').statuses).toHaveLength(0);
});
it.each(['beast.miracle', 'beast.advanced-miracle'])(
  '%s 净化或免疫异常，但保留禁复活与不可驱散特殊状态',
  (id) => {
    const b = createBattle(input([id]));
    for (const s of [
      'control',
      'debuff',
      'forbidden',
      'special',
      'beast.poison.status',
    ])
      b.applyStatus('a', s, 5, 'b');
    if (id === 'beast.miracle') {
      expect(b.unit('a').statuses).toHaveLength(5);
      turn(b);
      expect(b.unit('a').attrs.hp).toBe(980);
    }
    expect(
      b
        .unit('a')
        .statuses.map((s) => s.id)
        .sort(),
    ).toEqual(['forbidden', 'special']);
  },
);
it.each(['beast.concentration', 'beast.advanced-concentration'])(
  '%s 免控制不免普通减益，并降低物伤',
  (id) => {
    const b = createBattle(input([id]));
    b.applyStatus('a', 'control', 3);
    b.applyStatus('a', 'debuff', 3);
    expect(b.unit('a').statuses.map((s) => s.id)).toEqual(['debuff']);
    turn(b, true);
    expect(b.unit('b').attrs.hp).toBe(920);
  },
);
it.each([
  ['beast.eternity', 1.5, 3],
  ['beast.advanced-eternity', 2, 6],
] as const)(
  '%s 延长增益但排除隐身、特殊入场和减益；不重算快照',
  (id, factor, cap) => {
    const data = input([id]);
    const b = createBattle(data);
    for (const duration of [1, 3, 10]) {
      b.applyStatus('a', 'buff', duration);
      expect(
        b.unit('a').statuses.find((s) => s.id === 'buff')!.remainingRounds,
      ).toBe(duration + Math.min(cap, Math.floor(duration * (factor - 1))));
    }
    for (const status of ['entry', 'debuff', 'beast.stealth.status']) {
      b.applyStatus('a', status, 3);
      expect(
        b.unit('a').statuses.find((s) => s.id === status)!.remainingRounds,
      ).toBe(3);
    }
    const restored = restoreBattle(data, b.snapshot(), b.log());
    turn(b);
    turn(restored);
    expect(restored.snapshot()).toEqual(b.snapshot());
  },
);
