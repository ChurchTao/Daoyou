import { describe, expect, it } from 'vitest';
import { generateForgedEquipment } from '../engine/combat-v6/equipment/forging';
import { changeEquipmentLocation } from './equipment-location';
import {
  emptySlot,
  InventoryItemSchema,
  sortBag,
  type InventoryItem,
} from './index';

function equipment(id: string, slotIndex: number | null): InventoryItem {
  const generated = generateForgedEquipment({
    id,
    createdAt: '2026-09-15T00:00:00Z',
    seed: 123,
    templateId: 'dao_equipment.standard.weapon.v1',
    equipmentLevel: 10,
    boosts: { ore: 0, essence: 0, attributes: 0 },
  });
  if (!generated.ok) throw new Error('Invalid fixture');
  return InventoryItemSchema.parse({
    id,
    definitionId: 'equipment.v6',
    instanceData: generated.instance,
    location: slotIndex === null ? 'equipped' : 'bag',
    slotIndex,
    quantity: 1,
    stackKey: null,
    revision: 0,
  });
}
const fullBag = () =>
  Array.from({ length: 40 }, (_, slotIndex): InventoryItem => ({
    id: `book-${slotIndex}`,
    definitionId: 'book.beast.combo',
    location: 'bag',
    slotIndex,
    quantity: 99,
    instanceData: null,
    stackKey: 'combo',
    revision: 0,
  }));

describe('穿戴道装不占随身格位', () => {
  it('穿戴释放原格位，整理不把装备放回背包', () => {
    const before = [equipment('sword', 7)];
    const next = changeEquipmentLocation(before, 'sword', true);
    expect(next[0]).toMatchObject({
      location: 'equipped',
      slotIndex: null,
      revision: 1,
    });
    expect(emptySlot(next)).toBe(0);
    expect(sortBag(next)).toEqual(next);
    expect(before[0]).toMatchObject({
      location: 'bag',
      slotIndex: 7,
      revision: 0,
    });
    expect(InventoryItemSchema.safeParse(next[0]).success).toBe(true);
  });
  it('背包满时可替换，旧装备回到新装备原格位', () => {
    const before = [
      ...fullBag().slice(0, 39),
      equipment('new', 39),
      equipment('old', null),
    ];
    const next = changeEquipmentLocation(before, 'new', true, 'old');
    expect(next.find((i) => i.id === 'new')).toMatchObject({
      location: 'equipped',
      slotIndex: null,
      revision: 1,
    });
    expect(next.find((i) => i.id === 'old')).toMatchObject({
      location: 'bag',
      slotIndex: 39,
      revision: 1,
    });
    expect(next.filter((i) => i.location === 'bag')).toHaveLength(40);
    expect(
      new Set(next.filter((i) => i.location === 'bag').map((i) => i.slotIndex))
        .size,
    ).toBe(40);
  });
  it('满背包卸下失败且不改变输入，有空格时卸下成功', () => {
    const before = [...fullBag(), equipment('old', null)];
    expect(() => changeEquipmentLocation(before, 'old', false, 'old')).toThrow(
      '背包已满',
    );
    expect(before.at(-1)).toMatchObject({ location: 'equipped', revision: 0 });
    const next = changeEquipmentLocation(
      before.filter((i) => i.slotIndex !== 12),
      'old',
      false,
      'old',
    );
    expect(next.at(-1)).toMatchObject({
      location: 'bag',
      slotIndex: 12,
      revision: 1,
    });
  });
  it('不能穿戴储藏室道装，也不接受非道装的穿戴位置', () => {
    expect(() =>
      changeEquipmentLocation(
        [{ ...equipment('stored', null), location: 'storage' }],
        'stored',
        true,
      ),
    ).toThrow();
    expect(
      InventoryItemSchema.safeParse({
        ...fullBag()[0],
        location: 'equipped',
        slotIndex: null,
      }).success,
    ).toBe(false);
  });
});
