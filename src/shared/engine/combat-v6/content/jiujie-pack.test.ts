import { describe, expect, it } from 'vitest';
import { z } from 'zod';
import raw from './data/jiujie-combat.json';
import schema from './data/jiujie-combat.schema.json';
import { JiujieCombatShape, loadJiujieCombat, JIUJIE_COMBAT } from './jiujie-pack';

describe('九劫重做内容契约', () => {
  it('严格 schema 同步，基础技能不含探查、旧引爆和旧终极技能', () => {
    expect(z.toJSONSchema(JiujieCombatShape, { reused: 'ref' })).toEqual(schema);
    expect(JIUJIE_COMBAT.baseSkills).toHaveLength(9);
    expect(JIUJIE_COMBAT.skills.some(s => /startling_thunder|nine_heavens_thunder|heavenly_prison/.test(s.definition.id))).toBe(false);
    expect(JIUJIE_COMBAT.statuses.find(s => s.id.endsWith('.electric'))?.maxStacks ?? 1).toBe(1);
  });
  it('拒绝重复技能、缺失引用与未知表达式', () => {
    const duplicate = structuredClone(raw);
    duplicate.skills[1].id = duplicate.skills[0].id;
    expect(() => loadJiujieCombat(duplicate)).toThrow('重复 ID');
    const missing = structuredClone(raw);
    missing.baseSkillIds.push('jiujie.skill.missing');
    expect(() => loadJiujieCombat(missing)).toThrow('技能引用不存在');
    const formula = structuredClone(raw);
    formula.skills[0].costMp = 'unverifiedCoefficient * 2';
    expect(() => loadJiujieCombat(formula)).toThrow('未知表达式');
  });
});
