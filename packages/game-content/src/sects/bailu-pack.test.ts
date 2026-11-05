import { describe, expect, it } from 'vitest';
import { z } from 'zod';
import rawCombat from './data/bailu-combat.json' with { type: 'json' };
import rawPaths from './data/bailu-paths.json' with { type: 'json' };
import combatSchema from './data/bailu-combat.schema.json' with { type: 'json' };
import pathsSchema from './data/bailu-paths.schema.json' with { type: 'json' };
import { BAILU_COMBAT, BailuCombatPackShape, loadBailuCombatPack } from './bailu-pack.js';
import { BailuPathsPackShape, loadBailuPathsPack } from './bailu-path-pack.js';

describe('白鹿内容契约', () => {
  it('作者 Schema 与严格运行时解析同步', () => {
    expect(z.toJSONSchema(BailuCombatPackShape, { reused: 'ref' })).toEqual(combatSchema);
    expect(z.toJSONSchema(BailuPathsPackShape, { reused: 'ref' })).toEqual(pathsSchema);
  });

  it('拒绝未知字段、越宗引用、无效表达式和重复经脉槽位', () => {
    const unknown = structuredClone(rawCombat);
    Reflect.set(unknown.skills[0], 'uncheckedDamage', 9999);
    expect(() => loadBailuCombatPack(unknown)).toThrow('uncheckedDamage');
    const missing = structuredClone(rawCombat);
    missing.baseSkillIds.push('bailu.skill.missing');
    expect(() => loadBailuCombatPack(missing)).toThrow('技能引用不存在');
    const expression = structuredClone(rawCombat);
    expression.skills[0].costMp = 'unreviewedDamage * 10';
    expect(() => loadBailuCombatPack(expression)).toThrow('未知表达式');
    const foreign = structuredClone(rawCombat);
    Reflect.set(foreign.skills[2].effects[0], 'statusId', 'youdu.status.poison');
    expect(() => loadBailuCombatPack(foreign)).toThrow('statusId');
    const slots = structuredClone(rawPaths);
    slots.paths[0].nodes[1].slot = slots.paths[0].nodes[0].slot;
    expect(() => loadBailuPathsPack(slots)).toThrow('层级槽位重复');
    const reference = structuredClone(rawPaths);
    reference.paths[0].foundationPassives.push('bailu.passive.missing');
    expect(() => loadBailuPathsPack(reference)).toThrow('引用不存在');
  });

  it('封印分工与必中作用域不会泄漏到所有技能', () => {
    const soul = BAILU_COMBAT.statuses.find(status => status.id === 'bailu.status.soul');
    expect(soul?.blocksDamagingSpells).toBe(true);
    expect(soul?.blocksSpell).toBeUndefined();
    const sureSeal = BAILU_COMBAT.skill('bailu.skill.jinsheng').definition;
    expect(sureSeal.modifiers?.filter(modifier => modifier.sealAlwaysHit).every(modifier => modifier.when?.skillIds?.includes(sureSeal.id))).toBe(true);
    expect(BAILU_COMBAT.statuses.find(status => status.id === 'bailu.status.sleep_deep')?.breakOnDamageAbove).toBe(30);
  });
});
