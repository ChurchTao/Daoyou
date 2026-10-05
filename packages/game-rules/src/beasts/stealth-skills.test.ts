import { CommandType, EventType, TargetMode } from '@daoyou/combat-core/enums';
import { createBattle, restoreBattle } from '@daoyou/combat-core/session';
import type { Command } from '@daoyou/combat-core/types';
import { BEAST_SKILLS, BEAST_STATUS_DEFS } from '@daoyou/game-content/beasts';
import { YOUDU_V6_DEFINITION } from '@daoyou/game-content/sects/youdu';
import { COMBAT_V6_SEAL_CURVE_TRAINING_VERSIONS } from '@daoyou/game-domain/combat';
import { expect, it } from 'vitest';
import { createDaoyouRuleset } from '../combat/daoyou/index.js';
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
    versions: COMBAT_V6_SEAL_CURVE_TRAINING_VERSIONS,
    ruleset,
    skills: BEAST_SKILLS,
    statusDefs: [...BEAST_STATUS_DEFS, ...YOUDU_V6_DEFINITION.statuses],
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
for (const stealth of [
  'beast.stealth',
  'beast.advanced-stealth',
  'youdu.status.stealth',
]) {
  for (const reveal of [
    undefined,
    'beast.perception',
    'beast.advanced-perception',
    'youdu.status.insight',
    'youdu.status.insight_strong',
  ]) {
    it.each(['attack', 'beast.spirit-flame', 'beast.thunderstorm'])(
      `${stealth} / ${reveal ?? '无看破'}：%s 的选敌和实际伤害遵循看破能力`,
      (attack) => {
        const data = input(
          stealth,
          reveal?.startsWith('beast.') ? [reveal] : [],
        );
        if (stealth.startsWith('youdu.')) data.units[0].passives = [];
        const b = createBattle(data);
        if (stealth.startsWith('youdu.'))
          b.applyStatus('pet', stealth, 3, 'owner');
        if (reveal?.startsWith('youdu.')) b.applyStatus('enemy', reveal, 3);
        const options = b.queryCommands('enemy');
        const targets =
          attack === 'attack'
            ? options.attackTargetIds
            : options.skills.find((s) => s.skillId === attack)!
                .selectableTargetIds;
        expect(targets.includes('pet')).toBe(Boolean(reveal));
        expect(targets).toContain('owner');
        const command: Command =
          attack === 'attack'
            ? { type: CommandType.Attack, target: 'pet' }
            : {
                type: CommandType.Skill,
                skillId: attack,
                targets: ['pet', 'owner'],
              };
        b.submit('enemy', command);
        b.submit('pet', { type: CommandType.Defend });
        b.submit('owner', { type: CommandType.Defend });
        b.lockAndResolve();
        expect(b.unit('pet').attrs.hp).toBe(reveal ? 900 : 1000);
        if (!reveal || attack === 'beast.thunderstorm') {
          expect(b.unit('owner').attrs.hp).toBe(900);
        }
      },
    );
  }
}

it.each(Object.values(TargetMode))('群法 %s 选敌模式不能绕过隐身', (mode) => {
  const data = input();
  data.skills = data.skills.map((skill) =>
    skill.id === 'beast.thunderstorm'
      ? { ...skill, targeting: { ...skill.targeting, mode, count: 2 } }
      : skill,
  );
  const b = createBattle(data);
  expect(
    b
      .queryCommands('enemy')
      .skills.find((s) => s.skillId === 'beast.thunderstorm')!
      .selectableTargetIds,
  ).toEqual(['owner']);
  b.submit('enemy', {
    type: CommandType.Skill,
    skillId: 'beast.thunderstorm',
    targets: ['pet', 'owner'],
  });
  b.submit('pet', { type: CommandType.Defend });
  b.submit('owner', { type: CommandType.Defend });
  b.lockAndResolve();
  expect(b.unit('pet').attrs.hp).toBe(1000);
  expect(b.unit('owner').attrs.hp).toBe(900);
});

it('看破状态到期后，群法重新无法命中仍在隐身的灵兽', () => {
  const b = createBattle(input('beast.advanced-stealth'));
  b.applyStatus('enemy', 'youdu.status.insight', 1);
  expect(b.queryCommands('enemy').attackTargetIds).toContain('pet');
  defend(b);
  defend(b);
  expect(b.unit('pet').statuses).toHaveLength(1);
  expect(b.queryCommands('enemy').attackTargetIds).not.toContain('pet');
  b.submit('enemy', {
    type: CommandType.Skill,
    skillId: 'beast.thunderstorm',
    targets: ['owner'],
  });
  b.submit('pet', { type: CommandType.Defend });
  b.submit('owner', { type: CommandType.Defend });
  b.lockAndResolve();
  expect(b.unit('pet').attrs.hp).toBe(1000);
  expect(b.unit('owner').attrs.hp).toBe(900);
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
