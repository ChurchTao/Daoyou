import { describe, expect, it } from 'vitest';
import { addItems, InventoryItemSchema } from '../../inventory/index.js';
import { inventoryStackIdentity } from '../../inventory/stack-key.js';
import { seedFactsOf, SeedFactsSchema } from '../../items/definitions/seeds.js';
import {
  buildSpiritFieldSeedMaterialFromPlant,
  readSpiritFieldSeedSpec,
} from './seedMaterial.js';
import type { SpiritFieldPlantSnapshot } from './types.js';

const plant: SpiritFieldPlantSnapshot = {
  id: 'fingerprint-seed',
  seedName: '霜纹芽核',
  seedDescription: '淡白芽核表面有一圈霜纹。',
  clueTexts: ['靠近清露时霜纹会变亮', '暖意过盛时灵机略显沉寂'],
  quality: '玄品',
  element: '冰',
  minRealm: '金丹',
  growthForm: 'shrub',
  harvestPart: 'fruit',
  preferredMethods: ['shade_dew', 'flower_fruit'],
  avoidedMethods: ['sun_wake'],
  preferredHabitats: ['cold', 'shaded'],
  avoidedHabitats: ['volcanic'],
  growthTraits: ['dew-seeking'],
  useTags: ['qi-restoration'],
  outcomeBiases: ['spirit_fruit'],
  creationTags: ['Material.Semantic.Freeze'],
  stageDurationMs: {
    germination: 100_000,
    nourishing: 100_000,
    forming: 100_000,
  },
  baseYieldMin: 2,
  baseYieldMax: 4,
};

describe('spirit seed material', () => {
  it('keeps distinct growing facts apart while identical seeds stack', () => {
    const facts = seedFactsOf(buildSpiritFieldSeedMaterialFromPlant(plant));
    const changed = seedFactsOf(
      buildSpiritFieldSeedMaterialFromPlant({ ...plant, baseYieldMax: 8 }),
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
      SeedFactsSchema.parse(separate[1].instanceData).seedSpec.plant
        .baseYieldMax,
    ).toBe(8);
  });
  it('rejects invalid seed snapshots instead of inventing growing facts', () => {
    const material = buildSpiritFieldSeedMaterialFromPlant(plant);
    expect(() => seedFactsOf({ ...material, rank: '凡品' })).toThrow();
    expect(() => seedFactsOf({ ...material, details: {} })).toThrow();
  });
  it('stacks identical seeds up to 999 per slot', () => {
    const facts = seedFactsOf(buildSpiritFieldSeedMaterialFromPlant(plant));
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
    const material = buildSpiritFieldSeedMaterialFromPlant(plant, 2);
    expect(material.type).toBe('seed');
    const spec = readSpiritFieldSeedSpec(material.details);
    expect(spec?.plant.seedName).toBe(plant.seedName);
    expect(spec?.fingerprint).toMatch(/^seed-v1-/);
  });

  it('rejects tampered hidden traits', () => {
    const material = buildSpiritFieldSeedMaterialFromPlant(plant);
    const details = structuredClone(material.details) as {
      seedSpec: { plant: { outcomeBiases: string[] } };
    };
    details.seedSpec.plant.outcomeBiases = ['tcdb'];
    expect(readSpiritFieldSeedSpec(details)).toBeNull();
  });
});
