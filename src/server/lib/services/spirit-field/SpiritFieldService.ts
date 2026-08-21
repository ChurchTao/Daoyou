import { getExecutor, type DbExecutor, type DbTransaction } from '@server/lib/drizzle/db';
import { cultivators, materials } from '@server/lib/drizzle/schema';
import { createDomainEvent } from '@server/lib/mq/domainEventWriter';
import {
  getOrCreateSpiritField,
  updateSpiritField,
} from '@server/lib/repositories/SpiritFieldRepository';
import { playerCommandExecutor } from '@server/lib/services/CommandExecutors';
import { updateSpiritStones } from '@server/lib/services/cultivator/CultivatorStateRepository';
import { addMaterialStackToInventory } from '@server/lib/services/materialInventory';
import { qiCurrencyChange } from '@server/lib/services/QiResourceChanges';
import { QiService } from '@server/lib/services/QiService';
import type {
  SpiritFieldCareRequest,
  SpiritFieldHarvestRequest,
  SpiritFieldSowRequest,
  SpiritFieldUpgradeRequest,
} from '@shared/contracts/spiritField';
import {
  SPIRIT_FIELD_LEVELS,
  SPIRIT_FIELD_PLOT_UNLOCKS,
  SPIRIT_FIELD_STARTER_BATCHES,
  SpiritSeedGenerator,
  buildSpiritFieldObservations,
  buildSpiritFieldSeedMaterialFromPlant,
  calculateSpiritFieldGrowth,
  calculateSpiritFieldHarvestQuantity,
  canPlantSpiritFieldSeed,
  chooseCareNeed,
  deterministicUnit,
  evaluateCareAction,
  getCareQiCost,
  getNextCareAt,
  getNextQuality,
  getSpiritFieldCareScore,
  getSpiritFieldLevelConfig,
  getSpiritFieldQualityUpgradeChance,
  getSpiritFieldRareCareDropChance,
  getSpiritFieldSeedReturnQuantity,
  isSpiritFieldPlotUnlocked,
  readSpiritFieldSeedSpec,
  type SpiritFieldPlotState,
} from '@shared/engine/spirit-field';
import type { Material } from '@shared/types/cultivator';
import type { RealmType } from '@shared/types/constants';
import { and, eq } from 'drizzle-orm';
import { interpretSpiritFieldCare, narrateSpiritFieldResult } from './SpiritFieldLlmService';

export type SpiritFieldActor = { userId: string; cultivatorId: string };

type SeedDetails = {
  spiritFieldCare?: { version?: number; effect?: string; power?: number };
};

export class SpiritFieldServiceError extends Error {
  constructor(
    message: string,
    readonly status: 400 | 404 | 409 = 400,
  ) {
    super(message);
  }
}

function careItemDetails(effect: string, power: number): Record<string, unknown> {
  return { spiritFieldCare: { version: 1, effect, power } };
}

function getCareItemMeta(details: unknown): SeedDetails['spiritFieldCare'] | null {
  if (!details || typeof details !== 'object') return null;
  const value = (details as SeedDetails).spiritFieldCare;
  return value && typeof value.effect === 'string' ? value : null;
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

function resetPlot(index: number): SpiritFieldPlotState {
  return {
    index,
    plantId: null,
    plant: null,
    plantedAt: null,
    careCount: 0,
    careBoostMs: 0,
    careScoreTotal: 0,
    careScoreCount: 0,
    lastCareAt: null,
    careNeed: null,
  };
}

async function addMaterial(
  tx: DbTransaction,
  cultivatorId: string,
  material: Omit<Material, 'id'>,
) {
  await addMaterialStackToInventory(cultivatorId, material, tx);
}

export async function getSpiritFieldSnapshot(actor: SpiritFieldActor) {
  const row = await loadCultivator(actor);
  const field = await getOrCreateSpiritField(actor.cultivatorId);
  const realm = row.realm as RealmType;
  const qi = await QiService.getQiState(actor.cultivatorId);
  const inventoryRows = await getExecutor()
    .select()
    .from(materials)
    .where(eq(materials.cultivatorId, actor.cultivatorId));

  const seeds = inventoryRows.flatMap((item) => {
    const spec = readSpiritFieldSeedSpec(item.details);
    const plant = spec?.plant;
    return plant
      ? [
          {
            materialId: item.id,
            plantId: plant.id,
            name: item.name,
            quantity: item.quantity,
            quality: item.rank,
            element: item.element,
            plantName: plant.name,
            minRealm: plant.minRealm,
            canPlant: canPlantSpiritFieldSeed(realm, plant),
          },
        ]
      : [];
  });

  const careItems = inventoryRows.flatMap((item) => {
    const meta = getCareItemMeta(item.details);
    return meta
      ? [
          {
            materialId: item.id,
            name: item.name,
            quantity: item.quantity,
            quality: item.rank,
            effect: meta.effect,
            power: meta.power ?? 0,
          },
        ]
      : [];
  });

  const now = Date.now();
  const plots = field.plots.map((plot) => {
    const unlockRule = SPIRIT_FIELD_PLOT_UNLOCKS[plot.index]!;
    const unlocked = isSpiritFieldPlotUnlocked({
      plotIndex: plot.index,
      realm,
      selfHarvestCount: field.selfHarvestCount,
    });
    const plant = plot.plant;
    const growth = calculateSpiritFieldGrowth({ plot, fieldLevel: field.level, nowMs: now });
    const nextCareAt = getNextCareAt(plot);
    return {
      ...plot,
      unlocked,
      unlockRule,
      plant,
      careScore: getSpiritFieldCareScore(plot),
      progress: growth.progress,
      mature: growth.mature,
      remainingMs: growth.remainingMs,
      nextCareAt,
      canCare:
        Boolean(plant) &&
        !growth.mature &&
        plot.careCount < (plant?.careSlots ?? 0) &&
        (!nextCareAt || nextCareAt <= now),
      observations: plant ? buildSpiritFieldObservations(plot.careNeed) : [],
    };
  });

  const level = getSpiritFieldLevelConfig(field.level);
  const nextLevel =
    field.level < SPIRIT_FIELD_LEVELS.length - 1
      ? SPIRIT_FIELD_LEVELS[field.level + 1]
      : null;

  return {
    profile: {
      id: field.id,
      level: field.level,
      levelName: level.name,
      speedBonus: level.speedBonus,
      selfHarvestCount: field.selfHarvestCount,
      totalCareCount: field.totalCareCount,
      starterClaimed: field.starterClaimed,
      proficiency: field.proficiency,
    },
    player: {
      realm,
      spiritStones: row.spiritStones,
      qi: qi.current,
      qiMax: qi.max,
    },
    upgrade: nextLevel
      ? { nextLevel: field.level + 1, name: nextLevel.name, cost: nextLevel.upgradeCost }
      : null,
    plots,
    seeds,
    careItems,
  };
}

export async function claimSpiritFieldStarterSeeds(actor: SpiritFieldActor) {
  // AI/生成器调用放在事务外，避免长事务持锁。
  const starterMaterials = await SpiritSeedGenerator.generateBatches(
    SPIRIT_FIELD_STARTER_BATCHES,
  );

  return playerCommandExecutor.executeWithLock({
    userId: actor.userId,
    cultivatorId: actor.cultivatorId,
    source: 'spirit_field_starter',
    command: async (tx) => {
      await loadCultivator(actor, tx);
      const field = await getOrCreateSpiritField(actor.cultivatorId, tx);
      if (field.starterClaimed) {
        throw new SpiritFieldServiceError('初始灵种已经领取过了', 409);
      }
      for (const material of starterMaterials) {
        await addMaterial(tx, actor.cultivatorId, material);
      }
      await updateSpiritField(tx, field.id, { starterClaimed: true });
      return {
        result: { message: '已领取初始灵种' },
        resourceChanges: [
          {
            resourceTopic: 'inventory.materials',
            eventType: 'inventory.spirit-field.starter',
            operation: 'invalidate',
          },
        ],
      };
    },
  });
}

export async function sowSpiritField(actor: SpiritFieldActor, input: SpiritFieldSowRequest) {
  return playerCommandExecutor.executeWithLock({
    userId: actor.userId,
    cultivatorId: actor.cultivatorId,
    source: 'spirit_field_sow',
    command: async (tx) => {
      const row = await loadCultivator(actor, tx);
      const field = await getOrCreateSpiritField(actor.cultivatorId, tx);
      const plot = field.plots[input.plotIndex];
      if (!plot) throw new SpiritFieldServiceError('田块不存在', 404);
      if (
        !isSpiritFieldPlotUnlocked({
          plotIndex: input.plotIndex,
          realm: row.realm as RealmType,
          selfHarvestCount: field.selfHarvestCount,
        })
      ) {
        throw new SpiritFieldServiceError('这块灵田尚未解锁', 409);
      }
      if (plot.plant) throw new SpiritFieldServiceError('这块灵田已经种有灵植', 409);

      const [seed] = await tx
        .select()
        .from(materials)
        .where(
          and(
            eq(materials.id, input.seedMaterialId),
            eq(materials.cultivatorId, actor.cultivatorId),
          ),
        )
        .limit(1);
      if (!seed) throw new SpiritFieldServiceError('没有找到这枚灵种', 404);
      const spec = readSpiritFieldSeedSpec(seed.details);
      if (!spec) throw new SpiritFieldServiceError('该物品不是可播种的灵种');
      const plant = spec.plant;
      if (plant.quality !== seed.rank) {
        throw new SpiritFieldServiceError('灵种品质快照异常，请重新获取该灵种');
      }
      if (!canPlantSpiritFieldSeed(row.realm as RealmType, plant)) {
        throw new SpiritFieldServiceError('当前境界还不足以驾驭这枚灵种', 409);
      }

      if (seed.quantity <= 1) {
        await tx.delete(materials).where(eq(materials.id, seed.id));
      } else {
        await tx
          .update(materials)
          .set({ quantity: seed.quantity - 1 })
          .where(eq(materials.id, seed.id));
      }

      const plantedAt = new Date().toISOString();
      const plots = [...field.plots];
      plots[input.plotIndex] = {
        index: input.plotIndex,
        plantId: plant.id,
        plant,
        plantedAt,
        careCount: 0,
        careBoostMs: 0,
        careScoreTotal: 0,
        careScoreCount: 0,
        lastCareAt: null,
        careNeed: chooseCareNeed(
          `${actor.cultivatorId}:${input.plotIndex}:${plantedAt}:${plant.id}`,
          plant,
        ),
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
            plantName: plant.name,
            seedQuality: plant.quality,
          },
          deduplicationKey: `spirit-field-sow:${field.id}:${input.plotIndex}:${seed.id}:${plantedAt}`,
        },
        tx,
      );
      return {
        result: { message: `已种下${plant.name}`, plotIndex: input.plotIndex },
        resourceChanges: [
          {
            resourceTopic: 'inventory.materials',
            eventType: 'inventory.spirit-field.seed-consumed',
            operation: 'invalidate',
          },
        ],
      };
    },
  });
}

export async function interpretSpiritFieldAction(
  actor: SpiritFieldActor,
  input: { plotIndex: number; message: string; abortSignal?: AbortSignal },
) {
  await loadCultivator(actor);
  const field = await getOrCreateSpiritField(actor.cultivatorId);
  const plot = field.plots[input.plotIndex];
  const plant = plot?.plant;
  if (!plot || !plant) {
    throw new SpiritFieldServiceError('这块田里还没有可照料的灵植', 404);
  }
  const growth = calculateSpiritFieldGrowth({ plot, fieldLevel: field.level });
  if (growth.mature) throw new SpiritFieldServiceError('灵植已经成熟，可以直接采收', 409);
  return interpretSpiritFieldCare({
    message: input.message,
    plant,
    observations: buildSpiritFieldObservations(plot.careNeed),
    careCount: plot.careCount,
    careSlots: plant.careSlots,
    abortSignal: input.abortSignal,
  });
}

export async function careSpiritField(actor: SpiritFieldActor, input: SpiritFieldCareRequest) {
  if (input.plan.action === 'observe' || input.plan.action === 'wait') {
    throw new SpiritFieldServiceError('这次做法不会改变灵田状态，无需确认施为');
  }
  const fingerprint = JSON.stringify({ plotIndex: input.plotIndex, plan: input.plan });
  const committed = await playerCommandExecutor.executeWithLock({
    userId: actor.userId,
    cultivatorId: actor.cultivatorId,
    source: 'spirit_field_care',
    requestId: input.requestId,
    idempotency: { key: input.requestId, fingerprint },
    command: async (tx) => {
      await loadCultivator(actor, tx);
      const field = await getOrCreateSpiritField(actor.cultivatorId, tx);
      const plot = field.plots[input.plotIndex];
      const plant = plot?.plant;
      if (!plot || !plant) {
        throw new SpiritFieldServiceError('这块田里没有可照料的灵植', 404);
      }
      const growth = calculateSpiritFieldGrowth({ plot, fieldLevel: field.level });
      if (growth.mature) throw new SpiritFieldServiceError('灵植已经成熟，无需继续养护', 409);
      if (plot.careCount >= plant.careSlots) {
        throw new SpiritFieldServiceError('这株灵植本轮已经养护充分', 409);
      }
      const nextCareAt = getNextCareAt(plot);
      if (nextCareAt && nextCareAt > Date.now()) {
        throw new SpiritFieldServiceError('灵植刚刚受过养护，需要先缓一缓', 409);
      }

      const action = input.plan.action;
      const qiCost = getCareQiCost(action);
      const evaluation = evaluateCareAction(plot.careNeed, action);
      if (evaluation.grade === 'neutral') {
        throw new SpiritFieldServiceError('这次做法不会改变灵田状态，无需确认施为');
      }
      const boostMs = Math.round(plant.baseGrowthMs * evaluation.boostPercent);
      const actionInstanceId = `spirit-field-care:${actor.cultivatorId}:${input.requestId}`;
      const reservation = await QiService.reserveQi({
        cultivatorId: actor.cultivatorId,
        action: 'spirit_field_care',
        actionInstanceId,
        cost: qiCost,
        metadata: { plantId: plant.id, plotIndex: input.plotIndex, action },
        tx,
      });
      await QiService.commitReservation({ actionInstanceId, tx });

      const caredAt = new Date().toISOString();
      const nextCareCount = plot.careCount + 1;
      const plots = [...field.plots];
      plots[input.plotIndex] = {
        ...plot,
        careCount: nextCareCount,
        careBoostMs: plot.careBoostMs + boostMs,
        careScoreTotal: plot.careScoreTotal + evaluation.careScore,
        careScoreCount: plot.careScoreCount + 1,
        lastCareAt: caredAt,
        careNeed:
          nextCareCount >= plant.careSlots
            ? null
            : chooseCareNeed(
                `${plant.id}:${plot.plantedAt}:${nextCareCount}:${action}`,
                plant,
              ),
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
            action,
            plantName: plant.name,
            seedQuality: plant.quality,
            careGrade: evaluation.grade,
            careScore: evaluation.careScore,
            qiCost,
          },
          deduplicationKey: `spirit-field-care:${actor.cultivatorId}:${input.requestId}`,
        },
        tx,
      );

      return {
        result: {
          plantName: plant.name,
          grade: evaluation.grade,
          careScore: evaluation.careScore,
          growthBoostPercent: Math.round(evaluation.boostPercent * 100),
          qiCost,
          qiAfter: reservation.qiAfter,
          careCount: nextCareCount,
          careSlots: plant.careSlots,
          narrative: '',
        },
        resourceChanges: [qiCurrencyChange('currency.spirit-field.care', reservation)],
      };
    },
  });

  committed.result.narrative = await narrateSpiritFieldResult({
    kind: 'care',
    plantName: committed.result.plantName,
    facts: {
      grade: committed.result.grade,
      careScore: committed.result.careScore,
      growthBoostPercent: committed.result.growthBoostPercent,
      qiCost: committed.result.qiCost,
      plan: input.plan.summary,
    },
    fallback: `你按既定手法细细照料${committed.result.plantName}，灵植气息随之平稳了几分。`,
  });
  return committed;
}

export async function harvestSpiritField(actor: SpiritFieldActor, input: SpiritFieldHarvestRequest) {
  const committed = await playerCommandExecutor.executeWithLock({
    userId: actor.userId,
    cultivatorId: actor.cultivatorId,
    source: 'spirit_field_harvest',
    requestId: input.requestId,
    idempotency: {
      key: input.requestId,
      fingerprint: JSON.stringify({ plotIndex: input.plotIndex, mode: input.mode }),
    },
    command: async (tx) => {
      await loadCultivator(actor, tx);
      const field = await getOrCreateSpiritField(actor.cultivatorId, tx);
      const plot = field.plots[input.plotIndex];
      const plant = plot?.plant;
      if (!plot || !plant) {
        throw new SpiritFieldServiceError('这块田里没有可采收的灵植', 404);
      }
      const growth = calculateSpiritFieldGrowth({ plot, fieldLevel: field.level });
      if (!growth.mature) throw new SpiritFieldServiceError('灵植尚未成熟', 409);

      const settlementSeed = `${field.id}:${input.plotIndex}:${plot.plantedAt}:${input.requestId}`;
      const careScore = getSpiritFieldCareScore(plot);
      const mainQuantity = calculateSpiritFieldHarvestQuantity({
        plot,
        fieldLevel: field.level,
        mode: input.mode,
        seed: settlementSeed,
      });
      const rewards: Array<{
        name: string;
        quantity: number;
        kind: 'herb' | 'seed' | 'care';
        quality?: string;
      }> = [];

      await addMaterial(tx, actor.cultivatorId, {
        name: plant.name,
        type: 'herb',
        rank: plant.quality,
        element: plant.element,
        description: plant.description,
        details: {
          spiritField: {
            source: 'harvest',
            plantId: plant.id,
            seedQuality: plant.quality,
            careScore,
          },
        },
        quantity: mainQuantity,
      });
      rewards.push({
        name: plant.name,
        quantity: mainQuantity,
        kind: 'herb',
        quality: plant.quality,
      });

      let harvestedHerbs = mainQuantity;
      let highestQuality = plant.quality;
      const nextQuality = getNextQuality(plant.quality);
      const upgradeChance = getSpiritFieldQualityUpgradeChance({
        careScore,
        fieldLevel: field.level,
        mode: input.mode,
      });
      if (
        nextQuality &&
        deterministicUnit(`${settlementSeed}:quality-upgrade`) < upgradeChance
      ) {
        await addMaterial(tx, actor.cultivatorId, {
          name: plant.name,
          type: 'herb',
          rank: nextQuality,
          element: plant.element,
          description: `${plant.description} 其中一株在精细培育中凝出更高一阶灵韵。`,
          details: {
            spiritField: {
              source: 'quality_upgrade',
              plantId: plant.id,
              seedQuality: plant.quality,
              careScore,
            },
          },
          quantity: 1,
        });
        rewards.push({
          name: `${plant.name}（灵韵升阶）`,
          quantity: 1,
          kind: 'herb',
          quality: nextQuality,
        });
        harvestedHerbs += 1;
        highestQuality = nextQuality;
      }

      const seedReturnQuantity = getSpiritFieldSeedReturnQuantity({
        careScore,
        mode: input.mode,
        seed: settlementSeed,
      });
      if (seedReturnQuantity > 0) {
        const seedMaterial = buildSpiritFieldSeedMaterialFromPlant(
          plant,
          seedReturnQuantity,
        );
        await addMaterial(tx, actor.cultivatorId, seedMaterial);
        rewards.push({
          name: seedMaterial.name,
          quantity: seedReturnQuantity,
          kind: 'seed',
          quality: plant.quality,
        });
      }

      if (
        deterministicUnit(`${settlementSeed}:care-drop`) <
        getSpiritFieldRareCareDropChance({ careScore, mode: input.mode })
      ) {
        await addMaterial(tx, actor.cultivatorId, {
          name: '清灵露',
          type: 'aux',
          rank: '灵品',
          element: '水',
          description: '灵植成熟时偶尔凝出的清润灵露，可用于后续灵田养护内容。',
          details: careItemDetails('gentle_nurture', 1),
          quantity: 1,
        });
        rewards.push({ name: '清灵露', quantity: 1, kind: 'care', quality: '灵品' });
      }

      const plots = [...field.plots];
      plots[input.plotIndex] = resetPlot(input.plotIndex);
      const nextSelfHarvestCount = field.selfHarvestCount + harvestedHerbs;
      await updateSpiritField(tx, field.id, {
        plots,
        selfHarvestCount: nextSelfHarvestCount,
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
            mode: input.mode,
            plantName: plant.name,
            seedQuality: plant.quality,
            highestQuality,
            careScore,
            herbQuantity: harvestedHerbs,
            seedReturned: seedReturnQuantity,
          },
          deduplicationKey: `spirit-field-harvest:${actor.cultivatorId}:${input.requestId}`,
        },
        tx,
      );

      return {
        result: {
          plantName: plant.name,
          mode: input.mode,
          rewards,
          harvestedHerbs,
          careScore,
          upgradeChancePercent: Math.round(upgradeChance * 100),
          selfHarvestCount: nextSelfHarvestCount,
          narrative: '',
        },
        resourceChanges: [
          {
            resourceTopic: 'inventory.materials',
            eventType: 'inventory.spirit-field.harvest',
            operation: 'invalidate',
          },
        ],
      };
    },
  });

  committed.result.narrative = await narrateSpiritFieldResult({
    kind: 'harvest',
    plantName: committed.result.plantName,
    facts: {
      mode: committed.result.mode,
      rewards: committed.result.rewards,
      careScore: committed.result.careScore,
      selfHarvestCount: committed.result.selfHarvestCount,
    },
    fallback: `你顺着药根细细收拢灵土，将成熟的${committed.result.plantName}稳稳采入储物袋。`,
  });
  return committed;
}

export async function upgradeSpiritField(actor: SpiritFieldActor, input: SpiritFieldUpgradeRequest) {
  return playerCommandExecutor.executeWithLock({
    userId: actor.userId,
    cultivatorId: actor.cultivatorId,
    source: 'spirit_field_upgrade',
    requestId: input.requestId,
    idempotency: {
      key: input.requestId,
      fingerprint: 'spirit-field-upgrade',
    },
    command: async (tx) => {
      await loadCultivator(actor, tx);
      const field = await getOrCreateSpiritField(actor.cultivatorId, tx);
      if (field.level >= SPIRIT_FIELD_LEVELS.length - 1) {
        throw new SpiritFieldServiceError('灵田已经达到当前最高等级', 409);
      }
      const nextLevel = SPIRIT_FIELD_LEVELS[field.level + 1]!;
      const spiritStones = await updateSpiritStones(
        actor.userId,
        actor.cultivatorId,
        -nextLevel.upgradeCost,
        tx,
      );
      const level = field.level + 1;
      await updateSpiritField(tx, field.id, { level });
      await createDomainEvent(
        {
          type: 'spirit-field.upgraded',
          aggregate: { type: 'spirit-field', id: field.id },
          data: {
            cultivatorId: actor.cultivatorId,
            spiritFieldId: field.id,
            requestId: input.requestId,
            fromLevel: field.level,
            toLevel: level,
            spentSpiritStones: nextLevel.upgradeCost,
          },
          deduplicationKey: `spirit-field-upgrade:${actor.cultivatorId}:${input.requestId}`,
        },
        tx,
      );
      return {
        result: {
          level,
          levelName: nextLevel.name,
          speedBonus: nextLevel.speedBonus,
          spent: nextLevel.upgradeCost,
          spiritStones,
        },
        resourceChanges: [
          {
            resourceTopic: 'player.currency',
            eventType: 'currency.spirit-field.upgrade',
            operation: 'merge',
            payload: { spiritStones },
          },
        ],
      };
    },
  });
}
