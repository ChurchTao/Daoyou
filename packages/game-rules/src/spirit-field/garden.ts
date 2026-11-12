import { ELEMENT_VALUES, type ElementType } from '@daoyou/constants/elements';
import {
  QUALITY_ORDER,
  QUALITY_VALUES,
  type Quality,
} from '@daoyou/constants/qualities';
import { REALM_ORDER, type RealmType } from '@daoyou/constants/realms';
import { BASE_PRICES } from '@daoyou/game-content/materials';
import {
  SPIRIT_GARDEN_BRANCH_QI_COSTS,
  SPIRIT_GARDEN_CLEAR_SEED_CHANCE,
  SPIRIT_GARDEN_COLLECTION_LIMIT,
  SPIRIT_GARDEN_EVOLUTION_ATTEMPT_LIMIT,
  SPIRIT_GARDEN_EVOLUTION_COOLDOWN_MS,
  SPIRIT_GARDEN_EVOLUTION_QI_COSTS,
  SPIRIT_GARDEN_EVOLUTION_STONE_RATIO,
  SPIRIT_GARDEN_EVOLUTION_SUCCESS_CHANCES,
  SPIRIT_GARDEN_INCIDENT_INTERVAL_MS,
  SPIRIT_GARDEN_MATURE_QI_COSTS,
  SPIRIT_GARDEN_MIN_REALM,
  SPIRIT_GARDEN_OFFLINE_CAP_MS,
  SPIRIT_GARDEN_PEST_RECOVERY_MS,
  SPIRIT_GARDEN_PRODUCTION_BY_QUALITY,
  SPIRIT_GARDEN_PRODUCTION_LIFETIME_MS,
  SPIRIT_GARDEN_SPECIES,
} from '@daoyou/game-content/spirit-field/config';
import type { Material } from '@daoyou/game-domain/character';
import { PILL_FAMILY_VALUES } from '@daoyou/game-domain/consumables';
import {
  SPIRIT_GARDEN_BRANCHES,
  SpiritGardenFruitEffectsSchema,
  buildSpiritGardenSeedMaterialFromPlant,
  type SpiritGardenBranch,
  type SpiritGardenCodexEntry,
  type SpiritGardenOutput,
  type SpiritGardenPlant,
  type SpiritGardenPlantView,
  type SpiritGardenProduct,
  type SpiritGardenSeedPlant,
  type SpiritGardenSeedReward,
  type SpiritGardenSpeciesId,
  type SpiritGardenState,
  type SpiritSeedPlant,
} from '@daoyou/game-domain/spirit-field';
import { z } from 'zod';
import {
  isSpiritGardenMutated,
  recordSpiritGardenIncident,
  spiritGardenProductionRate,
} from './garden-incidents.js';

export {
  SPIRIT_GARDEN_COLLECTION_LIMIT,
  SPIRIT_GARDEN_OFFLINE_CAP_MS,
  SPIRIT_GARDEN_PRODUCTION_LIFETIME_MS,
  SPIRIT_GARDEN_SPECIES,
};

const speciesIdSchema = z.enum(
  SPIRIT_GARDEN_SPECIES.map((species) => species.id),
);
const nonnegative = z.number().int().nonnegative().max(Number.MAX_SAFE_INTEGER);
const productSchema = z
  .object({
    speciesId: speciesIdSchema,
    name: z.string().min(1).max(100),
    description: z.string().max(500),
    element: z.enum(ELEMENT_VALUES),
    kind: z.enum(['herb', 'tcdb', 'spirit_fruit']),
    fruitFamily: z.enum(PILL_FAMILY_VALUES).optional(),
    fruitEffects: SpiritGardenFruitEffectsSchema.optional(),
    quality: z.enum(QUALITY_VALUES),
    quantity: z.number().int().min(1).max(10000),
  })
  .strict()
  .refine(
    (product) =>
      product.kind === 'spirit_fruit'
        ? Boolean(product.fruitFamily) !== Boolean(product.fruitEffects)
        : product.fruitFamily === undefined &&
          product.fruitEffects === undefined,
    '灵果用途与产物类型不符',
  );
const plantSchema = z
  .object({
    id: z.string().min(1).max(160),
    speciesId: speciesIdSchema,
    seedName: z.string().min(1).max(100),
    quality: z.enum(QUALITY_VALUES),
    activeGrowthMs: nonnegative,
    settledAt: nonnegative,
    productionMs: nonnegative,
    productionBonusRemainder: z.number().int().min(0).max(9).default(0),
    storedProductionMs: nonnegative.max(SPIRIT_GARDEN_PRODUCTION_LIFETIME_MS),
    productionUsedMs: nonnegative
      .max(SPIRIT_GARDEN_PRODUCTION_LIFETIME_MS)
      .default(0),
    productionClockMs: nonnegative.max(SPIRIT_GARDEN_PRODUCTION_LIFETIME_MS),
    incidents: z
      .array(
        z
          .object({
            kind: z.enum(['pests', 'beast', 'mutation']),
            productionDay: z.number().int().min(1).max(27),
            occurredAt: nonnegative,
            seedSpeciesId: speciesIdSchema.nullable(),
          })
          .strict(),
      )
      .max(3)
      .default([]),
    recoveryRemainingMs: nonnegative
      .max(SPIRIT_GARDEN_PEST_RECOVERY_MS)
      .default(0),
    pendingSeedSpeciesId: speciesIdSchema.nullable().default(null),
    firstYieldGranted: z.boolean(),
    branch: z.enum(SPIRIT_GARDEN_BRANCHES).nullable(),
    branchAtProductionMs: nonnegative
      .max(SPIRIT_GARDEN_PRODUCTION_LIFETIME_MS)
      .nullable(),
    evolved: z.boolean(),
    evolutionAttempts: z
      .array(
        z
          .object({
            atProductionMs: nonnegative.max(
              SPIRIT_GARDEN_PRODUCTION_LIFETIME_MS,
            ),
            succeeded: z.boolean(),
          })
          .strict(),
      )
      .max(SPIRIT_GARDEN_EVOLUTION_ATTEMPT_LIMIT),
    pending: z.array(productSchema).max(8),
  })
  .strict()
  .refine(
    (plant) =>
      !plant.evolved || (plant.branch !== null && plant.quality !== '神品'),
    '灵植蜕变状态无效',
  );
const codexSchema = z
  .object({
    speciesId: speciesIdSchema,
    matured: z.boolean(),
    branches: z.array(z.enum(SPIRIT_GARDEN_BRANCHES)).max(2),
    evolved: z.boolean(),
  })
  .strict();
export const SpiritGardenStateSchema = z
  .object({
    version: z.literal(2),
    plots: z
      .array(
        z
          .object({
            index: z.number().int().min(0).max(5),
            plant: plantSchema.nullable(),
          })
          .strict(),
      )
      .length(6),
    // Keep up to the former 24 stored plants readable; new archives use the current cap.
    collection: z
      .array(plantSchema)
      .max(Math.max(24, SPIRIT_GARDEN_COLLECTION_LIMIT)),
    codex: z.array(codexSchema).max(SPIRIT_GARDEN_SPECIES.length),
  })
  .strict()
  .superRefine((state, ctx) => {
    if (state.plots.some((plot, index) => plot.index !== index))
      ctx.addIssue({ code: 'custom', message: '灵田田块次序无效' });
    const plants = [
      ...state.plots.flatMap((plot) => (plot.plant ? [plot.plant] : [])),
      ...state.collection,
    ];
    if (new Set(plants.map((plant) => plant.id)).size !== plants.length)
      ctx.addIssue({ code: 'custom', message: '灵植身份重复' });
    if (
      new Set(state.codex.map((entry) => entry.speciesId)).size !==
      state.codex.length
    )
      ctx.addIssue({ code: 'custom', message: '灵植图录重复' });
    for (const plant of plants) {
      const species = getSpiritGardenSpecies(plant.speciesId);
      if (species.quality !== plant.quality) {
        ctx.addIssue({ code: 'custom', message: '灵植物种与品质不符' });
        continue;
      }
      const output = getSpiritGardenOutput(plant);
      if (
        plant.storedProductionMs > storageCapacity(plant) ||
        plant.productionMs >= output.cycleMs ||
        plant.productionMs * 10 + plant.productionBonusRemainder >
          plant.storedProductionMs * spiritGardenProductionRate(plant)
      )
        ctx.addIssue({ code: 'custom', message: '灵植生产进度无效' });
      const growth = times(plant);
      const latestAttempt = plant.evolutionAttempts.at(-1);
      if (
        plant.productionClockMs > plant.productionUsedMs ||
        plant.activeGrowthMs > growth.matureMs + plant.productionUsedMs ||
        (plant.firstYieldGranted && plant.activeGrowthMs < growth.matureMs) ||
        (!plant.firstYieldGranted &&
          (plant.activeGrowthMs > growth.matureMs ||
            plant.productionUsedMs !== 0 ||
            plant.productionClockMs !== 0 ||
            plant.productionMs !== 0 ||
            plant.productionBonusRemainder !== 0 ||
            plant.storedProductionMs !== 0 ||
            plant.pending.length !== 0 ||
            plant.pendingSeedSpeciesId !== null ||
            plant.incidents.length !== 0 ||
            plant.recoveryRemainingMs !== 0 ||
            plant.branch !== null ||
            plant.evolutionAttempts.length !== 0)) ||
        (plant.branch === null) !== (plant.branchAtProductionMs === null) ||
        (plant.branchAtProductionMs !== null &&
          (!plant.firstYieldGranted ||
            plant.branchAtProductionMs < growth.branchMs ||
            plant.branchAtProductionMs > plant.productionUsedMs)) ||
        plant.evolved !== Boolean(latestAttempt?.succeeded) ||
        (plant.quality === '神品' && plant.evolutionAttempts.length !== 0) ||
        plant.evolutionAttempts.some(
          (attempt, index) =>
            plant.branchAtProductionMs === null ||
            attempt.atProductionMs <
              plant.branchAtProductionMs + growth.evolveMs ||
            attempt.atProductionMs > plant.productionUsedMs ||
            (index > 0 &&
              (plant.evolutionAttempts[index - 1]!.succeeded ||
                attempt.atProductionMs <
                  plant.evolutionAttempts[index - 1]!.atProductionMs +
                    SPIRIT_GARDEN_EVOLUTION_COOLDOWN_MS)),
        )
      )
        ctx.addIssue({ code: 'custom', message: '灵植阶段突破记录无效' });
      const negativeIncidents = plant.incidents.filter(
        (incident) => incident.kind !== 'mutation',
      );
      const seedIncidents = plant.incidents.filter(
        (incident) => incident.seedSpeciesId !== null,
      );
      const lastIncident = plant.incidents.at(-1);
      if (
        negativeIncidents.length > 2 ||
        plant.incidents.length - negativeIncidents.length > 1 ||
        seedIncidents.length > 1 ||
        plant.incidents.some(
          (incident, index) =>
            incident.productionDay * SPIRIT_GARDEN_INCIDENT_INTERVAL_MS >
              plant.productionClockMs ||
            incident.occurredAt > plant.settledAt ||
            (index > 0 &&
              (incident.productionDay <=
                plant.incidents[index - 1]!.productionDay ||
                incident.occurredAt <
                  plant.incidents[index - 1]!.occurredAt)) ||
            (incident.seedSpeciesId !== null && incident.kind !== 'beast'),
        ) ||
        (plant.pendingSeedSpeciesId !== null &&
          !seedIncidents.some(
            (incident) => incident.seedSpeciesId === plant.pendingSeedSpeciesId,
          )) ||
        (plant.recoveryRemainingMs > 0 &&
          (!lastIncident ||
            lastIncident.kind === 'mutation' ||
            (lastIncident.kind === 'beast' &&
              plant.recoveryRemainingMs > 2 * 3_600_000))) ||
        (!isSpiritGardenMutated(plant) && plant.productionBonusRemainder !== 0)
      )
        ctx.addIssue({ code: 'custom', message: '灵植异事记录无效' });
      if (
        plant.pending.some((product) => product.speciesId !== plant.speciesId)
      )
        ctx.addIssue({ code: 'custom', message: '灵植待领产物归属无效' });
    }
  })
  .transform(recordCodex);
export function parseSpiritGardenState(input: unknown): SpiritGardenState {
  return SpiritGardenStateSchema.parse(input);
}
export function createSpiritGarden(): SpiritGardenState {
  return {
    version: 2,
    plots: Array.from({ length: 6 }, (_, index) => ({ index, plant: null })),
    collection: [],
    codex: [],
  };
}
export function getSpiritGardenSpecies(id: SpiritGardenSpeciesId) {
  const species = SPIRIT_GARDEN_SPECIES.find((entry) => entry.id === id);
  if (!species) throw new Error('灵植物种不存在');
  return species;
}
function getSpiritGardenSpeciesForQuality(
  id: SpiritGardenSpeciesId,
  quality: Quality,
) {
  const species = getSpiritGardenSpecies(id);
  if (species.quality !== quality) throw new Error('灵植物种与品质不符');
  return species;
}
export function resolveSpiritGardenSpecies(
  seed: SpiritSeedPlant,
): SpiritGardenSpeciesId {
  const species =
    'speciesId' in seed
      ? getSpiritGardenSeedCandidates(seed.quality).find(
          (entry) =>
            seed.speciesId === entry.id &&
            seed.id === `garden-seed:${entry.id}:${seed.quality}`,
        )
      : null;
  if (!species) throw new Error('旧版灵种无法播种，请先进行材料转化');
  return species.id;
}
export function isSpiritGardenSeed(
  seed: SpiritSeedPlant,
): seed is SpiritGardenSeedPlant {
  return (
    'speciesId' in seed &&
    getSpiritGardenSeedCandidates(seed.quality).some(
      (entry) =>
        seed.speciesId === entry.id &&
        seed.id === `garden-seed:${entry.id}:${seed.quality}`,
    )
  );
}
export function canPlantSpiritGardenSeed(
  realm: RealmType,
  seed: SpiritSeedPlant,
): boolean {
  return (
    isSpiritGardenSeed(seed) &&
    REALM_ORDER[realm] >= REALM_ORDER[SPIRIT_GARDEN_MIN_REALM[seed.quality]]
  );
}
export function getSpiritGardenSeedCandidates(
  quality: Quality,
  element?: ElementType,
) {
  return SPIRIT_GARDEN_SPECIES.filter(
    (species) =>
      species.quality === quality && (!element || species.element === element),
  );
}
export function buildSpiritGardenSeed(
  speciesId: SpiritGardenSpeciesId,
  quality: Quality,
  quantity = 1,
): Omit<Material, 'id'> {
  const species = getSpiritGardenSpeciesForQuality(speciesId, quality);
  return buildSpiritGardenSeedMaterialFromPlant(
    {
      id: `garden-seed:${species.id}:${quality}`,
      speciesId: species.id,
      seedName: `${species.name}的种子`,
      seedDescription: species.description,
      clueTexts: [
        `成株后稳定产出${species.baseOutput.name}`,
        `成株后继续生长，可消耗天地灵气选择培养方向：${species.branches.abundance.name}或${species.branches.essence.name}。成株后可持续培养28天；收成已满或灵植处于暂存区时暂停计时，恢复期间仍计时`,
      ],
      element: species.element,
      growthForm: species.growthForm,
      harvestPart: species.harvestPart,
      quality,
      minRealm: SPIRIT_GARDEN_MIN_REALM[quality],
    },
    quantity,
  );
}
function times(plant: SpiritGardenPlant) {
  const species = getSpiritGardenSpeciesForQuality(
    plant.speciesId,
    plant.quality,
  );
  const multiplier = 1 + QUALITY_ORDER[plant.quality] * 0.25;
  return {
    matureMs: species.matureMs,
    branchMs: Math.round(species.branchMs * multiplier),
    evolveMs: Math.round(species.evolveMs * multiplier),
  };
}
export function getSpiritGardenOutput(
  plant: Pick<SpiritGardenPlant, 'speciesId' | 'quality' | 'branch'> & {
    evolved?: boolean;
  },
): SpiritGardenOutput {
  const species = getSpiritGardenSpeciesForQuality(
    plant.speciesId,
    plant.quality,
  );
  const output = plant.branch
    ? species.branches[plant.branch].output
    : species.baseOutput;
  const production = SPIRIT_GARDEN_PRODUCTION_BY_QUALITY[outputQuality(plant)];
  return {
    ...output,
    quantity: plant.branch === 'abundance' ? 2 : 1,
    cycleMs:
      output.kind === 'herb'
        ? production.herbCycleMs
        : output.kind === 'spirit_fruit'
          ? production.fruitCycleMs
          : production.treasureCycleMs,
  };
}
function storageCapacity(plant: SpiritGardenPlant): number {
  return Math.max(
    SPIRIT_GARDEN_OFFLINE_CAP_MS,
    getSpiritGardenOutput(plant).cycleMs,
  );
}
/** Shorter cycles retain completion ratio; longer cycles retain elapsed work. */
function changePlantOutput(
  plant: SpiritGardenPlant,
  change: Partial<Pick<SpiritGardenPlant, 'branch' | 'evolved'>>,
): SpiritGardenPlant {
  const next = { ...plant, ...change };
  const oldCycle = getSpiritGardenOutput(plant).cycleMs;
  const newCycle = getSpiritGardenOutput(next).cycleMs;
  const oldTicks = plant.productionMs * 10 + plant.productionBonusRemainder;
  const newTicks =
    newCycle < oldCycle
      ? Number((BigInt(oldTicks) * BigInt(newCycle)) / BigInt(oldCycle))
      : oldTicks;
  next.productionMs = Math.floor(newTicks / 10);
  next.productionBonusRemainder = isSpiritGardenMutated(plant)
    ? newTicks % 10
    : 0;
  const rate = spiritGardenProductionRate(plant);
  const completedStoredMs =
    plant.storedProductionMs - Math.ceil(oldTicks / rate);
  next.storedProductionMs = Math.min(
    storageCapacity(next),
    completedStoredMs +
      Math.ceil(
        (next.productionMs * 10 + next.productionBonusRemainder) / rate,
      ),
  );
  return next;
}
function outputQuality(plant: {
  quality: Quality;
  evolved?: boolean;
}): Quality {
  return QUALITY_VALUES[
    Math.min(
      QUALITY_VALUES.length - 1,
      QUALITY_ORDER[plant.quality] + (plant.evolved ? 1 : 0),
    )
  ]!;
}
function addProduct(
  pending: SpiritGardenProduct[],
  product: SpiritGardenProduct,
): SpiritGardenProduct[] {
  const same = (entry: SpiritGardenProduct) =>
    entry.name === product.name &&
    entry.kind === product.kind &&
    entry.quality === product.quality &&
    entry.fruitFamily === product.fruitFamily &&
    JSON.stringify(entry.fruitEffects) === JSON.stringify(product.fruitEffects);
  return pending.some(same)
    ? pending.map((entry) =>
        same(entry)
          ? { ...entry, quantity: entry.quantity + product.quantity }
          : entry,
      )
    : [...pending, product];
}
function productOf(
  plant: SpiritGardenPlant,
  output: SpiritGardenOutput,
  quantity: number,
): SpiritGardenProduct {
  return {
    speciesId: plant.speciesId,
    name: output.name,
    description: output.description,
    element: getSpiritGardenSpeciesForQuality(plant.speciesId, plant.quality)
      .element,
    kind: output.kind,
    ...(output.fruitFamily ? { fruitFamily: output.fruitFamily } : {}),
    ...(output.fruitEffects
      ? { fruitEffects: output.fruitEffects.map((effect) => ({ ...effect })) }
      : {}),
    quality: outputQuality(plant),
    quantity,
  };
}
function remainingProductionTime(plant: SpiritGardenPlant): number {
  return SPIRIT_GARDEN_PRODUCTION_LIFETIME_MS - plant.productionUsedMs;
}
function settlePlant(
  plant: SpiritGardenPlant,
  nowMs: number,
): SpiritGardenPlant {
  const elapsed = Math.max(0, nowMs - plant.settledAt);
  if (elapsed === 0 || remainingProductionTime(plant) === 0) return plant;
  const matureMs = times(plant).matureMs;
  if (!plant.firstYieldGranted) {
    return {
      ...plant,
      activeGrowthMs: Math.min(matureMs, plant.activeGrowthMs + elapsed),
      settledAt: Math.max(plant.settledAt, nowMs),
    };
  }
  const output = getSpiritGardenOutput(plant);
  const storageCapMs = storageCapacity(plant);
  let remainingElapsedMs = elapsed;
  let cursorMs = plant.settledAt;
  let next = { ...plant };

  // Lifespan includes recovery; the separate production clock fixes incident draws.
  while (
    remainingElapsedMs > 0 &&
    remainingProductionTime(next) > 0 &&
    next.storedProductionMs < storageCapMs
  ) {
    if (next.recoveryRemainingMs > 0) {
      const recoveringMs = Math.min(
        remainingElapsedMs,
        next.recoveryRemainingMs,
        remainingProductionTime(next),
      );
      next.recoveryRemainingMs -= recoveringMs;
      next.productionUsedMs += recoveringMs;
      next.activeGrowthMs += recoveringMs;
      cursorMs += recoveringMs;
      remainingElapsedMs -= recoveringMs;
      continue;
    }
    const nextIncidentAt =
      (Math.floor(next.productionClockMs / SPIRIT_GARDEN_INCIDENT_INTERVAL_MS) +
        1) *
      SPIRIT_GARDEN_INCIDENT_INTERVAL_MS;
    const acceptedMs = Math.min(
      remainingElapsedMs,
      nextIncidentAt - next.productionClockMs,
      storageCapMs - next.storedProductionMs,
      remainingProductionTime(next),
    );
    const productionTicks =
      next.productionMs * 10 +
      next.productionBonusRemainder +
      acceptedMs * spiritGardenProductionRate(next);
    const cycleTicks = output.cycleMs * 10;
    const cycles = Math.floor(productionTicks / cycleTicks);
    next.productionMs = Math.floor((productionTicks % cycleTicks) / 10);
    next.productionBonusRemainder = productionTicks % 10;
    next.storedProductionMs += acceptedMs;
    next.productionUsedMs += acceptedMs;
    next.productionClockMs += acceptedMs;
    next.activeGrowthMs += acceptedMs;
    cursorMs += acceptedMs;
    remainingElapsedMs -= acceptedMs;
    if (cycles > 0)
      next.pending = addProduct(
        next.pending,
        productOf(next, output, cycles * output.quantity),
      );
    if (
      next.productionClockMs === nextIncidentAt &&
      remainingProductionTime(next) > 0
    )
      next = recordSpiritGardenIncident(next, cursorMs);
  }
  const exhausted = remainingProductionTime(next) === 0;
  return {
    ...next,
    settledAt: Math.max(plant.settledAt, nowMs),
    productionMs: exhausted ? 0 : next.productionMs,
    productionBonusRemainder: exhausted ? 0 : next.productionBonusRemainder,
    recoveryRemainingMs: exhausted ? 0 : next.recoveryRemainingMs,
  };
}
function recordCodex(state: SpiritGardenState): SpiritGardenState {
  const entries = new Map<SpiritGardenSpeciesId, SpiritGardenCodexEntry>(
    state.codex.map((entry) => [
      entry.speciesId,
      { ...entry, branches: [...entry.branches] },
    ]),
  );
  for (const plant of [
    ...state.plots.flatMap((plot) => (plot.plant ? [plot.plant] : [])),
    ...state.collection,
  ]) {
    if (!plant.firstYieldGranted) continue;
    const entry = entries.get(plant.speciesId) ?? {
      speciesId: plant.speciesId,
      matured: false,
      branches: [],
      evolved: false,
    };
    entry.matured = true;
    if (plant.branch && !entry.branches.includes(plant.branch))
      entry.branches.push(plant.branch);
    entry.evolved ||= plant.evolved;
    entries.set(plant.speciesId, entry);
  }
  return { ...state, codex: [...entries.values()] };
}
export function settleSpiritGarden(
  state: SpiritGardenState,
  nowMs: number,
): SpiritGardenState {
  if (!Number.isSafeInteger(nowMs) || nowMs < 0)
    throw new Error('灵田时间无效');
  return recordCodex({
    ...state,
    plots: state.plots.map((plot) => ({
      ...plot,
      plant: plot.plant ? settlePlant(plot.plant, nowMs) : null,
    })),
  });
}
function selectedPlant(
  state: SpiritGardenState,
  plotIndex: number,
  plantId: string,
) {
  const plant = state.plots[plotIndex]?.plant;
  if (!plant || plant.id !== plantId)
    throw new Error('灵植已经变化，请重新查看灵田');
  return plant;
}
function replacePlant(
  state: SpiritGardenState,
  plotIndex: number,
  plant: SpiritGardenPlant | null,
): SpiritGardenState {
  return {
    ...state,
    plots: state.plots.map((plot) =>
      plot.index === plotIndex ? { ...plot, plant } : plot,
    ),
  };
}
export function plantSpiritGardenSeed(
  state: SpiritGardenState,
  plotIndex: number,
  seed: SpiritSeedPlant,
  plantId: string,
  realm: RealmType,
  nowMs: number,
): SpiritGardenState {
  const settled = settleSpiritGarden(state, nowMs);
  if (!settled.plots[plotIndex] || settled.plots[plotIndex]!.plant)
    throw new Error('请先选择一块空田');
  if (
    [
      ...settled.plots.flatMap((plot) => (plot.plant ? [plot.plant.id] : [])),
      ...settled.collection.map((plant) => plant.id),
    ].includes(plantId)
  )
    throw new Error('灵植身份重复');
  if (REALM_ORDER[realm] < REALM_ORDER[SPIRIT_GARDEN_MIN_REALM[seed.quality]])
    throw new Error('当前境界不足以培养这枚灵种');
  return replacePlant(settled, plotIndex, {
    id: plantId,
    speciesId: resolveSpiritGardenSpecies(seed),
    seedName: seed.seedName,
    quality: seed.quality,
    activeGrowthMs: 0,
    settledAt: nowMs,
    productionMs: 0,
    productionBonusRemainder: 0,
    storedProductionMs: 0,
    productionUsedMs: 0,
    productionClockMs: 0,
    incidents: [],
    recoveryRemainingMs: 0,
    pendingSeedSpeciesId: null,
    firstYieldGranted: false,
    branch: null,
    branchAtProductionMs: null,
    evolved: false,
    evolutionAttempts: [],
    pending: [],
  });
}
export function matureSpiritGardenPlant(
  state: SpiritGardenState,
  plotIndex: number,
  plantId: string,
  nowMs: number,
): SpiritGardenState {
  const settled = settleSpiritGarden(state, nowMs);
  const plant = selectedPlant(settled, plotIndex, plantId);
  if (plant.firstYieldGranted) throw new Error('这株灵植已经培育成株');
  if (plant.activeGrowthMs < times(plant).matureMs)
    throw new Error('幼苗还在生长，暂时不能培育成株');
  return recordCodex(
    replacePlant(settled, plotIndex, {
      ...plant,
      firstYieldGranted: true,
      pending: addProduct(
        plant.pending,
        productOf(plant, getSpiritGardenOutput(plant), 1),
      ),
    }),
  );
}
export function chooseSpiritGardenBranch(
  state: SpiritGardenState,
  plotIndex: number,
  plantId: string,
  branch: SpiritGardenBranch,
  nowMs: number,
): SpiritGardenState {
  const settled = settleSpiritGarden(state, nowMs);
  const plant = selectedPlant(settled, plotIndex, plantId);
  if (remainingProductionTime(plant) === 0)
    throw new Error('这株灵植已经停止产出');
  if (!plant.firstYieldGranted) throw new Error('请先消耗天地灵气培育成株');
  if (!SPIRIT_GARDEN_BRANCHES.includes(branch))
    throw new Error('培养方向不存在');
  if (plant.branch) throw new Error('这株灵植已经选定培养方向');
  if (plant.productionUsedMs < times(plant).branchMs)
    throw new Error('尚未达到选择培养方向所需的生长时间');
  return recordCodex(
    replacePlant(settled, plotIndex, {
      ...changePlantOutput(plant, { branch }),
      branchAtProductionMs: plant.productionUsedMs,
    }),
  );
}
export function getSpiritGardenPlantView(
  plant: SpiritGardenPlant,
  realm: RealmType,
): SpiritGardenPlantView {
  const species = getSpiritGardenSpeciesForQuality(
    plant.speciesId,
    plant.quality,
  );
  const growth = times(plant);
  const quality = outputQuality(plant);
  const nextQuality =
    QUALITY_VALUES[
      Math.min(QUALITY_VALUES.length - 1, QUALITY_ORDER[plant.quality] + 1)
    ]!;
  const minRealm = SPIRIT_GARDEN_MIN_REALM[nextQuality];
  const remainingProductionMs = remainingProductionTime(plant);
  const rate = spiritGardenProductionRate(plant);
  const productionTicks =
    plant.productionMs * 10 + plant.productionBonusRemainder;
  const exhausted = remainingProductionMs === 0;
  const branchRemainingMs = Math.max(
    0,
    growth.branchMs - plant.productionUsedMs,
  );
  const evolveRemainingMs =
    plant.branchAtProductionMs === null
      ? growth.evolveMs
      : Math.max(
          0,
          growth.evolveMs -
            (plant.productionUsedMs - plant.branchAtProductionMs),
        );
  const lastAttempt = plant.evolutionAttempts.at(-1);
  const evolveCooldownRemainingMs =
    !plant.evolved && lastAttempt
      ? Math.max(
          0,
          lastAttempt.atProductionMs +
            SPIRIT_GARDEN_EVOLUTION_COOLDOWN_MS -
            plant.productionUsedMs,
        )
      : 0;
  const evolutionAttemptsRemaining =
    plant.evolved || plant.quality === '神品'
      ? 0
      : SPIRIT_GARDEN_EVOLUTION_ATTEMPT_LIMIT - plant.evolutionAttempts.length;
  const evolveReason = exhausted
    ? '这株灵植已经停止产出'
    : !plant.firstYieldGranted
      ? '先消耗天地灵气培育成株'
      : plant.evolved
        ? '这株灵植已经完成蜕变'
        : plant.quality === '神品'
          ? '神品灵植不再蜕变，产物品质已达上限'
          : !plant.branch
            ? '先消耗天地灵气选择培养方向'
            : evolutionAttemptsRemaining === 0
              ? '这株灵植的3次蜕变机会已经用尽'
              : evolveRemainingMs > 0
                ? '选择培养方向后还需继续生长，才能尝试蜕变'
                : evolveCooldownRemainingMs > 0
                  ? '蜕变冷却尚未结束，请等待冷却完成后重试'
                  : REALM_ORDER[realm] < REALM_ORDER[minRealm]
                    ? `需要${minRealm}及以上境界`
                    : null;
  const output = getSpiritGardenOutput(plant);
  const productiveRemainingMs = Math.max(
    0,
    remainingProductionMs - plant.recoveryRemainingMs,
  );
  return {
    ...plant,
    speciesId: species.id,
    speciesName: species.name,
    description: species.description,
    stage: plant.evolved
      ? 'evolved'
      : plant.branch
        ? 'nurtured'
        : plant.firstYieldGranted
          ? 'mature'
          : 'seedling',
    outputQuality: quality,
    output,
    ...growth,
    nextYieldMs: exhausted
      ? 0
      : !plant.firstYieldGranted
        ? Math.max(0, growth.matureMs - plant.activeGrowthMs)
        : plant.recoveryRemainingMs +
          Math.ceil((output.cycleMs * 10 - productionTicks) / rate),
    remainingProductionMs,
    remainingHarvestCycles: exhausted
      ? 0
      : Math.floor(
          (productionTicks + productiveRemainingMs * rate) /
            (output.cycleMs * 10),
        ),
    exhausted,
    mutated: isSpiritGardenMutated(plant),
    canMature:
      !plant.firstYieldGranted && plant.activeGrowthMs >= growth.matureMs,
    matureQiCost: SPIRIT_GARDEN_MATURE_QI_COSTS[plant.quality],
    branchQiCost: SPIRIT_GARDEN_BRANCH_QI_COSTS[plant.quality],
    branchRemainingMs,
    evolveRemainingMs,
    evolveCooldownRemainingMs,
    evolutionAttemptsRemaining,
    evolveSuccessChance: SPIRIT_GARDEN_EVOLUTION_SUCCESS_CHANCES[plant.quality],
    canBranch:
      !exhausted &&
      plant.firstYieldGranted &&
      !plant.branch &&
      branchRemainingMs === 0,
    canEvolve: evolveReason === null,
    evolveReason,
    evolveCost: {
      spiritStones: Math.ceil(
        BASE_PRICES[nextQuality] * SPIRIT_GARDEN_EVOLUTION_STONE_RATIO,
      ),
      qi: SPIRIT_GARDEN_EVOLUTION_QI_COSTS[plant.quality],
      materialKind: 'herb',
      materialQuality: plant.quality,
      quantity: 1,
      minRealm,
    },
    storageFull: plant.storedProductionMs >= storageCapacity(plant),
  };
}
/** Preview the chosen output using the same progress adjustment as confirmation. */
export function getSpiritGardenBranchPreview(
  plant: SpiritGardenPlant,
  branch: SpiritGardenBranch,
  realm: RealmType,
): SpiritGardenPlantView {
  return getSpiritGardenPlantView(changePlantOutput(plant, { branch }), realm);
}

/** A hypothetical success for the confirmation screen; never commits an attempt. */
export function getSpiritGardenEvolutionPreview(
  plant: SpiritGardenPlant,
  realm: RealmType,
): SpiritGardenPlantView {
  return getSpiritGardenPlantView(
    changePlantOutput(plant, { evolved: true }),
    realm,
  );
}
export function evolveSpiritGardenPlant(
  state: SpiritGardenState,
  plotIndex: number,
  plantId: string,
  realm: RealmType,
  nowMs: number,
  roll: number,
): SpiritGardenState {
  if (!Number.isFinite(roll) || roll < 0 || roll >= 1)
    throw new Error('蜕变判定无效');
  const settled = settleSpiritGarden(state, nowMs);
  const plant = selectedPlant(settled, plotIndex, plantId);
  const view = getSpiritGardenPlantView(plant, realm);
  if (!view.canEvolve) throw new Error(view.evolveReason ?? '当前不能蜕变');
  const succeeded = roll < view.evolveSuccessChance;
  const next = {
    ...plant,
    evolutionAttempts: [
      ...plant.evolutionAttempts,
      { atProductionMs: plant.productionUsedMs, succeeded },
    ],
  };
  return recordCodex(
    replacePlant(
      settled,
      plotIndex,
      succeeded ? changePlantOutput(next, { evolved: true }) : next,
    ),
  );
}
export function archiveSpiritGardenPlant(
  state: SpiritGardenState,
  plotIndex: number,
  plantId: string,
  nowMs: number,
): SpiritGardenState {
  const settled = settleSpiritGarden(state, nowMs);
  if (settled.collection.length >= SPIRIT_GARDEN_COLLECTION_LIMIT)
    throw new Error('暂存区已满，请先移回或永久移除灵植，腾出空位');
  const plant = selectedPlant(settled, plotIndex, plantId);
  if (remainingProductionTime(plant) === 0)
    throw new Error('这株灵植已经停止产出');
  return {
    ...replacePlant(settled, plotIndex, null),
    collection: [...settled.collection, plant],
  };
}
/** Retiring a dormant or exhausted plant preserves its discoveries. */
export function retireSpiritGardenPlant(
  state: SpiritGardenState,
  plantId: string,
  nowMs: number,
  plotIndex?: number,
): SpiritGardenState {
  const settled = settleSpiritGarden(state, nowMs);
  const plant =
    plotIndex === undefined
      ? settled.collection.find((entry) => entry.id === plantId)
      : selectedPlant(settled, plotIndex, plantId);
  if (!plant) throw new Error('暂存区中没有找到这株灵植');
  if (plotIndex !== undefined && remainingProductionTime(plant) > 0)
    throw new Error('这株灵植尚未停止产出');
  if (plant.pending.length > 0 || plant.pendingSeedSpeciesId !== null)
    throw new Error('请先领取这株灵植的待领产物');
  if (plotIndex !== undefined) return replacePlant(settled, plotIndex, null);
  return {
    ...settled,
    collection: settled.collection.filter((entry) => entry.id !== plantId),
  };
}
/** Only an exhausted, fully claimed in-field plant can leave a same-species seed. */
export function clearSpiritGardenPlot(
  state: SpiritGardenState,
  plotIndex: number,
  plantId: string,
  nowMs: number,
  roll: number,
): { state: SpiritGardenState; seed: SpiritGardenSeedReward | null } {
  if (!Number.isFinite(roll) || roll < 0 || roll >= 1)
    throw new Error('留种判定无效');
  const settled = settleSpiritGarden(state, nowMs);
  const plant = selectedPlant(settled, plotIndex, plantId);
  const cleared = retireSpiritGardenPlant(settled, plantId, nowMs, plotIndex);
  return {
    state: cleared,
    seed:
      roll < SPIRIT_GARDEN_CLEAR_SEED_CHANCE
        ? { speciesId: plant.speciesId, quality: plant.quality, quantity: 1 }
        : null,
  };
}
export function restoreSpiritGardenPlant(
  state: SpiritGardenState,
  plotIndex: number,
  plantId: string,
  realm: RealmType,
  nowMs: number,
): SpiritGardenState {
  const settled = settleSpiritGarden(state, nowMs);
  if (!settled.plots[plotIndex] || settled.plots[plotIndex]!.plant)
    throw new Error('请先选择一块空田');
  const plant = settled.collection.find((entry) => entry.id === plantId);
  if (!plant) throw new Error('暂存区中没有找到这株灵植');
  if (remainingProductionTime(plant) === 0)
    throw new Error('这株灵植已经停止产出');
  if (
    REALM_ORDER[realm] <
    REALM_ORDER[SPIRIT_GARDEN_MIN_REALM[outputQuality(plant)]]
  )
    throw new Error('当前境界不足以移回这株灵植');
  return {
    ...replacePlant(settled, plotIndex, { ...plant, settledAt: nowMs }),
    collection: settled.collection.filter((entry) => entry.id !== plantId),
  };
}
export function harvestSpiritGarden(
  state: SpiritGardenState,
  nowMs: number,
): {
  state: SpiritGardenState;
  products: SpiritGardenProduct[];
  seeds: SpiritGardenSeedReward[];
} {
  const settled = settleSpiritGarden(state, nowMs);
  const plants = [
    ...settled.plots.flatMap((plot) => (plot.plant ? [plot.plant] : [])),
    ...settled.collection,
  ];
  const products = plants.flatMap((plant) => plant.pending);
  const seeds: SpiritGardenSeedReward[] = plants.flatMap((plant) =>
    plant.pendingSeedSpeciesId
      ? [
          {
            speciesId: plant.pendingSeedSpeciesId,
            quality: getSpiritGardenSpecies(plant.pendingSeedSpeciesId).quality,
            quantity: 1,
          },
        ]
      : [],
  );
  if (products.length === 0 && seeds.length === 0)
    throw new Error('灵圃暂时没有可领取的产物');
  const clear = (plant: SpiritGardenPlant) =>
    plant.pending.length > 0 || plant.pendingSeedSpeciesId !== null
      ? {
          ...plant,
          pending: [],
          pendingSeedSpeciesId: null,
          storedProductionMs: Math.ceil(
            (plant.productionMs * 10 + plant.productionBonusRemainder) /
              spiritGardenProductionRate(plant),
          ),
        }
      : plant;
  return {
    state: {
      ...settled,
      plots: settled.plots.map((plot) => ({
        ...plot,
        plant: plot.plant ? clear(plot.plant) : null,
      })),
      collection: settled.collection.map(clear),
    },
    products,
    seeds,
  };
}
export function getSpiritGardenMaturedCount(state: SpiritGardenState): number {
  return state.codex.filter((entry) => entry.matured).length;
}
