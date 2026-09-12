import { expect, it } from 'vitest';
import {
  CommandType,
  StatusCategory,
  createBattle,
  restoreBattle,
  type StatusDef,
} from '../core';
import { createDaoyouRuleset } from '../rules-daoyou';
import { COMBAT_V6_PHASE_7C_VERSIONS } from '../version';
import { BEAST_SKILLS, BEAST_STATUS_DEFS } from './content';
import { beastDeathIds } from './progression';
const extra: StatusDef[] = [
  {
    id: 'ban',
    name: '禁复活',
    kind: 'ban',
    category: StatusCategory.Debuff,
    blocksRevive: true,
    persistWhenDowned: true,
  },
  { id: 'buff', name: '增益', kind: 'buff', category: StatusCategory.Buff },
  {
    id: 'control',
    name: '控制',
    kind: 'control',
    category: StatusCategory.Control,
  },
];
function input(own = ['beast.ghost'], enemy: string[] = []) {
  return {
    seed: 1,
    versions: COMBAT_V6_PHASE_7C_VERSIONS,
    ruleset: createDaoyouRuleset({
      formulas: {
        physicalHitChance: () => 1,
        spellHitChance: () => 1,
        physicalFluctuationMin: 1,
        physicalFluctuationMax: 1,
        fluctuationMin: 1,
        fluctuationMax: 1,
        defendPhysicalFactor: 1,
        baseDamage: () => 100,
      },
    }),
    skills: BEAST_SKILLS.map((s) =>
      s.id.includes('divine-revival')
        ? { ...s, hooks: s.hooks?.map((h) => ({ ...h, chance: 1 })) }
        : s,
    ),
    statusDefs: [...BEAST_STATUS_DEFS, ...extra],
    units: [
      {
        id: 'beast:pet',
        name: '灵兽',
        kind: 'pet' as const,
        ownerId: 'owner',
        side: 0 as const,
        passives: own,
        attrs: { hp: 1000, mp: 100, maxMp: 100, speed: 100 },
      },
      {
        id: 'reserve',
        name: '后备',
        kind: 'pet' as const,
        ownerId: 'owner',
        side: 0 as const,
        benched: true,
        attrs: { hp: 1000, speed: 90 },
      },
      {
        id: 'owner',
        name: '主人',
        kind: 'player' as const,
        side: 0 as const,
        attrs: { hp: 1000, speed: 80 },
      },
      {
        id: 'enemy',
        name: '敌人',
        kind: 'npc' as const,
        side: 1 as const,
        passives: enemy,
        skills: ['beast.spirit-flame'],
        attrs: { hp: 10000, mp: 1000, speed: 1 },
      },
    ],
  };
}
function turn(
  b: ReturnType<typeof createBattle>,
  attack = false,
  spell = false,
) {
  for (const u of b.snapshot().units)
    if (!u.flags.dead && !u.flags.downed && !u.flags.benched)
      b.submit(
        u.id,
        u.id === 'enemy' && attack
          ? spell
            ? {
                type: CommandType.Skill,
                skillId: 'beast.spirit-flame',
                targets: ['beast:pet'],
              }
            : { type: CommandType.Attack, target: 'beast:pet' }
          : { type: CommandType.Defend },
      );
  b.lockAndResolve();
}
it.each(['beast.ghost', 'beast.advanced-ghost'])(
  '%s 五回合复起、屏蔽神佑且快照保留计时',
  (id) => {
    const data = input([id, 'beast.advanced-divine-revival']);
    const b = createBattle(data);
    b.unit('beast:pet').attrs.hp = 50;
    b.unit('beast:pet').attrs.mp = 37;
    b.unit('beast:pet').wound = 200;
    turn(b, true);
    expect(b.unit('beast:pet').flags).toMatchObject({
      dead: true,
      reviveAtRound: 6,
    });
    const restored = restoreBattle(data, b.snapshot(), b.log());
    for (let i = 0; i < 3; i++) {
      turn(b);
      turn(restored);
      expect(b.unit('beast:pet').flags.dead).toBe(true);
    }
    turn(b);
    turn(restored);
    expect(b.unit('beast:pet').flags.dead).toBe(false);
    expect(b.unit('beast:pet').attrs).toMatchObject({ hp: 800, mp: 37 });
    expect(restored.snapshot()).toEqual(b.snapshot());
    expect(restored.log()).toEqual(b.log());
    b.unit('beast:pet').attrs.hp = 50;
    turn(b, true);
    expect(b.unit('beast:pet').flags.reviveAtRound).toBe(11);
    expect(beastDeathIds(b.log())).toEqual(['pet']);
  },
);
it('禁复活在等待期间计时，到期才复起', () => {
  const b = createBattle(input());
  b.applyStatus('beast:pet', 'ban', 5);
  b.unit('beast:pet').attrs.hp = 50;
  turn(b, true);
  for (let i = 0; i < 4; i++) turn(b);
  expect(b.unit('beast:pet').flags.dead).toBe(true);
  turn(b);
  expect(b.unit('beast:pet').flags.dead).toBe(false);
});
it.each([
  ['beast.exorcism', 150],
  ['beast.advanced-exorcism', 200],
] as const)('%s 物法增伤并阻止复起', (id, damage) => {
  for (const spell of [false, true]) {
    const b = createBattle(input(['beast.ghost'], [id]));
    turn(b, true, spell);
    expect(b.unit('beast:pet').attrs.hp).toBe(1000 - damage);
    b.unit('beast:pet').attrs.hp = 50;
    turn(b, true, spell);
    expect(b.unit('beast:pet').flags.dead).toBe(true);
    expect(b.unit('beast:pet').flags.reviveAtRound).toBeUndefined();
    const plain = createBattle(input([], [id]));
    turn(plain, true, spell);
    expect(plain.unit('beast:pet').attrs.hp).toBe(900);
  }
});
it.each(['beast.lifesteal', 'beast.advanced-lifesteal'])(
  '%s 不能从鬼魂吸血，鬼魂自身也不能恢复气血',
  (id) => {
    const b = createBattle(
      input(['beast.ghost', 'beast.advanced-regeneration'], [id]),
    );
    b.unit('enemy').attrs.hp = 1000;
    turn(b, true);
    expect(b.unit('enemy').attrs.hp).toBe(1000);
    expect(b.unit('beast:pet').attrs.hp).toBe(900);
  },
);
it.each([
  ['beast.denial', 120, 120],
  ['beast.advanced-denial', 120, 96],
] as const)(
  '%s 拒绝增益、免控制、鬼魂增伤与高级法抗',
  (id, physical, spellDamage) => {
    for (const spell of [false, true]) {
      const b = createBattle(
        input(
          [
            id,
            'beast.ghost',
            'beast.advanced-divine-revival',
            'beast.concentration',
          ],
          ['beast.ghost'],
        ),
      );
      b.applyStatus('beast:pet', 'buff', 3);
      b.applyStatus('beast:pet', 'control', 3);
      expect(b.unit('beast:pet').statuses).toHaveLength(0);
      turn(b, true, spell);
      expect(b.unit('beast:pet').attrs.hp).toBe(
        1000 - (spell ? spellDamage : physical),
      );
      b.unit('beast:pet').attrs.hp = 1;
      turn(b, true);
      expect(b.unit('beast:pet').flags).toMatchObject({ dead: true });
      expect(b.unit('beast:pet').flags.reviveAtRound).toBeUndefined();
    }
  },
);
it('换宠取消等待复起，不在后备复活或出现两只出战宠', () => {
  const b = createBattle(input());
  b.unit('beast:pet').attrs.hp = 1;
  turn(b, true);
  b.submit('owner', { type: CommandType.Summon, petId: 'reserve' });
  b.submit('enemy', { type: CommandType.Defend });
  b.lockAndResolve();
  expect(b.unit('beast:pet').flags).toMatchObject({
    dead: true,
    benched: true,
  });
  expect(b.unit('beast:pet').flags.reviveAtRound).toBeUndefined();
  for (let i = 0; i < 5; i++) turn(b);
  expect(b.unit('beast:pet').flags.dead).toBe(true);
  expect(b.unit('reserve').flags.benched).toBe(false);
});
it('仅剩等待鬼魂不能维持战斗', () => {
  const b = createBattle(input());
  b.unit('owner').flags.downed = true;
  b.unit('owner').attrs.hp = 0;
  b.unit('beast:pet').attrs.hp = 1;
  turn(b, true);
  expect(b.snapshot().result).toBeDefined();
});
it('外部治疗与普通复活不能绕过鬼魂恢复限制', () => {
  const data = input();
  data.skills.push({
    id: 'test.heal',
    name: '治疗',
    tags: [],
    targeting: { side: 'enemy', includeDead: true },
    effects: [
      { type: 'heal', power: 500 },
      { type: 'revive', hp: 500 },
    ],
  });
  data.units.find((u) => u.id === 'enemy')!.skills!.push('test.heal');
  const b = createBattle(data);
  function heal() {
    b.submit('owner', { type: CommandType.Defend });
    if (!b.unit('beast:pet').flags.dead)
      b.submit('beast:pet', { type: CommandType.Defend });
    b.submit('enemy', {
      type: CommandType.Skill,
      skillId: 'test.heal',
      targets: ['beast:pet'],
    });
    b.lockAndResolve();
  }
  b.unit('beast:pet').attrs.hp = 300;
  heal();
  expect(b.unit('beast:pet').attrs.hp).toBe(300);
  b.unit('beast:pet').attrs.hp = 1;
  turn(b, true);
  heal();
  expect(b.unit('beast:pet').flags.dead).toBe(true);
});
it('驱鬼固定伤害不增幅，但归因于驱鬼者的击杀仍阻止复起', () => {
  const data = input(['beast.ghost'], ['beast.advanced-exorcism']);
  data.skills.push({
    id: 'test.fixed',
    name: '固定',
    tags: [],
    targeting: { side: 'enemy' },
    effects: [{ type: 'fixedHit', power: 100 }],
  });
  data.units.find((u) => u.id === 'enemy')!.skills!.push('test.fixed');
  const b = createBattle(data);
  function hit() {
    b.submit('owner', { type: CommandType.Defend });
    b.submit('beast:pet', { type: CommandType.Defend });
    b.submit('enemy', {
      type: CommandType.Skill,
      skillId: 'test.fixed',
      targets: ['beast:pet'],
    });
    b.lockAndResolve();
  }
  hit();
  expect(b.unit('beast:pet').attrs.hp).toBe(900);
  b.unit('beast:pet').attrs.hp = 1;
  hit();
  expect(b.unit('beast:pet').flags.reviveAtRound).toBeUndefined();
});
