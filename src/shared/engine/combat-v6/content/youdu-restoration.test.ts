import { describe, expect, it } from 'vitest';
import { createBattle, effectiveAttrs, restoreBattle, type Command } from '../core';
import { createDaoyouRuleset } from '../rules-daoyou';
import { COMBAT_V6_PHASE_6D_VERSIONS as versions } from '../version';
import { createEmptySectCombatProgressV6 } from '../build-state';
import { compileSectDefinitionV6 } from './compiler';
import { YOUDU_V6_DEFINITION as definition } from './youdu';

const S = (id: string) => `youdu.skill.${id}`;
const T = (id: string) => `youdu.status.${id}`;
function project(path = 'soul_judge', level = 180, nodes: string[] = []) {
  const progress = createEmptySectCombatProgressV6('youdu', `youdu.path.${path}`, Object.fromEntries(definition.methods.map(m => [m.id, level])));
  progress.meridianDepth = 7;
  progress.meridianLoadouts.find(l => l.pathId === progress.activePathId)!.nodeIds = nodes;
  const result = compileSectDefinitionV6({ definition, progress, characterLevel: 180 });
  if (!result.ok) throw new Error(JSON.stringify(result.diagnostics));
  return result.projection;
}
function setup(path = 'soul_judge', nodes: string[] = []) {
  const p = project(path, 180, nodes);
  const input = { seed: 12, versions,
    ruleset: createDaoyouRuleset({ formulas: { sealHitChance: () => 1, fluctuationMin: 1, fluctuationMax: 1 } }),
    skills: p.skills, statusDefs: p.statusDefs,
    units: [
      { id: 's', name: '幽修', kind: 'player' as const, side: 0 as const, level: 180,
        attrs: { hp: 10000, mp: 10000, speed: 1000, physicalAtk: 1000, physicalDef: 1000 },
        skills: p.activeSkillIds, passives: p.passiveSkillIds, skillLevels: p.skillLevels, skillOverrides: p.skillOverrides },
      { id: 'a', name: '队友', kind: 'player' as const, side: 0 as const, attrs: { hp: 10000, mp: 1000, physicalAtk: 1000, physicalDef: 1000, speed: 2 } },
      { id: 'pet', name: '灵兽', kind: 'pet' as const, ownerId: 's', side: 0 as const, attrs: { hp: 10000, speed: 1 } },
      { id: 't', name: '对手', kind: 'player' as const, side: 1 as const, attrs: { hp: 100000, mp: 10000, speed: 3 } },
      { id: 'npc', name: '怪物', kind: 'npc' as const, side: 1 as const, attrs: { hp: 100000, mp: 10000, speed: 4 } },
    ] };
  return { b: createBattle(input), input };
}
type Battle = ReturnType<typeof setup>['b'];
function round(b: Battle, command: Command = { type: 'defend' }) {
  for (const u of b.state.units) if (!u.flags.dead && !u.flags.downed) b.submit(u.id, u.id === 's' ? command : { type: 'defend' });
  b.lockAndResolve();
}
const cast = (id: string, target = 't'): Command => ({ type: 'skill', skillId: S(id), targets: [target] });
const dealt = (b: Battle, id: string) => b.log().filter(e => e.type === 'damage' && e.targetId === id).map(e => e.type === 'damage' ? e.amount : 0);

describe('幽都基础模组还原', () => {
  it('两流派共享抗封根基，六道断狱只由物理流派授予，并按心法分阶段解锁', () => {
    for (const path of ['soul_judge', 'six_paths']) {
      const p = project(path);
      expect(p.passiveSkillIds).toContain('youdu.passive.soul_guard');
      for (const name of ['judge', 'revival', 'dispel', 'stealth']) expect(p.activeSkillIds).toContain(S(name));
      expect(p.activeSkillIds.includes(S('sever'))).toBe(path === 'six_paths');
    }
    expect(project('soul_judge', 74).activeSkillIds).not.toContain(S('soul_seal'));
    expect(project('soul_judge', 75).activeSkillIds).toContain(S('soul_seal'));
    expect(project('soul_judge', 119).activeSkillIds).not.toContain(S('revival'));
  });
  it('阎罗类群攻产生伤势，对怪物翻倍；减速技能不再制造伤势', () => {
    const { b } = setup(); round(b, cast('edict'));
    expect(b.unit('t').wound).toBe(180);
    expect(dealt(b, 'npc')[0]).toBeGreaterThanOrEqual(dealt(b, 't')[0] * 2 - 1);
    const c = setup().b; round(c, cast('pursuit'));
    expect(c.unit('t').wound).toBe(0);
    expect(c.unit('t').statuses).toContainEqual(expect.objectContaining({ id: T('slow') }));
    expect(c.unit('s').attrs.mp).toBe(9950);
  });
  it('判官类技能同时削血削蓝，锢魂及延长节点分别为5与6回合', () => {
    const { b } = setup(); round(b, cast('judge'));
    expect(b.unit('t').attrs.hp).toBeLessThan(100000);
    expect(b.unit('t').attrs.mp).toBe(9820);
    expect(b.unit('s').attrs.mp).toBe(9980);
    for (const [nodes, duration] of [[[], 5], [['youdu.node.soul.4.3'], 6]] as const) {
      const c = setup('soul_judge', [...nodes]).b; round(c, cast('soul_seal'));
      expect(c.unit('t').statuses).toContainEqual(expect.objectContaining({ id: T('soul_seal'), remainingRounds: duration }));
      expect(c.unit('s').attrs.mp).toBe(9950);
    }
  });
  it('隐身阻止单体选取和施法；鬼眼恢复可选目标，不增加普通命中', () => {
    const { b } = setup(); round(b, cast('stealth', 'a'));
    expect(b.queryCommands('t').attackTargetIds).not.toContain('a');
    b.unit('a').skills = [S('insight')];
    expect(b.queryCommands('a').skills[0].ready).toBe(false);
    b.unit('t').skills = [S('insight')]; b.unit('t').attrs.mp = 100;
    b.applyStatus('t', T('insight'), 5, 's');
    expect(b.queryCommands('t').attackTargetIds).toContain('a');
    expect(effectiveAttrs(b.unit('t')).hit).toBe(b.unit('t').attrs.hit);
  });
  it('复活只选倒地可复起目标，并附带增攻降防；禁复活目标不可选', () => {
    const { b } = setup(); b.unit('a').flags.downed = true; b.unit('a').attrs.hp = 0;
    const option = () => b.queryCommands('s').skills.find(s => s.skillId === S('revival'))!;
    expect(option().selectableTargetIds).toEqual(['a']);
    b.applyStatus('a', T('soul_seal'), 5, 't'); expect(option().selectableTargetIds).toEqual([]);
    b.unit('a').statuses = []; round(b, cast('revival', 'a'));
    expect(b.unit('a').flags.downed).toBe(false);
    expect(b.unit('a').attrs.hp).toBe(3000);
    expect(effectiveAttrs(b.unit('a')).physicalAtk).toBe(1200);
    expect(effectiveAttrs(b.unit('a')).physicalDef).toBe(800);
    expect(b.unit('s').attrs.mp).toBe(9850);
  });
  it('隐身分别按自身15、队友10支付后续法力，支付失败解除；多个状态分别计费', () => {
    for (const [id, cost] of [['s', 15], ['a', 10]] as const) {
      const { b } = setup(); round(b, cast('stealth', id));
      expect(b.unit('s').attrs.mp).toBe(9850);
      round(b); expect(b.unit('s').attrs.mp).toBe(9850 - cost);
      b.unit('s').attrs.mp = cost - 1; round(b);
      expect(b.unit(id).statuses.some(s => s.id === T('stealth'))).toBe(false);
      expect(b.unit('s').attrs.mp).toBe(cost - 1);
    }
    const { b } = setup(); round(b, cast('stealth', 'a')); round(b, cast('stealth', 'pet'));
    const mp = b.unit('s').attrs.mp; round(b); expect(b.unit('s').attrs.mp).toBe(mp - 20);
  });
  it('毒有等级上限并持续扣蓝，群疗按施术者成长而非队友血量成长；快照可恢复', () => {
    const { b, input } = setup(); b.unit('s').attrs.hp = 5000; b.unit('a').attrs.hp = 5000; b.unit('pet').attrs.hp = 5000;
    b.unit('a').attrs.maxHp = 20000;
    round(b, cast('wither'));
    expect(dealt(b, 't').every(value => value <= 180 * 8 * 1.05)).toBe(true);
    expect(b.unit('t').attrs.mp).toBeLessThan(10000);
    expect(b.unit('a').attrs.hp).toBeGreaterThan(5000);
    expect(b.unit('a').attrs.hp).toBe(b.unit('s').attrs.hp);
    expect(b.unit('pet').attrs.hp).toBe(5000);
    expect(b.unit('s').attrs.mp).toBe(9960);
    const restored = restoreBattle(input, JSON.parse(JSON.stringify(b.snapshot())), [...b.log()]);
    round(b); round(restored);
    expect(restored.snapshot()).toEqual(b.snapshot()); expect(restored.log()).toEqual(b.log());
  });
});
