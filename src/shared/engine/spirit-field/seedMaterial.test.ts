import { describe, expect, it } from 'vitest';
import { buildSpiritFieldSeedMaterialFromPlant, readSpiritFieldSeedSpec } from './seedMaterial';
import type { SpiritFieldPlantSnapshot } from './types';

const plant: SpiritFieldPlantSnapshot = {
  id: 'fingerprint-seed', seedName: '霜纹芽核', seedDescription: '淡白芽核表面有一圈霜纹。', clueTexts: ['靠近清露时霜纹会变亮', '暖意过盛时灵机略显沉寂'],
  quality: '玄品', element: '冰', minRealm: '金丹', growthForm: 'shrub', harvestPart: 'fruit',
  preferredMethods: ['shade_dew', 'flower_fruit'], avoidedMethods: ['sun_wake'], preferredHabitats: ['cold', 'shaded'], avoidedHabitats: ['volcanic'], growthTraits: ['dew-seeking'], useTags: ['qi-restoration'], outcomeBiases: ['spirit_fruit'], creationTags: ['Material.Semantic.Freeze'],
  stageDurationMs: { germination: 100_000, nourishing: 100_000, forming: 100_000 }, baseYieldMin: 2, baseYieldMax: 4,
};

describe('spirit seed material', () => {
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
