import {
  CommandType,
  EventType,
  FormulaFamily,
} from '@daoyou/combat-core/enums';
import { createBattle, restoreBattle } from '@daoyou/combat-core/session';
import type { LineupUnit, SkillDef } from '@daoyou/combat-core/types';
import { BEAST_SKILLS, BEAST_STATUS_DEFS } from '@daoyou/game-content/beasts';
import { COMBAT_V6_SEAL_CURVE_TRAINING_VERSIONS } from '@daoyou/game-domain/combat';
import { describe, expect, it } from 'vitest';
import { automaticCommands } from '../combat/auto.js';
import { baseDamage, createDaoyouRuleset } from '../combat/daoyou/index.js';

const ruleset = createDaoyouRuleset({
  maxRounds: 200,
  formulas: {
    physicalHitChance: () => 1,
    spellHitChance: () => 1,
    fluctuationMin: 1,
    fluctuationMax: 1,
  },
});
const definition = (id: string) =>
  structuredClone(BEAST_SKILLS.find((skill) => skill.id === id)!);
function actor(
  id: string,
  side: 0 | 1,
  extra: Partial<LineupUnit> = {},
): LineupUnit {
  return {
    id,
    name: id,
    side,
    kind: 'pet',
    level: 10,
    attrs: {
      hp: 10000,
      maxHp: 10000,
      mp: 1000,
      maxMp: 1000,
      physicalAtk: 100,
      physicalDef: 0,
      magicAtk: 100,
      speed: side === 0 ? 100 : 1,
    },
    ...extra,
  };
}
function battle(
  source: Partial<LineupUnit> = {},
  target: Partial<LineupUnit> = {},
  others: LineupUnit[] = [],
  overrides: SkillDef[] = [],
  activeRuleset = ruleset,
) {
  return createBattle({
    seed: 42,
    versions: COMBAT_V6_SEAL_CURVE_TRAINING_VERSIONS,
    ruleset: activeRuleset,
    skills: [...BEAST_SKILLS, ...overrides],
    statusDefs: BEAST_STATUS_DEFS,
    units: [actor('source', 0, source), actor('target', 1, target), ...others],
  });
}
function cast(
  session: ReturnType<typeof battle>,
  id: string,
  source = 'source',
) {
  session.submit(source, {
    type: CommandType.Skill,
    skillId: id,
    targets: ['target'],
  });
  for (const unit of session.snapshot().units) {
    if (
      unit.id !== source &&
      !unit.flags.benched &&
      !unit.flags.dead &&
      !unit.flags.downed
    )
      session.submit(unit.id, { type: CommandType.Defend });
  }
  session.lockAndResolve();
}
const damages = (session: ReturnType<typeof battle>, source = 'source') =>
  session
    .log()
    .filter((event) => event.type === EventType.Damage)
    .filter((event) => event.sourceId === source);

describe('灵兽特殊技能首轮战斗', () => {
  it('观照万象首回合可由任意物种使用并支付子技能费用、进入150回合冷却', () => {
    const session = battle({
      skills: ['beast.all-seeing', 'beast.water-attack', 'beast.spirit-flame'],
    });
    expect(
      session
        .queryCommands('source')
        .skills.find((option) => option.skillId === 'beast.all-seeing')?.ready,
    ).toBe(true);
    cast(session, 'beast.all-seeing');
    expect(damages(session)).toHaveLength(2);
    expect(session.unit('source').attrs.mp).toBe(980);
    expect(session.unit('source').cooldowns?.['beast.all-seeing']).toBe(151);
    expect(
      session
        .queryCommands('source')
        .skills.find((option) => option.skillId === 'beast.all-seeing')?.ready,
    ).toBe(false);
  });

  it.each([
    [200, 0, 100, 420],
    [200, 0, 200, 100],
    [200, 0, 300, 50],
    [200, 250, 0, 45],
  ])(
    '摧山依双方攻击差（%d/%d/%d）算出%d，并夹取正差上限',
    (attack, defense, targetAttack, expected) => {
      const session = battle();
      const src = {
        ...session.unit('source'),
        attrs: { ...session.unit('source').attrs, physicalAtk: attack },
      };
      const dst = {
        ...session.unit('target'),
        attrs: {
          ...session.unit('target').attrs,
          physicalAtk: targetAttack,
          physicalDef: defense,
        },
      };
      expect(
        baseDamage({
          family: FormulaFamily.AttackDifference,
          kind: 'physical',
          source: src,
          target: dst,
          coeff: 1,
          power: 80,
          fury: false,
        }),
      ).toBe(expected);
    },
  );

  it('摧山耗蓝等级加20，仍按物理命中规则而非无视防御', () => {
    const session = battle({ skills: ['beast.mountain-breaker'] });
    cast(session, 'beast.mountain-breaker');
    expect(session.unit('source').attrs.mp).toBe(970);
    expect(damages(session)[0]).toMatchObject({ amount: 25 });
  });

  it('摧山临时命中仅作用于自身，不泄漏给普攻或其他主动技能', () => {
    const other: SkillDef = {
      id: 'test.physical',
      name: '普通物理技能',
      tags: ['physical'],
      targeting: { side: 'enemy' },
      effects: [{ type: 'physicalHit' }],
    };
    const source = actor('source', 0, {
      skills: ['beast.mountain-breaker', other.id],
    });
    source.attrs.hit = 100;
    const session = battle(
      source,
      {},
      [],
      [other],
      createDaoyouRuleset({
        formulas: {
          physicalHitChance: (source) => (source.attrs.hit >= 130 ? 1 : 0),
        },
      }),
    );
    session.submit('source', { type: 'attack', target: 'target' });
    session.submit('target', { type: 'defend' });
    session.lockAndResolve();
    cast(session, other.id);
    expect(damages(session)).toHaveLength(0);
    expect(
      session
        .log()
        .filter(
          (event) => event.type === 'miss' && event.sourceId === 'source',
        ),
    ).toHaveLength(2);
    cast(session, 'beast.mountain-breaker');
    expect(damages(session)).toHaveLength(1);
  });

  it.each([
    [true, 0, 130],
    [true, 1, 195],
    [false, 0, 65],
    [false, 1, 130],
  ])('善恶分支evil=%s、必杀率%d有原版倍率%d', (evil, critical, expected) => {
    const skill = definition('beast.karmic-retribution');
    if (skill.effects[0].type !== 'randomBranch')
      throw new Error('missing branch');
    skill.effects[0].chance = evil ? 1 : 0;
    const source = actor('source', 0, {
      skills: [skill.id],
      passives: ['beast.lifesteal'],
    });
    source.attrs.critRate = critical;
    const target = actor('target', 1);
    target.attrs.hp = 5000;
    const session = battle(source, target, [], [skill]);
    cast(session, skill.id);
    expect(session.unit('source').attrs.mp).toBe(980);
    if (evil) {
      // The defending target halves physical damage; an evil crit is 3x, never 4x.
      expect(damages(session)[0]).toMatchObject({ amount: expected });
    } else {
      expect(damages(session)).toHaveLength(0);
      expect(
        session.log().find((event) => event.type === EventType.Heal),
      ).toMatchObject({ targetId: 'target', amount: expected });
      expect(session.unit('source').attrs.hp).toBe(10000);
    }
  });

  it('凝光按入血伤害生成护盾，回合末85%衰减且无固定到期回合', () => {
    const skill = definition('beast.radiant-barrier');
    skill.hooks![0].chance = 1;
    const source = actor('source', 0);
    source.attrs.physicalAtk = 1000;
    const session = battle(source, { passives: [skill.id] }, [], [skill]);
    session.submit('source', { type: 'attack', target: 'target' });
    session.submit('target', { type: 'attack', target: 'source' });
    session.lockAndResolve();
    expect(session.unit('target').barriers[0]).toMatchObject({
      current: 552,
      untilBattleEnd: true,
    });
    session.submit('source', { type: 'defend' });
    session.submit('target', { type: 'defend' });
    session.lockAndResolve();
    expect(session.unit('target').barriers[0].current).toBe(469);
    expect(
      restoreBattle(
        {
          seed: 42,
          versions: COMBAT_V6_SEAL_CURVE_TRAINING_VERSIONS,
          units: [],
          ruleset,
          skills: [...BEAST_SKILLS, skill],
        },
        session.snapshot(),
        [...session.log()],
      ).unit('target').barriers[0],
    ).toMatchObject({ current: 469, decayPerRound: 0.15 });
  });

  it('凝光护盾封顶于最大气血30%，致命伤害不留下护盾', () => {
    const skill = definition('beast.radiant-barrier');
    skill.hooks![0].chance = 1;
    const source = actor('source', 0);
    source.attrs.physicalAtk = 5000;
    const session = battle(
      source,
      {
        attrs: { ...actor('target', 1).attrs, maxHp: 10001 },
        passives: [skill.id],
      },
      [],
      [skill],
    );
    session.submit('source', { type: 'attack', target: 'target' });
    session.submit('target', { type: 'attack', target: 'source' });
    session.lockAndResolve();
    expect(session.unit('target').barriers[0].current).toBe(2550);
    expect(
      session
        .log()
        .find(
          (event) =>
            event.type === 'barrierChanged' && event.reason === 'applied',
        ),
    ).toMatchObject({ after: 3000 });
    const fatal = battle(
      source,
      { attrs: { ...actor('target', 1).attrs, hp: 100 }, passives: [skill.id] },
      [],
      [skill],
    );
    fatal.submit('source', { type: 'attack', target: 'target' });
    fatal.lockAndResolve();
    expect(fatal.unit('target').barriers).toEqual([]);
  });

  it('凝光按实际损失气血计算，留一血攻击的过量伤害不生成额外护盾', () => {
    const shield = definition('beast.radiant-barrier');
    shield.hooks![0].chance = 1;
    const hit: SkillDef = {
      id: 'test.nonfatal',
      name: '留一血',
      tags: ['physical'],
      targeting: { side: 'enemy' },
      effects: [{ type: 'fixedHit', power: 1000, cannotKill: true }],
    };
    const session = battle(
      { skills: [hit.id] },
      {
        attrs: { ...actor('target', 1).attrs, hp: 100 },
        passives: [shield.id],
      },
      [],
      [shield, hit],
    );
    cast(session, hit.id);
    expect(session.unit('target').attrs.hp).toBe(1);
    expect(
      session
        .log()
        .find(
          (event) =>
            event.type === 'barrierChanged' && event.reason === 'applied',
        ),
    ).toMatchObject({ after: 49 });
    expect(session.unit('target').barriers[0].current).toBe(41);
  });

  it('凝光能由反震派生伤害和周期掉血触发', () => {
    const shield = definition('beast.radiant-barrier');
    shield.hooks![0].chance = 1;
    const reflection = definition('beast.reflection');
    reflection.hooks![0].chance = 1;
    const reflected = battle(
      { passives: [shield.id] },
      { passives: [reflection.id] },
      [],
      [shield, reflection],
    );
    reflected.submit('source', { type: 'attack', target: 'target' });
    reflected.submit('target', { type: 'defend' });
    reflected.lockAndResolve();
    expect(reflected.unit('source').attrs.hp).toBe(9984);
    expect(reflected.unit('source').barriers[0].current).toBe(6);
    const periodic = battle({ passives: [shield.id] }, {}, [], [shield]);
    periodic.applyStatus('source', 'beast.poison.status', 3, 'target');
    for (const id of ['source', 'target'])
      periodic.submit(id, { type: 'defend' });
    periodic.lockAndResolve();
    expect(periodic.unit('source').attrs.hp).toBe(9800);
    expect(periodic.unit('source').barriers[0].current).toBe(85);
  });

  it.each([false, true])(
    '嗜血普通攻击击倒后半伤追另一目标（神佑=%s）',
    (revived) => {
      const revival = definition('beast.divine-revival');
      revival.hooks![0].chance = 1;
      const target = actor('target', 1, {
        passives: revived ? [revival.id] : [],
      });
      target.attrs.hp = 100;
      const session = battle(
        { passives: ['beast.bloodthirsty-pursuit'] },
        target,
        [actor('other', 1)],
        [revival],
      );
      session.submit('source', { type: 'attack', target: 'target' });
      session.submit('target', { type: 'attack', target: 'source' });
      session.submit('other', { type: 'attack', target: 'source' });
      session.lockAndResolve();
      expect(damages(session)).toMatchObject([
        { targetId: 'target', amount: 130 },
        { targetId: 'other', amount: 65 },
      ]);
      expect(session.unit('source').attrs.mp).toBe(1000);
      expect(session.unit('target').flags.dead).toBe(!revived);
    },
  );

  it('嗜血不由主动技能击倒触发，也不递归追击', () => {
    const source = actor('source', 0, {
      skills: ['beast.mountain-breaker'],
      passives: ['beast.bloodthirsty-pursuit'],
    });
    source.attrs.physicalAtk = 1000;
    const target = actor('target', 1);
    target.attrs.hp = 1;
    const other = actor('other', 1);
    other.attrs.hp = 1;
    const session = battle(source, target, [other, actor('third', 1)]);
    cast(session, 'beast.mountain-breaker');
    expect(damages(session)).toHaveLength(1);
    const ordinary = battle(source, target, [other, actor('third', 1)]);
    ordinary.submit('source', { type: 'attack', target: 'target' });
    ordinary.lockAndResolve();
    expect(damages(ordinary)).toHaveLength(2);
  });

  it('出奇对无物种标记灵兽的后续回合入场首次整法生效', () => {
    const owner = actor('source', 0, { kind: 'player' });
    const reserve = actor('fox', 0, {
      benched: true,
      ownerId: 'source',
      skills: ['beast.spirit-flame'],
      passives: ['beast.surprise-spell'],
    });
    const session = battle(owner, {}, [reserve]);
    for (const id of ['source', 'target'])
      session.submit(id, { type: 'defend' });
    session.lockAndResolve();
    session.submit('source', { type: 'summon', petId: 'fox' });
    session.submit('target', { type: 'defend' });
    session.lockAndResolve();
    expect(session.unit('fox').entryRound).toBe(2);
    cast(session, 'beast.spirit-flame', 'fox');
    expect(damages(session, 'fox')[0]).toMatchObject({
      amount: 150,
    });
    expect(session.unit('fox').spellActionsSinceEntry).toBe(1);
    cast(session, 'beast.spirit-flame', 'fox');
    expect(damages(session, 'fox')[1]).toMatchObject({ amount: 120 });
  });

  it('出奇首回合入场无加成', () => {
    const session = battle({
      skills: ['beast.spirit-flame'],
      passives: ['beast.surprise-spell'],
    });
    cast(session, 'beast.spirit-flame');
    expect(damages(session)[0]).toMatchObject({ amount: 120 });
    expect(session.unit('source').spellActionsSinceEntry).toBe(1);
  });

  it('观照首道子法与其法连共享出奇加成，后一道子法正常伤害', () => {
    const repeat = definition('beast.spell-combo');
    repeat.innate!.spellRepeat!.chance = 1;
    const reserve = actor('fox', 0, {
      benched: true,
      ownerId: 'source',
      skills: ['beast.all-seeing', 'beast.spirit-flame', 'beast.water-attack'],
      passives: ['beast.surprise-spell', repeat.id],
    });
    const session = battle({ kind: 'player' }, {}, [reserve], [repeat]);
    for (const id of ['source', 'target'])
      session.submit(id, { type: 'defend' });
    session.lockAndResolve();
    session.submit('source', { type: 'summon', petId: 'fox' });
    session.submit('target', { type: 'defend' });
    session.lockAndResolve();
    cast(session, 'beast.all-seeing', 'fox');
    expect(damages(session, 'fox').map((event) => event.amount)).toEqual([
      150, 75, 120, 60,
    ]);
    expect(session.unit('fox').spellActionsSinceEntry).toBe(2);
    expect(session.unit('fox').attrs.mp).toBe(980);
  });

  it.each([10, 25, 30])(
    '自动观照要求能支付完整随机攻击序列（法力%d）',
    (mp) => {
      const source = actor('source', 0, {
        skills: ['beast.all-seeing', 'beast.wildfire', 'beast.spirit-flame'],
        ownerId: 'owner',
      });
      source.attrs.physicalAtk = 10;
      source.attrs.mp = mp;
      const session = battle(source, {}, [
        actor('owner', 0, { kind: 'player' }),
      ]);
      expect(
        automaticCommands(session.snapshot(), 'owner', BEAST_SKILLS, (id) =>
          session.queryCommands(id),
        ).find((group) => group.unitId === 'source')?.command,
      ).toMatchObject({
        type: 'skill',
        skillId: mp >= 30 ? 'beast.all-seeing' : 'beast.spirit-flame',
      });
    },
  );

  it('灵兽自动战斗能选择观照与物理特殊技，法力不足时仍可普攻', () => {
    const source = actor('source', 0, {
      skills: ['beast.all-seeing', 'beast.spirit-flame', 'beast.water-attack'],
      ownerId: 'owner',
    });
    source.attrs.physicalAtk = 10;
    const session = battle(source, {}, [actor('owner', 0, { kind: 'player' })]);
    const command = automaticCommands(
      session.snapshot(),
      'owner',
      BEAST_SKILLS,
      (id) => session.queryCommands(id),
    ).find((group) => group.unitId === 'source')?.command;
    expect(command).toMatchObject({
      type: 'skill',
      skillId: 'beast.all-seeing',
    });
    const physical = battle(
      {
        skills: ['beast.mountain-breaker'],
        ownerId: 'owner',
        attrs: { ...source.attrs, physicalAtk: 1000 },
      },
      {},
      [actor('owner', 0, { kind: 'player' })],
    );
    expect(
      automaticCommands(physical.snapshot(), 'owner', BEAST_SKILLS, (id) =>
        physical.queryCommands(id),
      ).find((group) => group.unitId === 'source')?.command,
    ).toMatchObject({ type: 'skill', skillId: 'beast.mountain-breaker' });
    physical.unit('source').attrs.mp = 0;
    expect(
      automaticCommands(physical.snapshot(), 'owner', BEAST_SKILLS, (id) =>
        physical.queryCommands(id),
      ).find((group) => group.unitId === 'source')?.command.type,
    ).toBe('attack');
  });
});
