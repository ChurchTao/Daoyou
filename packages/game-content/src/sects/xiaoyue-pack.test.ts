import { describe, expect, it } from 'vitest';
import { z } from 'zod';
import combat from './data/xiaoyue-combat.json' with { type: 'json' };
import combatSchema from './data/xiaoyue-combat.schema.json' with { type: 'json' };
import paths from './data/xiaoyue-paths.json' with { type: 'json' };
import pathsSchema from './data/xiaoyue-paths.schema.json' with { type: 'json' };
import { XIAOYUE_COMBAT, XiaoyueCombatPackShape, loadXiaoyueCombatPack } from './xiaoyue-pack.js';
import { XiaoyuePathsPackShape, loadXiaoyuePathsPack } from './xiaoyue-path-pack.js';

describe('啸岳岭内容契约', () => {
  it('JSON Schema 与严格运行时解析同步', () => {
    expect(z.toJSONSchema(XiaoyueCombatPackShape, { reused: 'ref' })).toEqual(combatSchema);
    expect(z.toJSONSchema(XiaoyuePathsPackShape, { reused: 'ref' })).toEqual(pathsSchema);
    expect(() => loadXiaoyueCombatPack({ ...combat, unrecognized: true })).toThrow('Unrecognized key');
    expect(() => loadXiaoyuePathsPack({ ...paths, paths: [paths.paths[0], paths.paths[0]] })).toThrow('重复 ID');
    const missingStatus = structuredClone(combat);
    missingStatus.skills[0].effects[1] = { type: 'applyStatus', statusId: 'xiaoyue.status.missing', duration: 1, self: true } as typeof missingStatus.skills[0]['effects'][number];
    expect(() => loadXiaoyueCombatPack(missingStatus)).toThrow('引用不存在');
  });

  it('狮击按次扣除法力，鹏击与最佳搭档分别计算冷却', () => {
    expect(XIAOYUE_COMBAT.skill('xiaoyue.skill.lion_strike').definition.costMp).toBe(30);
    expect(XIAOYUE_COMBAT.skill('xiaoyue.skill.eagle_strike').definition.cooldownRounds).toBe(2);
    expect(XIAOYUE_COMBAT.skill('xiaoyue.skill.best_partners').definition.cooldownRounds).toBe(8);
  });
});
