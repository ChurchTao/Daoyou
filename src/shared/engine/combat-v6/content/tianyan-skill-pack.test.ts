import { describe, expect, it } from 'vitest';
import { z } from 'zod';
import raw from './data/tianyan-skills.json';
import schema from './data/tianyan-skills.schema.json';
import { TianyanSkillsShape, loadTianyanSkills, compileTianyanSkills } from './tianyan-skill-pack';
import { TIANYAN_FOUNDATION } from './tianyan-foundation';
import { CommandType, EffectType, createBattle } from '../core';
import { createDaoyouRuleset } from '../rules-daoyou';
import { COMBAT_V6_PHASE_6D_VERSIONS } from '../version';

describe('天衍技能本体配置', () => {
  it('Schema 同步', () => expect(z.toJSONSchema(TianyanSkillsShape, { reused: 'ref' })).toEqual(schema));
  it('五行技能只生成一份反应和最终法印', () => {
    const data = structuredClone(raw);
    data.elemental[1].markDuration = 4;
    const skill = compileTianyanSkills(loadTianyanSkills(data)).skill('tianyan.skill.fire').definition;
    expect(skill.effects.filter(e => e.type === EffectType.EmitMechanic)).toHaveLength(2);
    expect(skill.effects[skill.effects.length - 1]).toEqual({ type: EffectType.ApplyStatus, statusId: 'tianyan.status.mark.fire', duration: 4 });
  });
  it('拒绝重复五行、缺失状态种类和过量资源消耗', () => {
    const duplicate = structuredClone(raw);
    duplicate.elemental[1].element = 'wood';
    expect(() => loadTianyanSkills(duplicate)).toThrow('五行技能');
    const missing = JSON.parse(JSON.stringify(raw));
    missing.skills.find((s: { id: string }) => s.id === 'tianyan.skill.transfer').targeting.requireStatusKinds = ['tianyan.missing'];
    expect(() => loadTianyanSkills(missing)).toThrow('状态类别不存在');
    const cost = JSON.parse(JSON.stringify(raw));
    cost.skills.find((s: { resourceCosts?: unknown }) => s.resourceCosts).resourceCosts[0].amount = 99;
    expect(() => loadTianyanSkills(cost)).toThrow('资源规则超过上限');
  });
  it('配置的五行法术威力进入真实伤害结算', () => {
    function cast(power?: number) {
      const data = JSON.parse(JSON.stringify(raw));
      if (power !== undefined) data.elemental[1].power = power;
      const pack = compileTianyanSkills(loadTianyanSkills(data)), skill = pack.skill('tianyan.skill.fire').definition;
      const battle = createBattle({
        seed: 7, versions: COMBAT_V6_PHASE_6D_VERSIONS, ruleset: createDaoyouRuleset(),
        skills: [skill], statusDefs: TIANYAN_FOUNDATION.statuses,
        units: [
          { id: 'source', name: '术者', side: 0, kind: 'player', skills: [skill.id], resources: TIANYAN_FOUNDATION.resources, skillLevels: { [skill.id]: 10 }, attrs: { hp: 5000, mp: 1000, maxMp: 1000, speed: 100, physicalAtk: 10, physicalDef: 10, magicAtk: 100 } },
          { id: 'target', name: '目标', side: 1, kind: 'npc', attrs: { hp: 5000, speed: 1, physicalAtk: 10, physicalDef: 10, magicDef: 10 } },
        ],
      });
      battle.submit('source', { type: CommandType.Skill, skillId: skill.id, targets: ['target'] });
      battle.submit('target', { type: CommandType.Defend });
      battle.lockAndResolve();
      return battle.snapshot().units.find(u => u.id === 'target')!.attrs.hp;
    }
    expect(cast(2000)).toBeLessThan(cast());
  });
});
