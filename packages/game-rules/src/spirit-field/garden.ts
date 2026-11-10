import { ELEMENT_VALUES, type ElementType } from '@daoyou/constants/elements';
import {
  QUALITY_ORDER,
  QUALITY_VALUES,
  type Quality,
} from '@daoyou/constants/qualities';
import { REALM_ORDER, type RealmType } from '@daoyou/constants/realms';
import {
  SPIRIT_GARDEN_COLLECTION_LIMIT,
  SPIRIT_GARDEN_OFFLINE_CAP_MS,
  SPIRIT_GARDEN_SPECIES,
  getSpiritFieldQualityBalance,
} from '@daoyou/game-content/spirit-field/config';
import type { Material } from '@daoyou/game-domain/character';
import { PILL_FAMILY_VALUES } from '@daoyou/game-domain/consumables';
import { CreationTags } from '@daoyou/game-domain/legacy/tags';
import {
  SPIRIT_FIELD_CULTIVATION_METHODS,
  SPIRIT_GARDEN_BRANCHES,
  SpiritGardenFruitEffectsSchema,
  buildSpiritFieldSeedDetails,
  buildSpiritFieldSeedMaterialFromPlant,
  readSpiritFieldSeedSpec,
  type SpiritFieldPlantSnapshot,
  type SpiritFieldPlotState,
  type SpiritGardenBranch,
  type SpiritGardenCodexEntry,
  type SpiritGardenOutput,
  type SpiritGardenPlant,
  type SpiritGardenPlantView,
  type SpiritGardenProduct,
  type SpiritGardenSpeciesId,
  type SpiritGardenState,
} from '@daoyou/game-domain/spirit-field';
import { z } from 'zod';
import {
  getSpiritFieldPlotRuntime,
  settleSpiritFieldHarvest,
} from './rules.js';

export {
  SPIRIT_GARDEN_COLLECTION_LIMIT,
  SPIRIT_GARDEN_OFFLINE_CAP_MS,
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
    storedProductionMs: nonnegative.max(SPIRIT_GARDEN_OFFLINE_CAP_MS),
    firstYieldGranted: z.boolean(),
    branch: z.enum(SPIRIT_GARDEN_BRANCHES).nullable(),
    evolved: z.boolean(),
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
    collection: z.array(plantSchema).max(SPIRIT_GARDEN_COLLECTION_LIMIT),
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
        plant.productionMs >= output.cycleMs ||
        plant.productionMs > plant.storedProductionMs
      )
        ctx.addIssue({ code: 'custom', message: '灵植生产进度无效' });
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
  seed: SpiritFieldPlantSnapshot,
): SpiritGardenSpeciesId {
  const candidates = getSpiritGardenSeedCandidates(seed.quality);
  // Seeds from the released plot system carry name and element but no catalog ID.
  const species =
    candidates.find(
      (entry) => seed.id === `garden-seed:${entry.id}:${seed.quality}`,
    ) ??
    candidates.find(
      (entry) =>
        seed.seedName === `${entry.name}的种子` ||
        seed.seedName === `${entry.name}籽` ||
        seed.seedName === entry.name,
    ) ??
    candidates.find((entry) => entry.element === seed.element) ??
    candidates[0];
  if (!species) throw new Error('当前品质没有可匹配的灵植物种');
  return species.id;
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
  const balance = getSpiritFieldQualityBalance(quality);
  return buildSpiritFieldSeedMaterialFromPlant(
    {
      id: `garden-seed:${species.id}:${quality}`,
      seedName: `${species.name}的种子`,
      seedDescription: species.description,
      clueTexts: [
        `成株后稳定产出${species.baseOutput.name}`,
        `蕴灵后可选繁茂或${species.branches.essence.name}，长期保留植株`,
      ],
      element: species.element,
      growthForm: species.growthForm,
      harvestPart: species.harvestPart,
      preferredMethods: [],
      avoidedMethods: [],
      preferredHabitats: ['mountain'],
      avoidedHabitats: [],
      growthTraits: ['slow-rooting'],
      useTags: ['alchemy'],
      outcomeBiases: ['herb'],
      creationTags: [CreationTags.MATERIAL.SEMANTIC_ALCHEMY],
      quality,
      minRealm: balance.minRealm,
      stageDurationMs: balance.stageDurationMs,
      baseYieldMin: 1,
      baseYieldMax: 1,
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
    matureMs: Math.round(species.matureMs * multiplier),
    branchMs: Math.round(species.branchMs * multiplier),
    evolveMs: Math.round(species.evolveMs * multiplier),
  };
}
export function getSpiritGardenOutput(
  plant: Pick<SpiritGardenPlant, 'speciesId' | 'quality' | 'branch'>,
): SpiritGardenOutput {
  const species = getSpiritGardenSpeciesForQuality(
    plant.speciesId,
    plant.quality,
  );
  const output = plant.branch
    ? species.branches[plant.branch].output
    : species.baseOutput;
  return {
    ...output,
    cycleMs: Math.round(
      output.cycleMs * (1 + QUALITY_ORDER[plant.quality] * 0.25),
    ),
  };
}
function outputQuality(plant: SpiritGardenPlant): Quality {
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
function settlePlant(
  plant: SpiritGardenPlant,
  nowMs: number,
): SpiritGardenPlant {
  const elapsed = Math.max(0, nowMs - plant.settledAt);
  if (elapsed === 0) return plant;
  const matureMs = times(plant).matureMs;
  const oldGrowth = plant.activeGrowthMs;
  const activeGrowthMs = oldGrowth + elapsed;
  const output = getSpiritGardenOutput(plant);
  const productiveMs =
    Math.max(0, activeGrowthMs - matureMs) - Math.max(0, oldGrowth - matureMs);
  const acceptedMs = Math.min(
    productiveMs,
    SPIRIT_GARDEN_OFFLINE_CAP_MS - plant.storedProductionMs,
  );
  const productionMs = plant.productionMs + acceptedMs;
  const cycles = Math.floor(productionMs / output.cycleMs);
  const firstYield = !plant.firstYieldGranted && activeGrowthMs >= matureMs;
  const quantity = cycles * output.quantity + (firstYield ? 1 : 0);
  return {
    ...plant,
    activeGrowthMs,
    settledAt: Math.max(plant.settledAt, nowMs),
    productionMs: productionMs % output.cycleMs,
    storedProductionMs: plant.storedProductionMs + acceptedMs,
    firstYieldGranted: plant.firstYieldGranted || firstYield,
    pending:
      quantity > 0
        ? addProduct(plant.pending, productOf(plant, output, quantity))
        : plant.pending,
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
    if (plant.activeGrowthMs < times(plant).matureMs) continue;
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
  seed: SpiritFieldPlantSnapshot,
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
  if (
    REALM_ORDER[realm] <
    REALM_ORDER[getSpiritFieldQualityBalance(seed.quality).minRealm]
  )
    throw new Error('当前境界不足以培养这枚灵种');
  return replacePlant(settled, plotIndex, {
    id: plantId,
    speciesId: resolveSpiritGardenSpecies(seed),
    seedName: seed.seedName,
    quality: seed.quality,
    activeGrowthMs: 0,
    settledAt: nowMs,
    productionMs: 0,
    storedProductionMs: 0,
    firstYieldGranted: false,
    branch: null,
    evolved: false,
    pending: [],
  });
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
  if (!SPIRIT_GARDEN_BRANCHES.includes(branch))
    throw new Error('培养方向不存在');
  if (plant.branch) throw new Error('这株灵植已经选定培养方向');
  if (plant.activeGrowthMs < times(plant).branchMs)
    throw new Error('灵植尚未蕴灵，暂不能选择培养方向');
  return recordCodex(replacePlant(settled, plotIndex, { ...plant, branch }));
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
  const minRealm = getSpiritFieldQualityBalance(nextQuality).minRealm;
  const evolveReason = plant.evolved
    ? '这株灵植已经完成蜕变'
    : plant.quality === '神品'
      ? '神品灵植已至品阶上限'
      : !plant.branch
        ? '先选定培养方向'
        : plant.activeGrowthMs < growth.evolveMs
          ? '灵植生长积累尚不足'
          : REALM_ORDER[realm] < REALM_ORDER[minRealm]
            ? `需要${minRealm}及以上境界`
            : null;
  const output = getSpiritGardenOutput(plant);
  return {
    ...plant,
    speciesId: species.id,
    speciesName: species.name,
    description: species.description,
    stage: plant.evolved
      ? 'evolved'
      : plant.activeGrowthMs >= growth.branchMs
        ? 'nurtured'
        : plant.activeGrowthMs >= growth.matureMs
          ? 'mature'
          : 'seedling',
    outputQuality: quality,
    output,
    ...growth,
    nextYieldMs:
      Math.max(0, growth.matureMs - plant.activeGrowthMs) ||
      Math.max(0, output.cycleMs - plant.productionMs),
    canBranch: !plant.branch && plant.activeGrowthMs >= growth.branchMs,
    canEvolve: evolveReason === null,
    evolveReason,
    evolveCost: {
      spiritStones: 300 * (QUALITY_ORDER[plant.quality] + 1) ** 2,
      materialKind: 'herb',
      materialQuality: plant.quality,
      quantity: 1,
      minRealm,
    },
    storageFull: plant.storedProductionMs >= SPIRIT_GARDEN_OFFLINE_CAP_MS,
  };
}
export function evolveSpiritGardenPlant(
  state: SpiritGardenState,
  plotIndex: number,
  plantId: string,
  realm: RealmType,
  nowMs: number,
): SpiritGardenState {
  const settled = settleSpiritGarden(state, nowMs);
  const plant = selectedPlant(settled, plotIndex, plantId);
  const view = getSpiritGardenPlantView(plant, realm);
  if (!view.canEvolve) throw new Error(view.evolveReason ?? '当前不能蜕变');
  return recordCodex(
    replacePlant(settled, plotIndex, {
      ...plant,
      evolved: true,
    }),
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
    throw new Error('保种收藏已满');
  const plant = selectedPlant(settled, plotIndex, plantId);
  return {
    ...replacePlant(settled, plotIndex, null),
    collection: [...settled.collection, plant],
  };
}
/** Retiring a dormant plant never removes its discoveries or unclaimed assets. */
export function retireSpiritGardenPlant(
  state: SpiritGardenState,
  plantId: string,
  nowMs: number,
): SpiritGardenState {
  const settled = settleSpiritGarden(state, nowMs);
  const plant = settled.collection.find((entry) => entry.id === plantId);
  if (!plant) throw new Error('收藏中没有找到这株灵植');
  if (plant.pending.length > 0) throw new Error('请先领取这株灵植的待领产物');
  return {
    ...settled,
    collection: settled.collection.filter((entry) => entry.id !== plantId),
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
  if (!plant) throw new Error('收藏中没有找到这株灵植');
  if (
    REALM_ORDER[realm] <
    REALM_ORDER[getSpiritFieldQualityBalance(outputQuality(plant)).minRealm]
  )
    throw new Error('当前境界不足以迁回这株灵植');
  return {
    ...replacePlant(settled, plotIndex, { ...plant, settledAt: nowMs }),
    collection: settled.collection.filter((entry) => entry.id !== plantId),
  };
}
export function harvestSpiritGarden(
  state: SpiritGardenState,
  nowMs: number,
): { state: SpiritGardenState; products: SpiritGardenProduct[] } {
  const settled = settleSpiritGarden(state, nowMs);
  const products = [
    ...settled.plots.flatMap((plot) => plot.plant?.pending ?? []),
    ...settled.collection.flatMap((plant) => plant.pending),
  ];
  if (products.length === 0) throw new Error('灵圃暂时没有可领取的产物');
  const clear = (plant: SpiritGardenPlant) =>
    plant.pending.length > 0
      ? { ...plant, pending: [], storedProductionMs: plant.productionMs }
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
  };
}
export function getSpiritGardenMaturedCount(state: SpiritGardenState): number {
  return state.codex.filter((entry) => entry.matured).length;
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
    const validSeed = readSpiritFieldSeedSpec(
      buildSpiritFieldSeedDetails(raw.plant!),
    );
    if (!validSeed) throw new Error('旧灵植生长事实无效，无法安全迁移');
    const history = z
      .array(
        z.object({
          stage: z.enum(['germination', 'nourishing', 'forming']),
          method: z.enum(SPIRIT_FIELD_CULTIVATION_METHODS),
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
    state = plantSpiritGardenSeed(
      state,
      index,
      validSeed.plant,
      id,
      '渡劫',
      nowMs,
    );
    const plant = state.plots[index]!.plant!;
    const start = plot.stageStartedAt ? Date.parse(plot.stageStartedAt) : nowMs;
    const end = plot.stageEndsAt ? Date.parse(plot.stageEndsAt) : nowMs;
    const progress =
      plot.stageStartedAt && plot.stageEndsAt
        ? Math.max(0, Math.min(1, (nowMs - start) / Math.max(1, end - start)))
        : 0;
    const ready =
      getSpiritFieldPlotRuntime(plot, nowMs).status === 'ready_to_harvest';
    const activeGrowthMs = Math.round(
      times(plant).matureMs * ((plot.stageIndex + progress) / 3),
    );
    let migrated: SpiritGardenPlant = {
      ...plant,
      activeGrowthMs: ready ? times(plant).matureMs : activeGrowthMs,
    };
    if (ready) {
      const old = settleSpiritFieldHarvest(
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
    state = replacePlant(state, index, migrated);
  }
  return recordCodex(state);
}
