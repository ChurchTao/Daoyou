import { ELEMENT_VALUES } from '@daoyou/constants/elements';
import { QUALITY_VALUES } from '@daoyou/constants/qualities';
import { REALM_VALUES } from '@daoyou/constants/realms';
import { z } from 'zod';
import type { Material } from '../cultivator.js';
import { readLegacySpiritFieldSeedSpec } from '../legacy/spirit-field.js';
import {
  SPIRIT_SEED_GROWTH_FORMS,
  SPIRIT_SEED_HARVEST_PARTS,
  type SpiritGardenSeedPlant,
  type SpiritGardenSeedSpec,
  type SpiritSeedSpec,
} from './types.js';

const SpiritGardenSeedPlantSchema = z
  .object({
    id: z.string().min(1).max(160),
    speciesId: z.string().min(1).max(100),
    seedName: z.string().min(1).max(100),
    seedDescription: z.string().max(2000),
    clueTexts: z.array(z.string().max(500)).max(3),
    quality: z.enum(QUALITY_VALUES),
    element: z.enum(ELEMENT_VALUES),
    minRealm: z.enum(REALM_VALUES),
    growthForm: z.enum(SPIRIT_SEED_GROWTH_FORMS),
    harvestPart: z.enum(SPIRIT_SEED_HARVEST_PARTS),
  })
  .strict()
  .refine(
    (plant) => plant.id === `garden-seed:${plant.speciesId}:${plant.quality}`,
    '灵种物种身份与品质不符',
  );
const SpiritGardenSeedSpecSchema = z
  .object({
    version: z.literal(2),
    plant: SpiritGardenSeedPlantSchema,
  })
  .strict();

function seedSpecOf(details: unknown): unknown {
  return details &&
    typeof details === 'object' &&
    !Array.isArray(details) &&
    'seedSpec' in details
    ? details.seedSpec
    : null;
}

/** Current catalog seeds have no hidden cultivation preferences or generated outcomes. */
export function readSpiritGardenSeedSpec(
  details: unknown,
): SpiritGardenSeedSpec | null {
  const parsed = SpiritGardenSeedSpecSchema.safeParse(seedSpecOf(details));
  return parsed.success ? parsed.data : null;
}

/** The v1 branch only reads already-owned assets for their conversion and return paths. */
export function readSpiritSeedSpec(details: unknown): SpiritSeedSpec | null {
  const raw = seedSpecOf(details);
  if (raw && typeof raw === 'object' && 'version' in raw && raw.version === 2)
    return readSpiritGardenSeedSpec(details);
  return readLegacySpiritFieldSeedSpec(details);
}

export function buildSpiritGardenSeedDetails(plant: SpiritGardenSeedPlant) {
  return { seedSpec: SpiritGardenSeedSpecSchema.parse({ version: 2, plant }) };
}
export function buildSpiritGardenSeedMaterialFromPlant(
  plant: SpiritGardenSeedPlant,
  quantity = 1,
): Omit<Material, 'id'> {
  const details = buildSpiritGardenSeedDetails(plant);
  return {
    name: plant.seedName,
    type: 'seed',
    rank: plant.quality,
    element: plant.element,
    description: [plant.seedDescription, ...plant.clueTexts].join('\n'),
    details,
    quantity: Math.max(1, Math.floor(quantity)),
  };
}
