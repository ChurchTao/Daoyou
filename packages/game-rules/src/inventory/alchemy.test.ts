import { describe, expect, it } from 'vitest';
import {
  consumableFactsOf,
  ConsumableFactsSchema,
  FORGING_MATERIAL_TYPES,
  MaterialFactsSchema,
  BAG_CAPACITY,
  type InventoryItem,
} from '@daoyou/game-domain/inventory';
import { calculateAlchemyCost } from '../alchemy/alchemyCost.js';
import {
  groupAlchemyBagMaterials,
  groupAlchemyStorageMaterials,
} from './alchemy.js';
import { InventoryItemSchema, sortBag } from './index.js';
import { inventoryStackIdentity } from './stack-key.js';
import { addItems } from './test-helpers.js';

const herb = {
  name: '凝血草',
  type: 'herb' as const,
  rank: '凡品' as const,
  element: '木' as const,
  description: '温养经脉，缓复气血。',
};
const pill = consumableFactsOf({
  name: '养元丹',
  type: '丹药',
  quality: '凡品',
  quantity: 1,
  description: '温养元气',
  spec: {
    kind: 'pill',
    family: 'cultivation',
    operations: [
      {
        type: 'add_status',
        status: 'cultivation_boost',
        payload: { boostPercent: 1.2, retreatExpMultiplier: 2.2 },
      },
    ],
    consumeRules: { scene: 'out_of_battle_only', quotaCategory: 'cultivation' },
    alchemyMeta: {
      source: 'improvised',
      sourceMaterials: [],
      stability: 80,
      toxicityRating: 10,
      tags: [],
      version: 4,
    },
  },
});
const material = (
  id: string,
  slotIndex: number,
  quantity: number,
): InventoryItem => ({
  id,
  slotIndex,
  quantity,
  location: 'bag',
  definitionId: 'material.v1',
  instanceData: herb,
  stackKey: inventoryStackIdentity('material.v1', herb),
  revision: 0,
});
describe('alchemy inventory migration', () => {
  it('retains the existing price curve', () => {
    expect(calculateAlchemyCost('凡品')).toBe(1600);
    expect(calculateAlchemyCost('灵品')).toBe(3200);
  });
  it('accepts herbs without expanding forging ingredient types', () => {
    expect(MaterialFactsSchema.parse(herb).type).toBe('herb');
    expect(FORGING_MATERIAL_TYPES).not.toContain('herb');
  });
  it('groups split stacks, excludes storage and retains distinct descriptions', () => {
    const split = [material('a', 0, 2), material('b', 1, 3)];
    const grouped = groupAlchemyBagMaterials(split);
    expect(grouped).toHaveLength(1);
    expect(grouped[0].quantity).toBe(5);
    expect(grouped[0].members).toHaveLength(2);
    expect(
      groupAlchemyBagMaterials([
        ...split,
        { ...material('c', 2, 99), location: 'storage', slotIndex: null },
      ]),
    ).toEqual(grouped);
    expect(
      groupAlchemyBagMaterials([
        ...split,
        {
          ...material('d', 2, 1),
          instanceData: { ...herb, description: '药性不同' },
        },
      ]),
    ).toHaveLength(2);
    expect(grouped[0]).toMatchObject(herb);
  });
  it('keeps storage rows selectable by their own IDs', () => {
    const storage = [
      {
        ...material('stored-a', 0, 3),
        location: 'storage' as const,
        slotIndex: null,
      },
      {
        ...material('stored-b', 1, 4),
        location: 'storage' as const,
        slotIndex: null,
      },
    ];
    expect(
      groupAlchemyStorageMaterials(storage).map((group) => [
        group.id,
        group.quantity,
      ]),
    ).toEqual([
      ['stored-a', 3],
      ['stored-b', 4],
    ]);
  });
  it('stacks matching materials up to 999 per slot', () => {
    let id = 0;
    const items = addItems(
      [],
      { definitionId: 'material.v1', quantity: 1000, instanceData: herb },
      'bag',
      false,
      () => `material-${id++}`,
    );
    expect(items.map((item) => item.quantity)).toEqual([999, 1]);
    expect(InventoryItemSchema.safeParse(items[0]).success).toBe(true);
    expect(
      InventoryItemSchema.safeParse({ ...items[0], quantity: 1000 }).success,
    ).toBe(false);
  });
  it('preserves visible pill facts through stacking and sorting', () => {
    let id = 0;
    const grant = {
      definitionId: 'consumable.v1',
      quantity: 1020,
      instanceData: pill,
    };
    const items = addItems([], grant, 'bag', true, () => `pill-${id++}`);
    expect(items.map((item) => item.quantity)).toEqual([999, 21]);
    const sorted = sortBag(items);
    expect(sorted.reduce((total, item) => total + item.quantity, 0)).toBe(1020);
    expect(InventoryItemSchema.safeParse(items[0]).success).toBe(true);
    expect(
      InventoryItemSchema.safeParse({ ...items[0], quantity: 1000 }).success,
    ).toBe(false);
    for (const item of sorted) expect(item.instanceData).toEqual(pill);
    expect(ConsumableFactsSchema.parse(pill).spec).toEqual(pill.spec);
    expect(inventoryStackIdentity('consumable.v1', pill)).toBe(
      inventoryStackIdentity('consumable.v1', {
        ...pill,
        description: '另一段描述',
        prompt: '另一段提示词',
      }),
    );
    expect(inventoryStackIdentity('consumable.v1', pill)).not.toBe(
      inventoryStackIdentity('consumable.v1', {
        ...pill,
        score: pill.score + 1,
      }),
    );
    expect(inventoryStackIdentity('consumable.v1', pill)).not.toBe(
      inventoryStackIdentity('consumable.v1', { ...pill, name: '另一种丹药' }),
    );
    expect(inventoryStackIdentity('consumable.v1', pill)).not.toBe(
      inventoryStackIdentity('consumable.v1', {
        ...pill,
        spec: {
          ...pill.spec,
          alchemyMeta: {
            ...('alchemyMeta' in pill.spec ? pill.spec.alchemyMeta : {}),
            toxicityRating: 20,
          },
        },
      }),
    );
    expect(inventoryStackIdentity('consumable.v1', pill)).not.toBe(
      inventoryStackIdentity('consumable.v1', { ...pill, quality: '灵品' }),
    );
  });
  it('uses storage overflow for output and rejects full-bag withdrawal', () => {
    const full = Array.from({ length: BAG_CAPACITY }, (_, i) =>
      material(`m-${i}`, i, 99),
    );
    const grant = {
      definitionId: 'consumable.v1',
      quantity: 2,
      instanceData: pill,
    };
    expect(() => addItems(full, grant, 'bag', false, () => 'pill')).toThrow();
    expect(
      addItems(full, grant, 'bag', true, () => 'pill').at(-1),
    ).toMatchObject({ location: 'storage', quantity: 2, instanceData: pill });
  });
});
