import { describe, expect, it } from 'vitest';
import { z } from 'zod';
import { evalExpr } from '@daoyou/combat-core/expr';
import { createUnit } from '@daoyou/combat-core/units';
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

  it('狮搏无兽形时计入化形费用，已有兽形只支付攻击费用', () => {
    const source = createUnit({ name: '百兽弟子', side: 0, kind: 'player', attrs: { hp: 100, speed: 10, physicalAtk: 100, physicalDef: 10 } }, 0);
    const costMp = XIAOYUE_COMBAT.skill('xiaoyue.skill.lion_strike').definition.costMp;
    expect(evalExpr(costMp, { source, skillLevel: 75, targets: 1 })).toBe(50);
    source.statuses.push({ id: 'xiaoyue.status.transform', kind: 'xiaoyue.status.transform', sourceId: source.id,
      remainingRounds: 4, appliedRound: 1, speedMod: 0, attrMods: {}, damageTakenPhysical: 1, damageTakenSpell: 1, healTaken: 1, healDealt: 1, stacks: 1 });
    expect(evalExpr(costMp, { source, skillLevel: 75, targets: 1 })).toBe(30);
  });

  it('鹏击与最佳搭档分别计算冷却', () => {
    expect(XIAOYUE_COMBAT.skill('xiaoyue.skill.eagle_strike').definition.cooldownRounds).toBe(2);
    expect(XIAOYUE_COMBAT.skill('xiaoyue.skill.best_partners').definition.cooldownRounds).toBe(8);
  });
});
