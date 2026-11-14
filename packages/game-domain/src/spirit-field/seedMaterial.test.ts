import { describe, expect, it } from 'vitest';
import { SeedFactsSchema, seedFactsOf } from '../items/seed-facts.js';
import {
  buildLegacySpiritFieldSeedDetails,
  type LegacySpiritFieldPlantSnapshot,
} from '../legacy/spirit-field.js';
import {
  buildSpiritGardenSeedDetails,
  buildSpiritGardenSeedMaterialFromPlant,
  readSpiritGardenSeedSpec,
  readSpiritSeedSpec,
} from './seedMaterial.js';
import type { SpiritGardenSeedPlant } from './types.js';

const plant: SpiritGardenSeedPlant = {
  id: 'garden-seed:licorice:凡品',
  speciesId: 'licorice',
  seedName: '甘草的种子',
  seedDescription: '山野常药。',
  clueTexts: ['成株后有28天有效生产寿命'],
  quality: '凡品',
  element: '木',
  minRealm: '炼气',
  growthForm: 'herb',
  harvestPart: 'root',
};

describe('catalog seed asset facts', () => {
  it('round-trips only catalog identity and display facts without generated cultivation rules', () => {
    const original = structuredClone(plant);
    const material = buildSpiritGardenSeedMaterialFromPlant(plant, 3);
    const spec = readSpiritGardenSeedSpec(material.details);
    expect(material.quantity).toBe(3);
    expect(material.description).toBe('山野常药。\n成株后有28天有效生产寿命');
    expect(spec).toEqual({ version: 2, plant });
    expect(seedFactsOf(material)).toEqual({
      name: plant.seedName,
      seedSpec: spec,
    });
    expect(readSpiritSeedSpec(material.details)).toEqual(spec);
    expect(plant).toEqual(original);
  });

  it('rejects mismatched identities and retired fields in current seeds', () => {
    for (const changed of [
      { ...plant, id: 'garden-seed:licorice:灵品' },
      { ...plant, speciesId: 'other-species' },
      { ...plant, preferredMethods: [] },
      { ...plant, stageDurationMs: { germination: 60_000 } },
    ])
      expect(
        readSpiritSeedSpec({ seedSpec: { version: 2, plant: changed } }),
      ).toBeNull();
    expect(readSpiritSeedSpec({ seedSpec: { version: 3, plant } })).toBeNull();
    expect(() =>
      seedFactsOf({
        ...buildSpiritGardenSeedMaterialFromPlant(plant),
        rank: '神品',
      }),
    ).toThrow();
  });

  it('preserves valid retired assets for conversion without treating them as current seeds', () => {
    const legacy: LegacySpiritFieldPlantSnapshot = {
      id: plant.id,
      seedName: '旧甘草灵种',
      seedDescription: '历史资产原文。',
      clueTexts: [],
      quality: '凡品',
      element: '木',
      minRealm: '炼气',
      growthForm: 'herb',
      harvestPart: 'root',
      preferredMethods: [],
      avoidedMethods: [],
      preferredHabitats: [],
      avoidedHabitats: [],
      growthTraits: [],
      useTags: [],
      outcomeBiases: [],
      creationTags: [],
      stageDurationMs: {
        germination: 60_000,
        nourishing: 60_000,
        forming: 60_000,
      },
      baseYieldMin: 1,
      baseYieldMax: 1,
    };
    const details = buildLegacySpiritFieldSeedDetails(legacy);
    expect(readSpiritSeedSpec(details)).toEqual(details.seedSpec);
    expect(readSpiritGardenSeedSpec(details)).toBeNull();
    expect(SeedFactsSchema.parse({ seedSpec: details.seedSpec }).name).toBe(
      '旧甘草灵种',
    );
    const damaged = structuredClone(details);
    damaged.seedSpec.plant.quality = '神品';
    expect(readSpiritSeedSpec(damaged)).toBeNull();
  });

  it('rejects accidental metadata extensions instead of adding them to current stack facts', () => {
    const details = buildSpiritGardenSeedDetails(plant);
    expect(
      SeedFactsSchema.safeParse({
        seedSpec: { ...details.seedSpec, fingerprint: 'old-format' },
      }).success,
    ).toBe(false);
  });
});
