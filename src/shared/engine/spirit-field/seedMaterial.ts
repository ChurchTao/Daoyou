import {
  ELEMENT_VALUES,
  QUALITY_VALUES,
  REALM_VALUES,
  type ElementType,
  type Quality,
  type RealmType,
} from '@shared/types/constants';
import type { Material } from '@shared/types/cultivator';
import {
  SPIRIT_SEED_CARE_STYLE_TAGS,
  SPIRIT_SEED_GROWTH_FORMS,
  SPIRIT_SEED_HABITAT_TAGS,
  SPIRIT_SEED_HARVEST_PARTS,
  SPIRIT_SEED_USE_TAGS,
  type SpiritFieldPlantSnapshot,
  type SpiritFieldSeedSpecV2,
  type SpiritSeedCareStyleTag,
  type SpiritSeedGrowthForm,
  type SpiritSeedHabitatTag,
  type SpiritSeedHarvestPart,
  type SpiritSeedUseTag,
} from './types';

function isRecord(value: unknown): value is Record<string, unknown> {
  return Boolean(value && typeof value === 'object' && !Array.isArray(value));
}

function isQuality(value: unknown): value is Quality {
  return typeof value === 'string' && QUALITY_VALUES.includes(value as Quality);
}

function isElement(value: unknown): value is ElementType {
  return typeof value === 'string' && ELEMENT_VALUES.includes(value as ElementType);
}

function isRealm(value: unknown): value is RealmType {
  return typeof value === 'string' && REALM_VALUES.includes(value as RealmType);
}

function enumOrDefault<T extends string>(
  value: unknown,
  allowed: readonly T[],
  fallback: T,
): T {
  return typeof value === 'string' && allowed.includes(value as T)
    ? (value as T)
    : fallback;
}

function enumArray<T extends string>(
  value: unknown,
  allowed: readonly T[],
  fallback: readonly T[],
  max = 3,
): T[] {
  if (!Array.isArray(value)) return [...fallback];
  const next = value.filter(
    (item): item is T => typeof item === 'string' && allowed.includes(item as T),
  );
  return [...new Set(next)].slice(0, max).length > 0
    ? [...new Set(next)].slice(0, max)
    : [...fallback];
}

export function readSpiritFieldSeedSpec(details: unknown): SpiritFieldSeedSpecV2 | null {
  if (!isRecord(details)) return null;
  const rawSeed = details.spiritFieldSeed;
  if (!isRecord(rawSeed) || rawSeed.version !== 2 || !isRecord(rawSeed.plant)) {
    return null;
  }
  const plant = rawSeed.plant;
  if (
    typeof plant.id !== 'string' ||
    typeof plant.name !== 'string' ||
    typeof plant.seedName !== 'string' ||
    !isQuality(plant.quality) ||
    !isElement(plant.element) ||
    !isRealm(plant.minRealm) ||
    typeof plant.baseGrowthMs !== 'number' ||
    typeof plant.careSlots !== 'number' ||
    typeof plant.careCooldownMs !== 'number' ||
    typeof plant.description !== 'string' ||
    typeof plant.baseYieldMin !== 'number' ||
    typeof plant.baseYieldMax !== 'number'
  ) {
    return null;
  }

  const growthForm = enumOrDefault<SpiritSeedGrowthForm>(
    plant.growthForm,
    SPIRIT_SEED_GROWTH_FORMS,
    'herb',
  );
  const harvestPart = enumOrDefault<SpiritSeedHarvestPart>(
    plant.harvestPart,
    SPIRIT_SEED_HARVEST_PARTS,
    growthForm === 'root' ? 'root' : growthForm === 'fungus' ? 'whole' : 'leaf',
  );

  return {
    version: 2,
    plant: {
      id: plant.id,
      name: plant.name,
      seedName: plant.seedName,
      quality: plant.quality,
      element: plant.element,
      minRealm: plant.minRealm,
      baseGrowthMs: Math.max(60_000, Math.floor(plant.baseGrowthMs)),
      careSlots: Math.max(1, Math.floor(plant.careSlots)),
      careCooldownMs: Math.max(0, Math.floor(plant.careCooldownMs)),
      description: plant.description,
      seedDescription:
        typeof plant.seedDescription === 'string'
          ? plant.seedDescription
          : `${plant.name}的种体，内蕴尚未舒展的灵机，可播入个人灵田。`,
      appearance:
        typeof plant.appearance === 'string'
          ? plant.appearance
          : '枝叶间可见淡淡灵光，形态会随生长逐渐舒展。',
      matureSign:
        typeof plant.matureSign === 'string'
          ? plant.matureSign
          : '成熟时灵光由散转凝，主要采收部位会出现明显变化。',
      growthForm,
      harvestPart,
      habitatTags: enumArray<SpiritSeedHabitatTag>(
        plant.habitatTags,
        SPIRIT_SEED_HABITAT_TAGS,
        ['mountain'],
      ),
      careStyleTags: enumArray<SpiritSeedCareStyleTag>(
        plant.careStyleTags,
        SPIRIT_SEED_CARE_STYLE_TAGS,
        ['qi-sensitive'],
      ),
      useTags: enumArray<SpiritSeedUseTag>(
        plant.useTags,
        SPIRIT_SEED_USE_TAGS,
        ['alchemy'],
      ),
      baseYieldMin: Math.max(1, Math.floor(plant.baseYieldMin)),
      baseYieldMax: Math.max(
        Math.max(1, Math.floor(plant.baseYieldMin)),
        Math.floor(plant.baseYieldMax),
      ),
    },
  };
}

export function isSpiritFieldSeedMaterial(material: {
  details?: unknown;
}): boolean {
  return readSpiritFieldSeedSpec(material.details) !== null;
}

export function buildSpiritFieldSeedDetails(plant: SpiritFieldPlantSnapshot) {
  return {
    spiritFieldSeed: {
      version: 2 as const,
      plant,
    },
  };
}

export function buildSpiritFieldSeedMaterialFromPlant(
  plant: SpiritFieldPlantSnapshot,
  quantity = 1,
): Omit<Material, 'id'> {
  return {
    name: plant.seedName,
    type: 'aux',
    rank: plant.quality,
    element: plant.element,
    description: plant.seedDescription,
    details: buildSpiritFieldSeedDetails(plant),
    quantity: Math.max(1, Math.floor(quantity)),
  };
}
