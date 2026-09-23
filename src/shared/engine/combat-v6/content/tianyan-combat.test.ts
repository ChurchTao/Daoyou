import { describe, expect, it } from 'vitest';
import { createBattle, effectiveAttrs, type Command, type CreateBattleInput } from '../core';
import { createEmptySectCombatProgressV6 } from '../build-state';
import { createDaoyouRuleset } from '../rules-daoyou';
import { COMBAT_V6_PHASE_6D_VERSIONS as versions } from '../version';
import { TIANYAN_V6_DEFINITION as definition } from './tianyan';
import { TIANYAN_REACTIONS_V1 } from './tianyan-foundation';
import { compileSectDefinitionV6 } from './compiler';
const S = (id: string) => 'tianyan.skill.' + id;
const T = (id: string) => 'tianyan.status.' + id;
const cmd = (id: string, targets = ['t']): Command => ({ type: 'skill', skillId: S(id), targets });
function setup(pathName = 'hetu', wanted: string[] = [], enemies = 6) {
  const path = definition.paths.find(p => p.id.endsWith('.' + pathName))!;
  const picked = wanted.map(id => path.nodes.find(n => n.id.endsWith('.' + id))!);
  const depth = Math.max(0, ...picked.map(n => n.layer));
  const nodes = Array.from({ length: depth }, (_, i) => picked.find(n => n.layer === i + 1) ?? path.nodes.find(n => n.layer === i + 1 && n.slot === 2)!);
  const progress = createEmptySectCombatProgressV6('tianyan', path.id, Object.fromEntries(definition.methods.map(m => [m.id, 180])));
  progress.meridianDepth = 7;
  progress.meridianLoadouts.find(l => l.pathId === path.id)!.nodeIds = nodes.map(n => n.id);
  const result = compileSectDefinitionV6({ definition, progress, characterLevel: 180 });
  if (!result.ok) throw new Error(JSON.stringify(result));
  const p = result.projection;
  for (const n of picked) if (!p.passiveSkillIds.includes(n.passives![0].definition.id)) throw new Error('未连通: ' + n.id);
  const attrs = { hp: 10000, maxHp: 10000, mp: 10000, maxMp: 10000, magicAtk: 1000, magicDef: 300, physicalAtk: 1000, physicalDef: 300, speed: 1000, spellCritRate: 0, critRate: 0 };
  const input: CreateBattleInput = { seed: 12, versions, skills: p.skills, statusDefs: [...p.statusDefs,
    { id: 'buff.a', name: '增益甲', kind: 'buff.a', category: 'buff' }, { id: 'buff.b', name: '增益乙', kind: 'buff.b', category: 'buff' }],
    ruleset: createDaoyouRuleset({ formulas: { spellHitChance: () => 1, physicalHitChance: () => 1, sealHitChance: () => 1, fluctuationMin: 1, fluctuationMax: 1, physicalFluctuationMin: 1, physicalFluctuationMax: 1 } }),
    units: [{ id: 's', name: '天衍', side: 0, kind: 'player', level: 180, attrs, skills: p.activeSkillIds, passives: p.passiveSkillIds, skillLevels: p.skillLevels, skillOverrides: p.skillOverrides, resources: p.resources },
      { id: 'a', name: '队友', side: 0, kind: 'player', level: 180, attrs: { ...attrs, speed: 300 } },
      ...Array.from({ length: enemies }, (_, i) => ({ id: i ? 't' + i : 't', name: '敌人', side: 1 as const, kind: 'player' as const, level: 180, attrs: { ...attrs, speed: 100 - i } }))] };
  return { b: createBattle(input), input, p };
}
type B = ReturnType<typeof setup>['b'];
function round(b: B, commands: Record<string, Command> = {}) {
  for (const u of b.state.units) if (!u.flags.dead && !u.flags.downed) b.submit(u.id, commands[u.id] ?? { type: 'defend' });
  b.lockAndResolve();
}
const st = (b: B, target: string, name: string) => b.unit(target).statuses.find(s => s.id === T(name));
const seal = (b: B, e: string) => b.applyStatus('s', T('mark.' + e), 1);
const damage = (b: B, target = 't') => b.log().filter(e => e.type === 'damage' && e.sourceId === 's' && e.targetId === target).reduce((n, e) => n + (e.type === 'damage' ? e.amount : 0), 0);
const elements = ['wood', 'fire', 'earth', 'metal', 'water'];
describe('天衍自身法印与十种反应', () => {
  it.each(elements.flatMap(old => elements.map(next => [old, next])))('%s → %s 只触发对应生克，更新自身唯一法印', (old, next) => {
    const { b } = setup(); seal(b, old); round(b, { s: cmd(next) });
    expect(b.unit('s').statuses.filter(s => s.kind === T('mark')).map(s => s.id)).toEqual([T('mark.' + next)]);
    expect(b.unit('t').statuses.some(s => s.kind === T('mark'))).toBe(false);
    const expected = TIANYAN_REACTIONS_V1.filter(r => r.oldElement === old && r.newElement === next).map(r => r.id);
    expect(b.log().filter(e => e.type === 'mechanicTriggered').map(e => e.type === 'mechanicTriggered' ? e.mechanicId : '')).toEqual(expected);
  });
  it('首次施法不反应，换目标继续；辅助、防御、普攻与施法失败保留法印', () => {
    const { b } = setup(); round(b, { s: cmd('wood') });
    expect(b.log().some(e => e.type === 'mechanicTriggered')).toBe(false);
    round(b, { s: cmd('ward', ['s']) }); round(b); round(b, { s: cmd('clarity', ['a']) });
    expect(st(b, 's', 'mark.wood')).toBeDefined();
    b.unit('s').attrs.mp = 0; round(b, { s: cmd('water') });
    expect(st(b, 's', 'mark.wood')).toBeDefined();
    b.unit('s').attrs.mp = 10000; round(b, { s: cmd('fire', ['t3']) });
    const action = b.log().filter(e => e.type === 'actionStart' && e.unitId === 's').at(-1);
    expect(action?.type === 'actionStart' && action.command.type === 'skill' && action.command.targets).toHaveLength(4);
    expect(st(b, 's', 'mark.fire')).toBeDefined();
  });
  it('法印不计时、不被驱散，倒地复活保留', () => {
    const { input } = setup();
    input.skills!.push({ id: 'kill', name: '击倒', tags: ['spell'], targeting: { side: 'enemy' }, effects: [{ type: 'fixedHit', power: 50000 }] }, { id: 'revive', name: '复活', tags: ['spell'], targeting: { side: 'ally', includeDowned: true }, effects: [{ type: 'revive', hpRatio: .5 }] }, { id: 'purge', name: '驱散', tags: ['spell'], targeting: { side: 'enemy' }, effects: [{ type: 'dispel', categories: ['buff'] }] });
    input.units[2].skills = ['kill', 'purge']; input.units[1].skills = ['revive'];
    const b = createBattle(input); seal(b, 'water');
    for (let i = 0; i < 5; i++) round(b);
    round(b, { t: { type: 'skill', skillId: 'purge', targets: ['s'] } }); expect(st(b, 's', 'mark.water')).toBeDefined();
    round(b, { t: { type: 'skill', skillId: 'kill', targets: ['s'] } }); expect(b.unit('s').flags.downed).toBe(true); expect(st(b, 's', 'mark.water')).toBeDefined();
    round(b, { a: { type: 'skill', skillId: 'revive', targets: ['s'] } }); expect(st(b, 's', 'mark.water')).toBeDefined();
    round(b, { s: cmd('earth') }); expect(st(b, 't', 'seal')).toBeDefined();
    expect(createBattle(input).unit('s').statuses).toEqual([]);
  });
  it('凝露范围伤害后只治疗最低血线友方一次；滋荣共两次恢复', () => {
    const { b } = setup(); b.unit('a').attrs.hp = 1000; seal(b, 'metal'); round(b, { s: cmd('water') });
    expect(b.log().filter(e => e.type === 'heal')).toHaveLength(1);
    expect(b.unit('a').attrs.hp).toBe(1416);
    seal(b, 'water'); round(b, { s: cmd('wood') }); expect(b.unit('a').attrs.hp).toBe(1662);
    round(b); expect(b.unit('a').attrs.hp).toBe(1908); round(b); expect(b.unit('a').attrs.hp).toBe(1908);
  });
  it('烬垒一次护盾、淬锋忽视法防、蒸腾法术增伤', () => {
    const { b } = setup(); seal(b, 'fire'); round(b, { s: cmd('earth') }); expect(b.unit('s').barriers[0].current).toBe(466);
    function cast(e: string, previous?: string) { const { b } = setup(); if (previous) seal(b, previous); round(b, { s: cmd(e) }); return damage(b); }
    expect(cast('metal', 'earth')).toBeGreaterThan(cast('metal'));
    expect(cast('water', 'fire')).toBeGreaterThan(cast('water'));
  });
  it('裂土减法防、熔锋双攻削弱、断枝仅移除一个普通增益', () => {
    const { b } = setup(); seal(b, 'earth'); round(b, { s: cmd('wood') }); expect(effectiveAttrs(b.unit('t')).magicDef).toBe(255);
    seal(b, 'metal'); round(b, { s: cmd('fire') }); for (const id of ['t', 't1', 't2']) expect(effectiveAttrs(b.unit(id)).magicAtk).toBe(900);
    b.applyStatus('t', 'buff.a', 5); b.applyStatus('t', 'buff.b', 5); seal(b, 'wood'); round(b, { s: cmd('metal') });
    expect(b.unit('t').statuses.filter(s => s.id.startsWith('buff.'))).toHaveLength(1);
  });
  it('截流走封印概率，留隙改为稳定削弱；净化不能解硬控', () => {
    const { input } = setup(); input.ruleset = createDaoyouRuleset({ formulas: { spellHitChance: () => 1, sealHitChance: () => 0 } });
    const b = createBattle(input); seal(b, 'water'); round(b, { s: cmd('earth') }); expect(st(b, 't', 'seal')).toBeUndefined();
    const { b: gap } = setup('luoshu', ['3.2']); seal(gap, 'water'); round(gap, { s: cmd('earth') }); expect(st(gap, 't', 'spell_dull')).toBeDefined(); expect(st(gap, 't', 'seal')).toBeUndefined();
    b.applyStatus('a', T('seal'), 4); b.applyStatus('a', T('bind'), 4); round(b, { s: cmd('clarity', ['a']) }); expect(st(b, 'a', 'bind')).toBeUndefined(); expect(st(b, 'a', 'seal')).toBeDefined();
  });
});
describe('天衍经脉机制分化', () => {
  it('余火替换燎原加人，润物分摊两人恢复，分锋增添金法目标', () => {
    const { b } = setup('hetu', ['2.1']); seal(b, 'wood'); round(b, { s: cmd('fire') });
    expect(st(b, 't', 'ember')).toBeUndefined(); expect(st(b, 't1', 'ember')).toBeDefined(); expect(damage(b, 't3')).toBe(0);
    const { b: rain } = setup('hetu', ['2.3']); seal(rain, 'metal'); rain.unit('s').attrs.hp = rain.unit('a').attrs.hp = 1000; round(rain, { s: cmd('water') });
    expect(rain.log().filter(e => e.type === 'heal')).toHaveLength(2); expect(rain.unit('a').attrs.hp).toBe(1291);
    const { b: split } = setup('hetu', ['2.2']); seal(split, 'earth'); round(split, { s: cmd('metal') }); expect(damage(split, 't1')).toBeGreaterThan(damage(split));
  });
  it('借势需要法印且只推进一次；止戈不改印；二者有真实冷却', () => {
    const { b } = setup('hetu', ['3.1']); expect(b.queryCommands('s').skills.find(s => s.skillId === S('borrow'))?.ready).toBe(false);
    seal(b, 'wood'); round(b, { s: cmd('borrow') }); expect(st(b, 's', 'mark.fire')).toBeDefined(); expect(b.unit('s').barriers).toHaveLength(1); expect(b.queryCommands('s').skills.find(s => s.skillId === S('borrow'))?.ready).toBe(false);
    const { b: truce } = setup('luoshu', ['3.1']); seal(truce, 'wood'); round(truce, { s: cmd('truce') }); expect(st(truce, 's', 'mark.wood')).toBeDefined(); expect(st(truce, 't', 'truce')).toBeDefined();
  });
  it('斩蔓、蚀基、钝兵分别实际改变驱散数、减防和人数', () => {
    const { b } = setup('luoshu', ['2.1']); b.applyStatus('t', 'buff.a', 5); b.applyStatus('t', 'buff.b', 5); seal(b, 'wood'); round(b, { s: cmd('metal') }); expect(b.unit('t').statuses.filter(s => s.id.startsWith('buff.'))).toEqual([]);
    const { b: crack } = setup('luoshu', ['2.2']); seal(crack, 'earth'); round(crack, { s: cmd('wood') }); expect(effectiveAttrs(crack.unit('t')).magicDef).toBe(225); expect(st(crack, 't', 'foundation_break')?.remainingRounds).toBe(1);
    const { b: blunt } = setup('luoshu', ['2.3']); seal(blunt, 'metal'); round(blunt, { s: cmd('fire') }); expect(effectiveAttrs(blunt.unit('t')).magicAtk).toBe(800); expect(damage(blunt, 't2')).toBe(0);
  });
  it('独照只补人数不足，归流只在生克时折价', () => {
    const { b: one } = setup('hetu', ['5.1'], 1); const { b: many } = setup('hetu', ['5.1']); round(one, { s: cmd('water') }); round(many, { s: cmd('water') }); expect(damage(one)).toBeGreaterThan(damage(many));
    const { b: normal } = setup('hetu', ['6.1']); const { b: react } = setup('hetu', ['6.1']); seal(react, 'fire'); round(normal, { s: cmd('water') }); round(react, { s: cmd('water') }); expect(react.unit('s').attrs.mp).toBeGreaterThan(normal.unit('s').attrs.mp);
  });
});
