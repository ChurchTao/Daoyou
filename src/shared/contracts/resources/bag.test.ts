import { describe, expect, it } from 'vitest';
import { inventoryBagSchema } from './bag';
import {
  RESOURCE_DATA_SCHEMAS,
  RESOURCE_TOPIC_SCOPE_KIND,
  ResourceChangeSchema,
} from './registry';

describe('完整背包资源契约', () => {
  const data = {
    items: [
      {
        id: 'jade',
        definitionId: 'jade.character_manual.changchun',
        location: 'bag',
        slotIndex: 7,
        quantity: 2,
        revision: 1,
        instanceData: null,
        stackKey: null,
        name: '长春功玉简',
        equipped: false,
      },
    ],
    equippedItems: [],
    used: 1,
    total: 1,
    capacity: 40,
    page: 0,
  };
  it('保留原格位、数量及展示字段，资源属于当前角色', () => {
    expect(RESOURCE_DATA_SCHEMAS['inventory.bag'].parse(data)).toEqual(data);
    expect(RESOURCE_TOPIC_SCOPE_KIND['inventory.bag']).toBe('cultivator');
    expect(
      ResourceChangeSchema.safeParse({
        id: 'f7e5d70c-9348-4a44-a306-cb8a69c3bb78',
        mutationOrdinal: 0,
        scope: { kind: 'cultivator', id: 'one' },
        resourceTopic: 'inventory.bag',
        resourceVersion: 1,
        scopeVersion: 1,
        eventType: 'inventory.bag.changed',
        source: 'inventory',
        createdAt: '2026-09-11T00:00:00.000Z',
        operation: 'invalidate',
      }).success,
    ).toBe(true);
  });
  it('拒绝储藏室内容及越界格位冒充完整随身背包', () => {
    expect(
      inventoryBagSchema.safeParse({
        ...data,
        items: [{ ...data.items[0], location: 'storage', slotIndex: null }],
      }).success,
    ).toBe(false);
    expect(
      inventoryBagSchema.safeParse({
        ...data,
        items: [{ ...data.items[0], slotIndex: 40 }],
      }).success,
    ).toBe(false);
  });
  it('四十格满背包仍可独立携带六件穿戴道装', () => {
    const full = {
      ...data,
      items: Array.from({ length: 40 }, (_, slotIndex) => ({
        ...data.items[0],
        id: `bag-${slotIndex}`,
        slotIndex,
      })),
      used: 40,
      total: 40,
      equippedItems: Array.from({ length: 6 }, (_, index) => ({
        ...data.items[0],
        id: `equipped-${index}`,
        definitionId: 'equipment.v6',
        location: 'equipped',
        slotIndex: null,
        equipped: true,
      })),
    };
    expect(inventoryBagSchema.safeParse(full).success).toBe(true);
    expect(
      inventoryBagSchema.safeParse({
        ...full,
        equippedItems: [...full.equippedItems, full.equippedItems[0]],
      }).success,
    ).toBe(false);
    expect(
      inventoryBagSchema.safeParse({ ...full, items: [full.equippedItems[0]] })
        .success,
    ).toBe(false);
  });
});
