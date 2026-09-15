import { describe, expect, it } from 'vitest';
import type { InventoryView } from '../contracts/inventory';
import { inventoryShowcaseSnapshot, isInventoryShowcase } from './showcase';

describe('inventory showcase snapshots', () => {
  it('keeps public facts stable and omits inventory ownership and placement', () => {
    const item: InventoryView['items'][number] = {
      id: 'item',
      location: 'bag',
      slotIndex: 3,
      revision: 4,
      stackKey: 'stack',
      definitionId: 'material.v1',
      name: '玄铁',
      quantity: 2,
      equipped: false,
      instanceData: { name: '玄铁', type: 'ore', rank: '玄品' },
    };
    const snapshot = inventoryShowcaseSnapshot(item);
    item.quantity = 1;
    (item.instanceData as { name: string }).name = '已变化';
    expect(snapshot).toEqual({
      definitionId: 'material.v1',
      name: '玄铁',
      quantity: 2,
      instanceData: { name: '玄铁', type: 'ore', rank: '玄品' },
    });
  });
  it('recognizes only versioned inventory showcases', () => {
    const snapshot = {
      definitionId: 'blueprint.weapon.10',
      name: '图纸',
      quantity: 1,
      instanceData: null,
    };
    expect(isInventoryShowcase({ version: 1, snapshot })).toBe(true);
    for (const payload of [
      null,
      {},
      { itemType: 'artifact', snapshot },
      { version: 2, snapshot },
      { version: 1, snapshot: null },
    ])
      expect(isInventoryShowcase(payload)).toBe(false);
  });
});
