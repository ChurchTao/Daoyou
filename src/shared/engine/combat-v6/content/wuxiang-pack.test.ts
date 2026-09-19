import { describe, expect, it } from 'vitest';
import { z } from 'zod';
import raw from './data/wuxiang-combat.json';
import schema from './data/wuxiang-combat.schema.json';
import { WuxiangCombatPackShape, loadWuxiangCombatPack, compileWuxiangCombatPack } from './wuxiang-pack';
import { CommandType, createBattle } from '../core';
import { createDaoyouRuleset } from '../rules-daoyou';
import { COMBAT_V6_PHASE_6D_VERSIONS } from '../version';

function heal(data: unknown) {
  const pack = compileWuxiangCombatPack(loadWuxiangCombatPack(data));
  const skill = pack.baseSkills[0].definition;
  const battle = createBattle({
    seed: 7, versions: COMBAT_V6_PHASE_6D_VERSIONS, ruleset: createDaoyouRuleset(),
    skills: [skill], statusDefs: pack.statuses,
    units: [
      { id: 'caster', name: '施法者', side: 0, kind: 'player', skills: [skill.id], resources: pack.resources, skillLevels: { [skill.id]: 10 }, attrs: { hp: 1000, mp: 1000, maxMp: 1000, speed: 100, physicalAtk: 10, physicalDef: 10 } },
      { id: 'ally', name: '伤者', side: 0, kind: 'player', attrs: { hp: 100, maxHp: 1000, speed: 10, physicalAtk: 10, physicalDef: 10 } },
      { id: 'enemy', name: '敌人', side: 1, kind: 'npc', attrs: { hp: 1000, speed: 1, physicalAtk: 10, physicalDef: 10 } },
    ],
  });
  battle.submit('caster', { type: CommandType.Skill, skillId: skill.id, targets: ['ally'] });
  battle.submit('ally', { type: CommandType.Defend });
  battle.submit('enemy', { type: CommandType.Defend });
  battle.lockAndResolve();
  return battle.snapshot();
}
describe('无相技能、状态与念资源', () => {
  it('Schema 同步', () => expect(z.toJSONSchema(WuxiangCombatPackShape)).toEqual(schema));
  it('拒绝不存在的状态条件和超过上限的资源消耗', () => {
    const condition = JSON.parse(JSON.stringify(raw));
    condition.skills[0].successEffects[0].when.requireAbsentStatusIds = ['wuxiang.status.missing'];
    expect(() => loadWuxiangCombatPack(condition)).toThrow('状态条件引用不存在');
    const cost = JSON.parse(JSON.stringify(raw));
    cost.skills.find((s: { resourceCosts?: unknown }) => s.resourceCosts).resourceCosts[0].amount = 7;
    expect(() => loadWuxiangCombatPack(cost)).toThrow('消耗超过资源上限');
  });
  it('治疗和成功后念增长采用配置', () => {
    const data = JSON.parse(JSON.stringify(raw));
    data.skills[0].effects[0].power = 300;
    data.skills[0].successEffects[0].amount = 3;
    const before = heal(raw), after = heal(data);
    expect(after.units.find(u => u.id === 'ally')!.attrs.hp).toBeGreaterThan(before.units.find(u => u.id === 'ally')!.attrs.hp);
    expect(before.units.find(u => u.id === 'caster')!.resources[0].current).toBe(1);
    expect(after.units.find(u => u.id === 'caster')!.resources[0].current).toBe(3);
  });
});
