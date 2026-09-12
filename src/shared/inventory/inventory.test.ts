import { describe, expect, it } from 'vitest';
import {
  activeBeastSkills,
  BEAST_SPECIES,
  generateStarterBeast,
} from '../engine/combat-v6/beasts';
import {
  DAO_EQUIPMENT_GENERATOR_VERSION_V2,
  DAO_EQUIPMENT_TEMPLATE_ID,
  generateDaoEquipmentV2,
} from '../engine/combat-v6/equipment';
import {
  BOOKS,
  InventoryItemSchema,
  learnBeastSkill,
  sameStack,
  sortBag,
  type InventoryItem,
} from './index';
import { addItems } from './test-helpers';
const item = (slotIndex = 0, quantity = 1): InventoryItem => ({
  id: `item-${slotIndex}`,
  location: 'bag',
  slotIndex,
  definitionId: BOOKS[0].id,
  quantity,
  instanceData: null,
  stackKey: `definition.v1:${BOOKS[0].id}`,
  revision: 0,
});
describe('inventory capacity and immutable facts', () => {
  it('sorts and merges without losing quantity or changing stored items', () => {
    const stored = {
      ...item(5, 5),
      id: 'stored',
      location: 'storage' as const,
      slotIndex: null,
    };
    const before = [item(7, 60), item(3, 60), item(9, 60), stored];
    const result = sortBag(before);
    expect(
      result
        .filter((i) => i.location === 'bag')
        .map((i) => [i.slotIndex, i.quantity]),
    ).toEqual([
      [0, 99],
      [1, 81],
    ]);
    expect(result.find((i) => i.id === 'stored')).toBe(stored);
    expect(result.reduce((s, i) => s + i.quantity, 0)).toBe(185);
    expect(before.map((i) => i.quantity)).toEqual([60, 60, 60, 5]);
  });
  it('fills existing stacks before slots, spills only remainder, and preserves input', () => {
    const before = Array.from({ length: 40 }, (_, i) => item(i, i ? 99 : 98));
    let id = 0;
    const next = addItems(
      before,
      { definitionId: BOOKS[0].id, quantity: 101 },
      'bag',
      true,
      () => `new-${id++}`,
    );
    expect(next.filter((i) => i.location === 'bag')).toHaveLength(40);
    expect(
      next.filter((i) => i.location === 'storage').map((i) => i.quantity),
    ).toEqual([99, 1]);
    expect(next[0].quantity).toBe(99);
    expect(next[0].revision).toBe(1);
    expect(before[0].quantity).toBe(98);
    expect(next.reduce((s, i) => s + i.quantity, 0)).toBe(
      before.reduce((s, i) => s + i.quantity, 0) + 101,
    );
    expect(() =>
      addItems(
        before,
        { definitionId: BOOKS[0].id, quantity: 2 },
        'bag',
        false,
        () => 'unused',
      ),
    ).toThrow('背包格子不足');
  });
  it('uses holes, respects distinct definitions and rejects invalid quantities', () => {
    let id = 0;
    const next = addItems(
      [item(1, 99)],
      { definitionId: BOOKS[1].id, quantity: 100 },
      'bag',
      false,
      () => `new-${id++}`,
    );
    expect(next.map((i) => i.slotIndex)).toEqual([1, 0, 2]);
    expect(next.map((i) => i.quantity)).toEqual([99, 99, 1]);
    expect(sameStack(next[0], next[1])).toBe(false);
    for (const quantity of [0, -1, 1.5, Infinity])
      expect(() =>
        addItems(
          [],
          { definitionId: BOOKS[0].id, quantity },
          'bag',
          true,
          () => 'a',
        ),
      ).toThrow();
  });
  it('validates location, quantity and frozen equipment identity', () => {
    expect(
      InventoryItemSchema.safeParse({ ...item(), location: 'storage' }).success,
    ).toBe(false);
    expect(
      InventoryItemSchema.safeParse({ ...item(), quantity: 100 }).success,
    ).toBe(false);
    expect(
      InventoryItemSchema.safeParse({
        ...item(),
        instanceData: { name: '伪造' },
      }).success,
    ).toBe(false);
    const generated = generateDaoEquipmentV2({
      id: 'sword',
      createdAt: '2026-09-07T00:00:00Z',
      seed: 4,
      templateId: DAO_EQUIPMENT_TEMPLATE_ID.Weapon,
      equipmentLevel: 10,
      generatorVersion: DAO_EQUIPMENT_GENERATOR_VERSION_V2,
    });
    if (!generated.ok) throw new Error('fixture');
    const equipment = {
      ...item(),
      id: 'sword',
      definitionId: 'equipment.v6',
      instanceData: generated.instance,
    };
    expect(InventoryItemSchema.safeParse(equipment).success).toBe(true);
    expect(
      InventoryItemSchema.safeParse({ ...equipment, quantity: 2 }).success,
    ).toBe(false);
    expect(
      InventoryItemSchema.safeParse({ ...equipment, id: 'different' }).success,
    ).toBe(false);
    const granted = addItems(
      [],
      {
        definitionId: 'equipment.v6',
        quantity: 1,
        instanceData: generated.instance,
      },
      'bag',
      false,
      () => 'unused',
    );
    expect(granted[0].id).toBe('sword');
    expect(granted[0].instanceData).toEqual(generated.instance);
    expect(() =>
      addItems(
        [],
        { definitionId: 'equipment.v6', quantity: 1 },
        'bag',
        false,
        () => 'x',
      ),
    ).toThrow();
  });
});
describe('beast books', () => {
  const beast = generateStarterBeast(
    '00000000-0000-4000-8000-000000000001',
    '00000000-0000-4000-8000-000000000002',
    BEAST_SPECIES[0].id,
    1,
  );
  it('replaces only the selected birth slot, without changing growth or capacity', () => {
    const next = learnBeastSkill(beast, BOOKS[2].id, 10, 0);
    expect(next.skills).toEqual([BOOKS[2].skillId]);
    expect(next.skillSlotCapacity).toBe(1);
    expect(next.revision).toBe(beast.revision + 1);
    expect(next.aptitudes).toEqual(beast.aptitudes);
    expect(BEAST_SPECIES[0].skills).toContain(beast.skills[0]);
    expect(() => learnBeastSkill(beast, BOOKS[0].id, 10, 0)).toThrow('已拥有');
    expect(() => learnBeastSkill(beast, BOOKS[2].id, 9, 0)).toThrow('不能培养');
    expect(() => learnBeastSkill(beast, BOOKS[2].id, 10, 1)).toThrow('技能格');
  });
  it('retains suppressed normal skill in its original slot', () => {
    const two = {
      ...beast,
      skillSlotCapacity: 2,
      skills: ['beast.combo', BOOKS[0].skillId],
    };
    const next = learnBeastSkill(two, 'book.beast.advanced-combo', 10, 1);
    expect(next.skills).toEqual(['beast.combo', 'beast.advanced-combo']);
    expect(activeBeastSkills(next)).toEqual(['beast.advanced-combo']);
  });
});
