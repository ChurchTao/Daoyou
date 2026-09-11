import { describe, expect, it } from 'vitest';
import { z } from 'zod';
import raw from './data/jiujie-combat.json';
import schema from './data/jiujie-combat.schema.json';
import { JiujieCombatShape, loadJiujieCombat, compileJiujieCombat } from './jiujie-pack';
import { CommandType, EffectType, EventType, createBattle, type SkillDef } from '../core';
import { createDaoyouRuleset } from '../rules-daoyou';
import { COMBAT_V6_PHASE_6D_VERSIONS } from '../version';

function cast(pack: ReturnType<typeof compileJiujieCombat>, id: string, statusId?: string, seed = 7) {
  const original = pack.skill(id).definition;
  const skill: SkillDef = { ...original, effects: [
    ...(statusId ? [{ type: EffectType.ApplyStatus, statusId, duration: 3 } as const] : []), ...original.effects,
  ] };
  const battle = createBattle({
    seed, versions: COMBAT_V6_PHASE_6D_VERSIONS, ruleset: createDaoyouRuleset(), skills: [skill], statusDefs: pack.statuses,
    units: [
      { id: 'source', name: '术者', side: 0, kind: 'player', skills: [id], skillLevels: { [id]: 10 }, attrs: { hp: 5000, mp: 1000, maxMp: 1000, speed: 100, physicalAtk: 10, physicalDef: 10, magicAtk: 100 } },
      { id: 'target', name: '目标', side: 1, kind: 'npc', attrs: { hp: 5000, mp: 1000, maxMp: 1000, speed: 1, physicalAtk: 10, physicalDef: 10, magicDef: 10 } },
    ],
  });
  battle.submit('source', { type: CommandType.Skill, skillId: id, targets: ['target'] });
  battle.submit('target', { type: CommandType.Defend });
  battle.lockAndResolve();
  return { target: battle.snapshot().units.find(u => u.id === 'target')!, events: battle.log() };
}
describe('九劫技能与特殊效果配置', () => {
  it('Schema 同步', () => expect(z.toJSONSchema(JiujieCombatShape, { reused: 'ref' })).toEqual(schema));
  it('拒绝重叠概率分支、重复技能、缺失状态与引爆门槛溢出', () => {
    const branches = structuredClone(raw);
    branches.judgment.branches[1].when = branches.judgment.branches[0].when;
    expect(() => loadJiujieCombat(branches)).toThrow('互斥');
    const duplicate = structuredClone(raw);
    duplicate.skills[1].id = duplicate.skills[0].id;
    expect(() => loadJiujieCombat(duplicate)).toThrow('重复 ID');
    const missing = structuredClone(raw);
    missing.detonation.statusId = 'jiujie.status.missing';
    expect(() => loadJiujieCombat(missing)).toThrow('引爆状态不存在');
    const stacks = structuredClone(raw);
    stacks.detonation.minStacks = 4;
    expect(() => loadJiujieCombat(stacks)).toThrow('层数上限');
  });
  it('五雷每次只抽取对应分支，配置概率影响伤害与削蓝', () => {
    for (const controlled of [false, true]) {
      const data = structuredClone(raw);
      data.judgment.branches[controlled ? 1 : 0].chance = 1;
      const success = cast(compileJiujieCombat(loadJiujieCombat(data)), 'jiujie.skill.five_thunder', controlled ? 'jiujie.status.suppress' : undefined);
      data.judgment.branches[controlled ? 1 : 0].chance = 0;
      const failure = cast(compileJiujieCombat(loadJiujieCombat(data)), 'jiujie.skill.five_thunder', controlled ? 'jiujie.status.suppress' : undefined);
      const events = success.events.filter(e => e.type === EventType.ChanceResolved);
      expect(events).toHaveLength(1);
      expect(events[0]).toMatchObject({ branchId: data.judgment.branches[controlled ? 1 : 0].branchId, success: true });
      expect(success.target.attrs.hp).toBeLessThan(failure.target.attrs.hp);
      expect(success.target.attrs.mp).toBe(750);
      expect(failure.target.attrs.mp).toBe(950);
    }
  });
  it('引爆威力进入真实伤害结算并消耗电芒', () => {
    const original = cast(compileJiujieCombat(loadJiujieCombat(raw)), 'jiujie.skill.startling_thunder', 'jiujie.status.electric');
    const data = structuredClone(raw);
    data.detonation.power = '1000';
    const changed = cast(compileJiujieCombat(loadJiujieCombat(data)), 'jiujie.skill.startling_thunder', 'jiujie.status.electric');
    expect(changed.target.attrs.hp).toBeLessThan(original.target.attrs.hp);
    expect(changed.target.statuses.some(s => s.id === 'jiujie.status.electric')).toBe(false);
  });
});
