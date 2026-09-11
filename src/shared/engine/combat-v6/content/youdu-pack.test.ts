import { describe, expect, it } from 'vitest';
import { z } from 'zod';
import raw from './data/youdu-combat.json';
import schema from './data/youdu-combat.schema.json';
import { YouduCombatPackShape, loadYouduCombatPack, compileYouduCombatPack } from './youdu-pack';
import { CommandType, createBattle } from '../core';
import { createDaoyouRuleset } from '../rules-daoyou';
import { COMBAT_V6_PHASE_6D_VERSIONS } from '../version';

function cast(data: unknown, index = 0) {
  const pack = compileYouduCombatPack(loadYouduCombatPack(data));
  const skill = pack.baseSkills[index].definition;
  const battle = createBattle({
    seed: 7, versions: COMBAT_V6_PHASE_6D_VERSIONS, ruleset: createDaoyouRuleset(),
    skills: [skill], statusDefs: pack.statuses,
    units: [
      { id: 'caster', name: '施法者', side: 0, kind: 'player', skills: [skill.id], skillLevels: { [skill.id]: 10 }, attrs: { hp: 10000, mp: 1000, maxMp: 1000, speed: 100, physicalAtk: 10, physicalDef: 10 } },
      { id: 'target', name: '目标', side: 1, kind: 'npc', attrs: { hp: 10000, speed: 1, physicalAtk: 10, physicalDef: 10 } },
    ],
  });
  battle.submit('caster', { type: CommandType.Skill, skillId: skill.id, targets: ['target'] });
  battle.submit('target', { type: CommandType.Defend });
  battle.lockAndResolve();
  return battle.snapshot();
}
describe('幽都技能与状态样板', () => {
  it('Schema 同步', () => expect(z.toJSONSchema(YouduCombatPackShape)).toEqual(schema));
  it('拒绝未知字段、机制、状态引用、表达式变量与语法', () => {
    const cases = [
      { ...raw, script: 'unsafe' },
      { ...raw, baseSkillIds: ['youdu.skill.missing'] },
      { ...raw, skills: [{ ...raw.skills[0], effects: [{ type: 'unknown' }] }] },
      { ...raw, skills: [{ ...raw.skills[0], effects: [{ type: 'applyStatus', statusId: 'youdu.status.missing', duration: 3 }] }] },
      { ...raw, skills: [{ ...raw.skills[0], costMp: 'unknown + 1' }] },
      { ...raw, skills: [{ ...raw.skills[0], costMp: 'floor(' }] },
    ];
    for (const data of cases) expect(() => loadYouduCombatPack(data)).toThrow('content/data/youdu-combat.json:');
  });
  it('配置修改进入真实战斗伤害与耗蓝结算', () => {
    const changed = { ...raw, skills: raw.skills.map((skill, i) => i ? skill : {
      ...skill, costMp: 100, effects: [{ type: 'fixedHit', power: 2000 }],
    }) };
    const before = cast(raw);
    const after = cast(changed);
    expect(after.units.find(u => u.id === 'caster')!.attrs.mp).toBe(900);
    expect(after.units.find(u => u.id === 'target')!.attrs.hp).toBeLessThan(before.units.find(u => u.id === 'target')!.attrs.hp);
  });
  it('状态周期伤害读取配置', () => {
    const changed = { ...raw, statuses: raw.statuses.map((status, i) => i ? status : {
      ...status, onTick: { type: 'dot', ratioOfMaxHp: 0.2 },
    }) };
    const before = cast(raw, 1);
    const after = cast(changed, 1);
    expect(after.units.find(u => u.id === 'target')!.attrs.hp).toBeLessThan(before.units.find(u => u.id === 'target')!.attrs.hp);
  });
});
