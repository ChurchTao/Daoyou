import { describe, expect, it } from 'vitest';
import { RecycleRequestSchema } from '../contracts/recycle';
import { consumableFactsOf } from '../items/definitions/consumables';
import type { Consumable } from '../types/cultivator';
import { recycleBlockingReason } from './recycle';

describe('回收边界', () => {
  it('允许灵果回收，但仓库灵果仍需先取入随身背包', () => {
    const fruit: Consumable = {
      name: '青露灵果',
      type: '灵果',
      quality: '玄品',
      quantity: 1,
      spec: {
        kind: 'spirit_fruit',
        family: 'healing',
        operations: [
          {
            type: 'restore_resource',
            resource: 'hp',
            mode: 'percent',
            value: 0.08,
          },
        ],
        consumeRules: {
          scene: 'out_of_battle_only',
          quotaCategory: 'none',
        },
        source: { kind: 'spirit_field', version: 1 },
      },
    };
    const item = {
      definitionId: 'consumable.v1',
      instanceData: consumableFactsOf(fruit),
      location: 'bag' as const,
    };
    expect(recycleBlockingReason(item)).toBeNull();
    expect(
      recycleBlockingReason({ ...item, location: 'storage' }),
    ).not.toBeNull();
  });

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
  it('实例材料仅允许随身背包回收', () => {
    const item = {
      definitionId: 'material.v1',
      instanceData: { name: '玄铁', type: 'ore', rank: '凡品' },
    };
    expect(recycleBlockingReason({ ...item, location: 'bag' })).toBeNull();
    expect(
      recycleBlockingReason({ ...item, location: 'storage' }),
    ).not.toBeNull();
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
