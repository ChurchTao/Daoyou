import { describe, expect, it } from 'vitest';
import { z } from 'zod';
import raw from './data/lingxiao-combat.json';
import schema from './data/lingxiao-combat.schema.json';
import { LingxiaoCombatPackShape, loadLingxiaoCombatPack, compileLingxiaoCombatPack } from './lingxiao-pack';
import { CommandType, createBattle } from '../core';
import { createDaoyouRuleset } from '../rules-daoyou';
import { COMBAT_V6_PHASE_6D_VERSIONS } from '../version';

describe('红尘剑宗技能、状态与资源配置', () => {
  it('Schema 同步', () => expect(z.toJSONSchema(LingxiaoCombatPackShape)).toEqual(schema));
  it('拒绝多段系数缺失、超上限门槛和不存在的资源', () => {
    const coefficients = JSON.parse(JSON.stringify(raw));
    coefficients.skills[0].effects[0].coeff = [1];
    expect(() => loadLingxiaoCombatPack(coefficients)).toThrow('系数数量');
    const cap = structuredClone(raw);
    cap.resources[0].max = 5;
    expect(() => loadLingxiaoCombatPack(cap)).toThrow('门槛超过资源上限');
    const missing = JSON.parse(JSON.stringify(raw));
    missing.skills.find((s: { id: string }) => s.id === 'lingxiao.skill.shadow_strike').effects[2].resourceId = 'lingxiao.resource.missing';
    expect(() => loadLingxiaoCombatPack(missing)).toThrow('资源引用不存在');
  });
  it('资源配置进入真实施法结算', () => {
    function cast(amount: number) {
      const data = JSON.parse(JSON.stringify(raw));
      data.skills.find((s: { id: string }) => s.id === 'lingxiao.skill.shadow_strike').effects[2].amount = amount;
      const pack = compileLingxiaoCombatPack(loadLingxiaoCombatPack(data));
      const skill = pack.skill('lingxiao.skill.shadow_strike').definition;
      const battle = createBattle({
        seed: 5, versions: COMBAT_V6_PHASE_6D_VERSIONS, ruleset: createDaoyouRuleset(),
        skills: [skill], statusDefs: pack.statuses,
        units: [
          { id: 'source', name: '剑修', side: 0, kind: 'player', skills: [skill.id], resources: pack.resources, skillLevels: { [skill.id]: 10 }, attrs: { hp: 1000, mp: 100, maxMp: 100, speed: 100, physicalAtk: 100, physicalDef: 10 } },
          { id: 'target', name: '目标', side: 1, kind: 'npc', attrs: { hp: 1000, speed: 1, physicalAtk: 10, physicalDef: 10 } },
        ],
      });
      battle.submit('source', { type: CommandType.Skill, skillId: skill.id, targets: ['target'] });
      battle.submit('target', { type: CommandType.Defend });
      battle.lockAndResolve();
      return battle.snapshot().units.find(u => u.id === 'source')!;
    }
    expect(cast(2).resources[0].current).toBe(2);
    expect(cast(4).resources[0].current).toBe(4);
    expect(cast(100).resources[0].current).toBe(11);
  });
});
