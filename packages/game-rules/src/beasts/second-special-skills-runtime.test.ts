import {
  CommandType,
  DamageKind,
  EventType,
  StatusCategory,
} from '@daoyou/combat-core/enums';
import { createBattle, restoreBattle } from '@daoyou/combat-core/session';
import type { Command, LineupUnit, SkillDef } from '@daoyou/combat-core/types';
import { BEAST_SKILLS, BEAST_STATUS_DEFS } from '@daoyou/game-content/beasts';
import { COMBAT_V6_SEAL_CURVE_TRAINING_VERSIONS } from '@daoyou/game-domain/combat';
import { describe, expect, it } from 'vitest';
import {
  createDaoyouRuleset,
  daoyouFormulasV3,
} from '../combat/daoyou/index.js';

const ruleset = createDaoyouRuleset({
  maxRounds: 200,
  formulas: {
    ...daoyouFormulasV3,
    physicalHitChance: () => 1,
    spellHitChance: () => 1,
    physicalFluctuationMin: 1,
    physicalFluctuationMax: 1,
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
    combatFacts: { strength: 240 },
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
function input(
  source: Partial<LineupUnit> = {},
  target: Partial<LineupUnit> = {},
  others: LineupUnit[] = [],
  overrides: SkillDef[] = [],
  activeRuleset = ruleset,
) {
  return {
    seed: 42,
    versions: COMBAT_V6_SEAL_CURVE_TRAINING_VERSIONS,
    ruleset: activeRuleset,
    skills: [...BEAST_SKILLS, ...overrides],
    statusDefs: [
      ...BEAST_STATUS_DEFS,
      {
        id: 'test.speed',
        name: '加速',
        kind: 'test.speed',
        category: StatusCategory.Buff,
        speedMod: 60,
      },
    ],
    units: [actor('source', 0, source), actor('target', 1, target), ...others],
  };
}
const skill = (skillId: string, target = 'target'): Command => ({
  type: CommandType.Skill,
  skillId,
  targets: [target],
});
const attack = (target = 'source'): Command => ({
  type: CommandType.Attack,
  target,
});
function resolve(
  session: ReturnType<typeof createBattle>,
  commands: Record<string, Command> = {},
) {
  for (const unit of session.snapshot().units)
    if (
      !unit.flags.benched &&
      !unit.flags.dead &&
      !unit.flags.downed &&
      !unit.flags.escaped
    )
      session.submit(
        unit.id,
        commands[unit.id] ?? { type: CommandType.Defend },
      );
  session.lockAndResolve();
}
const damages = (session: ReturnType<typeof createBattle>, source = 'source') =>
  session
    .log()
    .filter((event) => event.type === EventType.Damage)
    .filter((event) => event.sourceId === source);
const mpDamages = (session: ReturnType<typeof createBattle>) =>
  session
    .log()
    .filter((event) => event.type === EventType.MpDamage)
    .filter((event) => event.targetId === 'target');

describe('灵兽特殊技能第二轮战斗', () => {
  it('灵罡护体只护自身、耗蓝等级一半加50，施放回合计入六回合', () => {
    const data = input(
      { skills: ['beast.spirit-guard'] },
      { skills: ['beast.spirit-flame'] },
    );
    const session = createBattle(data);
    resolve(session, {
      source: skill('beast.spirit-guard'),
      target: skill('beast.spirit-flame', 'source'),
    });
    expect(session.unit('source').attrs.mp).toBe(945);
    expect(session.unit('source').statuses).toMatchObject([
      { remainingRounds: 5 },
    ]);
    expect(session.unit('target').statuses).toEqual([]);
    const restored = restoreBattle(data, session.snapshot(), [
      ...session.log(),
    ]);
    for (let round = 2; round <= 7; round++) {
      const commands = { target: skill('beast.spirit-flame', 'source') };
      resolve(session, commands);
      resolve(restored, commands);
    }
    expect(damages(session, 'target').map((event) => event.amount)).toEqual([
      42, 42, 42, 42, 42, 42, 120,
    ]);
    expect(session.unit('source').statuses).toEqual([]);
    expect(restored.snapshot()).toEqual(session.snapshot());
    expect(restored.log()).toEqual(session.log());
  });

  it('灵罡重施不叠乘，物理与固定伤害不减，御法仍独立叠乘', () => {
    const session = createBattle(
      input(
        {
          skills: ['beast.spirit-guard'],
          passives: ['beast.spell-resistance'],
        },
        { skills: ['beast.spirit-flame', 'beast.wind-strike'] },
      ),
    );
    resolve(session, { source: skill('beast.spirit-guard'), target: attack() });
    expect(damages(session, 'target')[0]).toMatchObject({
      amount: 130,
      kind: DamageKind.Physical,
    });
    resolve(session, {
      source: skill('beast.spirit-guard'),
      target: skill('beast.spirit-flame', 'source'),
    });
    expect(damages(session, 'target')[1]).toMatchObject({ amount: 39 });
    expect(session.unit('source').statuses).toHaveLength(1);
    resolve(session, { target: skill('beast.wind-strike', 'source') });
    expect(damages(session, 'target')[2]).toMatchObject({
      amount: 360,
      kind: DamageKind.Fixed,
    });
  });

  it.each([
    ['pet', 0, 393],
    ['player', 0, 196],
    ['npc', 1, 196],
    ['npc', 0, 393],
  ] as const)(
    '凌风对%s（人物事实%d）结算固伤%d，忽略防御与防守',
    (kind, isCharacter, expected) => {
      const session = createBattle(
        input(
          { skills: ['beast.wind-strike'] },
          {
            kind,
            combatFacts: { isCharacter },
            attrs: {
              ...actor('target', 1).attrs,
              physicalDef: 9000,
              magicDef: 9000,
            },
          },
        ),
      );
      resolve(session, { source: skill('beast.wind-strike') });
      expect(damages(session)[0]).toMatchObject({
        amount: expected,
        kind: DamageKind.Fixed,
      });
      expect(session.unit('source').attrs.mp).toBe(945);
    },
  );

  it('凌风使用施放时有效速度，属性事实不替代有效速度', () => {
    const session = createBattle(
      input({
        skills: ['beast.wind-strike'],
        combatFacts: { strength: 240, speed: 9000 },
      }),
    );
    session.applyStatus('source', 'test.speed', 3);
    resolve(session, { source: skill('beast.wind-strike') });
    expect(damages(session)[0]).toMatchObject({ amount: 413 });
  });

  it.each([
    [false, 30, 114],
    [true, 30, 166],
    [false, 0, 75],
    [true, 0, 107],
  ] as const)(
    '壁垒防守=%s、训练防御%d时保留基础防御并结算%d',
    (defending, trainingDefense, expected) => {
      const session = createBattle(
        input(
          { skills: ['beast.barrier-breaker'] },
          {
            combatFacts: { defenseTraining: trainingDefense },
            attrs: { ...actor('target', 1).attrs, physicalDef: 50 },
          },
        ),
      );
      resolve(session, {
        source: skill('beast.barrier-breaker'),
        target: defending ? { type: CommandType.Defend } : attack(),
      });
      expect(damages(session)[0]).toMatchObject({ amount: expected });
      expect(session.unit('source').attrs.mp).toBe(980);
    },
  );

  it.each(['beast.barrier-breaker', 'beast.mind-shatter'])(
    '%s必中且不改变普通攻击命中',
    (id) => {
      const session = createBattle(
        input(
          { skills: [id] },
          {},
          [],
          [],
          createDaoyouRuleset({
            formulas: { ...ruleset.formulas, physicalHitChance: () => 0 },
          }),
        ),
      );
      resolve(session, { source: skill(id), target: attack() });
      expect(damages(session)).toHaveLength(1);
      resolve(session, { source: attack('target'), target: attack() });
      expect(damages(session)).toHaveLength(1);
      expect(
        session
          .log()
          .some(
            (event) =>
              event.type === EventType.Miss && event.sourceId === 'source',
          ),
      ).toBe(true);
    },
  );

  it('摧心九成物伤与即刻扣蓝按实际入血结算，持续扣蓝在下一回合开始且仅一次', () => {
    const session = createBattle(input({ skills: ['beast.mind-shatter'] }));
    resolve(session, { source: skill('beast.mind-shatter'), target: attack() });
    expect(damages(session)[0]).toMatchObject({ amount: 117 });
    expect(session.unit('source').attrs.mp).toBe(985);
    expect(mpDamages(session).map((event) => event.amount)).toEqual([20, 21]);
    const events = session.log();
    const first = events.findIndex(
      (event) =>
        event.type === EventType.MpDamage && event.targetId === 'target',
    );
    const roundStart = events.findIndex(
      (event) => event.type === EventType.RoundStart && event.round === 2,
    );
    const second = events.findLastIndex(
      (event) =>
        event.type === EventType.MpDamage && event.targetId === 'target',
    );
    expect(first).toBeLessThan(roundStart);
    expect(second).toBeGreaterThan(roundStart);
    resolve(session);
    expect(session.unit('target').statuses).toEqual([]);
    expect(mpDamages(session).map((event) => event.amount)).toEqual([20, 21]);
  });

  it('摧心连续两回合施放都在下一回合开始持续扣蓝', () => {
    const session = createBattle(input({ skills: ['beast.mind-shatter'] }));
    for (let round = 1; round <= 2; round++)
      resolve(session, {
        source: skill('beast.mind-shatter'),
        target: attack(),
      });
    expect(mpDamages(session).map((event) => event.amount)).toEqual([
      20, 21, 20, 21,
    ]);
    resolve(session);
    expect(mpDamages(session).map((event) => event.amount)).toEqual([
      20, 21, 20, 21,
    ]);
    expect(session.unit('target').statuses).toEqual([]);
  });

  it('摧心尚未跳伤的状态快照冻结力量，恢复后不重算持续扣蓝', () => {
    const data = input();
    const session = createBattle(data);
    session.applyStatus('target', 'beast.mind-shatter.status', 1, 'source');
    session.unit('source').combatFacts!.strength = 1200;
    const restored = restoreBattle(data, session.snapshot(), [
      ...session.log(),
    ]);
    resolve(session);
    resolve(restored);
    expect(mpDamages(session).map((event) => event.amount)).toEqual([21]);
    expect(restored.snapshot()).toEqual(session.snapshot());
    expect(restored.log()).toEqual(session.log());
  });

  it.each([
    [50, 14],
    [200, 6],
  ])(
    '摧心护盾%d只将实际HP损失计入即刻扣蓝%d，保留等级项与持续扣蓝',
    (barrier, immediate) => {
      const session = createBattle(input({ skills: ['beast.mind-shatter'] }));
      session
        .unit('target')
        .barriers.push({
          id: 'test.barrier',
          name: '护盾',
          kind: 'test.barrier',
          current: barrier,
          remainingRounds: 3,
          sourceId: 'target',
          appliedRound: 1,
        });
      resolve(session, {
        source: skill('beast.mind-shatter'),
        target: attack(),
      });
      expect(session.unit('target').attrs.hp).toBe(
        10000 - Math.max(0, 117 - barrier),
      );
      expect(mpDamages(session).map((event) => event.amount)).toEqual([
        immediate,
        21,
      ]);
    },
  );

  it('摧心按被留一血限制后的实际HP损失扣蓝，法力损失封顶于剩余法力', () => {
    const nonfatal = definition('beast.mind-shatter');
    if (nonfatal.effects[0].type !== 'physicalHit')
      throw new Error('missing physical hit');
    nonfatal.effects[0].cannotKill = true;
    const session = createBattle(
      input(
        { skills: [nonfatal.id] },
        { attrs: { ...actor('target', 1).attrs, hp: 30 } },
        [],
        [nonfatal],
      ),
    );
    resolve(session, { source: skill(nonfatal.id), target: attack() });
    expect(session.unit('target').attrs.hp).toBe(1);
    expect(mpDamages(session).map((event) => event.amount)).toEqual([9, 21]);
    const capped = createBattle(
      input(
        { skills: ['beast.mind-shatter'] },
        { attrs: { ...actor('target', 1).attrs, mp: 5 } },
      ),
    );
    resolve(capped, { source: skill('beast.mind-shatter'), target: attack() });
    expect(capped.unit('target').attrs.mp).toBe(0);
    expect(mpDamages(capped).map((event) => event.amount)).toEqual([5]);
  });

  it.each([
    'beast.ghost',
    'beast.advanced-ghost',
    'beast.miracle',
    'beast.advanced-miracle',
  ])('%s阻止摧心持续扣蓝，保留即刻扣蓝', (passive) => {
    const session = createBattle(
      input({ skills: ['beast.mind-shatter'] }, { passives: [passive] }),
    );
    resolve(session, { source: skill('beast.mind-shatter'), target: attack() });
    expect(mpDamages(session).map((event) => event.amount)).toEqual([20]);
    expect(session.unit('target').statuses).toEqual([]);
  });

  it.each([true, false])(
    '摧心持续扣蓝取最高而不叠加（强者先施放=%s），快照保留冻结强度',
    (strongFirst) => {
      const data = input(
        {
          skills: ['beast.mind-shatter'],
          combatFacts: { strength: strongFirst ? 480 : 120 },
        },
        {},
        [
          actor('ally', 0, {
            skills: ['beast.mind-shatter'],
            attrs: { ...actor('ally', 0).attrs, speed: 50 },
            combatFacts: { strength: strongFirst ? 120 : 480 },
          }),
        ],
      );
      const session = createBattle(data);
      resolve(session, {
        source: skill('beast.mind-shatter'),
        ally: skill('beast.mind-shatter'),
        target: attack(),
      });
      expect(mpDamages(session).map((event) => event.amount)).toEqual([
        20, 20, 41,
      ]);
      expect(session.unit('target').statuses).toMatchObject([
        { priority: 41, tickMpPower: 41, remainingRounds: 1 },
      ]);
      const restored = restoreBattle(data, session.snapshot(), [
        ...session.log(),
      ]);
      session.unit('source').combatFacts!.strength = 1200;
      restored.unit('source').combatFacts!.strength = 1200;
      resolve(session);
      resolve(restored);
      expect(mpDamages(session).map((event) => event.amount)).toEqual([
        20, 20, 41,
      ]);
      expect(restored.snapshot()).toEqual(session.snapshot());
      expect(restored.log()).toEqual(session.log());
    },
  );

  it.each([
    ['pet', 0, 0, 120],
    ['npc', 1, 0, 120],
    ['player', 0, 0, 138],
    ['npc', 0, 0, 138],
    ['pet', 0, 1, 138],
  ] as const)(
    '出其不意识别先行%s、灵兽事实%d、队伍%d的同技能记录',
    (kind, isBeast, side, expected) => {
      const session = createBattle(
        input(
          { skills: ['beast.spirit-flame'], passives: ['beast.unanticipated'] },
          {},
          [
            actor('first', side, {
              kind,
              combatFacts: { isBeast },
              skills: ['beast.spirit-flame'],
              attrs: { ...actor('first', side).attrs, speed: 200 },
            }),
          ],
        ),
      );
      resolve(session, {
        source: skill('beast.spirit-flame'),
        first: skill('beast.spirit-flame', side === 0 ? 'target' : 'source'),
      });
      expect(damages(session)[0]).toMatchObject({ amount: expected });
    },
  );

  it('出其不意群攻与法连全程共享同一加成，同技能下一回合重新可用', () => {
    const repeat = definition('beast.spell-combo');
    repeat.innate!.spellRepeat!.chance = 1;
    const data = input(
      {
        level: 60,
        skills: ['beast.wildfire'],
        passives: ['beast.unanticipated', repeat.id],
      },
      {},
      [actor('second', 1), actor('third', 1)],
      [repeat],
    );
    const session = createBattle(data);
    resolve(session, { source: skill('beast.wildfire') });
    const restored = restoreBattle(data, session.snapshot(), [
      ...session.log(),
    ]);
    resolve(session, { source: skill('beast.wildfire') });
    resolve(restored, { source: skill('beast.wildfire') });
    expect(damages(session).map((event) => event.amount)).toEqual([
      156, 156, 156, 78, 78, 78, 156, 156, 156, 78, 78, 78,
    ]);
    expect(session.unit('source').attrs.mp).toBe(960);
    expect(restored.snapshot()).toEqual(session.snapshot());
    expect(restored.log()).toEqual(session.log());
  });

  it.each([
    ['beast.barrier-breaker', 161],
    ['beast.wind-strike', 451],
  ] as const)(
    '出其不意增强%s的物理或固定技能结果，普攻不获加成',
    (id, expected) => {
      const session = createBattle(
        input({ skills: [id], passives: ['beast.unanticipated'] }),
      );
      resolve(session, { source: skill(id), target: attack() });
      expect(damages(session)[0]).toMatchObject({ amount: expected });
      resolve(session, { source: attack('target'), target: attack() });
      expect(damages(session)[1]).toMatchObject({ amount: 130 });
    },
  );

  it('观照子技能独立判断同队记录，外层不攻击，法连沿用子技能判定', () => {
    const repeat = definition('beast.spell-combo');
    repeat.innate!.spellRepeat!.chance = 1;
    const session = createBattle(
      input(
        {
          skills: [
            'beast.all-seeing',
            'beast.spirit-flame',
            'beast.water-attack',
          ],
          passives: ['beast.unanticipated', repeat.id],
        },
        {},
        [
          actor('first', 0, {
            skills: ['beast.spirit-flame'],
            attrs: { ...actor('first', 0).attrs, speed: 200 },
          }),
        ],
        [repeat],
      ),
    );
    resolve(session, {
      source: skill('beast.all-seeing'),
      first: skill('beast.spirit-flame'),
    });
    expect(damages(session).map((event) => event.amount)).toEqual([
      120, 60, 138, 69,
    ]);
    expect(session.unit('source').attrs.mp).toBe(980);
    expect(session.unit('source').skillsUsedThisRound?.skillIds).toEqual([
      'beast.all-seeing',
      'beast.spirit-flame',
      'beast.water-attack',
    ]);
  });

  it('同伴法力不足而失败不消耗出其不意的同技能加成', () => {
    const session = createBattle(
      input(
        { skills: ['beast.spirit-flame'], passives: ['beast.unanticipated'] },
        {},
        [
          actor('first', 0, {
            skills: ['beast.spirit-flame'],
            attrs: { ...actor('first', 0).attrs, speed: 200, mp: 0 },
          }),
        ],
      ),
    );
    resolve(session, {
      source: skill('beast.spirit-flame'),
      first: skill('beast.spirit-flame'),
    });
    expect(session.unit('first').skillsUsedThisRound?.skillIds ?? []).toEqual(
      [],
    );
    expect(damages(session)[0]).toMatchObject({ amount: 138 });
  });
});
