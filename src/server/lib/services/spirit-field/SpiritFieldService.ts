import { getExecutor, type DbExecutor, type DbTransaction } from '@server/lib/drizzle/db';
import { consumables, cultivators, materials } from '@server/lib/drizzle/schema';
import { createDomainEvent } from '@server/lib/mq/domainEventWriter';
import { getOrCreateSpiritField, updateSpiritField } from '@server/lib/repositories/SpiritFieldRepository';
import { playerCommandExecutor } from '@server/lib/services/CommandExecutors';
import { ConditionService } from '@server/lib/services/ConditionService';
import { QiService } from '@server/lib/services/QiService';
import { qiCurrencyChange } from '@server/lib/services/QiResourceChanges';
import { addConsumableToInventoryInTransaction, consumeConsumableById, consumeMaterialById } from '@server/lib/services/cultivator/CultivatorInventoryRepository';
import { loadPlayerConsumableOperationFacts } from '@server/lib/services/cultivator/CultivatorConditionFactsReader';
import { updateSpiritStones } from '@server/lib/services/cultivator/CultivatorStateRepository';
import { mapConsumableRow } from '@server/lib/services/consumablePersistence';
import { addMaterialStackToInventory } from '@server/lib/services/materialInventory';
import type { SpiritFieldCultivateRequest, SpiritFieldHarvestRequest, SpiritFieldSowRequest } from '@shared/contracts/spiritField';
import type { ResourceChangeDescriptor } from '@shared/contracts/resources';
import { SPIRIT_FIELD_METHODS, SPIRIT_FIELD_STARTER_BATCHES, SpiritSeedGenerator, advanceSpiritFieldPlotToDecision, buildSpiritFruitSpec, canPlantSpiritFieldSeed, getCultivationResourceCost, getSpiritFieldMethod, getSpiritFieldPlotRuntime, getStageDurationMs, readSpiritFieldSeedSpec, resetSpiritFieldPlot, settleSpiritFieldHarvest, type SpiritFieldCultivationMethod, type SpiritFieldPlotState } from '@shared/engine/spirit-field';
import { isPillConsumable } from '@shared/lib/consumables';
import type { Consumable, Material } from '@shared/types/cultivator';
import type { MaterialType, RealmType } from '@shared/types/constants';
import { and, eq } from 'drizzle-orm';
import { finalizeSpiritFieldIdentity, judgeSpiritFieldStage, stageJudgmentScore } from './SpiritFieldLlmService';

export type SpiritFieldActor = { userId: string; cultivatorId: string };
export class SpiritFieldServiceError extends Error { constructor(message: string, readonly status: 400 | 404 | 409 = 400) { super(message); } }

async function loadCultivator(actor: SpiritFieldActor, q: DbExecutor | DbTransaction = getExecutor()) {
  const [row] = await q.select({ id: cultivators.id, userId: cultivators.userId, realm: cultivators.realm, spiritStones: cultivators.spirit_stones }).from(cultivators).where(and(eq(cultivators.id, actor.cultivatorId), eq(cultivators.userId, actor.userId), eq(cultivators.status, 'active'))).limit(1);
  if (!row) throw new SpiritFieldServiceError('当前没有可用的活跃角色', 404);
  return row;
}

async function addMaterial(tx: DbTransaction, cultivatorId: string, material: Omit<Material, 'id'>) { await addMaterialStackToInventory(cultivatorId, material, tx); }
function itemResourceKind(method: SpiritFieldCultivationMethod): MaterialType | 'pill' | null {
  const kind = getSpiritFieldMethod(method).resourceKind;
  return ['herb', 'ore', 'monster', 'tcdb', 'aux', 'pill'].includes(kind) ? kind as MaterialType | 'pill' : null;
}

async function resolveResource(actor: SpiritFieldActor, method: SpiritFieldCultivationMethod, resourceId?: string, q: DbExecutor | DbTransaction = getExecutor()): Promise<{ name?: string }> {
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
      if (!root) throw new SpiritFieldServiceError('当前没有可用于本命灌注的灵根');
      return { name: `${root.element}灵根` };
    }
    return {};
  }
  if (!resourceId) throw new SpiritFieldServiceError('请选择本次培育要消耗的物品');
  if (kind === 'pill') {
    const [row] = await q.select().from(consumables).where(and(eq(consumables.id, resourceId), eq(consumables.cultivatorId, actor.cultivatorId))).limit(1);
    if (!row || !isPillConsumable(mapConsumableRow(row))) throw new SpiritFieldServiceError('所选物品不是可用于化丹培元的丹药');
    return { name: row.name };
  }
  const [row] = await q.select().from(materials).where(and(eq(materials.id, resourceId), eq(materials.cultivatorId, actor.cultivatorId), eq(materials.type, kind))).limit(1);
  if (!row) throw new SpiritFieldServiceError(`请选择一份${kind}类材料`);
  return { name: row.name };
}

export async function getSpiritFieldSnapshot(actor: SpiritFieldActor) {
  const row = await loadCultivator(actor);
  const field = await getOrCreateSpiritField(actor.cultivatorId);
  const realm = row.realm as RealmType;
  const qi = await QiService.getQiState(actor.cultivatorId);
  const facts = await loadPlayerConsumableOperationFacts(actor.userId, actor.cultivatorId);
  const condition = facts ? ConditionService.tickNaturalRecovery(facts, facts.condition) : null;
  const [materialRows, consumableRows] = await Promise.all([
    getExecutor().select().from(materials).where(eq(materials.cultivatorId, actor.cultivatorId)),
    getExecutor().select().from(consumables).where(eq(consumables.cultivatorId, actor.cultivatorId)),
  ]);
  const seeds = materialRows.flatMap((item) => {
    const spec = readSpiritFieldSeedSpec(item.details);
    return spec ? [{ materialId: item.id, name: item.name, description: item.description, quantity: item.quantity, quality: item.rank, element: item.element, minRealm: spec.plant.minRealm, canPlant: canPlantSpiritFieldSeed(realm, spec.plant), clues: spec.plant.clueTexts }] : [];
  });
  const resources = [
    ...materialRows.filter((item) => ['herb', 'ore', 'monster', 'tcdb', 'aux'].includes(item.type)).map((item) => ({ id: item.id, name: item.name, kind: item.type, quality: item.rank, quantity: item.quantity })),
    ...consumableRows.map(mapConsumableRow).filter(isPillConsumable).map((item) => ({ id: item.id!, name: item.name, kind: 'pill' as const, quality: item.quality, quantity: item.quantity })),
  ];
  const now = Date.now();
  const plots = field.plots.map((storedPlot) => {
    const plot = advanceSpiritFieldPlotToDecision(storedPlot, now);
    const runtime = getSpiritFieldPlotRuntime(plot, now);
    const methods = runtime.stage ? SPIRIT_FIELD_METHODS.filter((method) => method.stage === runtime.stage).map((method) => ({ ...method, cost: plot.plant ? getCultivationResourceCost(method.id, plot.plant.quality) : { amount: 0, spiritStones: 0 } })) : [];
    return { ...plot, plant: plot.plant ? { seedName: plot.plant.seedName, seedDescription: plot.plant.seedDescription, clues: plot.plant.clueTexts, quality: plot.plant.quality, element: plot.plant.element } : null, unlocked: true, ...runtime, methods };
  });
  return {
    profile: { id: field.id, successfulHarvestCount: field.selfHarvestCount, starterClaimed: field.starterClaimed },
    player: { realm, spiritStones: row.spiritStones, qi: qi.current, qiMax: qi.max, mp: condition?.resources.mp.current ?? 0, mpMax: condition?.resources.mp.max ?? 0 },
    plots, seeds, resources,
  };
}

export async function claimSpiritFieldStarterSeeds(actor: SpiritFieldActor) {
  const starterMaterials = await SpiritSeedGenerator.generateBatches(SPIRIT_FIELD_STARTER_BATCHES);
  return playerCommandExecutor.executeWithLock({ userId: actor.userId, cultivatorId: actor.cultivatorId, source: 'spirit_field_starter', command: async (tx) => {
    await loadCultivator(actor, tx);
    const field = await getOrCreateSpiritField(actor.cultivatorId, tx);
    if (field.starterClaimed) throw new SpiritFieldServiceError('初始灵种已经领取过了', 409);
    for (const material of starterMaterials) await addMaterial(tx, actor.cultivatorId, material);
    await updateSpiritField(tx, field.id, { starterClaimed: true });
    return { result: { message: '已领取初始灵种' }, resourceChanges: [{ resourceTopic: 'inventory.materials' as const, eventType: 'inventory.spirit-field.starter', operation: 'invalidate' as const }] };
  } });
}

export async function sowSpiritField(actor: SpiritFieldActor, input: SpiritFieldSowRequest) {
  return playerCommandExecutor.executeWithLock({ userId: actor.userId, cultivatorId: actor.cultivatorId, source: 'spirit_field_sow', command: async (tx) => {
    const row = await loadCultivator(actor, tx);
    const field = await getOrCreateSpiritField(actor.cultivatorId, tx);
    const plot = field.plots[input.plotIndex];
    if (!plot) throw new SpiritFieldServiceError('田块不存在', 404);
    if (plot.plant) throw new SpiritFieldServiceError('这块灵田已经种有灵植', 409);
    const [seed] = await tx.select().from(materials).where(and(eq(materials.id, input.seedMaterialId), eq(materials.cultivatorId, actor.cultivatorId), eq(materials.type, 'seed'))).limit(1);
    const spec = seed ? readSpiritFieldSeedSpec(seed.details) : null;
    if (!seed || !spec) throw new SpiritFieldServiceError('没有找到可播种的灵植种子', 404);
    if (seed.rank !== spec.plant.quality) throw new SpiritFieldServiceError('灵种品质快照异常，请重新获取该灵种');
    if (!canPlantSpiritFieldSeed(row.realm as RealmType, spec.plant)) throw new SpiritFieldServiceError('当前境界还不足以驾驭这枚灵种', 409);
    await consumeMaterialById(actor.userId, actor.cultivatorId, seed.id, 1, tx);
    const plantedAt = new Date().toISOString();
    const plots = [...field.plots];
    plots[input.plotIndex] = { index: input.plotIndex, plantId: spec.plant.id, plant: spec.plant, plantedAt, stageIndex: 0, stageStartedAt: null, stageEndsAt: null, history: [] };
    await updateSpiritField(tx, field.id, { plots });
    await createDomainEvent({ type: 'spirit-field.sown', aggregate: { type: 'spirit-field', id: field.id }, data: { cultivatorId: actor.cultivatorId, spiritFieldId: field.id, plotIndex: input.plotIndex, seedMaterialId: seed.id, plantName: spec.plant.seedName, seedQuality: spec.plant.quality }, deduplicationKey: `spirit-field-sow:${field.id}:${input.plotIndex}:${seed.id}:${plantedAt}` }, tx);
    return { result: { message: `已种下${spec.plant.seedName}`, plotIndex: input.plotIndex }, resourceChanges: [{ resourceTopic: 'inventory.materials' as const, eventType: 'inventory.spirit-field.seed-consumed', operation: 'invalidate' as const }] };
  } });
}

async function consumeCultivationCost(actor: SpiritFieldActor, tx: DbTransaction, plot: SpiritFieldPlotState, method: SpiritFieldCultivationMethod, resourceId: string | undefined, requestId: string) {
  const definition = getSpiritFieldMethod(method);
  const cost = getCultivationResourceCost(method, plot.plant!.quality);
  let qiChange: ReturnType<typeof qiCurrencyChange> | null = null;
  let spiritStones: number | null = null;
  let condition: ReturnType<typeof ConditionService.applyExternalResourceLoss> | null = null;
  if (definition.resourceKind === 'qi') {
    const actionInstanceId = `spirit-field-cultivate:${actor.cultivatorId}:${requestId}`;
    const reservation = await QiService.reserveQi({ cultivatorId: actor.cultivatorId, action: 'spirit_field_care', actionInstanceId, cost: cost.amount, metadata: { plotIndex: plot.index, method }, tx });
    await QiService.commitReservation({ actionInstanceId, tx });
    qiChange = qiCurrencyChange('currency.spirit-field.care', reservation);
  }
  if (definition.resourceKind === 'spirit_stones') spiritStones = await updateSpiritStones(actor.userId, actor.cultivatorId, -cost.amount, tx);
  if (cost.spiritStones > 0) spiritStones = await updateSpiritStones(actor.userId, actor.cultivatorId, -cost.spiritStones, tx);
  if (['herb', 'ore', 'monster', 'tcdb', 'aux'].includes(definition.resourceKind)) await consumeMaterialById(actor.userId, actor.cultivatorId, resourceId!, cost.amount, tx);
  if (definition.resourceKind === 'pill') await consumeConsumableById(actor.userId, actor.cultivatorId, resourceId!, cost.amount, tx);
  if (definition.resourceKind === 'mp') {
    const facts = await loadPlayerConsumableOperationFacts(actor.userId, actor.cultivatorId, tx);
    if (!facts) throw new SpiritFieldServiceError('角色状态不存在', 404);
    const current = ConditionService.tickNaturalRecovery(facts, facts.condition);
    if (current.resources.mp.current < cost.amount) throw new SpiritFieldServiceError(`法力不足，需要 ${cost.amount} 点`, 409);
    condition = ConditionService.applyExternalResourceLoss(facts, current, { mpFlat: cost.amount });
    await tx.update(cultivators).set({ condition }).where(eq(cultivators.id, actor.cultivatorId));
  }
  return { cost, qiChange, spiritStones, condition };
}

export async function cultivateSpiritField(actor: SpiritFieldActor, input: SpiritFieldCultivateRequest, abortSignal?: AbortSignal) {
  await loadCultivator(actor);
  const initialField = await getOrCreateSpiritField(actor.cultivatorId);
  const initialPlot = advanceSpiritFieldPlotToDecision(initialField.plots[input.plotIndex]!);
  const initialRuntime = getSpiritFieldPlotRuntime(initialPlot);
  const definition = getSpiritFieldMethod(input.method);
  const preparation =
    initialPlot?.plant &&
    initialRuntime.status === 'awaiting_cultivation' &&
    definition.stage === initialRuntime.stage
      ? await (async () => {
          const resource = await resolveResource(
            actor,
            input.method,
            input.resourceId,
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
  const committed = await playerCommandExecutor.executeWithLock({ userId: actor.userId, cultivatorId: actor.cultivatorId, source: 'spirit_field_cultivate', requestId: input.requestId, idempotency: { key: input.requestId, fingerprint: JSON.stringify(input) }, command: async (tx) => {
    if (!preparation) throw new SpiritFieldServiceError('当前阶段不能使用这种培育方式', 409);
    await loadCultivator(actor, tx);
    const field = await getOrCreateSpiritField(actor.cultivatorId, tx);
    const plot = advanceSpiritFieldPlotToDecision(field.plots[input.plotIndex]!);
    const runtime = getSpiritFieldPlotRuntime(plot);
    if (!plot.plant || runtime.status !== 'awaiting_cultivation' || runtime.stage !== definition.stage) throw new SpiritFieldServiceError('这株灵植已经不在待培育状态', 409);
    await resolveResource(actor, input.method, input.resourceId, tx);
    const { cost, qiChange, spiritStones, condition } = await consumeCultivationCost(actor, tx, plot, input.method, input.resourceId, input.requestId);
    const startedAt = new Date();
    const durationMs = getStageDurationMs(plot.plant, input.method, preparation.judgment.affinity);
    const history = [...plot.history, { stage: definition.stage, method: input.method, affinity: preparation.judgment.affinity, score: stageJudgmentScore(preparation.judgment), feedback: preparation.judgment.feedback, resourceName: preparation.resource.name, completedAt: startedAt.toISOString() }];
    const plots = [...field.plots];
    plots[input.plotIndex] = { ...plot, history, stageStartedAt: startedAt.toISOString(), stageEndsAt: new Date(startedAt.getTime() + durationMs).toISOString() };
    await updateSpiritField(tx, field.id, { plots, totalCareCount: field.totalCareCount + 1 });
    await createDomainEvent({ type: 'spirit-field.care.performed', aggregate: { type: 'spirit-field', id: field.id }, data: { cultivatorId: actor.cultivatorId, spiritFieldId: field.id, plotIndex: input.plotIndex, requestId: input.requestId, action: input.method, plantName: plot.plant.seedName, seedQuality: plot.plant.quality, careGrade: preparation.judgment.affinity, careScore: stageJudgmentScore(preparation.judgment), qiCost: definition.resourceKind === 'qi' ? cost.amount : 0 }, deduplicationKey: `spirit-field-care:${actor.cultivatorId}:${input.requestId}` }, tx);
    const resourceChanges: ResourceChangeDescriptor[] = [
      { resourceTopic: 'inventory.materials', eventType: 'inventory.spirit-field.cultivate', operation: 'invalidate' },
      { resourceTopic: 'inventory.consumables', eventType: 'inventory.spirit-field.cultivate', operation: 'invalidate' },
    ];
    if (qiChange) resourceChanges.push(qiChange);
    if (condition) resourceChanges.push({ resourceTopic: 'player.condition', eventType: 'condition.spirit-field.cultivate', operation: 'replace', payload: condition });
    if (spiritStones !== null) resourceChanges.push({ resourceTopic: 'player.currency', eventType: 'currency.spirit_stones.changed', operation: 'merge', payload: { spiritStones } });
    return { result: { stage: definition.stage, method: input.method, methodName: definition.name, affinity: preparation.judgment.affinity, feedback: preparation.judgment.feedback, durationMs, resourceName: preparation.resource.name }, resourceChanges };
  } });
  return committed;
}

export async function harvestSpiritField(actor: SpiritFieldActor, input: SpiritFieldHarvestRequest, abortSignal?: AbortSignal) {
  await loadCultivator(actor);
  const initialField = await getOrCreateSpiritField(actor.cultivatorId);
  const initialPlot = initialField.plots[input.plotIndex];
  const preparation =
    initialPlot?.plant &&
    getSpiritFieldPlotRuntime(initialPlot).status === 'ready_to_harvest'
      ? await (async () => {
          const settlementSeed = `${initialField.id}:${input.plotIndex}:${initialPlot.plantedAt}:${initialPlot.plant!.id}`;
          const settlement = settleSpiritFieldHarvest(initialPlot, settlementSeed);
          const identity = await finalizeSpiritFieldIdentity({ plant: initialPlot.plant!, history: initialPlot.history, settlement, abortSignal });
          return { settlement, identity };
        })()
      : null;
  return playerCommandExecutor.executeWithLock({ userId: actor.userId, cultivatorId: actor.cultivatorId, source: 'spirit_field_harvest', requestId: input.requestId, idempotency: { key: input.requestId, fingerprint: JSON.stringify(input) }, command: async (tx) => {
    if (!preparation) throw new SpiritFieldServiceError('灵植尚未成型，暂不可采摘', 409);
    await loadCultivator(actor, tx);
    const field = await getOrCreateSpiritField(actor.cultivatorId, tx);
    const plot = field.plots[input.plotIndex];
    if (!plot?.plant || getSpiritFieldPlotRuntime(plot).status !== 'ready_to_harvest') throw new SpiritFieldServiceError('灵植尚未成型，暂不可采摘', 409);
    const verified = settleSpiritFieldHarvest(plot, `${field.id}:${input.plotIndex}:${plot.plantedAt}:${plot.plant.id}`);
    if (JSON.stringify(verified) !== JSON.stringify(preparation.settlement)) throw new SpiritFieldServiceError('造化结果已经变化，请重新查看灵田', 409);
    if (preparation.settlement.outcomeKind === 'spirit_fruit') {
      const fruit: Consumable = { name: preparation.identity.name, type: '灵果', quality: preparation.settlement.quality, quantity: preparation.settlement.quantity, description: preparation.identity.description, score: 0, spec: buildSpiritFruitSpec({ family: preparation.settlement.fruitFamily!, quality: preparation.settlement.quality }) };
      await addConsumableToInventoryInTransaction(actor.cultivatorId, fruit, tx);
    } else {
      await addMaterial(tx, actor.cultivatorId, { name: preparation.identity.name, type: preparation.settlement.outcomeKind, rank: preparation.settlement.quality, element: plot.plant.element, description: preparation.identity.description, details: { spiritFieldProduct: { source: 'spirit_field_v1' } }, quantity: preparation.settlement.quantity });
    }
    const plots = [...field.plots];
    plots[input.plotIndex] = resetSpiritFieldPlot(input.plotIndex);
    const successfulHarvestCount = field.selfHarvestCount + 1;
    await updateSpiritField(tx, field.id, { plots, selfHarvestCount: successfulHarvestCount });
    await createDomainEvent({ type: 'spirit-field.harvest.completed', aggregate: { type: 'spirit-field', id: field.id }, data: { cultivatorId: actor.cultivatorId, spiritFieldId: field.id, plotIndex: input.plotIndex, requestId: input.requestId, outcomeKind: preparation.settlement.outcomeKind, plantName: preparation.identity.name, seedQuality: plot.plant.quality, highestQuality: preparation.settlement.quality, careScore: preparation.settlement.score, quantity: preparation.settlement.quantity }, deduplicationKey: `spirit-field-harvest:${actor.cultivatorId}:${input.requestId}` }, tx);
    return { result: { name: preparation.identity.name, description: preparation.identity.description, ...preparation.settlement, successfulHarvestCount }, resourceChanges: [{ resourceTopic: preparation.settlement.outcomeKind === 'spirit_fruit' ? 'inventory.consumables' as const : 'inventory.materials' as const, eventType: 'inventory.spirit-field.harvest', operation: 'invalidate' as const }] };
  } });
}
