import {
  buildLegacySpiritFieldSeedDetails,
  type LegacySpiritFieldPlantSnapshot,
} from '@daoyou/game-domain/legacy/spirit-field';

/** Historical asset facts for conversion and retained-plot tests, never runtime generation. */
export const legacySeedPlant: LegacySpiritFieldPlantSnapshot = {
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

export function legacySeedMaterial(plant = legacySeedPlant, quantity = 1) {
  return {
    name: plant.seedName,
    type: 'seed' as const,
    rank: plant.quality,
    element: plant.element,
    description: plant.seedDescription,
    details: buildLegacySpiritFieldSeedDetails(plant),
    quantity,
  };
}
