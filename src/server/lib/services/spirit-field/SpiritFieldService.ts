import {
  getExecutor,
  type DbExecutor,
  type DbTransaction,
} from '@server/lib/drizzle/db';
import { cultivators } from '@server/lib/drizzle/schema';
import { createDomainEvent } from '@server/lib/mq/domainEventWriter';
import {
  getOrCreateSpiritField,
  updateSpiritField,
} from '@server/lib/repositories/SpiritFieldRepository';
import { playerCommandExecutor } from '@server/lib/services/CommandExecutors';
import { ConditionService } from '@server/lib/services/ConditionService';
import { qiCurrencyChange } from '@server/lib/services/QiResourceChanges';
import { QiService } from '@server/lib/services/QiService';
import { loadPlayerConsumableOperationFacts } from '@server/lib/services/cultivator/CultivatorConditionFactsReader';
import { updateSpiritStones } from '@server/lib/services/cultivator/CultivatorStateRepository';
import type { ResourceChangeDescriptor } from '@shared/contracts/resources';
import type {
  SpiritFieldCultivateRequest,
  SpiritFieldHarvestRequest,
  SpiritFieldSowRequest,
} from '@shared/contracts/spiritField';
import {
  SPIRIT_FIELD_METHODS,
  SPIRIT_FIELD_STARTER_BATCHES,
  SpiritSeedGenerator,
  advanceSpiritFieldPlotToDecision,
  buildSpiritFruitSpec,
  canPlantSpiritFieldSeed,
  getCultivationResourceCost,
  getSpiritFieldMethod,
  getSpiritFieldPlotRuntime,
  getStageDurationMs,
  resetSpiritFieldPlot,
  settleSpiritFieldHarvest,
  type SpiritFieldCultivationMethod,
  type SpiritFieldPlotState,
} from '@shared/engine/spirit-field';
import type { InventoryItem } from '@shared/inventory';
import { consumableFactsOf } from '@shared/items/definitions/consumables';
import { MaterialFactsSchema } from '@shared/items/definitions/materials';
import { seedFactsOf } from '@shared/items/definitions/seeds';
import type { MaterialType, RealmType } from '@shared/types/constants';
import type { Consumable, Material } from '@shared/types/cultivator';
import { and, eq } from 'drizzle-orm';
import { findPlayerMutationRequest } from '../../repositories/playerStateRepository';
import { grantInventory } from '../InventoryService';
import {
  consumeFieldItem,
  fieldResource,
  readFieldBag,
} from './SpiritFieldInventory';
import {
  finalizeSpiritFieldIdentity,
  judgeSpiritFieldStage,
  stageJudgmentScore,
} from './SpiritFieldLlmService';

export type SpiritFieldActor = { userId: string; cultivatorId: string };
export class SpiritFieldServiceError extends Error {
  constructor(
    message: string,
    readonly status: 400 | 404 | 409 = 400,
  ) {
    super(message);
  }
}

async function loadCultivator(
  actor: SpiritFieldActor,
  q: DbExecutor | DbTransaction = getExecutor(),
) {
  const [row] = await q
    .select({
      id: cultivators.id,
      userId: cultivators.userId,
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
  return row;
}

async function addMaterial(
  tx: DbTransaction,
  cultivatorId: string,
  material: Omit<Material, 'id'>,
) {
  return grantInventory(
    cultivatorId,
    [
      {
        definitionId: material.type === 'seed' ? 'seed.v1' : 'material.v1',
        quantity: material.quantity,
        instanceData:
          material.type === 'seed'
            ? seedFactsOf(material)
            : MaterialFactsSchema.parse({
                name: material.name,
                type: material.type,
                rank: material.rank,
                element: material.element ?? null,
                description: material.description ?? '',
              }),
      },
    ],
    tx,
  );
}
function itemResourceKind(
  method: SpiritFieldCultivationMethod,
): MaterialType | 'pill' | null {
  const kind = getSpiritFieldMethod(method).resourceKind;
  return ['herb', 'ore', 'monster', 'tcdb', 'aux', 'pill'].includes(kind)
    ? (kind as MaterialType | 'pill')
    : null;
}

async function resolveResource(
  actor: SpiritFieldActor,
  method: SpiritFieldCultivationMethod,
  resourceId?: string,
  q: DbExecutor | DbTransaction = getExecutor(),
): Promise<{ name?: string; revision?: number }> {
  const kind = itemResourceKind(method);
  if (!kind) {
    if (getSpiritFieldMethod(method).resourceKind === 'mp') {
      const facts = await loadPlayerConsumableOperationFacts(
        actor.userId,
        actor.cultivatorId,
        q,
      );
      const root = facts?.spiritual_roots
        .slice()
        .sort((left, right) => right.strength - left.strength)[0];
      if (!root)
        throw new SpiritFieldServiceError('当前没有可用于本命灌注的灵根');
      return { name: `${root.element}灵根` };
    }
    return {};
  }
  if (!resourceId)
    throw new SpiritFieldServiceError('请选择本次培育要消耗的物品');
  const item = (await readFieldBag(actor.cultivatorId, q)).find(
    (row) => row.id === resourceId,
  );
  const resource = item ? fieldResource(item) : null;
  if (!resource || resource.kind !== kind)
    throw new SpiritFieldServiceError('请选择对应类型的随身物品', 409);
  return { name: resource.name, revision: resource.revision };
}

export async function getSpiritFieldSnapshot(actor: SpiritFieldActor) {
  const row = await loadCultivator(actor);
  const field = await getOrCreateSpiritField(actor.cultivatorId);
  const realm = row.realm as RealmType;
  const qi = await QiService.getQiState(actor.cultivatorId);
  const facts = await loadPlayerConsumableOperationFacts(
    actor.userId,
    actor.cultivatorId,
  );
  const condition = facts
    ? ConditionService.tickNaturalRecovery(facts, facts.condition)
    : null;
  const bag = await readFieldBag(actor.cultivatorId);
  const available = bag.flatMap((item) => {
    const resource = fieldResource(item);
    return resource ? [resource] : [];
  });
  const seeds = available.flatMap((item) =>
    item.kind === 'seed' && 'spec' in item && item.spec
      ? [
          {
            materialId: item.id,
            revision: item.revision,
            name: item.name,
            description: item.spec.plant.seedDescription,
            quantity: item.quantity,
            quality: item.quality,
            element: item.spec.plant.element,
            minRealm: item.spec.plant.minRealm,
            canPlant: canPlantSpiritFieldSeed(realm, item.spec.plant),
            clues: item.spec.plant.clueTexts,
          },
        ]
      : [],
  );
  const resources = available
    .filter((item) => item.kind !== 'seed')
    .map(({ id, revision, name, kind, quality, quantity }) => ({
      id,
      revision,
      name,
      kind,
      quality,
      quantity,
    }));
  const now = Date.now();
  const plots = field.plots.map((storedPlot) => {
    const plot = advanceSpiritFieldPlotToDecision(storedPlot, now);
    const runtime = getSpiritFieldPlotRuntime(plot, now);
    const methods = runtime.stage
      ? SPIRIT_FIELD_METHODS.filter(
          (method) => method.stage === runtime.stage,
        ).map((method) => ({
          ...method,
          cost: plot.plant
            ? getCultivationResourceCost(method.id, plot.plant.quality)
            : { amount: 0, spiritStones: 0 },
        }))
      : [];
    return {
      ...plot,
      plant: plot.plant
        ? {
            seedName: plot.plant.seedName,
            seedDescription: plot.plant.seedDescription,
            clues: plot.plant.clueTexts,
            quality: plot.plant.quality,
            element: plot.plant.element,
          }
        : null,
      unlocked: true,
      ...runtime,
      methods,
    };
  });
  return {
    profile: {
      id: field.id,
      successfulHarvestCount: field.selfHarvestCount,
      starterClaimed: field.starterClaimed,
    },
    player: {
      realm,
      spiritStones: row.spiritStones,
      qi: qi.current,
      qiMax: qi.max,
      mp: condition?.resources.mp.current ?? 0,
      mpMax: condition?.resources.mp.max ?? 0,
    },
    plots,
    seeds,
    resources,
  };
}

export async function claimSpiritFieldStarterSeeds(actor: SpiritFieldActor) {
  const starterMaterials = await SpiritSeedGenerator.generateBatches(
    SPIRIT_FIELD_STARTER_BATCHES,
  );
  return playerCommandExecutor.executeWithLock({
    allowEmpty: true,
    userId: actor.userId,
    cultivatorId: actor.cultivatorId,
    source: 'spirit_field_starter',
    command: async (tx) => {
      await loadCultivator(actor, tx);
      const field = await getOrCreateSpiritField(actor.cultivatorId, tx);
      if (field.starterClaimed)
        throw new SpiritFieldServiceError('初始灵种已经领取过了', 409);
      const delivered: InventoryItem[] = [];
      for (const material of starterMaterials)
        delivered.push(
          ...(await addMaterial(tx, actor.cultivatorId, material)),
        );
      await updateSpiritField(tx, field.id, { starterClaimed: true });
      return {
        result: {
          message: '已领取初始灵种',
          locations: [...new Set(delivered.map((item) => item.location))],
        },
        resourceChanges: [],
      };
    },
  });
}

export async function sowSpiritField(
  actor: SpiritFieldActor,
  input: SpiritFieldSowRequest,
) {
  return playerCommandExecutor.executeWithLock({
    allowEmpty: true,
    userId: actor.userId,
    cultivatorId: actor.cultivatorId,
    source: 'spirit_field_sow',
    requestId: input.requestId,
    idempotency: { key: input.requestId, fingerprint: JSON.stringify(input) },
    command: async (tx) => {
      const row = await loadCultivator(actor, tx);
      const field = await getOrCreateSpiritField(actor.cultivatorId, tx);
      const plot = field.plots[input.plotIndex];
      if (!plot) throw new SpiritFieldServiceError('田块不存在', 404);
      if (plot.plant)
        throw new SpiritFieldServiceError('这块灵田已经种有灵植', 409);
      const seed = (await readFieldBag(actor.cultivatorId, tx)).find(
        (item) => item.id === input.seedMaterialId,
      );
      const resource = seed ? fieldResource(seed) : null;
      const spec = resource && 'spec' in resource ? resource.spec : null;
      if (!seed || !spec)
        throw new SpiritFieldServiceError('没有找到可播种的随身灵种', 404);
      if (!canPlantSpiritFieldSeed(row.realm as RealmType, spec.plant))
        throw new SpiritFieldServiceError('当前境界还不足以驾驭这枚灵种', 409);
      await consumeFieldItem(
        actor.cultivatorId,
        seed.id,
        input.revision,
        1,
        tx,
      );
      const plantedAt = new Date().toISOString();
      const plots = [...field.plots];
      plots[input.plotIndex] = {
        index: input.plotIndex,
        plantId: spec.plant.id,
        plant: spec.plant,
        plantedAt,
        stageIndex: 0,
        stageStartedAt: null,
        stageEndsAt: null,
        history: [],
      };
      await updateSpiritField(tx, field.id, { plots });
      await createDomainEvent(
        {
          type: 'spirit-field.sown',
          aggregate: { type: 'spirit-field', id: field.id },
          data: {
            cultivatorId: actor.cultivatorId,
            spiritFieldId: field.id,
            plotIndex: input.plotIndex,
            seedMaterialId: seed.id,
            plantName: spec.plant.seedName,
            seedQuality: spec.plant.quality,
          },
          deduplicationKey: `spirit-field-sow:${field.id}:${input.plotIndex}:${seed.id}:${plantedAt}`,
        },
        tx,
      );
      return {
        result: {
          message: `已种下${spec.plant.seedName}`,
          plotIndex: input.plotIndex,
        },
        resourceChanges: [],
      };
    },
  });
}

async function consumeCultivationCost(
  actor: SpiritFieldActor,
  tx: DbTransaction,
  plot: SpiritFieldPlotState,
  method: SpiritFieldCultivationMethod,
  resourceId: string | undefined,
  requestId: string,
  revision?: number,
) {
  const definition = getSpiritFieldMethod(method);
  const cost = getCultivationResourceCost(method, plot.plant!.quality);
  let qiChange: ReturnType<typeof qiCurrencyChange> | null = null;
  let spiritStones: number | null = null;
  let condition: ReturnType<
    typeof ConditionService.applyExternalResourceLoss
  > | null = null;
  if (definition.resourceKind === 'qi') {
    const actionInstanceId = `spirit-field-cultivate:${actor.cultivatorId}:${requestId}`;
    const reservation = await QiService.reserveQi({
      cultivatorId: actor.cultivatorId,
      action: 'spirit_field_care',
      actionInstanceId,
      cost: cost.amount,
      metadata: { plotIndex: plot.index, method },
      tx,
    });
    await QiService.commitReservation({ actionInstanceId, tx });
    qiChange = qiCurrencyChange('currency.spirit-field.care', reservation);
  }
  if (definition.resourceKind === 'spirit_stones')
    spiritStones = await updateSpiritStones(
      actor.userId,
      actor.cultivatorId,
      -cost.amount,
      tx,
    );
  if (cost.spiritStones > 0)
    spiritStones = await updateSpiritStones(
      actor.userId,
      actor.cultivatorId,
      -cost.spiritStones,
      tx,
    );
  if (itemResourceKind(method)) {
    if (revision === undefined)
      throw new SpiritFieldServiceError('请重新选择随身物品', 409);
    await consumeFieldItem(
      actor.cultivatorId,
      resourceId!,
      revision,
      cost.amount,
      tx,
    );
  }
  if (definition.resourceKind === 'mp') {
    const facts = await loadPlayerConsumableOperationFacts(
      actor.userId,
      actor.cultivatorId,
      tx,
    );
    if (!facts) throw new SpiritFieldServiceError('角色状态不存在', 404);
    const current = ConditionService.tickNaturalRecovery(
      facts,
      facts.condition,
    );
    if (current.resources.mp.current < cost.amount)
      throw new SpiritFieldServiceError(
        `法力不足，需要 ${cost.amount} 点`,
        409,
      );
    condition = ConditionService.applyExternalResourceLoss(facts, current, {
      mpFlat: cost.amount,
    });
    await tx
      .update(cultivators)
      .set({ condition })
      .where(eq(cultivators.id, actor.cultivatorId));
  }
  return { cost, qiChange, spiritStones, condition };
}

export async function cultivateSpiritField(
  actor: SpiritFieldActor,
  input: SpiritFieldCultivateRequest,
  abortSignal?: AbortSignal,
) {
  await loadCultivator(actor);
  const initialField = await getOrCreateSpiritField(actor.cultivatorId);
  const initialPlot = advanceSpiritFieldPlotToDecision(
    initialField.plots[input.plotIndex]!,
  );
  const initialRuntime = getSpiritFieldPlotRuntime(initialPlot);
  const definition = getSpiritFieldMethod(input.method);
  const previous = await findPlayerMutationRequest(
    actor.cultivatorId,
    'spirit_field_cultivate',
    input.requestId,
  );
  const preparation =
    !previous &&
    initialPlot?.plant &&
    initialRuntime.status === 'awaiting_cultivation' &&
    definition.stage === initialRuntime.stage
      ? await (async () => {
          const resource = await resolveResource(
            actor,
            input.method,
            input.resourceId,
          );
          if (
            itemResourceKind(input.method) &&
            resource.revision !== input.resourceRevision
          )
            throw new SpiritFieldServiceError(
              '随身物品已变化，请重新选择',
              409,
            );
          const judgment = await judgeSpiritFieldStage({
            plant: initialPlot.plant!,
            method: input.method,
            history: initialPlot.history,
            resourceName: resource.name,
            abortSignal,
          });
          return { resource, judgment };
        })()
      : null;
  const committed = await playerCommandExecutor.executeWithLock({
    allowEmpty: true,
    userId: actor.userId,
    cultivatorId: actor.cultivatorId,
    source: 'spirit_field_cultivate',
    requestId: input.requestId,
    idempotency: { key: input.requestId, fingerprint: JSON.stringify(input) },
    command: async (tx) => {
      if (!preparation)
        throw new SpiritFieldServiceError('当前阶段不能使用这种培育方式', 409);
      await loadCultivator(actor, tx);
      const field = await getOrCreateSpiritField(actor.cultivatorId, tx);
      const plot = advanceSpiritFieldPlotToDecision(
        field.plots[input.plotIndex]!,
      );
      const runtime = getSpiritFieldPlotRuntime(plot);
      if (
        !plot.plant ||
        runtime.status !== 'awaiting_cultivation' ||
        runtime.stage !== definition.stage ||
        JSON.stringify(plot) !== JSON.stringify(initialPlot)
      )
        throw new SpiritFieldServiceError('这株灵植已经不在待培育状态', 409);
      await resolveResource(actor, input.method, input.resourceId, tx);
      const { cost, qiChange, spiritStones, condition } =
        await consumeCultivationCost(
          actor,
          tx,
          plot,
          input.method,
          input.resourceId,
          input.requestId,
          input.resourceRevision,
        );
      const startedAt = new Date();
      const durationMs = getStageDurationMs(
        plot.plant,
        input.method,
        preparation.judgment.affinity,
      );
      const history = [
        ...plot.history,
        {
          stage: definition.stage,
          method: input.method,
          affinity: preparation.judgment.affinity,
          score: stageJudgmentScore(preparation.judgment),
          feedback: preparation.judgment.feedback,
          resourceName: preparation.resource.name,
          completedAt: startedAt.toISOString(),
        },
      ];
      const plots = [...field.plots];
      plots[input.plotIndex] = {
        ...plot,
        history,
        stageStartedAt: startedAt.toISOString(),
        stageEndsAt: new Date(startedAt.getTime() + durationMs).toISOString(),
      };
      await updateSpiritField(tx, field.id, {
        plots,
        totalCareCount: field.totalCareCount + 1,
      });
      await createDomainEvent(
        {
          type: 'spirit-field.care.performed',
          aggregate: { type: 'spirit-field', id: field.id },
          data: {
            cultivatorId: actor.cultivatorId,
            spiritFieldId: field.id,
            plotIndex: input.plotIndex,
            requestId: input.requestId,
            action: input.method,
            plantName: plot.plant.seedName,
            seedQuality: plot.plant.quality,
            careGrade: preparation.judgment.affinity,
            careScore: stageJudgmentScore(preparation.judgment),
            qiCost: definition.resourceKind === 'qi' ? cost.amount : 0,
          },
          deduplicationKey: `spirit-field-care:${actor.cultivatorId}:${input.requestId}`,
        },
        tx,
      );
      const resourceChanges: ResourceChangeDescriptor[] = [];
      if (qiChange) resourceChanges.push(qiChange);
      if (condition)
        resourceChanges.push({
          resourceTopic: 'player.condition',
          eventType: 'condition.spirit-field.cultivate',
          operation: 'replace',
          payload: condition,
        });
      if (spiritStones !== null)
        resourceChanges.push({
          resourceTopic: 'player.currency',
          eventType: 'currency.spirit_stones.changed',
          operation: 'merge',
          payload: { spiritStones },
        });
      return {
        result: {
          stage: definition.stage,
          method: input.method,
          methodName: definition.name,
          affinity: preparation.judgment.affinity,
          feedback: preparation.judgment.feedback,
          durationMs,
          resourceName: preparation.resource.name,
        },
        resourceChanges,
      };
    },
  });
  return committed;
}

export async function harvestSpiritField(
  actor: SpiritFieldActor,
  input: SpiritFieldHarvestRequest,
  abortSignal?: AbortSignal,
) {
  await loadCultivator(actor);
  const initialField = await getOrCreateSpiritField(actor.cultivatorId);
  const initialPlot = initialField.plots[input.plotIndex];
  const previous = await findPlayerMutationRequest(
    actor.cultivatorId,
    'spirit_field_harvest',
    input.requestId,
  );
  const preparation =
    !previous &&
    initialPlot?.plant &&
    getSpiritFieldPlotRuntime(initialPlot).status === 'ready_to_harvest'
      ? await (async () => {
          const settlementSeed = `${initialField.id}:${input.plotIndex}:${initialPlot.plantedAt}:${initialPlot.plant!.id}`;
          const settlement = settleSpiritFieldHarvest(
            initialPlot,
            settlementSeed,
          );
          const identity = await finalizeSpiritFieldIdentity({
            plant: initialPlot.plant!,
            history: initialPlot.history,
            settlement,
            abortSignal,
          });
          return { settlement, identity };
        })()
      : null;
  return playerCommandExecutor.executeWithLock({
    allowEmpty: true,
    userId: actor.userId,
    cultivatorId: actor.cultivatorId,
    source: 'spirit_field_harvest',
    requestId: input.requestId,
    idempotency: { key: input.requestId, fingerprint: JSON.stringify(input) },
    command: async (tx) => {
      if (!preparation)
        throw new SpiritFieldServiceError('灵植尚未成型，暂不可采摘', 409);
      await loadCultivator(actor, tx);
      const field = await getOrCreateSpiritField(actor.cultivatorId, tx);
      const plot = field.plots[input.plotIndex];
      if (
        !plot?.plant ||
        getSpiritFieldPlotRuntime(plot).status !== 'ready_to_harvest'
      )
        throw new SpiritFieldServiceError('灵植尚未成型，暂不可采摘', 409);
      const verified = settleSpiritFieldHarvest(
        plot,
        `${field.id}:${input.plotIndex}:${plot.plantedAt}:${plot.plant.id}`,
      );
      if (JSON.stringify(verified) !== JSON.stringify(preparation.settlement))
        throw new SpiritFieldServiceError(
          '造化结果已经变化，请重新查看灵田',
          409,
        );
      let delivered: InventoryItem[];
      if (preparation.settlement.outcomeKind === 'spirit_fruit') {
        const fruit: Consumable = {
          name: preparation.identity.name,
          type: '灵果',
          quality: preparation.settlement.quality,
          quantity: preparation.settlement.quantity,
          description: preparation.identity.description,
          score: 0,
          spec: buildSpiritFruitSpec({
            family: preparation.settlement.fruitFamily!,
            quality: preparation.settlement.quality,
          }),
        };
        delivered = await grantInventory(
          actor.cultivatorId,
          [
            {
              definitionId: 'consumable.v1',
              quantity: fruit.quantity,
              instanceData: consumableFactsOf(fruit),
            },
          ],
          tx,
        );
      } else {
        delivered = await addMaterial(tx, actor.cultivatorId, {
          name: preparation.identity.name,
          type: preparation.settlement.outcomeKind,
          rank: preparation.settlement.quality,
          element: plot.plant.element,
          description: preparation.identity.description,
          details: { spiritFieldProduct: { source: 'spirit_field_v1' } },
          quantity: preparation.settlement.quantity,
        });
      }
      const plots = [...field.plots];
      plots[input.plotIndex] = resetSpiritFieldPlot(input.plotIndex);
      const successfulHarvestCount = field.selfHarvestCount + 1;
      await updateSpiritField(tx, field.id, {
        plots,
        selfHarvestCount: successfulHarvestCount,
      });
      await createDomainEvent(
        {
          type: 'spirit-field.harvest.completed',
          aggregate: { type: 'spirit-field', id: field.id },
          data: {
            cultivatorId: actor.cultivatorId,
            spiritFieldId: field.id,
            plotIndex: input.plotIndex,
            requestId: input.requestId,
            outcomeKind: preparation.settlement.outcomeKind,
            plantName: preparation.identity.name,
            seedQuality: plot.plant.quality,
            highestQuality: preparation.settlement.quality,
            careScore: preparation.settlement.score,
            quantity: preparation.settlement.quantity,
          },
          deduplicationKey: `spirit-field-harvest:${actor.cultivatorId}:${input.requestId}`,
        },
        tx,
      );
      return {
        result: {
          name: preparation.identity.name,
          description: preparation.identity.description,
          ...preparation.settlement,
          successfulHarvestCount,
          locations: [...new Set(delivered.map((item) => item.location))],
        },
        resourceChanges: [],
      };
    },
  });
}
