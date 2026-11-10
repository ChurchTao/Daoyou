import { QUALITY_ORDER } from '@daoyou/constants/qualities';
import type { RealmType } from '@daoyou/constants/realms';
import type { ResourceChangeDescriptor } from '@daoyou/contracts/resources';
import type {
  SpiritFieldArchiveRequest,
  SpiritFieldBranchRequest,
  SpiritFieldEvolveRequest,
  SpiritFieldHarvestRequest,
  SpiritFieldRestoreRequest,
  SpiritFieldRetireRequest,
  SpiritFieldSnapshot,
  SpiritFieldSowRequest,
  SpiritFieldStarterRequest,
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
  archiveSpiritGardenPlant,
  buildSpiritFruitSpec,
  buildSpiritGardenSeed,
  chooseSpiritGardenBranch,
  evolveSpiritGardenPlant,
  getSpiritGardenMaturedCount,
  getSpiritGardenPlantView,
  getSpiritGardenSpecies,
  harvestSpiritGarden,
  migrateLegacySpiritGarden,
  plantSpiritGardenSeed,
  resolveSpiritGardenSpecies,
  restoreSpiritGardenPlant,
  retireSpiritGardenPlant,
  settleSpiritGarden,
  SPIRIT_GARDEN_COLLECTION_LIMIT,
  SPIRIT_GARDEN_OFFLINE_CAP_MS,
  SPIRIT_GARDEN_SPECIES,
} from '@daoyou/game-rules/spirit-field';
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

function stateOf(field: SpiritFieldRecord, now: number) {
  return (
    field.garden ??
    gardenRule(() => migrateLegacySpiritGarden(field.plots, now, field.id))
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
      const garden = gardenRule(() =>
        settleSpiritGarden(stateOf(field, now), now),
      );
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
const currencyChange = (spiritStones: number): ResourceChangeDescriptor => ({
  resourceTopic: 'player.currency',
  eventType: 'currency.spirit_stones.changed',
  operation: 'merge',
  payload: { spiritStones },
});

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

async function initializeLegacyField(
  actor: SpiritFieldActor,
  field: SpiritFieldRecord,
) {
  if (field.garden !== null) return;
  // A read may initialize the legacy aggregate once; production is still projected
  // from timestamps, and all subsequent reads leave the persistent cursor alone.
  await playerCommandExecutor.executeWithLock({
    allowEmpty: true,
    userId: actor.userId,
    cultivatorId: actor.cultivatorId,
    source: 'spirit_field_initialize',
    command: async (tx) => {
      await loadCultivator(actor, tx);
      const current = await getOrCreateSpiritField(actor.cultivatorId, tx);
      if (current.garden === null)
        await updateSpiritField(tx, current.id, {
          garden: stateOf(current, Date.now()),
        });
      return { result: null, resourceChanges: [] };
    },
  });
}

export async function getSpiritFieldSnapshot(
  actor: SpiritFieldActor,
): Promise<SpiritFieldSnapshot> {
  const player = await loadCultivator(actor);
  let field = await getOrCreateSpiritField(actor.cultivatorId);
  if (field.garden === null) {
    await initializeLegacyField(actor, field);
    field = await getOrCreateSpiritField(actor.cultivatorId);
  }
  const now = Date.now();
  const garden = gardenRule(() => settleSpiritGarden(stateOf(field, now), now));
  const plots = garden.plots.map((plot) => ({
    index: plot.index,
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
        plant.pending.reduce((amount, product) => amount + product.quantity, 0),
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
      const seedName = `${getSpiritGardenSpecies(resolveSpiritGardenSpecies(resource.spec.plant)).name}的种子`;
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
        result: { message: '已种下灵植，将自动成长', plantId },
        resourceChanges: [bagChange('sown')],
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
    async ({ garden, now }) => ({
      garden: gardenRule(() =>
        chooseSpiritGardenBranch(
          garden,
          input.plotIndex,
          input.plantId,
          input.branch,
          now,
        ),
      ),
      result: { message: '培养方向已确定' },
      detail: '为灵植确定长期培养方向',
    }),
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
      await consumeFieldItem(
        actor.cultivatorId,
        input.resourceId,
        input.resourceRevision,
        view.evolveCost.quantity,
        tx,
      );
      const spiritStones = await spendStones(
        actor,
        player,
        view.evolveCost.spiritStones,
        tx,
      );
      return {
        garden: next,
        detail: `${view.speciesName}完成蜕变`,
        result: { message: '灵植蜕变成功' },
        resourceChanges: [bagChange('evolved'), currencyChange(spiritStones)],
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
      detail: '灵植移入保种收藏，保留成长与待领产物',
      result: { message: '已移入保种收藏' },
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
      detail: '从保种收藏迁回灵植，继续成长与生产',
      result: { message: '灵植已迁回田中' },
    }),
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
    async ({ garden, now }) => ({
      garden: gardenRule(() =>
        retireSpiritGardenPlant(garden, input.plantId, now, input.plotIndex),
      ),
      detail: clearingPlot
        ? '清理采尽的灵植，保留图录成果'
        : '结束一株收藏灵植的培育，保留图录成果',
      result: {
        message: clearingPlot
          ? '已清畦，可以重新播种'
          : '已结束培育，图录成果已保留',
      },
    }),
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
      if (!harvested.products.length)
        throw new SpiritFieldServiceError('当前没有可领取的产物', 409);
      const delivered = await grantInventory(
        actor.cultivatorId,
        harvested.products.map(productGrant),
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
          quantity: harvested.products.reduce(
            (sum, product) => sum + product.quantity,
            0,
          ),
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
