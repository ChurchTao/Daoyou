import { QUALITY_ORDER } from '@daoyou/constants/qualities';
import type { RealmType } from '@daoyou/constants/realms';
import type { ResourceChangeDescriptor } from '@daoyou/contracts/resources';
import type {
  SpiritFieldArchiveRequest,
  SpiritFieldBranchBatchRequest,
  SpiritFieldBranchRequest,
  SpiritFieldEvolveRequest,
  SpiritFieldHarvestRequest,
  SpiritFieldMatureBatchRequest,
  SpiritFieldMatureRequest,
  SpiritFieldRestoreRequest,
  SpiritFieldRetireRequest,
  SpiritFieldSnapshot,
  SpiritFieldSowRequest,
  SpiritFieldStarterRequest,
  SpiritFieldUprootRequest,
} from '@daoyou/contracts/spirit-field';
import type { Material } from '@daoyou/game-domain/character';
import type { InventoryItem, ItemGrant } from '@daoyou/game-domain/inventory';
import {
  consumableFactsOf,
  MaterialFactsSchema,
  seedFactsOf,
} from '@daoyou/game-domain/inventory';
import type {
  SpiritGardenProduct,
  SpiritGardenState,
} from '@daoyou/game-domain/spirit-field';
import {
  projectLegacySpiritGarden,
  uprootLegacySpiritGardenPlant,
} from '@daoyou/game-rules/legacy/spirit-field-plots';
import {
  archiveSpiritGardenPlant,
  buildSpiritFruitSpec,
  buildSpiritGardenSeed,
  chooseSpiritGardenBranch,
  clearSpiritGardenPlot,
  evolveSpiritGardenPlant,
  getSpiritGardenMaturedCount,
  getSpiritGardenPlantView,
  getSpiritGardenSpecies,
  harvestSpiritGarden,
  matureSpiritGardenPlant,
  plantSpiritGardenSeed,
  resolveSpiritGardenSpecies,
  restoreSpiritGardenPlant,
  retireSpiritGardenPlant,
  settleSpiritGarden,
  SPIRIT_GARDEN_COLLECTION_LIMIT,
  SPIRIT_GARDEN_OFFLINE_CAP_MS,
  SPIRIT_GARDEN_SPECIES,
} from '@daoyou/game-rules/spirit-field';
import { QiService } from '@server/cultivator/application/QiService.js';
import { updateSpiritStones } from '@server/cultivator/application/readers/CultivatorStateRepository.js';
import { grantInventory } from '@server/inventory/operations.js';
import {
  getExecutor,
  type DbExecutor,
  type DbTransaction,
} from '@server/lib/drizzle/db.js';
import { cultivators } from '@server/lib/drizzle/schema.js';
import { createDomainEvent } from '@server/lib/mq/domainEventWriter.js';
import {
  getOrCreateSpiritField,
  updateSpiritField,
  type SpiritFieldRecord,
} from '@server/lib/repositories/SpiritFieldRepository.js';
import { describeJournal } from '@server/player/application/JournalSettlement.js';
import { playerCommandExecutor } from '@server/player/application/state/CommandExecutors.js';
import { and, eq } from 'drizzle-orm';
import { createHash, randomInt } from 'node:crypto';
import { SpiritFieldServiceError } from './SpiritFieldError.js';
import {
  consumeFieldItem,
  fieldResource,
  readFieldBag,
} from './SpiritFieldInventory.js';

export type SpiritFieldActor = { userId: string; cultivatorId: string };

async function loadCultivator(
  actor: SpiritFieldActor,
  q: DbExecutor = getExecutor(),
) {
  const [row] = await q
    .select({
      id: cultivators.id,
      realm: cultivators.realm,
      spiritStones: cultivators.spirit_stones,
    })
    .from(cultivators)
    .where(
      and(
        eq(cultivators.id, actor.cultivatorId),
        eq(cultivators.userId, actor.userId),
        eq(cultivators.status, 'active'),
      ),
    )
    .limit(1);
  if (!row) throw new SpiritFieldServiceError('当前没有可用的活跃角色', 404);
  return { ...row, realm: row.realm as RealmType };
}

type Cultivator = Awaited<ReturnType<typeof loadCultivator>>;
type CommandInput = { requestId: string; expectedVersion: number };
type CommandContext = {
  tx: DbTransaction;
  field: SpiritFieldRecord;
  player: Cultivator;
  garden: SpiritGardenState;
  now: number;
};
type GardenCommandResult<TResult> = {
  garden: SpiritGardenState;
  result: TResult;
  resourceChanges?: ResourceChangeDescriptor[];
  harvestCount?: number;
  starterClaimed?: boolean;
  detail: string;
};

function gardenRule<T>(run: () => T): T {
  try {
    return run();
  } catch (error) {
    if (error instanceof Error)
      throw new SpiritFieldServiceError(error.message, 409);
    throw error;
  }
}

function stateOf(field: SpiritFieldRecord) {
  return (
    field.garden ??
    gardenRule(() => projectLegacySpiritGarden(field.plots, field.id))
  );
}

function runGardenCommand<T>(
  actor: SpiritFieldActor,
  input: CommandInput,
  source: string,
  run: (context: CommandContext) => Promise<GardenCommandResult<T>>,
) {
  return playerCommandExecutor.executeWithLock({
    allowEmpty: true,
    userId: actor.userId,
    cultivatorId: actor.cultivatorId,
    source,
    requestId: input.requestId,
    idempotency: { key: input.requestId, fingerprint: JSON.stringify(input) },
    command: async (tx) => {
      const player = await loadCultivator(actor, tx);
      const field = await getOrCreateSpiritField(actor.cultivatorId, tx);
      if (field.version !== input.expectedVersion)
        throw new SpiritFieldServiceError('灵圃已经变化，请刷新后再试', 409);
      const now = Date.now();
      const garden = gardenRule(() => settleSpiritGarden(stateOf(field), now));
      const changed = await run({ tx, field, player, garden, now });
      await updateSpiritField(tx, field.id, {
        garden: changed.garden,
        ...(changed.harvestCount !== undefined
          ? { selfHarvestCount: changed.harvestCount }
          : {}),
        ...(changed.starterClaimed !== undefined
          ? { starterClaimed: changed.starterClaimed }
          : {}),
      });
      describeJournal(tx, actor.cultivatorId, changed.detail);
      return {
        result: { ...changed.result, version: field.version + 1 },
        resourceChanges: changed.resourceChanges ?? [],
      };
    },
  });
}

const bagChange = (action: string): ResourceChangeDescriptor => ({
  resourceTopic: 'inventory.bag',
  eventType: `inventory.spirit-field.${action}`,
  operation: 'invalidate',
});
const currencyChange = (stage: string): ResourceChangeDescriptor => ({
  resourceTopic: 'player.currency',
  eventType: `currency.spirit_field.${stage}`,
  operation: 'invalidate',
});

async function spendStageQi(
  actor: SpiritFieldActor,
  input: { requestId: string } & (
    | { plantId: string; plotIndex: number }
    | { targets: { plantId: string; plotIndex: number }[] }
  ),
  stage: 'mature' | 'branch' | 'evolve' | 'mature-batch' | 'branch-batch',
  cost: number,
  tx: DbTransaction,
) {
  const requestKey = createHash('sha256').update(input.requestId).digest('hex');
  const actionInstanceId = `spirit-garden-${stage}:${actor.cultivatorId}:${requestKey}`;
  await QiService.reserveQi({
    cultivatorId: actor.cultivatorId,
    action: 'spirit_field_care',
    actionInstanceId,
    cost,
    metadata: {
      stage,
      ...('targets' in input
        ? { targetCount: input.targets.length }
        : { plantId: input.plantId, plotIndex: input.plotIndex }),
    },
    tx,
  });
  await QiService.commitReservation({ actionInstanceId, tx });
}

async function spendStones(
  actor: SpiritFieldActor,
  player: Cultivator,
  amount: number,
  tx: DbTransaction,
) {
  if (!Number.isSafeInteger(amount) || amount < 1 || amount > 99_990_000)
    throw new SpiritFieldServiceError('灵石费用无效', 409);
  if (player.spiritStones < amount)
    throw new SpiritFieldServiceError(
      `灵石不足，需要 ${amount}，当前拥有 ${player.spiritStones}`,
      409,
    );
  return updateSpiritStones(actor.userId, actor.cultivatorId, -amount, tx);
}

function seedGrant(material: Omit<Material, 'id'>): ItemGrant {
  return {
    definitionId: 'seed.v1',
    quantity: material.quantity,
    instanceData: seedFactsOf(material),
  };
}
function productGrant(product: SpiritGardenProduct): ItemGrant {
  if (product.kind === 'spirit_fruit') {
    if (!product.fruitFamily && !product.fruitEffects)
      throw new SpiritFieldServiceError('灵果用途无效', 409);
    return {
      definitionId: 'consumable.v1',
      quantity: product.quantity,
      instanceData: consumableFactsOf({
        name: product.name,
        type: '灵果',
        quality: product.quality,
        quantity: product.quantity,
        description: product.description,
        score: 0,
        spec: buildSpiritFruitSpec({
          family: product.fruitFamily,
          effects: product.fruitEffects,
          quality: product.quality,
        }),
      }),
    };
  }
  return {
    definitionId: 'material.v1',
    quantity: product.quantity,
    instanceData: MaterialFactsSchema.parse({
      name: product.name,
      type: product.kind,
      rank: product.quality,
      element: product.element,
      description: product.description,
    }),
  };
}

export async function getSpiritFieldSnapshot(
  actor: SpiritFieldActor,
): Promise<SpiritFieldSnapshot> {
  const player = await loadCultivator(actor);
  const field = await getOrCreateSpiritField(actor.cultivatorId);
  const now = Date.now();
  const garden = gardenRule(() => settleSpiritGarden(stateOf(field), now));
  const plots = garden.plots.map((plot) => ({
    index: plot.index,
    ...(plot.unknownPlant
      ? {
          unknownPlant: {
            id: plot.unknownPlant.id,
            quality: plot.unknownPlant.quality,
          },
        }
      : {}),
    plant: plot.plant
      ? getSpiritGardenPlantView(plot.plant, player.realm)
      : null,
  }));
  const collection = garden.collection.map((plant) =>
    getSpiritGardenPlantView(plant, player.realm),
  );
  return {
    profile: {
      version: field.version,
      starterClaimed: field.starterClaimed,
      successfulHarvestCount: field.selfHarvestCount,
      maturedSpeciesCount: getSpiritGardenMaturedCount(garden),
      offlineCapMs: SPIRIT_GARDEN_OFFLINE_CAP_MS,
      collectionLimit: SPIRIT_GARDEN_COLLECTION_LIMIT,
    },
    player: { realm: player.realm, spiritStones: player.spiritStones },
    plots,
    collection,
    codex: garden.codex,
    species: [...SPIRIT_GARDEN_SPECIES],
    pendingQuantity: [
      ...garden.plots.flatMap((plot) => (plot.plant ? [plot.plant] : [])),
      ...garden.collection,
    ].reduce(
      (sum, plant) =>
        sum +
        plant.pending.reduce(
          (amount, product) => amount + product.quantity,
          0,
        ) +
        (plant.pendingSeedSpeciesId ? 1 : 0),
      0,
    ),
  };
}

export function claimSpiritFieldStarterSeeds(
  actor: SpiritFieldActor,
  input: SpiritFieldStarterRequest,
) {
  return runGardenCommand(
    actor,
    input,
    'spirit_field_starter',
    async ({ tx, field, garden }) => {
      if (field.starterClaimed)
        throw new SpiritFieldServiceError('初始灵种已经领取过了', 409);
      const seeds = [
        buildSpiritGardenSeed('licorice', '凡品', 2),
        buildSpiritGardenSeed('wild_chrysanthemum', '凡品', 2),
        buildSpiritGardenSeed('mountain_jujube', '凡品', 1),
      ];
      const delivered = await grantInventory(
        actor.cultivatorId,
        seeds.map(seedGrant),
        tx,
      );
      return {
        garden,
        starterClaimed: true,
        detail: '领取甘草、野菊与山枣灵种',
        result: {
          message: '已领取初始灵种',
          locations: locationsOf(delivered),
        },
        resourceChanges: [bagChange('starter')],
      };
    },
  );
}

export function sowSpiritField(
  actor: SpiritFieldActor,
  input: SpiritFieldSowRequest,
) {
  return runGardenCommand(
    actor,
    input,
    'spirit_field_sow',
    async ({ tx, garden, player, field, now }) => {
      const item = (
        await readFieldBag(actor.cultivatorId, tx, input.seedMaterialId)
      ).find((row) => row.id === input.seedMaterialId);
      const resource = item ? fieldResource(item) : null;
      if (
        !resource ||
        resource.kind !== 'seed' ||
        !('spec' in resource) ||
        !resource.spec
      )
        throw new SpiritFieldServiceError('没有找到可播种的灵种', 404);
      const seedName = gardenRule(
        () =>
          `${getSpiritGardenSpecies(resolveSpiritGardenSpecies(resource.spec.plant)).name}的种子`,
      );
      const plantId = globalThis.crypto.randomUUID();
      const next = gardenRule(() =>
        plantSpiritGardenSeed(
          garden,
          input.plotIndex,
          resource.spec.plant,
          plantId,
          player.realm,
          now,
        ),
      );
      await consumeFieldItem(
        actor.cultivatorId,
        input.seedMaterialId,
        input.revision,
        1,
        tx,
      );
      await createDomainEvent(
        {
          type: 'spirit-field.sown',
          aggregate: { type: 'spirit-field', id: field.id },
          data: {
            cultivatorId: actor.cultivatorId,
            spiritFieldId: field.id,
            plotIndex: input.plotIndex,
            seedMaterialId: input.seedMaterialId,
            plantName: seedName,
            seedQuality: resource.spec.plant.quality,
          },
          deduplicationKey: `spirit-garden-sow:${actor.cultivatorId}:${input.requestId}`,
        },
        tx,
      );
      return {
        garden: next,
        detail: `种下${seedName}，开始长期培育`,
        result: {
          message:
            '已栽种，幼苗将自动生长；生长时间达到后，需消耗天地灵气培育成株',
          plantId,
        },
        resourceChanges: [bagChange('sown')],
      };
    },
  );
}

export function matureSpiritField(
  actor: SpiritFieldActor,
  input: SpiritFieldMatureRequest,
) {
  return runGardenCommand(
    actor,
    input,
    'spirit_field_cultivate',
    async ({ tx, garden, player, now }) => {
      const plant = garden.plots[input.plotIndex]?.plant;
      if (!plant || plant.id !== input.plantId)
        throw new SpiritFieldServiceError('灵植已变化，请刷新后再试', 409);
      const view = getSpiritGardenPlantView(plant, player.realm);
      const next = gardenRule(() =>
        matureSpiritGardenPlant(garden, input.plotIndex, input.plantId, now),
      );
      await spendStageQi(actor, input, 'mature', view.matureQiCost, tx);
      return {
        garden: next,
        result: { message: '已培育成株，首批收成已产生，之后按周期产出' },
        detail: `将${view.speciesName}培育成株`,
        resourceChanges: [currencyChange('mature')],
      };
    },
  );
}

export function matureSpiritFieldBatch(
  actor: SpiritFieldActor,
  input: SpiritFieldMatureBatchRequest,
) {
  return runGardenCommand(
    actor,
    input,
    'spirit_field_cultivate',
    async ({ tx, garden, player, now }) => {
      let next = garden;
      let qiCost = 0;
      for (const target of input.targets) {
        const plant = next.plots[target.plotIndex]?.plant;
        if (!plant || plant.id !== target.plantId)
          throw new SpiritFieldServiceError('灵植已变化，请刷新后再试', 409);
        qiCost += getSpiritGardenPlantView(plant, player.realm).matureQiCost;
        next = gardenRule(() =>
          matureSpiritGardenPlant(next, target.plotIndex, target.plantId, now),
        );
      }
      await spendStageQi(actor, input, 'mature-batch', qiCost, tx);
      return {
        garden: next,
        result: {
          count: input.targets.length,
          message: `已将${input.targets.length}株灵植培育成株`,
        },
        detail: `将${input.targets.length}株灵植培育成株`,
        resourceChanges: [currencyChange('mature-batch')],
      };
    },
  );
}

export function branchSpiritFieldBatch(
  actor: SpiritFieldActor,
  input: SpiritFieldBranchBatchRequest,
) {
  return runGardenCommand(
    actor,
    input,
    'spirit_field_branch',
    async ({ tx, garden, player, now }) => {
      let next = garden;
      let qiCost = 0;
      for (const target of input.targets) {
        const plant = next.plots[target.plotIndex]?.plant;
        if (!plant || plant.id !== target.plantId)
          throw new SpiritFieldServiceError('灵植已变化，请刷新后再试', 409);
        qiCost += getSpiritGardenPlantView(plant, player.realm).branchQiCost;
        next = gardenRule(() =>
          chooseSpiritGardenBranch(
            next,
            target.plotIndex,
            target.plantId,
            input.branch,
            now,
          ),
        );
      }
      await spendStageQi(actor, input, 'branch-batch', qiCost, tx);
      return {
        garden: next,
        result: {
          count: input.targets.length,
          message: `已为${input.targets.length}株灵植选择培养方向`,
        },
        detail: `为${input.targets.length}株灵植选择培养方向`,
        resourceChanges: [currencyChange('branch-batch')],
      };
    },
  );
}

export function branchSpiritField(
  actor: SpiritFieldActor,
  input: SpiritFieldBranchRequest,
) {
  return runGardenCommand(
    actor,
    input,
    'spirit_field_branch',
    async ({ tx, garden, player, now }) => {
      const plant = garden.plots[input.plotIndex]?.plant;
      if (!plant || plant.id !== input.plantId)
        throw new SpiritFieldServiceError('灵植已变化，请刷新后再试', 409);
      const view = getSpiritGardenPlantView(plant, player.realm);
      const next = gardenRule(() =>
        chooseSpiritGardenBranch(
          garden,
          input.plotIndex,
          input.plantId,
          input.branch,
          now,
        ),
      );
      await spendStageQi(actor, input, 'branch', view.branchQiCost, tx);
      return {
        garden: next,
        result: { message: '培养方向已选定' },
        detail: `为${view.speciesName}选择培养方向`,
        resourceChanges: [currencyChange('branch')],
      };
    },
  );
}

export function evolveSpiritField(
  actor: SpiritFieldActor,
  input: SpiritFieldEvolveRequest,
) {
  return runGardenCommand(
    actor,
    input,
    'spirit_field_evolve',
    async ({ tx, garden, player, now }) => {
      const plant = garden.plots[input.plotIndex]?.plant;
      if (!plant || plant.id !== input.plantId)
        throw new SpiritFieldServiceError('灵植已变化，请刷新后再试', 409);
      const view = getSpiritGardenPlantView(plant, player.realm);
      const next = gardenRule(() =>
        evolveSpiritGardenPlant(
          garden,
          input.plotIndex,
          input.plantId,
          player.realm,
          now,
          randomInt(1_000_000) / 1_000_000,
        ),
      );
      const item = (
        await readFieldBag(actor.cultivatorId, tx, input.resourceId)
      ).find((row) => row.id === input.resourceId);
      const resource = item ? fieldResource(item) : null;
      if (
        !resource ||
        resource.kind !== 'herb' ||
        QUALITY_ORDER[resource.quality] <
          QUALITY_ORDER[view.evolveCost.materialQuality]
      )
        throw new SpiritFieldServiceError(
          `请选择${view.evolveCost.materialQuality}及以上的灵草材料`,
          409,
        );
      await spendStageQi(actor, input, 'evolve', view.evolveCost.qi, tx);
      await consumeFieldItem(
        actor.cultivatorId,
        input.resourceId,
        input.resourceRevision,
        view.evolveCost.quantity,
        tx,
      );
      await spendStones(actor, player, view.evolveCost.spiritStones, tx);
      const evolvedPlant = next.plots[input.plotIndex]!.plant!;
      const nextView = getSpiritGardenPlantView(evolvedPlant, player.realm);
      const evolved = evolvedPlant.evolved;
      const message = evolved
        ? '灵植蜕变成功，之后产物的品质提升一档'
        : nextView.evolutionAttemptsRemaining === 0
          ? '蜕变失败，本次费用已消耗。本株蜕变次数已用完，仍按原培养方向产出'
          : `蜕变失败，本次费用已消耗。仍按原培养方向产出，剩余${nextView.evolutionAttemptsRemaining}次尝试；在田生长${Math.ceil(nextView.evolveCooldownRemainingMs / 3_600_000)}小时、冷却结束后可重试，收成已满或灵植处于暂存区时暂停计时`;
      return {
        garden: next,
        detail: `${view.speciesName}：${message}`,
        result: {
          message,
          evolved,
          attemptsRemaining: nextView.evolutionAttemptsRemaining,
          chance: view.evolveSuccessChance,
          cooldownRemainingMs: nextView.evolveCooldownRemainingMs,
        },
        resourceChanges: [bagChange('evolved'), currencyChange('evolve')],
      };
    },
  );
}

export function archiveSpiritField(
  actor: SpiritFieldActor,
  input: SpiritFieldArchiveRequest,
) {
  return runGardenCommand(
    actor,
    input,
    'spirit_field_archive',
    async ({ garden, now }) => ({
      garden: gardenRule(() =>
        archiveSpiritGardenPlant(garden, input.plotIndex, input.plantId, now),
      ),
      detail: '暂存灵植，保留培养进度与待领收成',
      result: { message: '已暂存灵植' },
    }),
  );
}

export function restoreSpiritField(
  actor: SpiritFieldActor,
  input: SpiritFieldRestoreRequest,
) {
  return runGardenCommand(
    actor,
    input,
    'spirit_field_restore',
    async ({ garden, player, now }) => ({
      garden: gardenRule(() =>
        restoreSpiritGardenPlant(
          garden,
          input.plotIndex,
          input.plantId,
          player.realm,
          now,
        ),
      ),
      detail: '将灵植从暂存区移回灵田，继续生长与生产',
      result: { message: '灵植已移回灵田' },
    }),
  );
}

export function uprootSpiritField(
  actor: SpiritFieldActor,
  input: SpiritFieldUprootRequest,
) {
  return runGardenCommand(
    actor,
    input,
    'spirit_field_uproot',
    async ({ tx, garden }) => {
      const cleared = gardenRule(() =>
        uprootLegacySpiritGardenPlant(
          garden,
          input.plotIndex,
          input.plantId,
          () => randomInt(1_000_000) / 1_000_000,
        ),
      );
      const seed = cleared.seed;
      const delivered = await grantInventory(
        actor.cultivatorId,
        [seedGrant(buildSpiritGardenSeed(seed.speciesId, seed.quality, 1))],
        tx,
      );
      return {
        garden: cleared.state,
        detail: `铲除未知灵植，获得1枚${seed.quality}新灵种`,
        result: {
          message: '已铲除未知灵植，获得1枚同品质新灵种',
          seeds: [seed],
          quantity: 1,
          locations: locationsOf(delivered),
        },
        resourceChanges: [bagChange('uprooted')],
      };
    },
  );
}

export function retireSpiritField(
  actor: SpiritFieldActor,
  input: SpiritFieldRetireRequest,
) {
  const clearingPlot = input.plotIndex !== undefined;
  return runGardenCommand(
    actor,
    input,
    'spirit_field_retire',
    async ({ tx, garden, now }) => {
      const cleared =
        input.plotIndex !== undefined
          ? gardenRule(() =>
              clearSpiritGardenPlot(
                garden,
                input.plotIndex!,
                input.plantId,
                now,
                randomInt(1_000_000) / 1_000_000,
              ),
            )
          : {
              state: gardenRule(() =>
                retireSpiritGardenPlant(garden, input.plantId, now),
              ),
              seed: null,
            };
      const seeds = cleared.seed ? [cleared.seed] : [];
      const delivered = seeds.length
        ? await grantInventory(
            actor.cultivatorId,
            seeds.map((seed) =>
              seedGrant(
                buildSpiritGardenSeed(
                  seed.speciesId,
                  seed.quality,
                  seed.quantity,
                ),
              ),
            ),
            tx,
          )
        : [];
      return {
        garden: cleared.state,
        detail: clearingPlot
          ? cleared.seed
            ? '清理停止产出的灵植，获得1枚同物种、同原种品质的种子'
            : '清理停止产出的灵植，保留养成记录'
          : '永久移除暂存区中的一株灵植，保留养成记录',
        result: {
          message: clearingPlot
            ? cleared.seed
              ? '已清理田块，获得1枚同物种、同原种品质的种子'
              : '已清理田块，可以重新播种'
            : '已永久移除灵植，养成记录已保留',
          seeds,
          quantity: seeds.length,
          locations: locationsOf(delivered),
        },
        resourceChanges: seeds.length ? [bagChange('cleared')] : [],
      };
    },
  );
}

export function harvestSpiritField(
  actor: SpiritFieldActor,
  input: SpiritFieldHarvestRequest,
) {
  return runGardenCommand(
    actor,
    input,
    'spirit_field_harvest',
    async ({ tx, garden, field, now }) => {
      const harvested = gardenRule(() => harvestSpiritGarden(garden, now));
      if (!harvested.products.length && !harvested.seeds.length)
        throw new SpiritFieldServiceError('当前没有可领取的产物', 409);
      const delivered = await grantInventory(
        actor.cultivatorId,
        [
          ...harvested.products.map(productGrant),
          ...harvested.seeds.map((seed) =>
            seedGrant(
              buildSpiritGardenSeed(
                seed.speciesId,
                seed.quality,
                seed.quantity,
              ),
            ),
          ),
        ],
        tx,
      );
      for (let index = 0; index < harvested.products.length; index += 1) {
        const product = harvested.products[index]!;
        const plotIndex =
          garden.plots.find(
            (plot) => plot.plant?.speciesId === product.speciesId,
          )?.index ?? 0;
        await createDomainEvent(
          {
            type: 'spirit-field.harvest.completed',
            aggregate: { type: 'spirit-field', id: field.id },
            data: {
              cultivatorId: actor.cultivatorId,
              spiritFieldId: field.id,
              plotIndex,
              requestId: input.requestId,
              outcomeKind: product.kind,
              plantName: product.name,
              seedQuality: product.quality,
              highestQuality: product.quality,
              // Kept for the historical event envelope; care scoring is retired.
              careScore: 0,
              quantity: product.quantity,
            },
            deduplicationKey: `spirit-garden-harvest:${actor.cultivatorId}:${input.requestId}:${index}`,
          },
          tx,
        );
      }
      return {
        garden: harvested.state,
        detail: '一键领取灵圃待领产物',
        harvestCount: field.selfHarvestCount + 1,
        result: {
          message: '已领取全部产物',
          products: harvested.products,
          seeds: harvested.seeds,
          quantity:
            harvested.products.reduce(
              (sum, product) => sum + product.quantity,
              0,
            ) + harvested.seeds.reduce((sum, seed) => sum + seed.quantity, 0),
          locations: locationsOf(delivered),
        },
        resourceChanges: [bagChange('harvested')],
      };
    },
  );
}

function locationsOf(items: InventoryItem[]) {
  return [...new Set(items.map((item) => item.location))];
}
