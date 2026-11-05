import { createBattle } from '@daoyou/combat-core/session';
import {
  type Command,
  type CreateBattleInput,
} from '@daoyou/combat-core/types';
import { effectiveAttrs, isStanding } from '@daoyou/combat-core/units';
import { TIANYAN_REACTIONS_V1 } from '@daoyou/game-content/authoring/sects';
import { TIANYAN_V6_DEFINITION as definition } from '@daoyou/game-content/sects/tianyan';
import { COMBAT_V6_CHARACTER_BUILD_VERSIONS as versions } from '@daoyou/game-domain/combat';
import { describe, expect, it } from 'vitest';
import { observeAutoBattle } from '../combat/auto-observation.js';
import { rankAutoActions } from '../combat/auto-utility.js';
import { daoyouRulesetV6 } from '../combat/daoyou/index.js';
import { withCombatV6SkillPreviews } from '../combat/skill-previews.js';
import { createEmptySectCombatProgressV6 } from './build-state.js';
import { compileSectDefinitionV6 } from './compiler.js';
const S = (id: string) => 'tianyan.skill.' + id;
const T = (id: string) => 'tianyan.status.' + id;
const deterministicRuleset = {
  ...daoyouRulesetV6,
  formulas: {
    ...daoyouRulesetV6.formulas,
    spellHitChance: () => 1,
    physicalHitChance: () => 1,
    sealHitChance: () => 1,
    fluctuationMin: 1,
    fluctuationMax: 1,
    physicalFluctuationMin: 1,
    physicalFluctuationMax: 1,
  },
};
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
    ruleset: deterministicRuleset,
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
    if (isStanding(u)) b.submit(u.id, commands[u.id] ?? { type: 'defend' });
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
  it.each([
    ['wood', 1598],
    ['fire', 1677],
    ['earth', 1696],
    ['metal', 1899],
    ['water', 1327],
  ] as const)(
    '%s 使用正式 V6 人物法攻放大和技能系数，伤害为 %s',
    (element, expected) => {
      const { b } = setup();
      round(b, { s: cmd(element) });
      expect(damage(b)).toBe(expected);
    },
  );
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
    expect(b.unit('a').attrs.hp).toBe(1624);
    seal(b, 'water');
    round(b, { s: cmd('wood') });
    expect(b.unit('a').attrs.hp).toBe(1984);
    round(b);
    expect(b.unit('a').attrs.hp).toBe(2344);
    round(b);
    expect(b.unit('a').attrs.hp).toBe(2344);
  });
  it('烬垒一次护盾、淬锋忽视法防、蒸腾法术增伤', () => {
    const { b } = setup();
    seal(b, 'fire');
    round(b, { s: cmd('earth') });
    expect(b.unit('s').barriers[0].current).toBe(638);
    function cast(e: string, previous?: string) {
      const { b } = setup();
      if (previous) seal(b, previous);
      round(b, { s: cmd(e) });
      return damage(b);
    }
    expect(cast('metal', 'earth')).toBeGreaterThan(cast('metal'));
    expect(cast('water', 'fire')).toBe(1884);
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
    input.ruleset = {
      ...deterministicRuleset,
      formulas: { ...deterministicRuleset.formulas, sealHitChance: () => 0 },
    };
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
  it('余火保留燎原加人，润物分摊两人恢复，分锋增添金法目标', () => {
    const { b } = setup('hetu', ['2.1']);
    seal(b, 'wood');
    round(b, { s: cmd('fire') });
    expect(st(b, 't', 'ember')).toBeUndefined();
    expect(st(b, 't1', 'ember')).toBeDefined();
    expect(damage(b, 't3')).toBeGreaterThan(0);
    expect(st(b, 't3', 'ember')).toBeUndefined();
    const { b: rain } = setup('hetu', ['2.3']);
    seal(rain, 'metal');
    rain.unit('s').attrs.hp = rain.unit('a').attrs.hp = 1000;
    round(rain, { s: cmd('water') });
    expect(rain.log().filter((e) => e.type === 'heal')).toHaveLength(2);
    expect(rain.unit('a').attrs.hp).toBe(1436);
    const { b: split } = setup('hetu', ['2.2']);
    seal(split, 'earth');
    round(split, { s: cmd('metal') });
    expect(damage(split, 't1')).toBe(damage(split));
  });
  it('借势需要法印且只推进一次；止戈不改印；二者有真实冷却', () => {
    const { b } = setup('hetu', ['3.1']);
    // V6 允许先收令，法印条件仍在行动结算时校验。
    expect(
      b.queryCommands('s').skills.find((s) => s.skillId === S('borrow'))
        ?.reasons,
    ).toContain('skill-condition');
    round(b, { s: cmd('borrow') });
    expect(b.unit('s').attrs.mp).toBe(10000);
    expect(b.unit('s').barriers).toEqual([]);
    seal(b, 'wood');
    round(b, { s: cmd('borrow') });
    expect(st(b, 's', 'mark.fire')).toBeDefined();
    expect(b.unit('s').barriers).toHaveLength(1);
    expect(b.unit('s').barriers[0].current).toBe(760);
    expect(b.unit('s').attrs.mp).toBe(9960);
    expect(damage(b)).toBe(1580);
    expect(b.log().filter((e) => e.type === 'mechanicTriggered')).toEqual([]);
    expect(
      b.queryCommands('s').skills.find((s) => s.skillId === S('borrow'))?.ready,
    ).toBe(false);
    expect(
      b.queryCommands('s').skills.find((s) => s.skillId === S('borrow'))
        ?.cooldownRemaining,
    ).toBe(2);
    round(b);
    expect(
      b.queryCommands('s').skills.find((s) => s.skillId === S('borrow'))?.ready,
    ).toBe(false);
    round(b);
    expect(
      b.queryCommands('s').skills.find((s) => s.skillId === S('borrow'))?.ready,
    ).toBe(true);
    const { b: truce } = setup('luoshu', ['3.1']);
    seal(truce, 'wood');
    round(truce, { s: cmd('truce') });
    expect(st(truce, 's', 'mark.wood')).toBeDefined();
    expect(st(truce, 't', 'truce')).toBeDefined();
    expect(truce.unit('s').attrs.mp).toBe(9960);
    expect(damage(truce)).toBe(1544);
    expect(
      truce.queryCommands('s').skills.find((s) => s.skillId === S('truce'))
        ?.cooldownRemaining,
    ).toBe(2);
    round(truce);
    expect(
      truce.queryCommands('s').skills.find((s) => s.skillId === S('truce'))
        ?.ready,
    ).toBe(false);
    round(truce);
    expect(
      truce.queryCommands('s').skills.find((s) => s.skillId === S('truce'))
        ?.ready,
    ).toBe(true);
  });
  it('斩蔓驱散两项，蚀基减防两回合，钝兵强化减攻且保留三目标', () => {
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
    expect(st(crack, 't', 'foundation_break')?.remainingRounds).toBe(2);
    round(crack);
    expect(effectiveAttrs(crack.unit('t')).magicDef).toBe(225);
    round(crack);
    expect(effectiveAttrs(crack.unit('t')).magicDef).toBe(300);
    const { b: blunt } = setup('luoshu', ['2.3']);
    seal(blunt, 'metal');
    round(blunt, { s: cmd('fire') });
    expect(effectiveAttrs(blunt.unit('t')).magicAtk).toBe(800);
    expect(damage(blunt, 't2')).toBeGreaterThan(0);
    expect(effectiveAttrs(blunt.unit('t2')).magicAtk).toBe(800);
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
  it.each([
    { path: 'hetu', node: '1.2', spell: 'water', mark: undefined },
    { path: 'hetu', node: '2.2', spell: 'metal', mark: 'earth' },
    { path: 'hetu', node: '4.1', spell: 'fire', mark: 'wood' },
    { path: 'hetu', node: '4.2', spell: 'water', mark: 'metal' },
    { path: 'hetu', node: '4.3', spell: 'wood', mark: 'water' },
    { path: 'hetu', node: '5.2', spell: 'water', mark: undefined },
    { path: 'hetu', node: '6.1', spell: 'water', mark: 'fire' },
    { path: 'hetu', node: '6.3', spell: 'water', mark: 'fire' },
    { path: 'luoshu', node: '1.1', spell: 'metal', mark: undefined },
    { path: 'luoshu', node: '1.2', spell: 'wood', mark: undefined },
    { path: 'luoshu', node: '2.1', spell: 'metal', mark: 'wood' },
    { path: 'luoshu', node: '2.2', spell: 'wood', mark: 'earth' },
    { path: 'luoshu', node: '4.1', spell: 'metal', mark: 'wood' },
    { path: 'luoshu', node: '4.2', spell: 'water', mark: 'fire' },
    { path: 'luoshu', node: '6.2', spell: 'water', mark: 'fire' },
  ])(
    '$path $node 在单目标、无盾无增益局面不降低直接伤害',
    ({ path, node, spell, mark }) => {
      const [depth, column] = node.split('.').map(Number);
      const line = Array.from(
        { length: depth },
        (_, i) => `${i + 1}.${column}`,
      );
      const { b: before } = setup(path, line.slice(0, -1), 1);
      const { b: after } = setup(path, line, 1);
      for (const b of [before, after]) {
        b.unit('a').attrs.hp = 1000;
        if (mark) seal(b, mark);
        round(b, { s: cmd(spell) });
      }
      const directDamage = (b: B) =>
        b
          .log()
          .filter(
            (e) =>
              e.type === 'damage' &&
              e.sourceId === 's' &&
              e.targetId === 't' &&
              e.kind === 'spell',
          )
          .reduce((sum, e) => sum + (e.type === 'damage' ? e.amount : 0), 0);
      expect(directDamage(after)).toBeGreaterThanOrEqual(directDamage(before));
    },
  );
  it.each(['hetu', 'luoshu'])(
    '%s 的双净化保留两回合冷却并实际清除两项减益',
    (path) => {
      const { b } = setup(path, ['1.3', '2.3', '3.3']);
      b.applyStatus('a', T('bind'), 5);
      b.applyStatus('a', T('melt'), 5);
      round(b, { s: cmd('clarity', ['a']) });
      expect(st(b, 'a', 'bind')).toBeUndefined();
      expect(st(b, 'a', 'melt')).toBeUndefined();
      expect(b.unit('s').attrs.mp).toBe(9955);
      expect(
        b.queryCommands('s').skills.find((s) => s.skillId === S('clarity'))
          ?.cooldownRemaining,
      ).toBe(1);
      round(b);
      expect(
        b.queryCommands('s').skills.find((s) => s.skillId === S('clarity'))
          ?.ready,
      ).toBe(true);
    },
  );
  it.each([
    ['hetu', 1486],
    ['luoshu', 1406],
  ] as const)('%s 根基只强化成功生克的直接伤害', (path, expected) => {
    const { b: plain } = setup(path);
    const { b: same } = setup(path);
    const { b: react } = setup(path);
    seal(same, 'water');
    seal(react, 'metal');
    for (const b of [plain, same, react]) {
      b.unit('a').attrs.hp = 1000;
      round(b, { s: cmd('water') });
    }
    expect(damage(plain)).toBe(1327);
    expect(damage(same)).toBe(1327);
    expect(damage(react)).toBe(expected);
    expect(react.unit('a').attrs.hp).toBe(1624);
  });
  it('止戈削弱35%且行动后消耗，镇岳仍为25%', () => {
    const losses: number[] = [];
    for (const spell of ['truce', 'earth']) {
      const { input } = setup('luoshu', ['1.3', '2.2', '3.1']);
      input.skills!.push({
        id: 'enemy.spell',
        name: '法术',
        tags: ['spell'],
        targeting: { side: 'enemy' },
        effects: [{ type: 'spellHit', coeff: 1, power: 0 }],
      });
      input.units[2].skills = ['enemy.spell'];
      const b = createBattle(input);
      round(b, {
        s: cmd(spell),
        t: { type: 'skill', skillId: 'enemy.spell', targets: ['s'] },
      });
      losses.push(10000 - b.unit('s').attrs.hp);
      expect(
        st(b, 't', spell === 'truce' ? 'truce' : 'weaken_deep'),
      ).toBeUndefined();
      const hpBefore = b.unit('s').attrs.hp;
      round(b, {
        t: { type: 'skill', skillId: 'enemy.spell', targets: ['s'] },
      });
      expect(hpBefore - b.unit('s').attrs.hp).toBe(1400);
    }
    expect(losses).toEqual([910, 1050]);
  });
  it('借势与烬垒刷新同一护盾，不能交替叠加', () => {
    const { b } = setup('hetu', ['3.1']);
    seal(b, 'wood');
    round(b, { s: cmd('borrow') });
    expect(b.unit('s').barriers[0].current).toBe(760);
    round(b, { s: cmd('earth') });
    expect(b.unit('s').barriers).toHaveLength(1);
    expect(b.unit('s').barriers[0].current).toBe(760);
  });
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
      input.skills!.push({
        id: 'enemy.spell',
        name: '法术',
        tags: ['spell'],
        targeting: { side: 'enemy' },
        effects: [{ type: 'spellHit', coeff: 1, power: 0 }],
      });
      input.units[2].skills = ['enemy.spell'];
      const b = createBattle(input);
      seal(b, 'water');
      round(b, {
        s: cmd('earth'),
        t: { type: 'skill', skillId: 'enemy.spell', targets: ['s'] },
      });
      return { b, lost: 10000 - b.unit('s').attrs.hp };
    }
    const normal = incoming(['3.2']);
    const enhanced = incoming(['3.2', '4.3']);
    expect(st(normal.b, 't', 'spell_dull')).toBeDefined();
    expect(st(enhanced.b, 't', 'spell_dull_deep')).toBeDefined();
    expect(st(enhanced.b, 't', 'spell_dull')).toBeUndefined();
    expect(enhanced.lost / normal.lost).toBeCloseTo(0.65 / 0.75, 2);
    for (const b of [normal.b, enhanced.b])
      expect(st(b, 't', 'seal')).toBeUndefined();
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
    for (const [old, next] of [
      ['wood', 'fire'],
      ['earth', 'metal'],
    ]) {
      const { b: base } = setup('hetu', prefix);
      const { b: end } = setup('hetu', [...prefix, '7.2']);
      for (const b of [base, end]) {
        seal(b, old);
        round(b, { s: cmd(next) });
      }
      // 同类增伤相加：衍法+12%，映霞与分锋不再扣伤。
      const beforeFactor = 1.12;
      expect(
        Math.abs(
          damage(end) - (damage(base) * (beforeFactor + 0.05)) / beforeFactor,
        ),
      ).toBeLessThan(2);
    }
  });
  it('天人仍将凝露、滋荣和火生土护盾提高25%', () => {
    const prefix = ['1.2', '2.2', '3.2', '4.2', '5.2', '6.2'];
    for (const [old, next] of [
      ['metal', 'water'],
      ['water', 'wood'],
      ['fire', 'earth'],
    ]) {
      const values: number[] = [];
      for (const nodes of [prefix, [...prefix, '7.2']]) {
        const { b } = setup('hetu', nodes);
        b.unit('a').attrs.hp = 1000;
        seal(b, old);
        round(b, { s: cmd(next) });
        values.push(
          next === 'earth'
            ? b.unit('s').barriers[0].current
            : b.unit('a').attrs.hp - 1000,
        );
      }
      expect(Math.abs(values[1] - values[0] * 1.25)).toBeLessThan(2);
    }
  });
  it('余火保留额外目标并追加原强度的两次跳伤', () => {
    const totals: number[] = [];
    for (const nodes of [['1.1'], ['1.1', '2.1']]) {
      const { b } = setup('hetu', nodes);
      for (const u of b.state.units.filter((u) => u.side === 1))
        u.attrs.hp = u.attrs.maxHp = 20000;
      seal(b, 'wood');
      round(b, { s: cmd('fire') });
      round(b);
      totals.push(
        b
          .log()
          .filter((e) => e.type === 'damage' && e.sourceId === 's')
          .reduce((n, e) => n + (e.type === 'damage' ? e.amount : 0), 0),
      );
    }
    expect(totals).toEqual([8048, 9424]);
    const { b } = setup('hetu', ['2.1']);
    seal(b, 'wood');
    round(b, { s: cmd('fire') });
    const tick = b
      .log()
      .filter(
        (e) => e.type === 'damage' && e.sourceId === 's' && e.kind === 'fixed',
      );
    expect(tick.map((e) => (e.type === 'damage' ? e.amount : 0))).toEqual([
      200, 200,
    ]);
  });
});

describe('天衍同类减益保留较强档位', () => {
  it.each([
    ['truce_deep', 'truce'],
    ['truce', 'weaken_deep'],
    ['weaken_deep', 'weaken'],
    ['spell_dull_deep', 'spell_dull'],
  ] as const)('%s 优先于 %s，即使弱档持续时间更长', (strong, weak) => {
    const { b } = setup('luoshu');
    b.applyStatus('t', T(strong), 2, 's');
    b.applyStatus('t', T(weak), 4, 'a');
    expect(st(b, 't', strong)).toMatchObject({
      sourceId: 's',
      remainingRounds: 2,
    });
    expect(st(b, 't', weak)).toBeUndefined();

    b.applyStatus('t1', T(weak), 4, 'a');
    b.applyStatus('t1', T(strong), 2, 's');
    expect(st(b, 't1', strong)).toMatchObject({
      sourceId: 's',
      remainingRounds: 2,
    });
    expect(st(b, 't1', weak)).toBeUndefined();
  });

  it.each([
    {
      status: 'bind',
      skill: 'wood',
      mark: null,
      node: '1.2',
      attr: 'speed',
      expected: 75,
    },
    {
      status: 'foundation_break',
      skill: 'wood',
      mark: 'earth',
      node: '2.2',
      attr: 'magicDef',
      expected: 225,
    },
    {
      status: 'melt',
      skill: 'fire',
      mark: 'metal',
      node: '2.3',
      attr: 'magicAtk',
      expected: 800,
    },
  ] as const)(
    '$status 按施法者经脉区分强弱，与施放先后无关',
    ({ status, skill, mark, node, attr, expected }) => {
      for (const weakFirst of [false, true]) {
        const { input } = setup('luoshu', [node], 1);
        const weak = setup('luoshu', [], 1).input.units[0];
        input.units[1] = {
          ...weak,
          id: 'a',
          attrs: { ...weak.attrs, speed: weakFirst ? 1200 : 300 },
        };
        const b = createBattle(input);
        if (mark) {
          seal(b, mark);
          b.applyStatus('a', T('mark.' + mark), 1);
        }
        round(b, { s: cmd(skill), a: cmd(skill) });
        expect(st(b, 't', status)?.sourceId).toBe('s');
        expect(effectiveAttrs(b.unit('t'))[attr]).toBe(expected);
      }
    },
  );
});

describe('天衍第二轮条件收益', () => {
  it.each(
    [false, true].flatMap((wild) =>
      [1, 2, 3, 4, 5].map((enemies) => ({ wild, enemies })),
    ),
  )(
    '燎野=$wild、敌人$enemies人时，只补偿反应新增席并限制余火人数',
    ({ wild, enemies }) => {
      const nodes = wild ? ['4.1'] : [];
      const { b } = setup('hetu', nodes, enemies);
      seal(b, 'wood');
      round(b, { s: cmd('fire') });
      const bonus = wild
        ? [0.3, 0.3, 0.3, 0.15, 0][enemies - 1]
        : [0.15, 0.15, 0.15, 0, 0][enemies - 1];
      expect(damage(b)).toBe(Math.floor(1677 * (1.12 + bonus)));
      const plain = setup('hetu', nodes, enemies).b;
      round(plain, { s: cmd('fire') });
      expect(damage(plain)).toBe(1677);

      const { b: ember } = setup('hetu', ['2.1', ...nodes], enemies);
      seal(ember, 'wood');
      round(ember, { s: cmd('fire') });
      const dotCount = wild ? [0, 1, 2, 3, 3] : [0, 1, 2, 2, 2];
      expect(
        ember.state.units.filter((u) => st(ember, u.id, 'ember')),
      ).toHaveLength(dotCount[enemies - 1]);
      expect(st(ember, 't', 'ember')).toBeUndefined();
      expect(
        ember
          .log()
          .filter(
            (e) =>
              e.type === 'damage' && e.sourceId === 's' && e.kind === 'spell',
          ),
      ).toHaveLength(Math.min(enemies, wild ? 5 : 4));
    },
  );
  it('击杀前序目标不会让后续目标额外获得缺位增伤', () => {
    const { b } = setup('hetu', ['4.1'], 5);
    b.unit('t').attrs.hp = 1;
    seal(b, 'wood');
    round(b, { s: cmd('fire') });
    expect(b.unit('t').flags.downed).toBe(true);
    for (const id of ['t1', 't2', 't3', 't4']) expect(damage(b, id)).toBe(1878);
  });
  it('非首站位主目标仍按本次目标顺序限制余火，死亡副目标不补位', () => {
    const { b } = setup('hetu', ['2.1'], 5);
    b.unit('t').attrs.hp = 1;
    seal(b, 'wood');
    round(b, { s: cmd('fire', ['t3']) });
    expect(b.unit('t').flags.downed).toBe(true);
    expect(st(b, 't3', 'ember')).toBeUndefined();
    expect(st(b, 't1', 'ember')).toBeDefined();
    expect(st(b, 't2', 'ember')).toBeUndefined();
    expect(st(b, 't4', 'ember')).toBeUndefined();
  });
  it('缺位按实际可选名单计算，排除隐身与下场单位并包含敌方灵兽', () => {
    const { input } = setup('hetu', ['4.1'], 6);
    input.statusDefs!.push({
      id: 'fixture.hidden',
      name: '隐身',
      kind: 'fixture.hidden',
      untargetable: true,
    });
    const b = createBattle(input);
    b.applyStatus('t2', 'fixture.hidden', 3);
    b.unit('t3').flags.downed = true;
    b.unit('t4').flags.escaped = true;
    b.unit('t5').flags.benched = true;
    seal(b, 'wood');
    round(b, { s: cmd('fire', ['t1']) });
    expect(damage(b, 't')).toBe(2381);
    expect(damage(b, 't1')).toBe(2381);
    for (const id of ['t2', 't3', 't4', 't5']) expect(damage(b, id)).toBe(0);

    const pets = setup('hetu', [], 4).b;
    pets.unit('t3').kind = 'pet';
    pets.unit('t3').ownerId = 't';
    seal(pets, 'wood');
    round(pets, { s: cmd('fire') });
    expect(damage(pets)).toBe(1878);
    expect(damage(pets, 't3')).toBe(1878);
  });
  it.each([
    { wild: false, enemies: 3, previousTotal: 2876, expectedTotal: 3062 },
    { wild: true, enemies: 4, previousTotal: 4064, expectedTotal: 4312 },
  ])(
    '高法防$enemies人、燎野=$wild时保住原余火跳伤收益',
    ({ wild, enemies, previousTotal, expectedTotal }) => {
      const { b } = setup(
        'hetu',
        ['1.1', '2.1', ...(wild ? ['4.1'] : [])],
        enemies,
      );
      for (const u of b.state.units.filter((u) => u.side === 1))
        Object.assign(u.attrs, { hp: 20000, maxHp: 20000, magicDef: 1500 });
      seal(b, 'wood');
      round(b, { s: cmd('fire') });
      round(b);
      const total = b
        .log()
        .filter((e) => e.type === 'damage' && e.sourceId === 's')
        .reduce((sum, e) => sum + (e.type === 'damage' ? e.amount : 0), 0);
      expect(total).toBe(expectedTotal);
      expect(total).toBeGreaterThanOrEqual(previousTotal);
    },
  );
  it.each(['player', 'pet'] as const)(
    '润物只有一名%s伤员时恢复全额，不把满血者算第二名',
    (kind) => {
      const { b } = setup('hetu', ['2.3']);
      b.unit('a').kind = kind;
      if (kind === 'pet') b.unit('a').ownerId = 's';
      b.unit('a').attrs.hp = 1000;
      seal(b, 'metal');
      round(b, { s: cmd('water') });
      expect(b.unit('a').attrs.hp).toBe(1624);
      expect(b.log().filter((e) => e.type === 'heal')).toHaveLength(1);
      expect(b.unit('s').attrs.hp).toBe(10000);
    },
  );
  it.each([false, true])(
    '最后一击结束战斗后，润物=%s的凝露仍结清恢复',
    (rain) => {
      const { b } = setup('hetu', rain ? ['2.3'] : [], 1);
      b.unit('a').attrs.hp = 1000;
      b.unit('t').attrs.hp = 1;
      seal(b, 'metal');
      round(b, { s: cmd('water') });
      expect(b.finished).toBe(true);
      expect(b.unit('a').attrs.hp).toBe(1624);
      expect(b.log().filter((e) => e.type === 'heal')).toHaveLength(1);
    },
  );
  it('润物多人档在治疗前确定，先治满小灵兽不会让另一伤员拿到单人档', () => {
    const { input } = setup('hetu', ['2.3']);
    input.units.push({
      ...structuredClone(input.units[1]),
      id: 'pet',
      kind: 'pet',
      ownerId: 's',
      attrs: { ...input.units[1].attrs, hp: 1, maxHp: 100 },
    });
    const b = createBattle(input);
    b.unit('a').attrs.hp = 1000;
    seal(b, 'metal');
    round(b, { s: cmd('water') });
    expect(b.unit('pet').attrs.hp).toBe(100);
    expect(b.unit('a').attrs.hp).toBe(1436);
  });
  it.each(['wound', 'reject'] as const)(
    '润物排除%s造成的不可恢复气血，不抢占伤员档和选人',
    (reason) => {
      const { input } = setup('hetu', ['2.3']);
      if (reason === 'reject') {
        input.skills!.push({
          id: 'fixture.reject',
          name: '拒疗',
          tags: ['passive'],
          targeting: { side: 'self' },
          effects: [],
          innate: { rejectHpRecovery: true },
        });
        input.units[0].passives!.push('fixture.reject');
      }
      const b = createBattle(input);
      b.unit('a').attrs.hp = 5000;
      b.unit('s').attrs.hp = reason === 'wound' ? 1000 : 1;
      if (reason === 'wound') b.unit('s').wound = 9000;
      seal(b, 'metal');
      round(b, { s: cmd('water') });
      expect(b.unit('a').attrs.hp).toBe(5624);
      expect(b.unit('s').attrs.hp).toBe(reason === 'wound' ? 1000 : 1);
    },
  );
  it.each([
    { single: true, first: 1360, second: 1720 },
    { single: false, first: 1251, second: 1502 },
  ])(
    '润物滋荣单人档=$single在施加时固定，不随下一跳伤员变化',
    ({ single, first, second }) => {
      const { b } = setup('hetu', ['2.3']);
      b.unit('a').attrs.hp = 1000;
      if (!single) b.unit('s').attrs.hp = 9900;
      seal(b, 'water');
      round(b, { s: cmd('wood') });
      expect(b.unit('a').attrs.hp).toBe(first);
      expect(st(b, 'a', single ? 'regrowth_single' : 'regrowth')).toBeDefined();
      if (single) b.unit('s').attrs.hp = 1000;
      else expect(b.unit('s').attrs.hp).toBe(10000);
      round(b);
      expect(b.unit('a').attrs.hp).toBe(second);
      if (single) expect(b.unit('s').attrs.hp).toBe(1000);
    },
  );
  it('零伤员保留原来的滋荣预挂，后续受伤仍按多人档恢复', () => {
    const { b } = setup('hetu', ['2.3']);
    seal(b, 'water');
    round(b, { s: cmd('wood') });
    expect(b.log().filter((e) => e.type === 'heal')).toEqual([]);
    expect(st(b, 's', 'regrowth')).toBeDefined();
    expect(st(b, 'a', 'regrowth')).toBeDefined();
    b.unit('a').attrs.hp = 1000;
    round(b);
    expect(b.unit('a').attrs.hp).toBe(1251);
  });
  it('单人与多人滋荣变体同kind刷新，不能叠加恢复', () => {
    const { b } = setup('hetu', ['2.3']);
    b.unit('a').attrs.hp = 1000;
    seal(b, 'water');
    round(b, { s: cmd('wood') });
    expect(st(b, 'a', 'regrowth_single')).toBeDefined();
    b.unit('s').attrs.hp = 1000;
    seal(b, 'water');
    round(b, { s: cmd('wood') });
    expect(
      b.unit('a').statuses.filter((s) => s.kind === T('regrowth')),
    ).toHaveLength(1);
    expect(st(b, 'a', 'regrowth_single')).toBeUndefined();
    expect(st(b, 'a', 'regrowth')).toBeDefined();
    expect(b.unit('a').attrs.hp).toBe(1611);
    round(b);
    expect(b.unit('a').attrs.hp).toBe(1862);
  });
});

describe('天衍当前法印的指令预览', () => {
  function preview(b: B, input: CreateBattleInput, id: string) {
    return withCombatV6SkillPreviews(
      b.state,
      input.skills!,
      input.statusDefs!,
      b.queryCommands('s'),
    ).skillPreviews![S(id)];
  }

  it('按当前法印选择蒸腾，并随实际出手更新为水印', () => {
    const { b, input } = setup();
    expect(preview(b, input, 'water')).toMatchObject({
      currentMark: undefined,
      nextMark: '水行法印',
    });
    seal(b, 'fire');
    const steam = preview(b, input, 'water');
    expect(steam).toMatchObject({
      currentMark: '火行法印',
      reactionName: '蒸腾',
      nextMark: '水行法印',
    });
    expect(steam.effects.join(' ')).toContain('+42%');
    round(b, { s: cmd('water') });
    const next = preview(b, input, 'water');
    expect(next.currentMark).toBe('水行法印');
    expect(next.reactionName).toBeUndefined();
    expect(next.nextMark).toBeUndefined();
    expect(next.effects.join(' ')).not.toContain('+42%');
  });

  it('燎原缺位与余火覆盖使用当前合法目标数，不读敌方精确面板', () => {
    const { b, input } = setup('hetu', ['2.1', '4.1'], 3);
    seal(b, 'wood');
    const before = b.snapshot();
    const wildfire = preview(b, input, 'fire');
    expect(wildfire.reactionName).toBe('燎原');
    expect(wildfire.effects.join(' ')).toContain('至多 3 名');
    expect(wildfire.effects.join(' ')).toContain('至多 2 名副目标附加余火');
    expect(wildfire.effects.join(' ')).toContain('+42%');
    expect(b.snapshot()).toEqual(before);
    Object.assign(b.unit('t').attrs, { hp: 7291, maxHp: 7522, magicDef: 2300 });
    expect(preview(b, input, 'fire')).toEqual(wildfire);
    b.unit('t2').flags.downed = true;
    expect(preview(b, input, 'fire').effects.join(' ')).toContain(
      '至多 1 名副目标附加余火',
    );
  });

  it('润物以当前合法伤员确定凝露和滋荣份额，不写入真实战局', () => {
    const { b, input } = setup('hetu', ['2.3']);
    b.unit('a').attrs.hp = 1000;
    seal(b, 'metal');
    expect(preview(b, input, 'water').effects.join(' ')).toContain(
      '基础 624 点气血',
    );
    b.unit('s').attrs.hp = 1000;
    const before = b.snapshot();
    expect(preview(b, input, 'water').effects.join(' ')).toContain(
      '基础 436 点气血',
    );
    expect(b.snapshot()).toEqual(before);
    seal(b, 'water');
    expect(preview(b, input, 'wood').effects.join(' ')).toContain(
      '基础恢复 251 点气血',
    );
  });

  it('展示已点经脉的减防、封法替代和借势换印', () => {
    const { b: controlled, input: controlInput } = setup('luoshu', [
      '2.2',
      '3.2',
      '4.3',
    ]);
    seal(controlled, 'earth');
    expect(
      preview(controlled, controlInput, 'wood').effects.join(' '),
    ).toContain('法术防御降低 25%');
    seal(controlled, 'water');
    const stop = preview(controlled, controlInput, 'earth');
    expect(stop.reactionName).toBe('截流');
    expect(stop.effects.join(' ')).toContain('法术伤害降低 35%');
    expect(stop.effects.join(' ')).not.toContain('无法使用法术');

    const { b, input } = setup('hetu', ['3.1']);
    expect(preview(b, input, 'borrow').effects).toEqual([]);
    seal(b, 'fire');
    expect(preview(b, input, 'borrow')).toMatchObject({
      currentMark: '火行法印',
      nextMark: '土行法印',
    });
    expect(preview(b, input, 'borrow').effects.join(' ')).toContain('760 点');
    expect(preview(b, input, 'borrow').reactionName).toBeUndefined();
    expect(preview(b, input, 'ward').nextMark).toBeUndefined();
  });
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
    expect(score(rank(), 'metal')).toBe(score(initial, 'metal'));
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
