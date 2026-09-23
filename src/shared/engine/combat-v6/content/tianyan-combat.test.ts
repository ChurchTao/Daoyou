import { describe, expect, it } from 'vitest';
import { observeAutoBattle } from '../../../combat-v6/auto-observation';
import { rankAutoActions } from '../../../combat-v6/auto-utility';
import { createEmptySectCombatProgressV6 } from '../build-state';
import {
  createBattle,
  effectiveAttrs,
  type Command,
  type CreateBattleInput,
} from '../core';
import { createDaoyouRuleset } from '../rules-daoyou';
import { COMBAT_V6_PHASE_6D_VERSIONS as versions } from '../version';
import { compileSectDefinitionV6 } from './compiler';
import { TIANYAN_V6_DEFINITION as definition } from './tianyan';
import { TIANYAN_REACTIONS_V1 } from './tianyan-foundation';
const S = (id: string) => 'tianyan.skill.' + id;
const T = (id: string) => 'tianyan.status.' + id;
const cmd = (id: string, targets = ['t']): Command => ({
  type: 'skill',
  skillId: S(id),
  targets,
});
function setup(pathName = 'hetu', wanted: string[] = [], enemies = 6) {
  const path = definition.paths.find((p) => p.id.endsWith('.' + pathName))!;
  const picked = wanted.map((id) =>
    path.nodes.find((n) => n.id.endsWith('.' + id))!,
  );
  const depth = Math.max(0, ...picked.map((n) => n.layer));
  const nodes = Array.from(
    { length: depth },
    (_, i) =>
      picked.find((n) => n.layer === i + 1) ??
      path.nodes.find((n) => n.layer === i + 1 && n.slot === 2)!,
  );
  const progress = createEmptySectCombatProgressV6(
    'tianyan',
    path.id,
    Object.fromEntries(definition.methods.map((m) => [m.id, 180])),
  );
  progress.meridianDepth = 7;
  progress.meridianLoadouts.find((l) => l.pathId === path.id)!.nodeIds =
    nodes.map((n) => n.id);
  const result = compileSectDefinitionV6({
    definition,
    progress,
    characterLevel: 180,
  });
  if (!result.ok) throw new Error(JSON.stringify(result));
  const p = result.projection;
  for (const n of picked)
    if (!p.passiveSkillIds.includes(n.passives![0].definition.id))
      throw new Error('未连通: ' + n.id);
  const attrs = {
    hp: 10000,
    maxHp: 10000,
    mp: 10000,
    maxMp: 10000,
    magicAtk: 1000,
    magicDef: 300,
    physicalAtk: 1000,
    physicalDef: 300,
    speed: 1000,
    spellCritRate: 0,
    critRate: 0,
  };
  const input: CreateBattleInput = {
    seed: 12,
    versions,
    skills: p.skills,
    statusDefs: [
      ...p.statusDefs,
      { id: 'buff.a', name: '增益甲', kind: 'buff.a', category: 'buff' },
      { id: 'buff.b', name: '增益乙', kind: 'buff.b', category: 'buff' },
    ],
    ruleset: createDaoyouRuleset({
      formulas: {
        spellHitChance: () => 1,
        physicalHitChance: () => 1,
        sealHitChance: () => 1,
        fluctuationMin: 1,
        fluctuationMax: 1,
        physicalFluctuationMin: 1,
        physicalFluctuationMax: 1,
      },
    }),
    units: [
      {
        id: 's',
        name: '天衍',
        side: 0,
        kind: 'player',
        level: 180,
        attrs,
        skills: p.activeSkillIds,
        passives: p.passiveSkillIds,
        skillLevels: p.skillLevels,
        skillOverrides: p.skillOverrides,
        resources: p.resources,
      },
      {
        id: 'a',
        name: '队友',
        side: 0,
        kind: 'player',
        level: 180,
        attrs: { ...attrs, speed: 300 },
      },
      ...Array.from({ length: enemies }, (_, i) => ({
        id: i ? 't' + i : 't',
        name: '敌人',
        side: 1 as const,
        kind: 'player' as const,
        level: 180,
        attrs: { ...attrs, speed: 100 - i },
      })),
    ],
  };
  return { b: createBattle(input), input, p };
}
type B = ReturnType<typeof setup>['b'];
function round(b: B, commands: Record<string, Command> = {}) {
  for (const u of b.state.units)
    if (!u.flags.dead && !u.flags.downed && !u.flags.escaped)
      b.submit(u.id, commands[u.id] ?? { type: 'defend' });
  b.lockAndResolve();
}
const st = (b: B, target: string, name: string) =>
  b.unit(target).statuses.find((s) => s.id === T(name));
const seal = (b: B, e: string) => b.applyStatus('s', T('mark.' + e), 1);
const damage = (b: B, target = 't') =>
  b
    .log()
    .filter(
      (e) => e.type === 'damage' && e.sourceId === 's' && e.targetId === target,
    )
    .reduce((n, e) => n + (e.type === 'damage' ? e.amount : 0), 0);
const elements = ['wood', 'fire', 'earth', 'metal', 'water'];
describe('天衍自身法印与十种反应', () => {
  it.each(elements.flatMap((old) => elements.map((next) => [old, next])))(
    '%s → %s 只触发对应生克，更新自身唯一法印',
    (old, next) => {
      const { b } = setup();
      seal(b, old);
      round(b, { s: cmd(next) });
      expect(
        b
          .unit('s')
          .statuses.filter((s) => s.kind === T('mark'))
          .map((s) => s.id),
      ).toEqual([T('mark.' + next)]);
      expect(b.unit('t').statuses.some((s) => s.kind === T('mark'))).toBe(
        false,
      );
      const expected = TIANYAN_REACTIONS_V1.filter(
        (r) => r.oldElement === old && r.newElement === next,
      ).map((r) => r.id);
      expect(
        b
          .log()
          .filter((e) => e.type === 'mechanicTriggered')
          .map((e) => (e.type === 'mechanicTriggered' ? e.mechanicId : '')),
      ).toEqual(expected);
    },
  );
  it('首次施法不反应，换目标继续；辅助、防御、普攻与施法失败保留法印', () => {
    const { b } = setup();
    round(b, { s: cmd('wood') });
    expect(b.log().some((e) => e.type === 'mechanicTriggered')).toBe(false);
    round(b, { s: cmd('ward', ['s']) });
    round(b);
    round(b, { s: cmd('clarity', ['a']) });
    expect(st(b, 's', 'mark.wood')).toBeDefined();
    b.unit('s').attrs.mp = 0;
    round(b, { s: cmd('water') });
    expect(st(b, 's', 'mark.wood')).toBeDefined();
    b.unit('s').attrs.mp = 10000;
    round(b, { s: cmd('fire', ['t3']) });
    const action = b
      .log()
      .filter((e) => e.type === 'actionStart' && e.unitId === 's')
      .at(-1);
    expect(
      action?.type === 'actionStart' &&
        action.command.type === 'skill' &&
        action.command.targets,
    ).toHaveLength(4);
    expect(st(b, 's', 'mark.fire')).toBeDefined();
  });
  it('法印不计时、不被驱散，倒地复活保留', () => {
    const { input } = setup();
    input.skills!.push(
      {
        id: 'kill',
        name: '击倒',
        tags: ['spell'],
        targeting: { side: 'enemy' },
        effects: [{ type: 'fixedHit', power: 50000 }],
      },
      {
        id: 'revive',
        name: '复活',
        tags: ['spell'],
        targeting: { side: 'ally', includeDowned: true },
        effects: [{ type: 'revive', hpRatio: 0.5 }],
      },
      {
        id: 'purge',
        name: '驱散',
        tags: ['spell'],
        targeting: { side: 'enemy' },
        effects: [{ type: 'dispel', categories: ['buff'] }],
      },
    );
    input.units[2].skills = ['kill', 'purge'];
    input.units[1].skills = ['revive'];
    const b = createBattle(input);
    seal(b, 'water');
    for (let i = 0; i < 5; i++) round(b);
    round(b, { t: { type: 'skill', skillId: 'purge', targets: ['s'] } });
    expect(st(b, 's', 'mark.water')).toBeDefined();
    round(b, { t: { type: 'skill', skillId: 'kill', targets: ['s'] } });
    expect(b.unit('s').flags.downed).toBe(true);
    expect(st(b, 's', 'mark.water')).toBeDefined();
    round(b, { a: { type: 'skill', skillId: 'revive', targets: ['s'] } });
    expect(st(b, 's', 'mark.water')).toBeDefined();
    round(b, { s: cmd('earth') });
    expect(st(b, 't', 'seal')).toBeDefined();
    expect(createBattle(input).unit('s').statuses).toEqual([]);
  });
  it('凝露范围伤害后只治疗最低血线友方一次；滋荣共两次恢复', () => {
    const { b } = setup();
    b.unit('a').attrs.hp = 1000;
    seal(b, 'metal');
    round(b, { s: cmd('water') });
    expect(b.log().filter((e) => e.type === 'heal')).toHaveLength(1);
    expect(b.unit('a').attrs.hp).toBe(1416);
    seal(b, 'water');
    round(b, { s: cmd('wood') });
    expect(b.unit('a').attrs.hp).toBe(1662);
    round(b);
    expect(b.unit('a').attrs.hp).toBe(1908);
    round(b);
    expect(b.unit('a').attrs.hp).toBe(1908);
  });
  it('烬垒一次护盾、淬锋忽视法防、蒸腾法术增伤', () => {
    const { b } = setup();
    seal(b, 'fire');
    round(b, { s: cmd('earth') });
    expect(b.unit('s').barriers[0].current).toBe(466);
    function cast(e: string, previous?: string) {
      const { b } = setup();
      if (previous) seal(b, previous);
      round(b, { s: cmd(e) });
      return damage(b);
    }
    expect(cast('metal', 'earth')).toBeGreaterThan(cast('metal'));
    expect(cast('water', 'fire')).toBeGreaterThan(cast('water'));
  });
  it('裂土减法防、熔锋双攻削弱、断枝仅移除一个普通增益', () => {
    const { b } = setup();
    seal(b, 'earth');
    round(b, { s: cmd('wood') });
    expect(effectiveAttrs(b.unit('t')).magicDef).toBe(255);
    seal(b, 'metal');
    round(b, { s: cmd('fire') });
    for (const id of ['t', 't1', 't2'])
      expect(effectiveAttrs(b.unit(id)).magicAtk).toBe(900);
    b.applyStatus('t', 'buff.a', 5);
    b.applyStatus('t', 'buff.b', 5);
    seal(b, 'wood');
    round(b, { s: cmd('metal') });
    expect(
      b.unit('t').statuses.filter((s) => s.id.startsWith('buff.')),
    ).toHaveLength(1);
  });
  it('截流走封印概率，留隙改为稳定削弱；净化不能解硬控', () => {
    const { input } = setup();
    input.ruleset = createDaoyouRuleset({
      formulas: { spellHitChance: () => 1, sealHitChance: () => 0 },
    });
    const b = createBattle(input);
    seal(b, 'water');
    round(b, { s: cmd('earth') });
    expect(st(b, 't', 'seal')).toBeUndefined();
    const { b: gap } = setup('luoshu', ['3.2']);
    seal(gap, 'water');
    round(gap, { s: cmd('earth') });
    expect(st(gap, 't', 'spell_dull')).toBeDefined();
    expect(st(gap, 't', 'seal')).toBeUndefined();
    b.applyStatus('a', T('seal'), 4);
    b.applyStatus('a', T('bind'), 4);
    round(b, { s: cmd('clarity', ['a']) });
    expect(st(b, 'a', 'bind')).toBeUndefined();
    expect(st(b, 'a', 'seal')).toBeDefined();
  });
});
describe('天衍经脉机制分化', () => {
  it('余火替换燎原加人，润物分摊两人恢复，分锋增添金法目标', () => {
    const { b } = setup('hetu', ['2.1']);
    seal(b, 'wood');
    round(b, { s: cmd('fire') });
    expect(st(b, 't', 'ember')).toBeUndefined();
    expect(st(b, 't1', 'ember')).toBeDefined();
    expect(damage(b, 't3')).toBe(0);
    const { b: rain } = setup('hetu', ['2.3']);
    seal(rain, 'metal');
    rain.unit('s').attrs.hp = rain.unit('a').attrs.hp = 1000;
    round(rain, { s: cmd('water') });
    expect(rain.log().filter((e) => e.type === 'heal')).toHaveLength(2);
    expect(rain.unit('a').attrs.hp).toBe(1291);
    const { b: split } = setup('hetu', ['2.2']);
    seal(split, 'earth');
    round(split, { s: cmd('metal') });
    expect(damage(split, 't1')).toBeGreaterThan(damage(split));
  });
  it('借势需要法印且只推进一次；止戈不改印；二者有真实冷却', () => {
    const { b } = setup('hetu', ['3.1']);
    expect(
      b.queryCommands('s').skills.find((s) => s.skillId === S('borrow'))?.ready,
    ).toBe(false);
    seal(b, 'wood');
    round(b, { s: cmd('borrow') });
    expect(st(b, 's', 'mark.fire')).toBeDefined();
    expect(b.unit('s').barriers).toHaveLength(1);
    expect(
      b.queryCommands('s').skills.find((s) => s.skillId === S('borrow'))?.ready,
    ).toBe(false);
    const { b: truce } = setup('luoshu', ['3.1']);
    seal(truce, 'wood');
    round(truce, { s: cmd('truce') });
    expect(st(truce, 's', 'mark.wood')).toBeDefined();
    expect(st(truce, 't', 'truce')).toBeDefined();
  });
  it('斩蔓、蚀基、钝兵分别实际改变驱散数、减防和人数', () => {
    const { b } = setup('luoshu', ['2.1']);
    b.applyStatus('t', 'buff.a', 5);
    b.applyStatus('t', 'buff.b', 5);
    seal(b, 'wood');
    round(b, { s: cmd('metal') });
    expect(
      b.unit('t').statuses.filter((s) => s.id.startsWith('buff.')),
    ).toEqual([]);
    const { b: crack } = setup('luoshu', ['2.2']);
    seal(crack, 'earth');
    round(crack, { s: cmd('wood') });
    expect(effectiveAttrs(crack.unit('t')).magicDef).toBe(225);
    expect(st(crack, 't', 'foundation_break')?.remainingRounds).toBe(1);
    const { b: blunt } = setup('luoshu', ['2.3']);
    seal(blunt, 'metal');
    round(blunt, { s: cmd('fire') });
    expect(effectiveAttrs(blunt.unit('t')).magicAtk).toBe(800);
    expect(damage(blunt, 't2')).toBe(0);
  });
  it('独照只补人数不足，归流只在生克时折价', () => {
    const { b: one } = setup('hetu', ['5.1'], 1);
    const { b: many } = setup('hetu', ['5.1']);
    round(one, { s: cmd('water') });
    round(many, { s: cmd('water') });
    expect(damage(one)).toBeGreaterThan(damage(many));
    const { b: normal } = setup('hetu', ['6.1']);
    const { b: react } = setup('hetu', ['6.1']);
    seal(react, 'fire');
    round(normal, { s: cmd('water') });
    round(react, { s: cmd('water') });
    expect(react.unit('s').attrs.mp).toBeGreaterThan(normal.unit('s').attrs.mp);
  });
});

describe('天衍节点组合收益回归', () => {
  it('镇岳独立强化至25%；点出镇世后转为节蓝，保留40%削弱', () => {
    const { b: mountain } = setup('luoshu', ['1.3']);
    round(mountain, { s: cmd('earth') });
    expect(st(mountain, 't', 'weaken_deep')).toBeDefined();
    expect(mountain.unit('s').attrs.mp).toBe(9957);
    const { b: end } = setup('luoshu', ['7.2']);
    const { b: both } = setup('luoshu', ['1.3', '7.2']);
    for (const b of [end, both]) {
      round(b, { s: cmd('earth') });
      expect(st(b, 't', 'truce_deep')).toBeDefined();
      expect(st(b, 't', 'weaken_deep')).toBeUndefined();
    }
    expect(damage(both)).toBe(damage(end));
    expect(end.unit('s').attrs.mp).toBe(9964);
    expect(both.unit('s').attrs.mp).toBe(9968);
  });
  it('留隙搭配禁流将稳定削弱从25%提高到35%，不附加封法', () => {
    function incoming(nodes: string[]) {
      const { input } = setup('luoshu', nodes);
      input.skills!.push({ id: 'enemy.spell', name: '法术', tags: ['spell'], targeting: { side: 'enemy' }, effects: [{ type: 'spellHit', coeff: 1, power: 0 }] });
      input.units[2].skills = ['enemy.spell'];
      const b = createBattle(input);
      seal(b, 'water');
      round(b, { s: cmd('earth'), t: { type: 'skill', skillId: 'enemy.spell', targets: ['s'] } });
      return { b, lost: 10000 - b.unit('s').attrs.hp };
    }
    const normal = incoming(['3.2']);
    const enhanced = incoming(['3.2', '4.3']);
    expect(st(normal.b, 't', 'spell_dull')).toBeDefined();
    expect(st(enhanced.b, 't', 'spell_dull_deep')).toBeDefined();
    expect(st(enhanced.b, 't', 'spell_dull')).toBeUndefined();
    expect(enhanced.lost / normal.lost).toBeCloseTo(0.65 / 0.75, 2);
    for (const b of [normal.b, enhanced.b]) expect(st(b, 't', 'seal')).toBeUndefined();
  });
  it('天人不降低任何基础五行伤害，并强化燎原和淬锋', () => {
    const prefix = ['1.2', '2.2', '3.2', '4.2', '5.2', '6.2'];
    for (const element of elements) {
      const { b: base } = setup('hetu', prefix);
      const { b: end } = setup('hetu', [...prefix, '7.2']);
      round(base, { s: cmd(element) });
      round(end, { s: cmd(element) });
      expect(damage(end)).toBe(damage(base));
    }
    for (const [old, next] of [['wood', 'fire'], ['earth', 'metal']]) {
      const { b: base } = setup('hetu', prefix);
      const { b: end } = setup('hetu', [...prefix, '7.2']);
      for (const b of [base, end]) { seal(b, old); round(b, { s: cmd(next) }); }
      // 同类增伤相加：已有衍法+5%、映霞-4%，金法主目标另有分锋-15%。
      const beforeFactor = next === 'metal' ? 0.86 : 1.01;
      expect(Math.abs(damage(end) - damage(base) * (beforeFactor + 0.05) / beforeFactor)).toBeLessThan(2);
    }
  });
  it('天人仍将凝露、滋荣和火生土护盾提高25%', () => {
    const prefix = ['1.2', '2.2', '3.2', '4.2', '5.2', '6.2'];
    for (const [old, next] of [['metal', 'water'], ['water', 'wood'], ['fire', 'earth']]) {
      const values: number[] = [];
      for (const nodes of [prefix, [...prefix, '7.2']]) {
        const { b } = setup('hetu', nodes);
        b.unit('a').attrs.hp = 1000;
        seal(b, old);
        round(b, { s: cmd(next) });
        values.push(next === 'earth' ? b.unit('s').barriers[0].current : b.unit('a').attrs.hp - 1000);
      }
      expect(Math.abs(values[1] - values[0] * 1.25)).toBeLessThan(2);
    }
  });
  it('余火以延迟两跳换取高气血目标的完整周期收益，仍受气血比例限制', () => {
    const totals: number[] = [];
    for (const nodes of [['1.1'], ['1.1', '2.1']]) {
      const { b } = setup('hetu', nodes);
      for (const u of b.state.units.filter(u => u.side === 1)) u.attrs.hp = u.attrs.maxHp = 20000;
      seal(b, 'wood');
      round(b, { s: cmd('fire') });
      round(b);
      totals.push(b.log().filter(e => e.type === 'damage' && e.sourceId === 's').reduce((n, e) => n + (e.type === 'damage' ? e.amount : 0), 0));
    }
    expect(totals).toEqual([4056, 4418]);
    const { b } = setup('hetu', ['2.1']);
    seal(b, 'wood');
    round(b, { s: cmd('fire') });
    const tick = b.log().filter(e => e.type === 'damage' && e.sourceId === 's' && e.kind === 'fixed');
    expect(tick.map(e => e.type === 'damage' ? e.amount : 0)).toEqual([200, 200]);
  });
});

describe('38 个可选节点实际结算差异', () => {
  for (const path of definition.paths)
    for (const node of path.nodes.filter((n) => !n.automatic)) {
      it(`${path.name}·${node.name} 在合法连线构筑中有可观测收益或取舍`, () => {
        const pathName = path.id.split('.').at(-1)!;
        const line = path.nodes
          .filter((n) => n.layer <= node.layer && n.slot === node.slot)
          .map((n) => `${n.layer}.${n.slot}`);
        const active = setup(pathName, line).input;
        const baseline = setup(pathName, line.slice(0, -1)).input;
        function simulate(
          input: CreateBattleInput,
          spell: string,
          previous: string | undefined,
        ) {
          const b = createBattle(input);
          b.unit('s').attrs.hp = b.unit('a').attrs.hp = 3000;
          b.unit('s').attrs.mp = 5000;
          b.unit('t').attrs.hp = 9000;
          b.unit('t').barriers.push({
            id: 'test',
            kind: 'test',
            name: '护盾',
            current: 100,
            sourceId: 't',
            appliedRound: 0,
            remainingRounds: 5,
          });
          b.applyStatus('t', 'buff.a', 5);
          b.applyStatus('t', 'buff.b', 5);
          b.applyStatus('t', T('foundation_break'), 5);
          b.applyStatus('a', T('bind'), 5);
          b.applyStatus('a', T('melt'), 5);
          if (previous) seal(b, previous);
          // 独照观察实际人数不足，其余节点均在同一可比较局面中结算。
          if (node.name === '独照')
            for (const u of b.state.units.filter(
              (u) => u.side === 1 && u.id !== 't',
            ))
              u.flags.escaped = true;
          const command = b.unit('s').skills.includes(S(spell))
            ? cmd(
                spell,
                spell === 'ward' ? ['s'] : spell === 'clarity' ? ['a'] : ['t'],
              )
            : ({ type: 'defend' } as Command);
          round(b, { s: command, t: { type: 'attack', target: 's' } });
          return JSON.stringify(
            b.state.units.map((u) => ({
              hp: u.attrs.hp,
              mp: u.attrs.mp,
              attrs: effectiveAttrs(u),
              cooldowns: u.cooldowns,
              statuses: u.statuses,
              barriers: u.barriers,
            })),
          );
        }
        const scenarios = [
          ...elements,
          'ward',
          'clarity',
          'borrow',
          'truce',
        ].flatMap((spell) =>
          [undefined, ...elements].map((previous) => ({ spell, previous })),
        );
        expect(
          scenarios.some(
            ({ spell, previous }) =>
              simulate(active, spell, previous) !==
              simulate(baseline, spell, previous),
          ),
        ).toBe(true);
      });
    }
});

describe('天衍自动战斗估值', () => {
  it('识别自身反应、淬锋与蒸腾，不改变观察或战斗快照', () => {
    const { b, p } = setup();
    const rank = () =>
      rankAutoActions(
        observeAutoBattle(b.state, 's', p.statusDefs),
        's',
        p.skills,
        p.statusDefs,
        b.queryCommands('s'),
      );
    const score = (rows: ReturnType<typeof rank>, id: string) =>
      Math.max(
        ...rows
          .filter(
            (r) => r.command.type === 'skill' && r.command.skillId === S(id),
          )
          .map((r) => r.benefits.offense),
      );
    const initial = rank();
    seal(b, 'fire');
    expect(score(rank(), 'water')).toBeGreaterThan(score(initial, 'water'));
    seal(b, 'earth');
    expect(score(rank(), 'metal')).toBeGreaterThan(score(initial, 'metal'));
    const before = JSON.stringify(b.snapshot());
    const observation = observeAutoBattle(b.state, 's', p.statusDefs);
    const seen = JSON.stringify(observation);
    const first = rankAutoActions(
      observation,
      's',
      p.skills,
      p.statusDefs,
      b.queryCommands('s'),
    );
    expect(
      rankAutoActions(
        observation,
        's',
        p.skills,
        p.statusDefs,
        b.queryCommands('s'),
      ),
    ).toEqual(first);
    expect(JSON.stringify(observation)).toBe(seen);
    expect(JSON.stringify(b.snapshot())).toBe(before);
  });
  it('为最低血线友方估算凝露；法印本身不虚增控制价值', () => {
    const { b, p } = setup();
    b.unit('a').attrs.hp = 1000;
    seal(b, 'metal');
    const rows = rankAutoActions(
      observeAutoBattle(b.state, 's', p.statusDefs),
      's',
      p.skills,
      p.statusDefs,
      b.queryCommands('s'),
    );
    const water = rows.find(
      (r) => r.command.type === 'skill' && r.command.skillId === S('water'),
    )!;
    expect(
      water.intents.find((i) => i.targetId === 'a')?.healing,
    ).toBeGreaterThan(0);
    expect(water.benefits.control).toBe(0);
  });
});
