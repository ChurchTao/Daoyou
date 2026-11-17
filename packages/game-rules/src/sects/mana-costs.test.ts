import { describe, expect, it } from 'vitest';
import { evalExpr } from '@daoyou/combat-core/expr';
import { createBattle } from '@daoyou/combat-core/session';
import { createUnit } from '@daoyou/combat-core/units';
import type { SkillDef } from '@daoyou/combat-core/types';
import { COMBAT_V6_SECT_DEFINITIONS } from '@daoyou/game-content/sects';
import { COMBAT_V6_CHARACTER_BUILD_VERSIONS } from '@daoyou/game-domain/combat';
import { daoyouRulesetV6 } from '../combat/daoyou/index.js';

const definitions = Object.values(COMBAT_V6_SECT_DEFINITIONS);
const skills = [...new Map(definitions.flatMap(def => [
  ...def.skills,
  ...def.paths.flatMap(path => [...(path.grantSkills ?? []), ...path.nodes.flatMap(node => node.grantSkills ?? [])]),
]).map(entry => [entry.definition.id, entry.definition])).values()];
const get = (id: string) => skills.find(skill => skill.id === id)!;
const source = createUnit({ id: 's', name: '修士', kind: 'player', side: 0, level: 180, attrs: { hp: 100, maxHp: 1000, mp: 10000 }, skills: ['xiaoyue.skill.transform'], skillLevels: { 'xiaoyue.skill.transform': 180 } }, 0);

describe('八宗门法力定价', () => {
  it('回蓝术和剑宗耗血技能不耗蓝，其余主动技能费用随心法成长', () => {
    const active = skills.filter(skill => !skill.tags.includes('passive'));
    expect(new Set(active.map(skill => skill.school)).size).toBe(8);
    expect(active).toHaveLength(116);
    for (const skill of active) {
      if (['bailu.skill.juqi', 'xiaoyue.skill.mana_breath', 'lingxiao.skill.triple', 'lingxiao.skill.waiting', 'lingxiao.skill.formation'].includes(skill.id)) {
        expect(skill.costMp).toBeUndefined();
        continue;
      }
      const costs = [1, 90, 180].map(skillLevel => evalExpr(skill.costMp, { source, skillLevel, targets: 1, state: { round: 1, units: [source] } }));
      expect(costs[0], skill.id).toBeGreaterThan(0);
      expect(costs.every(Number.isInteger), skill.id).toBe(true);
      expect(costs[1], skill.id).toBeGreaterThan(costs[0]);
      expect(costs[2], skill.id).toBeGreaterThan(costs[1]);
    }
  });

  it.each([
    ['youdu.skill.wither', 260], ['wuxiang.skill.nectar', 258],
    ['wuxiang.skill.restore', 324], ['wanqiao.skill.rest', 258],
    ['bailu.skill.fuyuan', 152], ['jiujie.skill.thunder_slash', 129],
    ['lingxiao.skill.sword_aura', 125], ['tianyan.skill.fire', 157],
    ['xiaoyue.skill.chain_strike', 408],
  ])('%s 的180级单目标基础费用为 %i', (id, cost) => {
    expect(evalExpr(get(id as string).costMp, { source, skillLevel: 180, targets: 1, state: { round: 1, units: [source] } })).toBe(cost);
  });

  function battle(skill: SkillDef) {
    return createBattle({ seed: 17, ruleset: daoyouRulesetV6, versions: COMBAT_V6_CHARACTER_BUILD_VERSIONS,
      skills: [skill], statusDefs: definitions.flatMap(def => def.statuses),
      units: [
        { ...source, attrs: { ...source.attrs, speed: 100 }, skills: [skill.id] },
        { id: 'a', name: '友方', kind: 'player', side: 0, attrs: { hp: 100, maxHp: 1000 } },
        { id: 'pet', name: '灵兽', kind: 'pet', side: 0, ownerId: 's', attrs: { hp: 100, maxHp: 1000 } },
        { id: 'enemy', name: '对手', kind: 'player', side: 1, attrs: { hp: 100000 } },
      ] });
  }
  it('销魂蚀骨按在场友方人物计费，排除灵兽与倒地人物，预检和实际扣款一致', () => {
    for (const downed of [false, true]) {
      const b = battle(get('youdu.skill.wither'));
      b.unit('a').flags.downed = downed;
      const cost = downed ? 260 : 364;
      expect(b.queryCommands('s').skills[0].costs.mp).toBe(cost);
      b.submit('s', { type: 'skill', skillId: 'youdu.skill.wither', targets: ['enemy'] });
      for (const id of ['a', 'pet', 'enemy']) b.submit(id, { type: 'defend' });
      b.lockAndResolve();
      expect(b.unit('s').attrs.mp).toBe(10000 - cost);
      expect(b.unit('pet').attrs.hp).toBe(100);
    }
  });
  it('本愿印额外治疗计入预检与扣费，法力差一点时不会免费获得额外治疗', () => {
    for (const mp of [412, 413]) {
      const b = battle(get('wuxiang.skill.nectar'));
      b.applyStatus('a', 'wuxiang.status.vow', 5, 's');
      b.unit('s').attrs.mp = mp;
      const option = b.queryCommands('s').skills[0];
      expect(option.costs.mp).toBe(413);
      expect(option.reasons.includes('insufficient-mp')).toBe(mp < 413);
      b.submit('s', { type: 'skill', skillId: 'wuxiang.skill.nectar', targets: ['s'] });
      for (const id of ['a', 'pet', 'enemy']) b.submit(id, { type: 'defend' });
      b.lockAndResolve();
      expect(b.unit('s').attrs.mp).toBe(mp === 413 ? 0 : 412);
      expect(b.unit('a').attrs.hp).toBe(mp === 413 ? 520 : 100);
    }
  });
});
