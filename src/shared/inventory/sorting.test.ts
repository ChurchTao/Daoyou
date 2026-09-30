import { describe, expect, it } from 'vitest';
import { InventoryQuerySchema } from '../contracts/inventory';
import { ITEM_DEFINITIONS } from '../items/registry';
import { INVENTORY_KINDS, sortInventoryItems } from './sorting';

const items = [
  {
    id: 'a',
    definitionId: 'material.v1',
    quantity: 9,
    updatedAt: '2026-09-01T00:00:00.000Z',
    slotIndex: 7,
  },
  {
    id: 'b',
    definitionId: 'consumable.v1',
    quantity: 2,
    updatedAt: '2026-09-03T00:00:00.000Z',
    slotIndex: 3,
  },
  {
    id: 'c',
    definitionId: 'equipment.v6',
    quantity: 1,
    updatedAt: '2026-09-02T00:00:00.000Z',
    slotIndex: 5,
  },
];

describe('通用物品展示排序', () => {
  it('按更新时间从新到旧排列所有类型，保留原数组与格位', () => {
    const before = structuredClone(items);
    const sorted = sortInventoryItems(items, 'updatedAt');
    expect(sorted.map((item) => item.id)).toEqual(['b', 'c', 'a']);
    expect(sorted.map((item) => item.slotIndex)).toEqual([3, 5, 7]);
    expect(items).toEqual(before);
  });

  it('堆叠数量最多优先，数量相同按更新时间与 ID 稳定排列', () => {
    const tied = { ...items[0], id: 'd', updatedAt: items[1].updatedAt };
    const sameTime = { ...tied, id: 'e' };
    expect(
      sortInventoryItems([...items, tied, sameTime], 'quantity').map(
        (item) => item.id,
      ),
    ).toEqual(['e', 'd', 'a', 'b', 'c']);
  });

  it('按现有物品分类顺序排列，同类按最近更新排列', () => {
    const recentMaterial = {
      ...items[0],
      id: 'd',
      updatedAt: items[1].updatedAt,
    };
    expect(
      sortInventoryItems([...items, recentMaterial], 'kind').map(
        (item) => item.id,
      ),
    ).toEqual(['c', 'd', 'a', 'b']);
    expect(
      new Set(
        INVENTORY_KINDS.filter(([kind]) => kind !== 'all').map(
          ([kind]) => kind,
        ),
      ),
    ).toEqual(new Set(ITEM_DEFINITIONS.map((item) => item.kind)));
  });

  it('查询接受三种排序，拒绝未知排序且保留未指定的默认顺序', () => {
    for (const sort of ['updatedAt', 'quantity', 'kind']) {
      expect(InventoryQuerySchema.parse({ sort }).sort).toBe(sort);
    }
    expect(InventoryQuerySchema.parse({}).sort).toBeUndefined();
    expect(InventoryQuerySchema.safeParse({ sort: 'name' }).success).toBe(
      false,
    );
  });
});
