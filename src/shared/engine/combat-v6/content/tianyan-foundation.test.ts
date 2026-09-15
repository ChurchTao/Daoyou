import { describe, expect, it } from 'vitest';
import { z } from 'zod';
import raw from './data/tianyan-foundation.json';
import schema from './data/tianyan-foundation.schema.json';
import { TianyanFoundationShape, loadTianyanFoundation } from './tianyan-foundation';
import { compileTianyanReactionEffects } from './tianyan-reactions';
import { EffectType } from '../core';

describe('天衍反应基础配置', () => {
  it('Schema 同步', () => expect(z.toJSONSchema(TianyanFoundationShape, { reused: 'ref' })).toEqual(schema));
  it('拒绝重复组合、缺失状态规则和非法公式', () => {
    const duplicate = structuredClone(raw);
    duplicate.reactions[1].oldElement = duplicate.reactions[0].oldElement;
    duplicate.reactions[1].newElement = duplicate.reactions[0].newElement;
    expect(() => loadTianyanFoundation(duplicate)).toThrow('反应有序组合');
    const missing = JSON.parse(JSON.stringify(raw));
    delete missing.statusApplications['tianyan.status.mire'];
    expect(() => loadTianyanFoundation(missing)).toThrow('反应状态或施加规则不存在');
    const formula = structuredClone(raw);
    formula.reactions[0].followPower = 'floor(';
    expect(() => loadTianyanFoundation(formula)).toThrow('followPower');
  });
  it('反应生成器读取追加伤害、状态时长和衍数规则', () => {
    const data = structuredClone(raw);
    data.reactions[0].followPower = '123';
    data.statusApplications['tianyan.status.mire'].duration = 2;
    data.reactionResource.amount = 2;
    const pack = loadTianyanFoundation(data);
    expect(compileTianyanReactionEffects('fire', pack)).toContainEqual(expect.objectContaining({ type: EffectType.FixedHit, power: '123' }));
    expect(compileTianyanReactionEffects('earth', pack)).toContainEqual(expect.objectContaining({ type: EffectType.ApplyStatus, statusId: 'tianyan.status.mire', duration: 2 }));
    expect(compileTianyanReactionEffects('fire', pack)).toContainEqual(expect.objectContaining({ type: EffectType.ModifyResource, amount: 2, maxGainPerAction: 1 }));
  });
});
