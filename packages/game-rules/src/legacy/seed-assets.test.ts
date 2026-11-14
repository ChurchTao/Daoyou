import { seedFactsOf, SeedFactsSchema } from '@daoyou/game-domain/inventory';
import { readLegacySpiritFieldSeedSpec } from '@daoyou/game-domain/legacy/spirit-field';
import { describe, expect, it } from 'vitest';
import { addItems, InventoryItemSchema } from '../inventory/index.js';
import { inventoryStackIdentity } from '../inventory/stack-key.js';
import {
  legacySeedMaterial,
  legacySeedPlant as plant,
} from './seed-fixtures.js';

describe('historical seed asset reading', () => {
  it('keeps distinct growing facts apart while identical seeds stack', () => {
    const facts = seedFactsOf(legacySeedMaterial(plant));
    const changed = seedFactsOf(
      legacySeedMaterial({ ...plant, baseYieldMax: 8 }),
    );
    expect(inventoryStackIdentity('seed.v1', facts)).not.toBe(
      inventoryStackIdentity('seed.v1', changed),
    );
    let id = 0;
    const grant = { definitionId: 'seed.v1', quantity: 2, instanceData: facts };
    const first = addItems(
      [],
      grant,
      'bag',
      true,
      () => `seed-${++id}`,
      inventoryStackIdentity('seed.v1', facts),
    );
    const stacked = addItems(
      first,
      grant,
      'bag',
      true,
      () => `seed-${++id}`,
      inventoryStackIdentity('seed.v1', facts),
    );
    expect(stacked).toHaveLength(1);
    expect(stacked[0].quantity).toBe(4);
    const separate = addItems(
      stacked,
      { ...grant, instanceData: changed },
      'bag',
      true,
      () => `seed-${++id}`,
      inventoryStackIdentity('seed.v1', changed),
    );
    expect(separate).toHaveLength(2);
    expect(
      SeedFactsSchema.parse(separate[1].instanceData).seedSpec.plant,
    ).toMatchObject({ baseYieldMax: 8 });
  });
  it('rejects invalid seed snapshots instead of inventing growing facts', () => {
    const material = legacySeedMaterial(plant);
    expect(() => seedFactsOf({ ...material, rank: '凡品' })).toThrow();
    expect(() => seedFactsOf({ ...material, details: {} })).toThrow();
  });
  it('stacks identical seeds up to 999 per slot', () => {
    const facts = seedFactsOf(legacySeedMaterial(plant));
    let id = 0;
    const items = addItems(
      [],
      { definitionId: 'seed.v1', quantity: 1000, instanceData: facts },
      'bag',
      false,
      () => `seed-${++id}`,
      inventoryStackIdentity('seed.v1', facts),
    );
    expect(items.map((item) => item.quantity)).toEqual([999, 1]);
    expect(InventoryItemSchema.safeParse(items[0]).success).toBe(true);
    expect(
      InventoryItemSchema.safeParse({ ...items[0], quantity: 1000 }).success,
    ).toBe(false);
  });
  it('uses the global seed type and round-trips a stable fingerprint', () => {
    const material = legacySeedMaterial(plant, 2);
    expect(material.type).toBe('seed');
    const spec = readLegacySpiritFieldSeedSpec(material.details);
    expect(spec?.plant.seedName).toBe(plant.seedName);
    expect(spec?.fingerprint).toMatch(/^seed-v1-/);
  });

  it('rejects tampered hidden traits', () => {
    const material = legacySeedMaterial(plant);
    const details = structuredClone(material.details) as {
      seedSpec: { plant: { outcomeBiases: string[] } };
    };
    details.seedSpec.plant.outcomeBiases = ['tcdb'];
    expect(readLegacySpiritFieldSeedSpec(details)).toBeNull();
  });
});
