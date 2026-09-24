import { expect, it } from 'vitest';
import { CommandType, EventType, createBattle, restoreBattle } from '../core';
import { createDaoyouRuleset } from '../rules-daoyou';
import { COMBAT_V6_PHASE_7C_VERSIONS } from '../version';
import { BEAST_SKILLS, BEAST_STATUS_DEFS } from './content';
const ruleset = createDaoyouRuleset({
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
});
function input(
  stealth = 'beast.stealth',
  perception: string[] = [],
  reserve = false,
  seed = 1,
) {
  return {
    seed,
    versions: COMBAT_V6_PHASE_7C_VERSIONS,
    ruleset,
    skills: BEAST_SKILLS,
    statusDefs: BEAST_STATUS_DEFS,
    units: [
      {
        id: 'pet',
        name: '灵兽',
        side: 0 as const,
        kind: 'pet' as const,
        ownerId: 'owner',
        benched: reserve,
        passives: [stealth],
        skills: ['beast.spirit-flame'],
        attrs: { hp: 1000, mp: 100, maxMp: 100, speed: 100 },
      },
      {
        id: 'owner',
        name: '主人',
        side: 0 as const,
        kind: 'player' as const,
        attrs: { hp: 1000, speed: 80 },
      },
      {
        id: 'enemy',
        name: '敌人',
        side: 1 as const,
        kind: 'npc' as const,
        level: 60,
        passives: perception,
        skills: ['beast.spirit-flame', 'beast.thunderstorm'],
        attrs: { hp: 10000, mp: 1000, speed: 1 },
      },
    ],
  };
}
function defend(b: ReturnType<typeof createBattle>) {
  for (const u of b.snapshot().units)
    if (!u.flags.benched && !u.flags.dead)
      b.submit(u.id, { type: CommandType.Defend });
  b.lockAndResolve();
}
it.each([
  ['beast.stealth', 2, 3, 80],
  ['beast.advanced-stealth', 3, 5, 85],
] as const)(
  '%s 入场回合算持续，禁法与物理代价到期解除',
  (id, min, max, damage) => {
    const b = createBattle(input(id));
    const duration = b.unit('pet').statuses[0].remainingRounds;
    expect(duration).toBeGreaterThanOrEqual(min);
    expect(duration).toBeLessThanOrEqual(max);
    expect(b.queryCommands('pet').skills[0].ready).toBe(false);
    b.submit('pet', { type: CommandType.Attack, target: 'enemy' });
    b.submit('owner', { type: CommandType.Defend });
    b.submit('enemy', { type: CommandType.Defend });
    b.lockAndResolve();
    expect(b.unit('enemy').attrs.hp).toBe(10000 - damage);
    for (let i = 1; i < duration; i++) defend(b);
    expect(b.unit('pet').statuses).toHaveLength(0);
    expect(b.queryCommands('pet').skills[0].ready).toBe(true);
  },
);
it('无灵觉单法不可选隐身，灵觉可选，群法仍可选', () => {
  const hidden = createBattle(input());
  const options = hidden.queryCommands('enemy');
  expect(options.attackTargetIds).not.toContain('pet');
  expect(
    options.skills.find((s) => s.skillId === 'beast.spirit-flame')!
      .selectableTargetIds,
  ).not.toContain('pet');
  expect(
    options.skills.find((s) => s.skillId === 'beast.thunderstorm')!
      .selectableTargetIds,
  ).toContain('pet');
  for (const id of ['beast.perception', 'beast.advanced-perception']) {
    const b = createBattle(input('beast.stealth', [id]));
    expect(b.queryCommands('enemy').attackTargetIds).toContain('pet');
    b.submit('enemy', { type: CommandType.Attack, target: 'pet' });
    b.submit('pet', { type: CommandType.Defend });
    b.submit('owner', { type: CommandType.Defend });
    b.lockAndResolve();
    expect(b.unit('pet').attrs.hp).toBe(900);
  }
});
it('后备首次召出才隐身，召回再出战不重复触发，恢复快照不重抽', () => {
  const data = input('beast.stealth', [], true);
  const b = createBattle(data);
  expect(b.unit('pet').statuses).toHaveLength(0);
  b.submit('owner', { type: CommandType.Summon, petId: 'pet' });
  b.submit('enemy', { type: CommandType.Defend });
  b.lockAndResolve();
  expect(b.unit('pet').statuses).toHaveLength(1);
  const restored = restoreBattle(data, b.snapshot(), b.log());
  expect(restored.snapshot()).toEqual(b.snapshot());
  expect(restored.log()).toEqual(b.log());
  for (const session of [b, restored]) {
    session.submit('owner', { type: CommandType.Recall });
    session.submit('pet', { type: CommandType.Defend });
    session.submit('enemy', { type: CommandType.Defend });
    session.lockAndResolve();
    session.submit('owner', { type: CommandType.Summon, petId: 'pet' });
    session.submit('enemy', { type: CommandType.Defend });
    session.lockAndResolve();
    expect(session.unit('pet').statuses).toHaveLength(0);
    expect(
      session
        .log()
        .filter(
          (e) => e.type === EventType.StatusApplied && e.unitId === 'pet',
        ),
    ).toHaveLength(1);
  }
  expect(restored.snapshot()).toEqual(b.snapshot());
});
