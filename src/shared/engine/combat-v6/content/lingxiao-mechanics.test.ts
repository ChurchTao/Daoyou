import { describe, expect, it } from 'vitest';
import { CommandType, EventType, createBattle, restoreBattle, type SkillDef, type UnitKind } from '../core';
import { createDaoyouRuleset } from '../rules-daoyou';
import { LINGXIAO_COMBAT } from './lingxiao-pack';
import { LINGXIAO_V6_DEFINITION } from './lingxiao';
import { compileSectDefinitionV6 } from './compiler';
import { createEmptySectCombatProgressV6 } from '../build-state';
import { COMBAT_V6_PHASE_6D_VERSIONS } from '../version';

const skillId = (name: string) => `lingxiao.skill.${name}`;
const ruleset = createDaoyouRuleset({ formulas: {
  physicalHitChance: () => 1, sealHitChance: () => 1,
  fluctuationMin: 1, fluctuationMax: 1,
} });
function setup(hp = 1000, kind: UnitKind = 'npc', extraSkills: SkillDef[] = [], passives: string[] = []) {
  const skills = [...LINGXIAO_COMBAT.baseSkills.map(s => s.definition), ...extraSkills];
  return createBattle({ seed: 12, versions: COMBAT_V6_PHASE_6D_VERSIONS, ruleset: { ...ruleset, deferredPlayerCommands: true },
    skills, statusDefs: LINGXIAO_COMBAT.statuses,
    units: [{ id: 's', name: '剑修', side: 0, kind: 'player', level: 120,
      skills: skills.map(s => s.id), passives, attrs: { hp, maxHp: 1000, mp: 1000, speed: 500, physicalAtk: 200, critRate: 0 } },
    ...Array.from({ length: 4 }, (_, i) => ({ id: `t${i}`, name: '对手', side: 1, kind,
      attrs: { hp: 10000, physicalDef: 100, speed: 1, critRate: 0 }, slot: i }))],
  });
}
function round(b: ReturnType<typeof setup>, name?: string, targets = ['t0']) {
  b.submit('s', name ? { type: CommandType.Skill, skillId: skillId(name), targets } : { type: CommandType.Defend });
  for (let i = 0; i < 4; i++) if (!b.unit(`t${i}`).flags.dead) b.submit(`t${i}`, { type: CommandType.Defend });
  b.lockAndResolve();
}
const hits = (b: ReturnType<typeof setup>) => b.log().filter(e => e.type === EventType.Damage && e.sourceId === 's');

describe('红尘剑宗经典基础模组', () => {
  it.each([['triple', 500, 0], ['triple', 501, 3], ['formation', 500, 0], ['formation', 499, 3]] as const)(
    '%s 在气血 %i 时产生 %i 次伤害', (name, hp, count) => {
      const b = setup(hp);
      const option = b.queryCommands('s').skills.find(s => s.skillId === skillId(name))!;
      expect(option.reasons.includes('hp-requirement')).toBe(count === 0);
      round(b, name);
      expect(hits(b)).toHaveLength(count);
      expect(b.unit('s').attrs.hp).toBe(hp - (count ? 100 : 0));
    });
  it('断尘休息一次，第三回合恢复行动', () => {
    const b = setup(); round(b, 'triple'); round(b, 'triple');
    expect(hits(b)).toHaveLength(3);
    round(b, 'triple'); expect(hits(b)).toHaveLength(6);
  });
  it('断尘击杀不转移剩余剑数', () => {
    const b = setup(); b.unit('t0').attrs.hp = 1; round(b, 'triple');
    expect(hits(b)).toHaveLength(1); expect(b.unit('t1').attrs.hp).toBe(10000);
  });
  it('惊雷准备不攻击，次回合强制攻击一次，第三回合自由行动', () => {
    const b = setup(); round(b, 'waiting');
    expect(hits(b)).toHaveLength(0); expect(b.unit('s').attrs.hp).toBe(950);
    expect(b.unit('s').statuses.find(s => s.id === 'lingxiao.status.waiting')?.attrMods).toEqual({ physicalAtk: 120, hit: 120 });
    round(b); expect(hits(b)).toHaveLength(1);
    expect(b.unit('s').statuses).toHaveLength(0);
    round(b); expect(hits(b)).toHaveLength(1);
  });
  it.each(['player', 'pet'] as const)('剑龙吟不能作用于 %s', kind => {
    const b = setup(1000, kind);
    expect(b.queryCommands('s').skills.find(s => s.skillId === skillId('confuse'))?.selectableTargetIds).toEqual([]);
    round(b, 'confuse');
    expect(b.unit('t0').statuses).toHaveLength(0);
    expect(b.unit('s').attrs.mp).toBe(1000);
    expect(hits(b)).toHaveLength(0);
  });
  it('剑龙吟仍可控制怪物', () => {
    const b = setup(); round(b, 'confuse');
    expect(b.unit('t0').statuses.some(s => s.id === 'lingxiao.status.confuse')).toBe(true);
  });
});


describe('基础模组状态与回合边界', () => {
  const seal: SkillDef = { id: 'test.seal', name: '封印', tags: ['spell', 'seal'], targeting: { side: 'enemy' },
    effects: [{ type: 'applyStatus', statusId: 'lingxiao.status.confuse', duration: 1, hit: 'seal' }] };
  it('剑息期间免疫封印，休息结束后封印恢复生效', () => {
    const b = setup(1000, 'npc', [seal]); b.unit('t0').skills = [seal.id];
    for (let turn = 0; turn < 3; turn++) {
      b.submit('s', turn === 0 ? { type: 'skill', skillId: skillId('triple'), targets: ['t0'] } : { type: 'defend' });
      b.submit('t0', { type: 'skill', skillId: seal.id, targets: ['s'] });
      for (let i = 1; i < 4; i++) b.submit(`t${i}`, { type: 'defend' });
      b.lockAndResolve();
      expect(b.unit('s').statuses.some(s => s.id === 'lingxiao.status.confuse')).toBe(turn === 2);
    }
  });
  it('破极剑意刷新不叠加、只增加物理伤害，到期恢复原伤害', () => {
    const physical: SkillDef = { id: skillId('test_physical'), name: '物理', tags: ['physical'], targeting: { side: 'enemy' }, effects: [{ type: 'physicalHit', coeff: 1 }] };
    const spell: SkillDef = { ...physical, id: skillId('test_spell'), tags: ['spell'], effects: [{ type: 'spellHit', coeff: 1, power: 200 }] };
    const damage = (buff: boolean, name: string) => {
      const b = setup(1000, 'npc', [physical, spell]);
      if (buff) { round(b, 'sword_aura', ['s']); round(b, 'sword_aura', ['s']); }
      expect(b.unit('s').statuses.filter(s => s.id === 'lingxiao.status.sword_aura')).toHaveLength(buff ? 1 : 0);
      round(b, name);
      const first = 10000 - b.unit('t0').attrs.hp;
      for (let turn = 0; turn < 4; turn++) round(b);
      expect(b.unit('s').statuses.some(s => s.id === 'lingxiao.status.sword_aura')).toBe(false);
      const hp = b.unit('t0').attrs.hp;
      round(b, name);
      return [first, hp - b.unit('t0').attrs.hp];
    };
    const unbuffed = damage(false, 'test_physical');
    const buffed = damage(true, 'test_physical');
    expect(buffed[0]).toBeGreaterThan(unbuffed[0]);
    expect(buffed[1]).toBe(unbuffed[1]);
    expect(damage(true, 'test_spell')).toEqual(damage(false, 'test_spell'));
  });
  it('惊雷施放回合只有准备状态，下一回合保留原目标并可确定性恢复', () => {
    const b = setup();
    b.submit('s', { type: 'skill', skillId: skillId('waiting'), targets: ['t2'] });
    for (let i = 0; i < 4; i++) b.submit(`t${i}`, { type: 'defend' });
    b.lockAndResolve(state => {
      if (state.units.find(u => u.id === 's')!.statuses.some(s => s.id === 'lingxiao.status.preparing')) {
        expect(state.units.find(u => u.id === 's')!.statuses).toEqual([expect.objectContaining({ id: 'lingxiao.status.preparing', attrMods: {}, speedMod: 0, transitionSkillLevel: 120 })]);
      }
    });
    const restored = restoreBattle({ seed: 12, versions: COMBAT_V6_PHASE_6D_VERSIONS, ruleset,
      units: [], skills: LINGXIAO_COMBAT.baseSkills.map(s => s.definition), statusDefs: LINGXIAO_COMBAT.statuses }, b.snapshot(), [...b.log()]);
    round(b); round(restored);
    expect(hits(b)).toEqual([expect.objectContaining({ targetId: 't2' })]);
    expect(restored.snapshot()).toEqual(b.snapshot());
    expect(restored.log()).toEqual(b.log());
  });
  it.each(['revive', 'restoreHp'] as const)('通过 %s 复起当回合禁止临渊，后续回合可用', type => {
    const revive: SkillDef = { id: 'test.revive', name: '复起', tags: ['support'],
      targeting: { side: 'ally', includeDowned: true },
      effects: [type === 'revive' ? { type, hp: 400 } : { type, power: 400, revive: true }] };
    const b = setup(1000, 'npc', [revive]);
    b.unit('s').attrs.hp = 0; b.unit('s').flags.downed = true;
    b.unit('t0').side = 0; b.unit('t0').attrs.speed = 1000; b.unit('t0').skills = [revive.id];
    b.submit('s', { type: 'skill', skillId: skillId('formation'), targets: ['t1'] });
    b.submit('t0', { type: 'skill', skillId: revive.id, targets: ['s'] });
    for (let i = 1; i < 4; i++) b.submit(`t${i}`, { type: 'defend' });
    const revivedRound = b.state.round;
    b.lockAndResolve();
    expect(b.unit('s').flags.revivedRound).toBe(revivedRound);
    expect(hits(b)).toHaveLength(0); expect(b.unit('s').attrs.hp).toBe(400);
    expect(b.log()).toContainEqual({ type: 'actionFailed', unitId: 's', reason: 'revived-this-round' });
    round(b, 'formation', ['t1']); expect(hits(b)).toHaveLength(3);
    round(b, 'formation', ['t1']); expect(hits(b)).toHaveLength(3);
  });
});


it('降低血线和击倒取消休息的经脉仍在真实战斗中生效', () => {
  const def = LINGXIAO_V6_DEFINITION;
  const progress = createEmptySectCombatProgressV6('lingxiao', def.paths[0].id,
    Object.fromEntries(def.methods.map(m => [m.id, 120])));
  progress.meridianDepth = 7;
  progress.meridianLoadouts[0].nodeIds = ['lingxiao.node.zhanchen.4.1', 'lingxiao.node.zhanchen.6.1'];
  const compiled = compileSectDefinitionV6({ definition: def, progress, characterLevel: 120 });
  expect(compiled.ok).toBe(true);
  if (!compiled.ok) return;
  const b = setup(401, 'npc', [...compiled.projection.skills, ...compiled.projection.skillOverrides], compiled.projection.passiveSkillIds);
  b.unit('t0').attrs.hp = 1;
  round(b, 'triple');
  expect(hits(b)).toHaveLength(1);
  expect(b.unit('s').flags.skipNextAction).toBe(false);
  expect(b.unit('s').statuses.some(s => s.id === 'lingxiao.status.recovery')).toBe(false);
  b.unit('s').attrs.hp = 401;
  round(b, 'triple', ['t1']);
  expect(hits(b)).toHaveLength(4);
});

it('准备途中倒地不会在回合末获得惊雷攻击状态', () => {
  const lethal: SkillDef = { id: 'test.lethal', name: '致命伤害', tags: ['physical'], targeting: { side: 'enemy' }, effects: [{ type: 'fixedHit', power: 10000 }] };
  const b = setup(1000, 'npc', [lethal]);
  b.unit('t0').skills = [lethal.id];
  b.submit('s', { type: 'skill', skillId: skillId('waiting'), targets: ['t0'] });
  b.submit('t0', { type: 'skill', skillId: lethal.id, targets: ['s'] });
  for (let i = 1; i < 4; i++) b.submit(`t${i}`, { type: 'defend' });
  b.lockAndResolve();
  expect(b.unit('s').flags.downed).toBe(true);
  expect(b.unit('s').statuses).toHaveLength(0);
  expect(b.log().filter(e => e.type === EventType.StatusApplied && e.statusId === 'lingxiao.status.waiting')).toHaveLength(0);
});
