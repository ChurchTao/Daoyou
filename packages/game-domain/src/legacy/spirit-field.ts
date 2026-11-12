import { ELEMENT_VALUES, type ElementType } from '@daoyou/constants/elements';
import { QUALITY_VALUES, type Quality } from '@daoyou/constants/qualities';
import { REALM_VALUES, type RealmType } from '@daoyou/constants/realms';
import {
  SPIRIT_SEED_GROWTH_FORMS,
  SPIRIT_SEED_HARVEST_PARTS,
} from '../spirit-field/types.js';
import {
  LEGACY_SPIRIT_FIELD_CULTIVATION_METHODS,
  LEGACY_SPIRIT_FIELD_OUTCOME_KINDS,
  LEGACY_SPIRIT_SEED_GROWTH_TRAITS,
  LEGACY_SPIRIT_SEED_HABITAT_TAGS,
  LEGACY_SPIRIT_SEED_USE_TAGS,
  type LegacySpiritFieldPlantSnapshot,
  type LegacySpiritFieldSeedSpec,
} from './spirit-field-types.js';
import { CREATION_MATERIAL_SEMANTIC_TAGS } from './tags/creationTags.js';

function isRecord(value: unknown): value is Record<string, unknown> {
  return Boolean(value && typeof value === 'object' && !Array.isArray(value));
}
function isEnum<T extends string>(
  value: unknown,
  allowed: readonly T[],
): value is T {
  return typeof value === 'string' && allowed.includes(value as T);
}
function enumArray<T extends string>(
  value: unknown,
  allowed: readonly T[],
  max: number,
): T[] | null {
  if (!Array.isArray(value) || value.some((item) => !isEnum(item, allowed)))
    return null;
  return [...new Set(value as T[])].slice(0, max);
}

export function buildLegacySpiritFieldSeedFingerprint(
  plant: LegacySpiritFieldPlantSnapshot,
): string {
  const normalize = (value: unknown): unknown => {
    if (Array.isArray(value)) return value.map(normalize);
    if (value && typeof value === 'object') {
      return Object.keys(value as Record<string, unknown>)
        .sort()
        .reduce<Record<string, unknown>>((result, key) => {
          result[key] = normalize((value as Record<string, unknown>)[key]);
          return result;
        }, {});
    }
    return value;
  };
  const source = JSON.stringify(normalize(plant));
  let hash = 2166136261;
  for (let index = 0; index < source.length; index += 1) {
    hash ^= source.charCodeAt(index);
    hash = Math.imul(hash, 16777619);
  }
  return `seed-v1-${(hash >>> 0).toString(16).padStart(8, '0')}`;
}

export function readLegacySpiritFieldSeedSpec(
  details: unknown,
): LegacySpiritFieldSeedSpec | null {
  if (
    !isRecord(details) ||
    !isRecord(details.seedSpec) ||
    details.seedSpec.version !== 1 ||
    !isRecord(details.seedSpec.plant)
  )
    return null;
  const raw = details.seedSpec;
  const plant = raw.plant as Record<string, unknown>;
  const stageDurationMs = plant.stageDurationMs as Record<string, unknown>;
  const durations = [
    stageDurationMs?.germination,
    stageDurationMs?.nourishing,
    stageDurationMs?.forming,
  ];
  const preferredMethods = enumArray(
    plant.preferredMethods,
    LEGACY_SPIRIT_FIELD_CULTIVATION_METHODS,
    6,
  );
  const avoidedMethods = enumArray(
    plant.avoidedMethods,
    LEGACY_SPIRIT_FIELD_CULTIVATION_METHODS,
    4,
  );
  const preferredHabitats = enumArray(
    plant.preferredHabitats,
    LEGACY_SPIRIT_SEED_HABITAT_TAGS,
    3,
  );
  const avoidedHabitats = enumArray(
    plant.avoidedHabitats,
    LEGACY_SPIRIT_SEED_HABITAT_TAGS,
    2,
  );
  const growthTraits = enumArray(
    plant.growthTraits,
    LEGACY_SPIRIT_SEED_GROWTH_TRAITS,
    4,
  );
  const useTags = enumArray(plant.useTags, LEGACY_SPIRIT_SEED_USE_TAGS, 4);
  const outcomeBiases = enumArray(
    plant.outcomeBiases,
    LEGACY_SPIRIT_FIELD_OUTCOME_KINDS,
    3,
  );
  const creationTags = enumArray(
    plant.creationTags,
    CREATION_MATERIAL_SEMANTIC_TAGS,
    5,
  );
  if (
    typeof raw.fingerprint !== 'string' ||
    typeof plant.id !== 'string' ||
    typeof plant.seedName !== 'string' ||
    typeof plant.seedDescription !== 'string' ||
    !Array.isArray(plant.clueTexts) ||
    plant.clueTexts.some((item) => typeof item !== 'string') ||
    !isEnum(plant.quality, QUALITY_VALUES) ||
    !isEnum(plant.element, ELEMENT_VALUES) ||
    !isEnum(plant.minRealm, REALM_VALUES) ||
    !isEnum(plant.growthForm, SPIRIT_SEED_GROWTH_FORMS) ||
    !isEnum(plant.harvestPart, SPIRIT_SEED_HARVEST_PARTS) ||
    !isRecord(plant.stageDurationMs) ||
    durations.some(
      (value) =>
        typeof value !== 'number' || !Number.isFinite(value) || value < 60_000,
    ) ||
    typeof plant.baseYieldMin !== 'number' ||
    !Number.isFinite(plant.baseYieldMin) ||
    plant.baseYieldMin < 1 ||
    typeof plant.baseYieldMax !== 'number' ||
    !Number.isFinite(plant.baseYieldMax) ||
    plant.baseYieldMax < plant.baseYieldMin ||
    !preferredMethods ||
    !avoidedMethods ||
    !preferredHabitats ||
    !avoidedHabitats ||
    !growthTraits ||
    !useTags ||
    !outcomeBiases ||
    !creationTags
  )
    return null;
  const snapshot: LegacySpiritFieldPlantSnapshot = {
    id: plant.id,
    seedName: plant.seedName,
    seedDescription: plant.seedDescription,
    clueTexts: (plant.clueTexts as string[]).slice(0, 3),
    quality: plant.quality as Quality,
    element: plant.element as ElementType,
    minRealm: plant.minRealm as RealmType,
    growthForm: plant.growthForm,
    harvestPart: plant.harvestPart,
    preferredMethods,
    avoidedMethods,
    preferredHabitats,
    avoidedHabitats,
    growthTraits,
    useTags,
    outcomeBiases,
    creationTags,
    stageDurationMs: {
      germination: Math.max(
        60_000,
        Math.floor(Number(stageDurationMs.germination)),
      ),
      nourishing: Math.max(
        60_000,
        Math.floor(Number(stageDurationMs.nourishing)),
      ),
      forming: Math.max(60_000, Math.floor(Number(stageDurationMs.forming))),
    },
    baseYieldMin: Math.max(1, Math.floor(plant.baseYieldMin)),
    baseYieldMax: Math.max(1, Math.floor(plant.baseYieldMax)),
  };
  if (raw.fingerprint !== buildLegacySpiritFieldSeedFingerprint(snapshot))
    return null;
  return { version: 1, fingerprint: raw.fingerprint, plant: snapshot };
}

export function buildLegacySpiritFieldSeedDetails(
  plant: LegacySpiritFieldPlantSnapshot,
) {
  return {
    seedSpec: {
      version: 1 as const,
      fingerprint: buildLegacySpiritFieldSeedFingerprint(plant),
      plant,
    },
  };
}

export {
  LEGACY_SPIRIT_FIELD_CARE_ACTIONS,
  LEGACY_SPIRIT_FIELD_CULTIVATION_METHODS,
  LEGACY_SPIRIT_FIELD_OUTCOME_KINDS,
  LEGACY_SPIRIT_FIELD_STAGES,
} from './spirit-field-types.js';
export type {
  LegacySpiritFieldCareAction,
  LegacySpiritFieldCultivationMethod,
  LegacySpiritFieldHarvestSettlement,
  LegacySpiritFieldPlantSnapshot,
  LegacySpiritFieldPlotState,
  LegacySpiritFieldSeedSpec,
  LegacySpiritFieldStage,
  LegacySpiritFieldStageAffinity,
  LegacySpiritFieldStageHistory,
} from './spirit-field-types.js';
