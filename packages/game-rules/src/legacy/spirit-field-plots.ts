import { QUALITY_VALUES } from '@daoyou/constants/qualities';
import type {
  SpiritGardenSeedReward,
  SpiritGardenState,
} from '@daoyou/game-domain/spirit-field';
import { z } from 'zod';
import {
  createSpiritGarden,
  parseSpiritGardenState,
  SPIRIT_GARDEN_SPECIES,
  SpiritGardenStateSchema,
} from '../spirit-field/garden.js';
import { drawLegacySeedConversion } from './seed-migration.js';

const earlyGardenPlantSchema = z
  .object({
    id: z.string().min(1),
    speciesId: z.string().min(1),
    quality: z.unknown(),
    activeGrowthMs: z.number().int().nonnegative(),
    settledAt: z.number().int().nonnegative(),
    productionMs: z.number().int().nonnegative(),
    storedProductionMs: z.number().int().nonnegative(),
    firstYieldGranted: z.boolean(),
    branch: z.enum(['abundance', 'essence']).nullable(),
    evolved: z.boolean(),
    pending: z.array(z.unknown()),
  })
  .passthrough()
  .refine(
    (plant) =>
      !('productionClockMs' in plant) &&
      !('branchAtProductionMs' in plant) &&
      !('evolutionAttempts' in plant),
  );

/** Early development gardens also contain retired plants, even when garden is non-null. */
export function readPersistedSpiritGarden(
  input: unknown,
  fieldId: string,
): SpiritGardenState {
  const current = SpiritGardenStateSchema.safeParse(input);
  if (current.success) return current.data;
  const raw = z
    .object({
      version: z.literal(2),
      plots: z
        .array(
          z
            .object({
              index: z.number().int().min(0).max(5),
              plant: z.unknown(),
            })
            .passthrough(),
        )
        .length(6),
      collection: z.array(z.unknown()),
      codex: z.array(z.object({ speciesId: z.string() }).passthrough()),
    })
    .passthrough()
    .parse(input);
  const retiredSpecies = new Set<string>();
  const plots = raw.plots.map((plot) => {
    const old = earlyGardenPlantSchema.safeParse(plot.plant);
    if (!old.success) return plot;
    retiredSpecies.add(old.data.speciesId);
    const quality = z.enum(QUALITY_VALUES).safeParse(old.data.quality);
    return {
      index: plot.index,
      plant: null,
      unknownPlant: {
        id: `${fieldId}:unknown:${plot.index}`,
        quality: quality.success ? quality.data : null,
        legacyPlant: structuredClone(old.data),
      },
    };
  });
  if (!retiredSpecies.size) throw current.error;
  const currentSpecies = new Set(
    SPIRIT_GARDEN_SPECIES.map((species) => species.id),
  );
  return parseSpiritGardenState({
    ...raw,
    plots,
    codex: raw.codex.filter(
      (entry) =>
        currentSpecies.has(entry.speciesId) &&
        !retiredSpecies.has(entry.speciesId),
    ),
  });
}

/** Read-only projection: never infer a current species or settle old harvests. */
export function projectLegacySpiritGarden(
  input: unknown,
  fieldId: string,
): SpiritGardenState {
  if (!Array.isArray(input) || (input.length !== 0 && input.length !== 6))
    throw new Error('旧灵田数据无效，请联系管理员核对');
  const state = createSpiritGarden();
  for (let index = 0; index < input.length; index++) {
    const raw = z
      .object({
        index: z.literal(index),
        plantId: z.unknown(),
        plant: z.unknown(),
      })
      .parse(input[index]);
    if (raw.plant === null && raw.plantId === null) continue;
    const quality = z
      .object({ quality: z.enum(QUALITY_VALUES) })
      .safeParse(raw.plant);
    state.plots[index]!.unknownPlant = {
      id: `${fieldId}:unknown:${index}`,
      quality: quality.success ? quality.data.quality : null,
    };
  }
  return state;
}

export function uprootLegacySpiritGardenPlant(
  state: SpiritGardenState,
  plotIndex: number,
  plantId: string,
  random: () => number,
): { state: SpiritGardenState; seed: SpiritGardenSeedReward } {
  const unknown = state.plots[plotIndex]?.unknownPlant;
  if (!unknown || unknown.id !== plantId)
    throw new Error('灵植已经变化，请重新查看灵田');
  if (!unknown.quality) throw new Error('旧灵植品质异常，请联系管理员核对');
  const [seed] = drawLegacySeedConversion(unknown.quality, 1, random);
  return {
    state: {
      ...state,
      plots: state.plots.map((plot) =>
        plot.index === plotIndex ? { index: plot.index, plant: null } : plot,
      ),
    },
    seed: { ...seed!, quantity: 1 },
  };
}
