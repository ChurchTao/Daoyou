import { describe, expect, it } from 'vitest';
import { RecycleRequestSchema } from '../contracts/recycle';
import { FIXED_MATERIALS } from '../items/definitions/fixed-materials';
import { recycleBlockingReason } from './recycle';

describe('回收边界', () => {
  it('同一选择不能通过重复行超过单格数量', () => {
    const item = { id: 'stack', revision: 2, quantity: 60 };
    expect(
      RecycleRequestSchema.safeParse({ phase: 'preview', items: [item, item] })
        .success,
    ).toBe(false);
    for (const quantity of [0, -1, 1.5, 100]) {
      expect(
        RecycleRequestSchema.safeParse({
          phase: 'preview',
          items: [{ ...item, quantity }],
        }).success,
      ).toBe(false);
    }
  });
  it('允许同一物品事实的不同格位分别选量，不接受客户端价格', () => {
    const items = [
      { id: 'stack-a', revision: 1, quantity: 2 },
      { id: 'stack-b', revision: 3, quantity: 1 },
    ];
    expect(
      RecycleRequestSchema.safeParse({ phase: 'preview', items }).success,
    ).toBe(true);
    expect(
      RecycleRequestSchema.safeParse({ phase: 'preview', items, total: 999999 })
        .success,
    ).toBe(false);
  });
  it('固定材料与实例材料使用相同 bag 边界', () => {
    for (const definitionId of [FIXED_MATERIALS[0].id, 'material.v1']) {
      expect(
        recycleBlockingReason({
          definitionId,
          location: 'bag',
          instanceData: null,
        }),
      ).toBeNull();
      expect(
        recycleBlockingReason({
          definitionId,
          location: 'storage',
          instanceData: null,
        }),
      ).not.toBeNull();
    }
  });
  it('不把道装、未知定义或损坏的消耗品误当可出售丹药', () => {
    for (const definitionId of ['equipment.v6', 'unknown', 'consumable.v1']) {
      expect(
        recycleBlockingReason({
          definitionId,
          location: 'bag',
          instanceData: {},
        }),
      ).not.toBeNull();
    }
  });
});
