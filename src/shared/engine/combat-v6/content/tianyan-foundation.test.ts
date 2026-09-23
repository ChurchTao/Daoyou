import { describe, expect, it } from 'vitest';
import { z } from 'zod';
import raw from './data/tianyan-foundation.json';
import schema from './data/tianyan-foundation.schema.json';
import { TianyanFoundationShape, loadTianyanFoundation } from './tianyan-foundation';

describe('天衍生克状态配置', () => {
  it('Schema 同步', () => expect(z.toJSONSchema(TianyanFoundationShape, { reused: 'ref' })).toEqual(schema));
  it('拒绝重复组合、反转的克制方向和可驱散法印', () => {
    const duplicate = structuredClone(raw);
    Object.assign(duplicate.reactions[1], { oldElement: duplicate.reactions[0].oldElement, newElement: duplicate.reactions[0].newElement });
    expect(() => loadTianyanFoundation(duplicate)).toThrow('反应有序组合');
    const reverse = structuredClone(raw);
    const r = reverse.reactions[5];
    [r.oldElement, r.newElement] = [r.newElement, r.oldElement];
    expect(() => loadTianyanFoundation(reverse)).toThrow('生克方向错误');
    const mark = structuredClone(raw);
    mark.statuses[0].dispellable = true;
    expect(() => loadTianyanFoundation(mark)).toThrow('持久且不可驱散');
  });
  it('拒绝未知状态引用和错误恢复公式', () => {
    const missing = structuredClone(raw);
    missing.elements[0].markId = 'tianyan.status.missing';
    expect(() => loadTianyanFoundation(missing)).toThrow('状态引用不存在');
    const formula = structuredClone(raw);
    formula.statuses.find(s => s.healingPerRound)!.healingPerRound = 'floor(';
    expect(() => loadTianyanFoundation(formula)).toThrow('healingPerRound');
  });
});
