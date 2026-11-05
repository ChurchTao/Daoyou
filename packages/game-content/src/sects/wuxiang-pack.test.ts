import { describe, expect, it } from 'vitest';
import { z } from 'zod';
import raw from './data/wuxiang-combat.json' with { type: 'json' };
import schema from './data/wuxiang-combat.schema.json' with { type: 'json' };
import {
  loadWuxiangCombatPack,
  WUXIANG_COMBAT,
  WuxiangCombatPackShape,
} from './wuxiang-pack.js';

describe('无相天机技能包', () => {
  it('Schema 同步，递归效果使用引用', () =>
    expect(z.toJSONSchema(WuxiangCombatPackShape, { reused: 'ref' })).toEqual(
      schema,
    ));
  it('两类念头各自最多积累三层', () => {
    expect(WUXIANG_COMBAT.resources.map(({ id, max }) => [id, max])).toEqual([
      ['wuxiang.resource.fierce', 3],
      ['wuxiang.resource.still', 3],
    ]);
  });
  it('拒绝不存在的状态引用、无效表达式和超限初始资源', () => {
    const condition = structuredClone(raw);
    condition.skills[0].hooks![0].when!.requireAbsentStatusIds = [
      'wuxiang.status.missing',
    ];
    expect(() => loadWuxiangCombatPack(condition)).toThrow('引用不存在');
    const formula = structuredClone(raw);
    formula.skills[1].effects[0].power = 'floor(';
    expect(() => loadWuxiangCombatPack(formula)).toThrow('power');
    const resource = structuredClone(raw);
    resource.resources[0].current = 4;
    expect(() => loadWuxiangCombatPack(resource)).toThrow('初始值超过上限');
  });
});
