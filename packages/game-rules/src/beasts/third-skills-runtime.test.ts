import { createBattle, restoreBattle } from '@daoyou/combat-core/session';
import type { Command, LineupUnit, SkillDef } from '@daoyou/combat-core/types';
import { effectiveAttrs } from '@daoyou/combat-core/units';
import { BEAST_SKILLS, BEAST_STATUS_DEFS } from '@daoyou/game-content/beasts';
import { COMBAT_V6_SEAL_CURVE_TRAINING_VERSIONS } from '@daoyou/game-domain/combat';
import { expect, it } from 'vitest';
import { automaticCommands } from '../combat/auto.js';
import { createDaoyouRuleset } from '../combat/daoyou/index.js';

const ruleset = createDaoyouRuleset({
  maxRounds: 200,
  formulas: {
    physicalHitChance: () => 1,
    spellHitChance: () => 1,
    physicalFluctuationMin: 1,
    physicalFluctuationMax: 1,
    fluctuationMin: 1,
    fluctuationMax: 1,
    defendPhysicalFactor: 1,
    baseDamage: (input) =>
      input.kind === 'fixed'
        ? input.power
        : (input.kind === 'physical'
            ? input.source.attrs.physicalAtk - input.target.attrs.physicalDef
            : input.source.attrs.magicAtk - input.target.attrs.magicDef) *
            input.coeff +
          input.power,
  },
});
const definition = (id: string) =>
  structuredClone(BEAST_SKILLS.find((skill) => skill.id === id)!);
const cast = (skillId: string, target = 'target'): Command => ({
  type: 'skill',
  skillId,
  targets: [target],
});
const attack: Command = { type: 'attack', target: 'target' };
function actor(
  id: string,
  side: 0 | 1,
  extra: Partial<LineupUnit> = {},
): LineupUnit {
  return {
    id,
    name: id,
    kind: 'pet',
    side,
    level: 10,
    combatFacts: { magic: 220, strength: 100 },
    tags: [`beastSpecies.${id}`],
    attrs: {
      hp: 10000,
      maxHp: 10000,
      mp: 1000,
      maxMp: 1000,
      physicalAtk: 100,
      magicAtk: 100,
      physicalDef: 0,
      magicDef: 0,
      speed: side ? 1 : 100,
    },
    ...extra,
  };
}
function input(
  source: Partial<LineupUnit> = {},
  target: Partial<LineupUnit> = {},
  others: LineupUnit[] = [],
  overrides: SkillDef[] = [],
  seed = 42,
) {
  return {
    seed,
    versions: COMBAT_V6_SEAL_CURVE_TRAINING_VERSIONS,
    ruleset,
    skills: [...BEAST_SKILLS, ...overrides],
    statusDefs: [
      ...BEAST_STATUS_DEFS,
      {
        id: 'test.speed',
        name: '变速',
        kind: 'test.speed',
        category: 'buff' as const,
        speedMod: 200,
      },
    ],
    units: [actor('source', 0, source), actor('target', 1, target), ...others],
  };
}
function resolve(
  session: ReturnType<typeof createBattle>,
  command: Command = attack,
) {
  for (const unit of session.snapshot().units) {
    if (
      unit.flags.benched ||
      unit.flags.dead ||
      unit.flags.downed ||
      unit.flags.escaped
    )
      continue;
    session.submit(
      unit.id,
      unit.id === 'source' ? command : { type: 'defend' },
    );
  }
  session.lockAndResolve();
}
function damage(session: ReturnType<typeof createBattle>) {
  return session
    .log()
    .filter((event) => event.type === 'damage' && event.sourceId === 'source');
}

it.each([
  ['beast.fortune', 175],
  ['beast.advanced-fortune', 150],
] as const)('%s对物法暴击只降低额外部分', (id, amount) => {
  for (const spell of [false, true]) {
    const session = createBattle(
      input(
        {
          skills: ['beast.spirit-flame'],
          attrs: { ...actor('source', 0).attrs, critRate: 1, spellCritRate: 1 },
        },
        { passives: [id] },
      ),
    );
    resolve(session, spell ? cast('beast.spirit-flame') : attack);
    expect(damage(session)[0].amount).toBe(
      spell ? amount + amount * 0.2 : amount,
    );
    expect(
      session
        .log()
        .find((event) => event.type === 'hit' && event.sourceId === 'source'),
    ).toMatchObject({ crit: true });
  }
});

it('幸运适用于派生连击，善报治疗不受目标幸运减免', () => {
  const combo = definition('beast.combo');
  combo.hooks![1].chance = 1;
  const session = createBattle(
    input(
      {
        passives: ['beast.combo'],
        attrs: { ...actor('source', 0).attrs, critRate: 1 },
      },
      { passives: ['beast.advanced-fortune'] },
      [],
      [combo],
    ),
  );
  resolve(session);
  expect(damage(session).map((event) => event.amount)).toEqual([112, 112]);
  const karma = definition('beast.karmic-retribution');
  const branch = karma.effects[0];
  if (branch.type !== 'randomBranch') throw new Error('expected branch');
  branch.chance = 0;
  const healed = createBattle(
    input(
      {
        skills: [karma.id],
        attrs: { ...actor('source', 0).attrs, critRate: 1 },
      },
      {
        passives: ['beast.advanced-fortune'],
        attrs: { ...actor('target', 1).attrs, hp: 5000 },
      },
      [],
      [karma],
    ),
  );
  resolve(healed, cast(karma.id));
  expect(healed.unit('target').attrs.hp).toBe(5100);
});

it.each([
  ['beast.flight', 0.95],
  ['beast.advanced-flight', 0.9],
] as const)('%s物理闪避使用现有命中抽签，法术和必中不受影响', (id, chance) => {
  let misses = 0;
  for (let seed = 1; seed <= 100; seed++) {
    const session = createBattle(input({}, { passives: [id] }, [], [], seed));
    resolve(session);
    misses += session.log().filter((event) => event.type === 'miss').length;
  }
  expect(misses).toBeGreaterThan(0);
  expect(misses).toBeLessThan(25);
  const flight = definition(id);
  expect(flight.hooks![0].effects[0]).toMatchObject({ factor: chance });
  for (const skillId of ['beast.spirit-flame', 'beast.sweeping-strike']) {
    const session = createBattle(
      input({ skills: [skillId] }, { passives: [id] }),
    );
    resolve(session, cast(skillId));
    expect(damage(session)).toHaveLength(1);
  }
});

it.each([
  ['beast.coordination', 3],
  ['beast.advanced-coordination', 5],
] as const)(
  '%s只计存活异种，同种与后备不计，死亡与复生实时改变收益',
  (id, add) => {
    const others = [
      actor('a', 0),
      actor('b', 0, { tags: ['beastSpecies.a'] }),
      actor('same', 0, { tags: ['beastSpecies.source'] }),
      actor('reserve', 0, { benched: true }),
      actor('c', 0),
    ];
    const session = createBattle(input({ passives: [id] }, {}, others));
    resolve(session);
    expect(damage(session)[0].amount).toBe(100 + add);
    session.unit('a').flags.dead = true;
    session.unit('b').flags.dead = true;
    resolve(session);
    expect(damage(session).at(-1)!.amount).toBe(
      101 + (id.includes('advanced') ? 1 : 0),
    );
    session.unit('a').flags.dead = false;
    resolve(session);
    expect(damage(session).at(-1)!.amount).toBe(100 + add);
    expect(definition(id).innate?.sealHitTakenFactor).toBe(1.1);
  },
);

it('横扫主次倍率缩放号令结果加成，目标不重复且次目标按种子随机选择', () => {
  const seen = new Set<string>();
  for (let seed = 1; seed <= 20; seed++) {
    const session = createBattle(
      input(
        {
          skills: ['beast.sweeping-strike'],
          passives: ['beast.advanced-coordination'],
          level: 40,
        },
        {},
        [actor('ally', 0), actor('e2', 1), actor('e3', 1), actor('e4', 1)],
        [],
        seed,
      ),
    );
    resolve(session, cast('beast.sweeping-strike'));
    const dealt = damage(session);
    expect(dealt).toHaveLength(3);
    expect(dealt[0]).toMatchObject({ targetId: 'target', amount: 71 });
    expect(dealt.slice(1).map((event) => event.amount)).toEqual([38, 38]);
    expect(new Set(dealt.map((event) => event.targetId)).size).toBe(3);
    seen.add(
      dealt
        .slice(1)
        .map((event) => event.targetId)
        .join(','),
    );
    expect(session.unit('source').attrs.hp).toBe(9000);
    expect(session.unit('source').attrs.mp).toBe(1000);
  }
  expect(seen.size).toBeGreaterThan(1);
});

it('横扫受连击全局代价但不触发普攻连击或毒，反震致死中断剩余目标', () => {
  const combo = definition('beast.combo');
  combo.hooks![1].chance = 1;
  const poison = definition('beast.poison');
  poison.hooks![0].chance = 1;
  const session = createBattle(
    input(
      { skills: ['beast.sweeping-strike'], passives: [combo.id, poison.id] },
      {},
      [actor('e2', 1), actor('e3', 1)],
      [combo, poison],
    ),
  );
  resolve(session, cast('beast.sweeping-strike'));
  expect(damage(session).map((event) => event.amount)).toEqual([48, 26, 26]);
  expect(session.unit('target').statuses).toEqual([]);
  const reflection = definition('beast.advanced-reflection');
  reflection.hooks![0].chance = 1;
  const lethal = createBattle(
    input(
      {
        skills: ['beast.sweeping-strike'],
        attrs: { ...actor('source', 0).attrs, hp: 20 },
      },
      { passives: [reflection.id] },
      [actor('e2', 1), actor('e3', 1)],
      [reflection],
    ),
  );
  resolve(lethal, cast('beast.sweeping-strike'));
  expect(damage(lethal)).toHaveLength(1);
  expect(lethal.unit('source').flags.dead).toBe(true);
});

it('灵息激发按魔力属性快照增法攻，支付费用，计时刷新且不叠层', () => {
  const session = createBattle(
    input({ skills: ['beast.spirit-surge', 'beast.spirit-flame'] }),
  );
  expect(
    session
      .queryCommands('source')
      .skills.find((skill) => skill.skillId === 'beast.spirit-surge')!.costs.mp,
  ).toBe(55);
  resolve(session, cast('beast.spirit-surge', 'source'));
  expect(session.unit('source').attrs.mp).toBe(945);
  expect(effectiveAttrs(session.unit('source')).magicAtk).toBe(200);
  expect(session.unit('source').statuses[0].remainingRounds).toBe(4);
  resolve(session, cast('beast.spirit-surge', 'source'));
  expect(effectiveAttrs(session.unit('source')).magicAtk).toBe(200);
  expect(session.unit('source').statuses).toHaveLength(1);
  for (let i = 0; i < 4; i++) resolve(session);
  expect(effectiveAttrs(session.unit('source')).magicAtk).toBe(100);
});

it('灵息激发受绝灵拒绝，自动战斗仅在能支付后续法术时蓄势且不重复开启', () => {
  const denied = createBattle(
    input({ skills: ['beast.spirit-surge'], passives: ['beast.denial'] }),
  );
  resolve(denied, cast('beast.spirit-surge', 'source'));
  expect(denied.unit('source').statuses).toEqual([]);
  const session = createBattle(
    input(
      {
        skills: ['beast.spirit-surge', 'beast.spirit-flame'],
        ownerId: 'owner',
      },
      {},
      [actor('owner', 0, { kind: 'player' })],
    ),
  );
  const choose = () =>
    automaticCommands(
      session.snapshot(),
      'owner',
      BEAST_SKILLS,
      (id) => session.queryCommands(id),
      { statusDefs: BEAST_STATUS_DEFS },
    ).find((command) => command.unitId === 'source')!.command;
  expect(choose()).toMatchObject({
    type: 'skill',
    skillId: 'beast.spirit-surge',
  });
  resolve(session, choose());
  expect(choose()).toMatchObject({
    type: 'skill',
    skillId: 'beast.spirit-flame',
  });
  session.unit('source').statuses = [];
  session.unit('source').attrs.mp = 60;
  expect(choose()).not.toMatchObject({
    type: 'skill',
    skillId: 'beast.spirit-surge',
  });
});

it('观照调用横扫与十日并支付费用，不调用灵息激发', () => {
  const session = createBattle(
    input(
      {
        skills: [
          'beast.all-seeing',
          'beast.spirit-surge',
          'beast.sweeping-strike',
          'beast.eightfold-flame',
        ],
      },
      {},
      [actor('e2', 1), actor('e3', 1)],
    ),
  );
  resolve(session, cast('beast.all-seeing'));
  expect(damage(session)).toHaveLength(6);
  expect(session.unit('source').attrs.mp).toBe(970);
  expect(session.unit('source').attrs.hp).toBe(9000);
  expect(session.unit('source').statuses).toEqual([]);
});

it.each([
  ['physical', 110],
  ['spell', 132],
  ['fixed', 201],
] as const)('风起龙游对%s按有效速度增伤，速度相等不触发', (kind, amount) => {
  const id = kind === 'spell' ? 'beast.spirit-flame' : 'beast.wind-strike';
  const session = createBattle(
    input({ skills: [id], passives: ['beast.wind-pursuit'] }),
  );
  resolve(session, kind === 'physical' ? attack : cast(id));
  expect(damage(session)[0].amount).toBe(amount);
  const equal = createBattle(
    input(
      { passives: ['beast.wind-pursuit'] },
      { attrs: { ...actor('target', 1).attrs, speed: 100 } },
    ),
  );
  resolve(equal);
  expect(damage(equal)[0].amount).toBe(100);
});

it('风起龙游群法逐目标判断并响应状态变速', () => {
  const session = createBattle(
    input(
      { skills: ['beast.eightfold-flame'], passives: ['beast.wind-pursuit'] },
      {},
      [
        actor('fast', 1, {
          attrs: { ...actor('target', 1).attrs, speed: 200 },
        }),
      ],
    ),
  );
  resolve(session, cast('beast.eightfold-flame'));
  expect(damage(session).map((event) => event.amount)).toEqual([132, 120]);
  session.applyStatus('target', 'test.speed', 5, 'target');
  resolve(session);
  expect(damage(session).at(-1)!.amount).toBe(100);
});

it('招财成功跳过必杀且不受幸运减免，失败正常必杀；原始概率为8%', () => {
  for (const chance of [0, 1]) {
    const golden = definition('beast.golden-strike');
    golden.innate!.physicalBurst!.chance = chance;
    const session = createBattle(
      input(
        {
          passives: [golden.id],
          attrs: { ...actor('source', 0).attrs, critRate: 1 },
        },
        { passives: ['beast.advanced-fortune'] },
        [],
        [golden],
      ),
    );
    resolve(session);
    expect(damage(session)[0].amount).toBe(chance ? 400 : 150);
    expect(
      session
        .log()
        .find((event) => event.type === 'hit' && event.sourceId === 'source'),
    ).toMatchObject({ crit: !chance });
  }
  expect(definition('beast.golden-strike').innate!.physicalBurst!.chance).toBe(
    0.08,
  );
});

it('招财可作用于普攻连击，各命中独立判定，不生成额外攻击', () => {
  const golden = definition('beast.golden-strike');
  golden.innate!.physicalBurst!.chance = 1;
  const combo = definition('beast.combo');
  combo.hooks![1].chance = 1;
  const session = createBattle(
    input({ passives: [golden.id, combo.id] }, {}, [], [golden, combo]),
  );
  resolve(session);
  expect(damage(session).map((event) => event.amount)).toEqual([300, 300]);
  expect(
    session
      .log()
      .filter(
        (event) =>
          event.type === 'chanceResolved' &&
          event.branchId === 'beast.golden-strike.burst',
      ),
  ).toHaveLength(2);
});

it('十日0级可打三人；法连追加不再抽削弱', () => {
  const flame = definition('beast.eightfold-flame');
  flame.hooks![0].chance = 1;
  const repeat = definition('beast.spell-combo');
  repeat.innate!.spellRepeat!.chance = 1;
  const session = createBattle(
    input(
      { level: 0, skills: [flame.id], passives: [repeat.id] },
      {},
      [actor('e2', 1), actor('e3', 1)],
      [flame, repeat],
    ),
  );
  resolve(session, cast(flame.id));
  expect(damage(session)).toHaveLength(6);
  expect(
    session.log().filter((event) => event.type === 'statusApplied'),
  ).toHaveLength(3);
  expect(session.unit('source').attrs.mp).toBe(970);
  expect(session.unit('target').statuses).toHaveLength(1);
});

it('十日随机削弱四类可达，刷新排除旧削弱，高级避厄免疫', () => {
  const flame = definition('beast.eightfold-flame');
  flame.hooks![0].chance = 1;
  const seen = new Set<string>();
  for (let seed = 1; seed <= 40; seed++) {
    const session = createBattle(
      input({ skills: [flame.id] }, {}, [], [flame], seed),
    );
    resolve(session, cast(flame.id));
    const status = session.unit('target').statuses[0];
    seen.add(status.id);
    const first = structuredClone(status.attrMods);
    session.applyStatus('target', status.id, 3, 'source');
    expect(session.unit('target').statuses).toHaveLength(1);
    expect(session.unit('target').statuses[0].attrMods).toEqual(first);
  }
  expect(seen.size).toBe(4);
  const immune = createBattle(
    input(
      { skills: [flame.id] },
      { passives: ['beast.advanced-miracle'] },
      [],
      [flame],
    ),
  );
  resolve(immune, cast(flame.id));
  expect(immune.unit('target').statuses).toEqual([]);
});

it('新增技能随机数与状态在完整战局快照恢复后保持一致', () => {
  const data = input(
    {
      skills: [
        'beast.eightfold-flame',
        'beast.spirit-surge',
        'beast.sweeping-strike',
      ],
      passives: ['beast.golden-strike', 'beast.wind-pursuit'],
    },
    { passives: ['beast.flight', 'beast.fortune'] },
    [actor('e2', 1), actor('ally', 0)],
  );
  const session = createBattle(data);
  resolve(session, cast('beast.spirit-surge', 'source'));
  const restored = restoreBattle(data, session.snapshot(), [...session.log()]);
  for (const command of [
    cast('beast.eightfold-flame'),
    cast('beast.sweeping-strike'),
    attack,
  ]) {
    resolve(session, command);
    resolve(restored, command);
    expect(restored.snapshot()).toEqual(session.snapshot());
    expect(restored.log()).toEqual(session.log());
  }
});

it('风起龙游放大号令的完整结果加成，反震不再增幅', () => {
  const session = createBattle(
    input(
      {
        level: 40,
        passives: ['beast.wind-pursuit', 'beast.advanced-coordination'],
      },
      {},
      [actor('ally', 0)],
    ),
  );
  resolve(session);
  expect(damage(session)[0].amount).toBe(121);
  const reflection = definition('beast.advanced-reflection');
  reflection.hooks![0].chance = 1;
  const reflected = createBattle(
    input(
      {},
      {
        passives: [reflection.id, 'beast.wind-pursuit'],
        attrs: { ...actor('target', 1).attrs, speed: 200 },
      },
      [],
      [reflection],
    ),
  );
  resolve(reflected);
  expect(
    reflected
      .log()
      .filter(
        (event) => event.type === 'damage' && event.sourceId === 'target',
      )[0],
  ).toMatchObject({ amount: 50 });
});

it('十日命中被护盾全吸收仍可施加削弱', () => {
  const flame = definition('beast.eightfold-flame');
  flame.hooks![0].chance = 1;
  const shield: SkillDef = {
    id: 'test.shield',
    name: '护盾',
    tags: ['spell'],
    targeting: { side: 'self' },
    effects: [
      {
        type: 'applyBarrier',
        id: 'test.shield',
        kind: 'test.shield',
        name: '护盾',
        power: 1000,
        duration: 5,
      },
    ],
  };
  const session = createBattle(
    input(
      { skills: [flame.id] },
      {
        skills: [shield.id],
        attrs: { ...actor('target', 1).attrs, speed: 200 },
      },
      [],
      [flame, shield],
    ),
  );
  session.submit('source', cast(flame.id));
  session.submit('target', cast(shield.id, 'target'));
  session.lockAndResolve();
  expect(session.unit('target').attrs.hp).toBe(10000);
  expect(session.unit('target').statuses).toHaveLength(1);
});
