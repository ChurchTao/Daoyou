import { describe, expect, it } from 'vitest';
import { z } from 'zod';
import raw from './data/jiujie-combat.json' with { type: 'json' };
import schema from './data/jiujie-combat.schema.json' with { type: 'json' };
import { JiujieCombatShape, loadJiujieCombat, JIUJIE_COMBAT } from './jiujie-pack.js';

describe('九劫重做内容契约', () => {
  it('作者 Schema 同步，普通雷印不能叠加', () => {
    expect(z.toJSONSchema(JiujieCombatShape, { reused: 'ref' })).toEqual(schema);
    const mark = JIUJIE_COMBAT.statuses.find(status => status.id === 'jiujie.status.electric');
    expect(mark).toBeDefined();
    expect(mark?.maxStacks ?? 1).toBe(1);
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
