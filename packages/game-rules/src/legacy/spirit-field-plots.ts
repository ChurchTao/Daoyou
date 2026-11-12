import { QUALITY_VALUES, type Quality } from '@daoyou/constants/qualities';
import {
  LEGACY_SPIRIT_FIELD_CULTIVATION_METHODS,
  buildLegacySpiritFieldSeedDetails,
  readLegacySpiritFieldSeedSpec,
  type LegacySpiritFieldHarvestSettlement as SpiritFieldHarvestSettlement,
  type LegacySpiritFieldPlotState as SpiritFieldPlotState,
} from '@daoyou/game-domain/legacy/spirit-field';
import {
  readSpiritGardenSeedSpec,
  type SpiritGardenPlant,
  type SpiritGardenProduct,
  type SpiritGardenState,
} from '@daoyou/game-domain/spirit-field';
import { z } from 'zod';
import {
  buildSpiritGardenSeed,
  createSpiritGarden,
  getSpiritGardenSeedCandidates,
  getSpiritGardenSpecies,
  plantSpiritGardenSeed,
  settleSpiritGarden,
} from '../spirit-field/garden.js';

type SpiritFieldOutcomeKind = SpiritFieldHarvestSettlement['outcomeKind'];

/** Only the published short-term plot archive uses this one-time settlement. */
function isLegacyPlotReady(plot: SpiritFieldPlotState, nowMs: number): boolean {
  return (
    plot.stageIndex === 2 &&
    plot.stageStartedAt !== null &&
    plot.stageEndsAt !== null &&
    nowMs >= Date.parse(plot.stageEndsAt)
  );
}

function deterministicUnit(seed: string): number {
  let hash = 2166136261;
  for (let index = 0; index < seed.length; index += 1) {
    hash ^= seed.charCodeAt(index);
    hash = Math.imul(hash, 16777619);
  }
  return (hash >>> 0) / 4294967296;
}

function adjacentQuality(quality: Quality, delta: -1 | 1): Quality {
  const index = QUALITY_VALUES.indexOf(quality);
  return QUALITY_VALUES[
    Math.max(0, Math.min(QUALITY_VALUES.length - 1, index + delta))
  ]!;
}
function chooseOutcome(
  weights: Record<SpiritFieldOutcomeKind, number>,
  seed: string,
): SpiritFieldOutcomeKind {
  const entries = Object.entries(weights) as Array<
    [SpiritFieldOutcomeKind, number]
  >;
  const total = entries.reduce(
    (sum, [, weight]) => sum + Math.max(0, weight),
    0,
  );
  let cursor = deterministicUnit(`${seed}:outcome`) * total;
  for (const [kind, weight] of entries) {
    cursor -= Math.max(0, weight);
    if (cursor <= 0) return kind;
  }
  return 'herb';
}

function settleLegacyHarvest(
  plot: SpiritFieldPlotState,
  seed: string,
): SpiritFieldHarvestSettlement {
  const plant = plot.plant;
  if (!plant) throw new Error('空田不可结算');
  const score =
    plot.history.length > 0
      ? Math.round(
          plot.history.reduce((sum, item) => sum + item.score, 0) /
            plot.history.length,
        )
      : 50;
  const weights: Record<SpiritFieldOutcomeKind, number> = {
    herb: 3,
    tcdb: 1,
    spirit_fruit: 1,
  };
  for (const bias of plant.outcomeBiases) weights[bias] += 2;
  const formingMethod = plot.history.find(
    (item) => item.stage === 'forming',
  )?.method;
  if (formingMethod === 'leaf_medicine') weights.herb += 7;
  if (formingMethod === 'flower_fruit') weights.spirit_fruit += 7;
  if (formingMethod === 'return_treasure') weights.tcdb += 7;
  const outcomeKind = chooseOutcome(weights, seed);
  const mutationRoll = deterministicUnit(`${seed}:quality`);
  const mutated =
    score >= 85 && mutationRoll < 0.28 && plant.quality !== '神品';
  const degraded =
    score < 48 && mutationRoll < 0.55 && plant.quality !== '凡品';
  const quality = mutated
    ? adjacentQuality(plant.quality, 1)
    : degraded
      ? adjacentQuality(plant.quality, -1)
      : plant.quality;
  const span = plant.baseYieldMax - plant.baseYieldMin + 1;
  const baseQuantity =
    plant.baseYieldMin +
    Math.floor(deterministicUnit(`${seed}:quantity`) * span);
  const scoreMultiplier =
    score >= 90 ? 1.25 : score >= 72 ? 1.1 : score < 48 ? 0.75 : 1;
  const quantity =
    outcomeKind === 'herb'
      ? Math.max(1, Math.round(baseQuantity * scoreMultiplier))
      : outcomeKind === 'spirit_fruit'
        ? Math.max(
            1,
            Math.min(3, Math.round((baseQuantity / 2) * scoreMultiplier)),
          )
        : Math.max(
            1,
            Math.min(2, Math.round((baseQuantity / 3) * scoreMultiplier)),
          );
  const fruitFamily = plant.useTags.includes('beast-nurturing')
    ? 'beast_cultivation'
    : plant.useTags.includes('longevity')
      ? 'longevity'
      : plant.useTags.includes('marrow-wash')
        ? 'marrow_wash'
        : plant.useTags.includes('breakthrough')
          ? 'breakthrough'
          : plant.useTags.includes('body-tempering')
            ? 'tempering'
            : plant.useTags.includes('detox')
              ? 'detox'
              : plant.useTags.includes('qi-restoration')
                ? 'mana'
                : plant.useTags.includes('healing')
                  ? 'healing'
                  : plant.useTags.includes('spirit-nourishing')
                    ? 'insight'
                    : 'cultivation';
  return {
    outcomeKind,
    quality,
    quantity,
    score,
    mutated,
    degraded,
    fruitFamily,
  };
}

/** Migrate once at the host's transaction time; never backfill years of passive production. */
export function migrateLegacySpiritGarden(
  input: unknown,
  nowMs: number,
  fieldId = 'legacy',
): SpiritGardenState {
  if (!Array.isArray(input) || (input.length !== 0 && input.length !== 6))
    throw new Error('旧灵田数据无效，无法安全迁移');
  let state = createSpiritGarden();
  for (let index = 0; index < input.length; index += 1) {
    const raw = input[index] as Partial<SpiritFieldPlotState> | null;
    if (!raw || raw.index !== index || !('plant' in raw))
      throw new Error('旧灵田田块数据无效');
    if (raw.plant === null) {
      if (raw.plantId !== null)
        throw new Error('旧灵田存在无法识别的灵植，无法安全迁移');
      continue;
    }
    if (!raw.plant || raw.plantId !== raw.plant.id)
      throw new Error('旧灵植身份不一致，无法安全迁移');
    const validSeed = readLegacySpiritFieldSeedSpec(
      buildLegacySpiritFieldSeedDetails(raw.plant!),
    );
    if (!validSeed) throw new Error('旧灵植生长事实无效，无法安全迁移');
    const history = z
      .array(
        z.object({
          stage: z.enum(['germination', 'nourishing', 'forming']),
          method: z.enum(LEGACY_SPIRIT_FIELD_CULTIVATION_METHODS),
          affinity: z.enum(['excellent', 'good', 'neutral', 'strained']),
          score: z.number().int().min(0).max(100),
          feedback: z.string(),
          resourceName: z.string().optional(),
          completedAt: z.string(),
        }),
      )
      .max(3)
      .parse(raw.history);
    if (
      !Number.isInteger(raw.stageIndex) ||
      raw.stageIndex! < 0 ||
      raw.stageIndex! > 2
    )
      throw new Error('旧灵植阶段无效');
    for (const value of [raw.stageStartedAt, raw.stageEndsAt, raw.plantedAt])
      if (
        value !== null &&
        (typeof value !== 'string' || !Number.isFinite(Date.parse(value)))
      )
        throw new Error('旧灵植时间无效');
    const plot = {
      ...raw,
      plant: validSeed.plant,
      history,
    } as SpiritFieldPlotState;
    const id = `${validSeed.plant.id}:${index}`;
    // This one-time plot migration does not make old inventory seeds plantable.
    const candidates = getSpiritGardenSeedCandidates(validSeed.plant.quality);
    const species =
      candidates.find(
        (entry) =>
          validSeed.plant.id ===
          `garden-seed:${entry.id}:${validSeed.plant.quality}`,
      ) ??
      candidates.find(
        (entry) =>
          validSeed.plant.seedName === `${entry.name}的种子` ||
          validSeed.plant.seedName === `${entry.name}籽` ||
          validSeed.plant.seedName === entry.name,
      ) ??
      candidates.find((entry) => entry.element === validSeed.plant.element) ??
      candidates[0]!;
    const currentSeed = readSpiritGardenSeedSpec(
      buildSpiritGardenSeed(species.id, species.quality).details,
    )!.plant;
    state = plantSpiritGardenSeed(state, index, currentSeed, id, '渡劫', nowMs);
    const plant = state.plots[index]!.plant!;
    const start = plot.stageStartedAt ? Date.parse(plot.stageStartedAt) : nowMs;
    const end = plot.stageEndsAt ? Date.parse(plot.stageEndsAt) : nowMs;
    const progress =
      plot.stageStartedAt && plot.stageEndsAt
        ? Math.max(0, Math.min(1, (nowMs - start) / Math.max(1, end - start)))
        : 0;
    const ready = isLegacyPlotReady(plot, nowMs);
    const activeGrowthMs = Math.round(
      species.matureMs * ((plot.stageIndex + progress) / 3),
    );
    let migrated: SpiritGardenPlant = {
      ...plant,
      seedName: validSeed.plant.seedName,
      activeGrowthMs: ready ? species.matureMs : activeGrowthMs,
    };
    if (ready) {
      const old = settleLegacyHarvest(
        plot,
        `${fieldId}:${index}:${plot.plantedAt}:${plot.plant!.id}`,
      );
      const product: SpiritGardenProduct = {
        speciesId: plant.speciesId,
        name: `${getSpiritGardenSpecies(plant.speciesId).name}${old.outcomeKind === 'spirit_fruit' ? '留存灵果' : old.outcomeKind === 'tcdb' ? '留存灵华' : '留存灵材'}`,
        description: '旧灵田成熟作物迁移保留的收成。',
        element: plot.plant!.element,
        kind: old.outcomeKind,
        quality: old.quality,
        quantity: old.quantity,
        ...(old.outcomeKind === 'spirit_fruit'
          ? { fruitFamily: old.fruitFamily! }
          : {}),
      };
      migrated = { ...migrated, firstYieldGranted: true, pending: [product] };
    }
    state = {
      ...state,
      plots: state.plots.map((plot) =>
        plot.index === index ? { ...plot, plant: migrated } : plot,
      ),
    };
  }
  return settleSpiritGarden(state, nowMs);
}
