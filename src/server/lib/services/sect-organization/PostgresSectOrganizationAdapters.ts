import type { DbExecutor, DbTransaction } from '@server/lib/drizzle/db';
import {
  consumables,
  creationProducts,
  materials,
} from '@server/lib/drizzle/schema';
import { createPostgresDomainEventWriter } from '@server/lib/mq/domainEventWriter';
import * as organization from '@server/lib/repositories/sectOrganizationRepository';
import * as memberships from '@server/lib/repositories/sectRepository';
import { mapConsumableRow } from '@server/lib/services/consumablePersistence';
import { toArtifactFromProduct } from '@server/lib/services/creationProductArtifactSupport';
import { loadCultivatorCombatInput } from '@server/lib/services/cultivator/CultivatorCombatProjectionReader';
import {
  addMaterialToInventoryInTransaction,
  mapArtifactRow,
  mapMaterialRow,
} from '@server/lib/services/cultivator/CultivatorInventoryRepository';
import {
  updateCultivationExp,
} from '@server/lib/services/cultivator/CultivatorStateRepository';
import { updateCultivator } from '@server/lib/services/cultivator/CultivatorStateRepository';
import { executePersistentWorldBattle } from '@server/lib/services/BattleStateCoordinator';
import {
  materialLibraryEntryToMaterial,
  sampleMaterialLibraryEntryDeterministic,
} from '@server/lib/services/MaterialLibraryService';
import type { ResourceChangeDescriptor } from '@shared/contracts/resources';
import { SeededBattleRandomSource } from '@shared/engine/battle-v5/core/BattleRandom';
import {
  projectSectPillTraits,
  SectTaskRecordPayloadSchema,
  type SectDiscipleRank,
  type SectPillSubmissionFacts,
  type SectRuntime,
  type SectSubmissionItemFacts,
  type SectSubmissionItemKind,
} from '@shared/engine/sect';
import { simulateBattleV5 } from '@shared/lib/battle/simulateBattleV5';
import { prepareStandardFullBattle } from '@shared/engine/battle-v5/setup/BattleStateStrategy';
import { isPillSpec } from '@shared/lib/consumables';
import {
  ELEMENT_VALUES,
  MATERIAL_TYPE_VALUES,
  QUALITY_VALUES,
  type ElementType,
  type MaterialType,
  type Quality,
} from '@shared/types/constants';
import type { ConsumableSpec } from '@shared/types/consumable';
import { eq } from 'drizzle-orm';
import type {
  Clock,
  IdGenerator,
  SectAdmissionRepository,
  SectBenefitQueryContext,
  SectCommandContext,
  SectConstructionCommandContext,
  SectConstructionQueryContext,
  SectConstructionRepository,
  SectEconomyCommandContext,
  SectEconomyQueryContext,
  SectEconomyReadRepository,
  SectEconomyRepository,
  SectFacilityReadRepository,
  SectFacilityRepository,
  SectMembershipCommandContext,
  SectMembershipQueryContext,
  SectMembershipQueryRepository,
  SectMembershipRepository,
  SectQueryContext,
  SectTaskRecord,
  SectTraditionRepository,
  SectTrainingResourceGateway,
} from './ports';
import { emptySectCommandEffects } from './SectCommandEffects';
import { getSectDateKey, getSectWeekKey } from './SectOrganizationClock';

function mapTask(row: {
  id: string;
  membershipId: string;
  taskId: string;
  kind: string;
  periodKey: string;
  attempt: number;
  status: string;
  progress: number;
  payload: unknown;
  createdAt: Date;
  completedAt: Date | null;
  claimedAt: Date | null;
}): SectTaskRecord {
  return {
    id: row.id,
    membershipId: row.membershipId,
    taskId: row.taskId,
    kind: row.kind as SectTaskRecord['kind'],
    periodKey: row.periodKey,
    attempt: row.attempt,
    status: row.status as SectTaskRecord['status'],
    progress: row.progress,
    payload: SectTaskRecordPayloadSchema.parse(row.payload),
    createdAt: row.createdAt,
    completedAt: row.completedAt ?? undefined,
    claimedAt: row.claimedAt ?? undefined,
  };
}

export const systemSectClock: Clock = {
  now: () => new Date(),
  dateKey: getSectDateKey,
  weekKey: getSectWeekKey,
};

export const cryptoSectIdGenerator: IdGenerator = {
  next: () => globalThis.crypto.randomUUID(),
};

function moduleResolver(runtime: SectRuntime) {
  return {
    require: (sectId: string) => runtime.registry.require(sectId).organization,
  };
}

function requireTransaction(q: DbExecutor | DbTransaction): DbTransaction {
  if (!('rollback' in q)) throw new Error('宗门写操作必须使用事务绑定 Adapter');
  return q;
}

function stateAdapter(q: DbExecutor | DbTransaction, runtime: SectRuntime) {
  return {
    load: (cultivatorId: string) =>
      memberships.loadCultivatorSectState(cultivatorId, q, runtime),
    loadForSect: (cultivatorId: string, sectId: string) =>
      memberships.loadCultivatorSectStateForSect(
        cultivatorId,
        sectId,
        q,
        runtime,
      ),
    listMemberships: (cultivatorId: string) =>
      memberships.listMemberships(cultivatorId, q),
  };
}

export function createPostgresSectAdmissionRepository(args: {
  q: DbExecutor | DbTransaction;
  runtime: SectRuntime;
}): SectAdmissionRepository {
  const { q, runtime } = args;
  return {
    ...stateAdapter(q, runtime),
    findActiveMembership: (cultivatorId) =>
      memberships.findMembership(cultivatorId, q),
    findMembershipForSect: (cultivatorId, sectId) =>
      memberships.findMembershipForSect(cultivatorId, sectId, q),
    ensureMembershipCandidate(cultivatorId, sectId, configVersion) {
      return memberships.ensureMembershipCandidate(
        cultivatorId,
        sectId,
        configVersion,
        requireTransaction(q),
      );
    },
    activateMembership: (membershipId, definition) =>
      memberships.activateMembership(
        membershipId,
        definition,
        requireTransaction(q),
      ),
    ensureFacilities: (sectId, facilities) =>
      organization.ensureSectFacilities(
        sectId,
        facilities,
        requireTransaction(q),
      ),
  };
}

export function createPostgresSectTraditionRepository(args: {
  q: DbExecutor | DbTransaction;
  runtime: SectRuntime;
}): SectTraditionRepository {
  const { q, runtime } = args;
  const tx = () => requireTransaction(q);
  return {
    ...stateAdapter(q, runtime),
    setMethodLevel: (membershipId, methodId, level) =>
      memberships.setMethodLevel(membershipId, methodId, level, tx()),
    createPathWithFirstLayer: (membershipId, pathId, tacticId, layerId) =>
      memberships.createPathWithFirstLayer(
        membershipId,
        pathId,
        tacticId,
        layerId,
        tx(),
      ),
    appendUnlockedPathLayer: (membershipId, pathId, layerId, expectedCount) =>
      memberships.appendUnlockedPathLayer(
        membershipId,
        pathId,
        layerId,
        expectedCount,
        tx(),
      ),
    activatePathIfNone: (membershipId, pathId) =>
      memberships.activatePathIfNone(membershipId, pathId, tx()),
    activatePath: (membershipId, pathId) =>
      memberships.activatePath(membershipId, pathId, tx()),
    replaceMeridianLoadout: (membershipId, pathId, slot, nodeIds) =>
      memberships.replaceMeridianLoadout(
        membershipId,
        pathId,
        slot,
        nodeIds,
        tx(),
      ),
    activateMeridianLoadout: (membershipId, pathId, slot) =>
      memberships.activateMeridianLoadout(membershipId, pathId, slot, tx()),
    replaceAbilityLoadout: (membershipId, slots) =>
      memberships.replaceAbilityLoadout(membershipId, slots, tx()),
    setPathTactic: (membershipId, pathId, tacticId) =>
      memberships.setPathTactic(membershipId, pathId, tacticId, tx()),
  };
}

export function createPostgresSectTrainingResourceGateway(args: {
  q: DbExecutor | DbTransaction;
  runtime: SectRuntime;
}): SectTrainingResourceGateway {
  const { q, runtime } = args;
  return {
    load: (cultivatorId) =>
      memberships.loadSectCultivatorProgress(cultivatorId, q),
    spend: (cultivatorId, cost) =>
      memberships.spendTrainingResources(
        cultivatorId,
        cost,
        requireTransaction(q),
      ),
    async methodLevelCap(cultivatorId) {
      const state = await memberships.loadCultivatorSectState(
        cultivatorId,
        q,
        runtime,
      );
      if (!state) return 20;
      const levels = new Map(
        (await organization.listSectFacilities(state.sectId, q)).map((row) => [
          row.facilityKey,
          row.level,
        ]),
      );
      return runtime.registry
        .require(state.sectId)
        .organization.benefits.methodLevelCap(levels);
    },
  };
}

function membershipQueryAdapter(
  q: DbExecutor | DbTransaction,
): SectMembershipQueryRepository {
  return {
    async findByCultivator(cultivatorId) {
      const row = await memberships.findMembership(cultivatorId, q);
      return row
        ? {
            id: row.id,
            sectId: row.sectId,
            cultivatorId: row.cultivatorId,
            discipleRank: row.discipleRank as SectDiscipleRank,
            contribution: row.contribution,
            lifetimeContribution: row.lifetimeContribution,
          }
        : null;
    },
    countCompletedDailyTasks: (membershipId) =>
      organization.countCompletedDailySectTasks(membershipId, q),
    hasCompletedTask: (membershipId, taskId) =>
      organization.hasCompletedSectTask(membershipId, taskId, q),
    loadState: (cultivatorId) =>
      memberships.loadCultivatorSectState(cultivatorId, q),
    async listMembers(sectId, page, pageSize) {
      const result = await organization.listSectMembers(
        sectId,
        page,
        pageSize,
        q,
      );
      return {
        rows: result.rows.map((row) => ({
          ...row,
          discipleRank: row.discipleRank as SectDiscipleRank,
        })),
        total: result.total,
      };
    },
  };
}

function membershipCommandAdapter(tx: DbTransaction): SectMembershipRepository {
  return {
    ...membershipQueryAdapter(tx),
    async promote(membershipId, rank) {
      return Boolean(
        await organization.promoteSectMembership(membershipId, rank, tx),
      );
    },
  };
}

function facilityReadAdapter(
  q: DbExecutor | DbTransaction,
): SectFacilityReadRepository {
  return {
    list: (sectId) => organization.listSectFacilities(sectId, q),
  };
}

function facilityCommandAdapter(
  tx: DbTransaction,
  runtime: SectRuntime,
): SectFacilityRepository {
  return {
    ...facilityReadAdapter(tx),
    ensure: (sectId) =>
      organization.ensureSectFacilities(
        sectId,
        runtime.registry.require(sectId).organization.construction.facilities,
        tx,
      ),
  };
}

function normalizeQuality(value: string | null): Quality {
  return QUALITY_VALUES.includes(value as Quality)
    ? (value as Quality)
    : '凡品';
}

function mapSubmissionPill(row: {
  id: string;
  name: string;
  quality: string;
  quantity: number;
  spec: unknown;
}): SectPillSubmissionFacts | null {
  if (!isPillSpec(row.spec as ConsumableSpec)) return null;
  const spec = row.spec as ConsumableSpec & { kind: 'pill' };
  return {
    kind: 'pill',
    id: row.id,
    name: row.name,
    quality: normalizeQuality(row.quality),
    quantity: row.quantity,
    family: spec.family,
    appearance: spec.alchemyMeta.appearance,
    traits: projectSectPillTraits(spec),
  };
}

function mapSubmissionMaterial(row: {
  id: string;
  name: string;
  rank: string;
  quantity: number;
  type: string;
  element: string | null;
}): SectSubmissionItemFacts {
  return {
    kind: 'material',
    id: row.id,
    name: row.name,
    quality: normalizeQuality(row.rank),
    quantity: row.quantity,
    materialType: MATERIAL_TYPE_VALUES.includes(row.type as MaterialType)
      ? (row.type as MaterialType)
      : 'aux',
    element: ELEMENT_VALUES.includes(row.element as ElementType)
      ? (row.element as ElementType)
      : undefined,
  };
}

function mapSubmissionArtifact(row: {
  id: string;
  name: string;
  quality: string | null;
  slot: string | null;
  isEquipped: boolean;
  productModel: unknown;
}): SectSubmissionItemFacts {
  const model =
    row.productModel && typeof row.productModel === 'object'
      ? (row.productModel as Record<string, unknown>)
      : {};
  const affixes = Array.isArray(model.affixes) ? model.affixes : [];
  const modelQuality = QUALITY_VALUES.includes(
    model.projectionQuality as Quality,
  )
    ? (model.projectionQuality as Quality)
    : undefined;
  const rowQuality = normalizeQuality(row.quality);
  if (modelQuality && modelQuality !== rowQuality)
    throw new Error(`法宝品质持久化不一致：${row.id}`);
  return {
    kind: 'artifact',
    id: row.id,
    name: row.name,
    quality: modelQuality ?? rowQuality,
    quantity: 1,
    slot: ['weapon', 'armor', 'accessory'].includes(row.slot ?? '')
      ? (row.slot as 'weapon' | 'armor' | 'accessory')
      : undefined,
    perfectAffixCount: affixes.filter(
      (affix) =>
        affix &&
        typeof affix === 'object' &&
        (affix as Record<string, unknown>).isPerfect === true,
    ).length,
    isEquipped: row.isEquipped,
  };
}

function submissionInventoryAdapter(q: DbExecutor | DbTransaction) {
  const find = async (
    cultivatorId: string,
    kind: SectSubmissionItemKind,
    itemId: string,
  ): Promise<SectSubmissionItemFacts | null> => {
    if (kind === 'pill') {
      const row = await organization.findOwnedConsumable(
        cultivatorId,
        itemId,
        q,
      );
      return row ? mapSubmissionPill(row) : null;
    }
    if (kind === 'artifact') {
      const row = await organization.findOwnedArtifact(cultivatorId, itemId, q);
      return row ? mapSubmissionArtifact(row) : null;
    }
    const row = await organization.findOwnedMaterial(cultivatorId, itemId, q);
    return row ? mapSubmissionMaterial(row) : null;
  };
  return {
    async listSubmissionItemsPage(input: {
      cultivatorId: string;
      kind: SectSubmissionItemKind;
      page: number;
      pageSize: number;
    }) {
      if (input.kind === 'pill') {
        const result = await organization.listOwnedSubmissionConsumables(
          input.cultivatorId,
          input.page,
          input.pageSize,
          q,
        );
        return {
          items: result.rows
            .map(mapSubmissionPill)
            .filter((item): item is SectPillSubmissionFacts => Boolean(item)),
          total: result.total,
        };
      }
      if (input.kind === 'artifact') {
        const result = await organization.listOwnedSubmissionArtifacts(
          input.cultivatorId,
          input.page,
          input.pageSize,
          q,
        );
        return {
          items: result.rows.map(mapSubmissionArtifact),
          total: result.total,
        };
      }
      const result = await organization.listOwnedSubmissionMaterials(
        input.cultivatorId,
        input.page,
        input.pageSize,
        q,
      );
      return {
        items: result.rows.map(mapSubmissionMaterial),
        total: result.total,
      };
    },
    findSubmissionItem: find,
    async consumeSubmissionItem(input: {
      cultivatorId: string;
      kind: SectSubmissionItemKind;
      itemId: string;
      quantity: number;
    }) {
      if (!('rollback' in q)) throw new Error('宗门物品提交必须在事务中执行');
      const consumed =
        input.kind === 'pill'
          ? await organization.consumeOwnedSubmissionConsumable(
              input.cultivatorId,
              input.itemId,
              input.quantity,
              q,
            )
          : input.kind === 'artifact'
            ? await organization.consumeOwnedSubmissionArtifact(
                input.cultivatorId,
                input.itemId,
                q,
              )
            : await organization.consumeOwnedSubmissionMaterial(
                input.cultivatorId,
                input.itemId,
                input.quantity,
                q,
              );
      if (!consumed) return { consumed: false };
      const change = await buildSubmissionInventoryChange(
        q,
        input.kind,
        input.itemId,
      );
      return inventorySettlement(true, change, input.itemId);
    },
  };
}

function inventorySettlement(
  consumed: boolean,
  change: Awaited<ReturnType<typeof buildSubmissionInventoryChange>>,
  itemId: string,
) {
  if (!consumed) return { consumed: false };
  return {
    consumed: true,
    change,
    settlement: {
      topic: change.resourceTopic,
      itemId,
      remainingQuantity:
        change.operation === 'upsert-items'
          ? Number(
              (change.payload.items[0] as { quantity?: number })?.quantity ?? 1,
            )
          : 0,
      removed: change.operation === 'remove-items',
    },
  };
}

async function buildSubmissionInventoryChange(
  q: DbTransaction,
  kind: SectSubmissionItemKind,
  itemId: string,
): Promise<
  ResourceChangeDescriptor<
    'inventory.artifacts' | 'inventory.materials' | 'inventory.consumables'
  >
> {
  if (kind === 'pill') {
    const [row] = await q
      .select()
      .from(consumables)
      .where(eq(consumables.id, itemId))
      .limit(1);
    return row
      ? {
          resourceTopic: 'inventory.consumables',
          eventType: 'sect.task_inventory_item_updated',
          operation: 'upsert-items',
          payload: { items: [mapConsumableRow(row)], idKey: 'id' },
        }
      : {
          resourceTopic: 'inventory.consumables',
          eventType: 'sect.task_inventory_item_removed',
          operation: 'remove-items',
          payload: { ids: [itemId], idKey: 'id' },
        };
  }
  if (kind === 'artifact') {
    const [row] = await q
      .select()
      .from(creationProducts)
      .where(eq(creationProducts.id, itemId))
      .limit(1);
    return row
      ? {
          resourceTopic: 'inventory.artifacts',
          eventType: 'sect.task_inventory_item_updated',
          operation: 'upsert-items',
          payload: {
            items: [mapArtifactRow(toArtifactFromProduct(row))],
            idKey: 'id',
          },
        }
      : {
          resourceTopic: 'inventory.artifacts',
          eventType: 'sect.task_inventory_item_removed',
          operation: 'remove-items',
          payload: { ids: [itemId], idKey: 'id' },
        };
  }
  const [row] = await q
    .select()
    .from(materials)
    .where(eq(materials.id, itemId))
    .limit(1);
  return row
    ? {
        resourceTopic: 'inventory.materials',
        eventType: 'sect.task_inventory_item_updated',
        operation: 'upsert-items',
        payload: { items: [mapMaterialRow(row)], idKey: 'id' },
      }
    : {
        resourceTopic: 'inventory.materials',
        eventType: 'sect.task_inventory_item_removed',
        operation: 'remove-items',
        payload: { ids: [itemId], idKey: 'id' },
      };
}

function rewardAdapter(q: DbExecutor | DbTransaction, userId: string) {
  return {
    async grantContribution(membershipId: string, amount: number) {
      if (!('rollback' in q)) throw new Error('宗门奖励必须在事务中执行');
      const balance = await organization.addSectContribution(
        membershipId,
        amount,
        q,
      );
      const effects = emptySectCommandEffects();
      effects.settlement.contribution = balance.contribution;
      effects.resourceChanges.push({
        resourceTopic: 'sect.membership',
        eventType: 'sect.task_contribution_settled',
        operation: 'merge',
        payload: {
          contribution: balance.contribution,
          lifetimeContribution: balance.lifetimeContribution,
        },
      });
      return {
        value: balance.contribution,
        lifetimeContribution: balance.lifetimeContribution,
        effects,
      };
    },
    async grantSpiritStones(
      cultivatorId: string,
      amount: number,
      source = 'sect_task',
    ) {
      if (!('rollback' in q)) throw new Error('宗门奖励必须在事务中执行');
      const balance = await organization.addCultivatorSpiritStones(
        cultivatorId,
        amount,
        q,
      );
      const effects = emptySectCommandEffects();
      effects.settlement.spiritStones = balance;
      effects.resourceChanges.push({
        resourceTopic: 'player.currency',
        eventType:
          source === 'sect_stipend'
            ? 'sect.stipend_currency_settled'
            : 'sect.task_currency_settled',
        operation: 'merge',
        payload: { spiritStones: balance },
      });
      return { value: balance, effects };
    },
    async grantCultivationExp(
      _userId: string,
      cultivatorId: string,
      amount: number,
    ) {
      if (!('rollback' in q)) throw new Error('宗门奖励必须在事务中执行');
      const progress = await updateCultivationExp(
        userId,
        cultivatorId,
        amount,
        undefined,
        q,
      );
      const effects = emptySectCommandEffects();
      effects.settlement.cultivationProgress = progress;
      effects.resourceChanges.push({
        resourceTopic: 'player.progress',
        eventType: 'sect.task_progress_settled',
        operation: 'replace',
        payload: progress,
      });
      return { value: progress, effects };
    },
    async grantMaterial(
      cultivatorId: string,
      input: Parameters<typeof addMaterialToInventoryInTransaction>[1],
    ) {
      if (!('rollback' in q)) throw new Error('宗门奖励必须在事务中执行');
      const material = await addMaterialToInventoryInTransaction(
        cultivatorId,
        input,
        q,
      );
      const effects = emptySectCommandEffects();
      effects.resourceChanges.push({
        resourceTopic: 'inventory.materials',
        eventType: 'sect.reward_material_granted',
        operation: 'upsert-items',
        payload: { idKey: 'id', items: [material] },
      });
      return effects;
    },
  };
}

function economyReadAdapter(
  q: DbExecutor | DbTransaction,
): SectEconomyReadRepository {
  return {
    hasClaimedStipend: (membershipId: string, weekKey: string) =>
      organization.hasClaimedSectStipend(membershipId, weekKey, q),
  };
}

function economyCommandAdapter(tx: DbTransaction): SectEconomyRepository {
  return {
    ...economyReadAdapter(tx),
    async spendContribution(membershipId: string, amount: number) {
      return organization.spendSectContribution(
        membershipId,
        amount,
        tx,
      );
    },
    async recordStipendClaim(input: {
      membershipId: string;
      weekKey: string;
      spiritStones: number;
    }) {
      return Boolean(await organization.createSectStipendClaim(input, tx));
    },
    async spendSpiritStones(cultivatorId: string, amount: number) {
      return organization.spendCultivatorSpiritStones(cultivatorId, amount, tx);
    },
  };
}

function constructionCommandAdapter(
  tx: DbTransaction,
): SectConstructionRepository {
  return {
    async grantContribution(membershipId: string, amount: number) {
      return organization.addSectContribution(
        membershipId,
        amount,
        tx,
      );
    },
  };
}

export function createPostgresSectMembershipQueryContext(args: {
  q: DbExecutor | DbTransaction;
  runtime: SectRuntime;
  clock?: Clock;
}): SectMembershipQueryContext {
  return {
    memberships: membershipQueryAdapter(args.q),
    facilities: facilityReadAdapter(args.q),
    economy: economyReadAdapter(args.q),
    modules: moduleResolver(args.runtime),
    clock: args.clock ?? systemSectClock,
  };
}

export function createPostgresSectMembershipCommandContext(args: {
  q: DbTransaction;
  runtime: SectRuntime;
  clock?: Clock;
}): SectMembershipCommandContext {
  return {
    memberships: membershipCommandAdapter(args.q),
    facilities: facilityReadAdapter(args.q),
    economy: economyReadAdapter(args.q),
    modules: moduleResolver(args.runtime),
    clock: args.clock ?? systemSectClock,
  };
}

export function createPostgresSectEconomyContext(args: {
  q: DbTransaction;
  runtime: SectRuntime;
  userId: string;
  clock?: Clock;
}): SectEconomyCommandContext;
export function createPostgresSectEconomyContext(args: {
  q: DbExecutor | DbTransaction;
  runtime: SectRuntime;
  userId?: undefined;
  clock?: Clock;
}): SectEconomyQueryContext;
export function createPostgresSectEconomyContext(args: {
  q: DbExecutor | DbTransaction;
  runtime: SectRuntime;
  userId?: string;
  clock?: Clock;
}): SectEconomyQueryContext | SectEconomyCommandContext {
  const base: SectEconomyQueryContext = {
    q: args.q,
    memberships: membershipQueryAdapter(args.q),
    facilities: facilityReadAdapter(args.q),
    economy: economyReadAdapter(args.q),
    modules: moduleResolver(args.runtime),
    clock: args.clock ?? systemSectClock,
  };
  if (!args.userId) return base;
  const tx = requireTransaction(args.q);
  return {
    ...base,
    facilities: facilityCommandAdapter(tx, args.runtime),
    economy: economyCommandAdapter(tx),
    rewards: rewardAdapter(tx, args.userId),
  };
}

export function createPostgresSectConstructionQueryContext(args: {
  q: DbExecutor | DbTransaction;
  runtime: SectRuntime;
  clock?: Clock;
}): SectConstructionQueryContext {
  return {
    memberships: membershipQueryAdapter(args.q),
    facilities: facilityReadAdapter(args.q),
    modules: moduleResolver(args.runtime),
    clock: args.clock ?? systemSectClock,
  };
}

export function createPostgresSectConstructionCommandContext(args: {
  q: DbTransaction;
  runtime: SectRuntime;
  clock?: Clock;
}): SectConstructionCommandContext {
  return {
    memberships: membershipQueryAdapter(args.q),
    facilities: facilityCommandAdapter(args.q, args.runtime),
    construction: constructionCommandAdapter(args.q),
    events: createPostgresDomainEventWriter(args.q),
    economy: economyCommandAdapter(args.q),
    modules: moduleResolver(args.runtime),
    clock: args.clock ?? systemSectClock,
  };
}

export function createPostgresSectBenefitContext(args: {
  q: DbExecutor | DbTransaction;
  runtime: SectRuntime;
}): SectBenefitQueryContext {
  return {
    memberships: membershipQueryAdapter(args.q),
    facilities: facilityReadAdapter(args.q),
    modules: moduleResolver(args.runtime),
  };
}

export function createPostgresSectCommandContext(args: {
  tx: DbTransaction;
  runtime: SectRuntime;
  userId: string;
  clock?: Clock;
  ids?: IdGenerator;
}): SectCommandContext {
  const { tx } = args;
  return {
    memberships: {
      async findByCultivator(cultivatorId) {
        const row = await memberships.findMembership(cultivatorId, tx);
        return row
          ? {
              id: row.id,
              sectId: row.sectId,
              cultivatorId: row.cultivatorId,
              discipleRank: row.discipleRank as SectDiscipleRank,
              contribution: row.contribution,
              lifetimeContribution: row.lifetimeContribution,
            }
          : null;
      },
      countCompletedDailyTasks: (membershipId) =>
        organization.countCompletedDailySectTasks(membershipId, tx),
      hasCompletedTask: (membershipId, taskId) =>
        organization.hasCompletedSectTask(membershipId, taskId, tx),
    },
    tasks: {
      list: async (membershipId, periodKeys) =>
        (
          await organization.listSectTaskRecords(membershipId, periodKeys, tx)
        ).map(mapTask),
      find: async (membershipId, periodKey, taskId) => {
        const row = await organization.findSectTaskRecord(
          membershipId,
          periodKey,
          taskId,
          tx,
        );
        return row ? mapTask(row) : null;
      },
      nextAttempt: (membershipId, periodKey, taskId) =>
        organization.getNextSectTaskAttempt(membershipId, periodKey, taskId, tx),
      create: async (input) =>
        mapTask(
          await organization.createSectTaskRecord(
            {
              ...input,
              payload: SectTaskRecordPayloadSchema.parse(input.payload),
            },
            tx,
          ),
        ),
      complete: async (id, progress) => {
        const row = await organization.completeSectTaskRecord(id, progress, tx);
        return row ? mapTask(row) : null;
      },
      abandon: (id, acceptedBefore) =>
        organization.abandonSectTaskRecord(id, acceptedBefore, tx),
      updatePayload: async (id, payload) => {
        const row = await organization.updateSectTaskPayload(
          id,
          SectTaskRecordPayloadSchema.parse(payload),
          tx,
        );
        return row ? mapTask(row) : null;
      },
      claim: async (id, claimedAt) => {
        const row = await organization.claimCompletedSectTaskRecord(
          id,
          claimedAt,
          tx,
        );
        return row ? mapTask(row) : null;
      },
      upsertProgress: async (input) =>
        mapTask(
          await organization.upsertSectTaskProgress(
            {
              ...input,
              payload: SectTaskRecordPayloadSchema.parse(input.payload),
            },
            tx,
          ),
        ),
      countCompletedDailySince: (membershipId, periodKey) =>
        organization.countCompletedDailySectTasksSince(
          membershipId,
          periodKey,
          tx,
        ),
    },
    submissionInventory: submissionInventoryAdapter(tx),
    cultivators: {
      async loadRuntime(cultivatorId) {
        return (
          (await loadCultivatorCombatInput(cultivatorId, tx))?.cultivator ??
          null
        );
      },
      async findBattleTargetCandidate(input) {
        const candidate =
          await organization.findSectBattleTargetCandidate(input, tx);
        return candidate
          ? {
              ...candidate,
              sectName: args.runtime.registry.require(candidate.sectId)
                .definition.name,
            }
          : null;
      },
      loadProgress: (cultivatorId) =>
        memberships.loadSectCultivatorProgress(cultivatorId, tx),
      async saveCondition(cultivatorId, condition) {
        const updated = await updateCultivator(
          cultivatorId,
          { condition },
          tx,
        );
        if (!updated) throw new Error('角色状态保存失败');
      },
    },
    battle: {
      execute: (player, opponent, strategy, seed) => {
        const randomSource = new SeededBattleRandomSource(seed);
        if (strategy === 'persistent_world') {
          const execution = executePersistentWorldBattle({
            strategyId: strategy,
            player,
            opponent,
            randomSource,
          });
          return {
            battleResult: execution.battleResult,
            nextCondition: execution.nextCondition,
          };
        }
        return {
          battleResult: simulateBattleV5(
            prepareStandardFullBattle({ player, opponent }),
            randomSource,
          ),
        };
      },
    },
    rewards: rewardAdapter(tx, args.userId),
    rewardMaterials: {
      async sampleOre(preferredQualities, seed) {
        for (const quality of preferredQualities) {
          const entry = await sampleMaterialLibraryEntryDeterministic(
            {
              materialType: 'ore',
              quality,
              seed: `${seed}:${quality}`,
            },
            tx,
          );
          if (!entry) continue;
          const material = materialLibraryEntryToMaterial(entry);
          return {
            libraryItemId: entry.itemId,
            name: material.name,
            quality: material.rank,
            type: 'ore' as const,
            ...(material.element ? { element: material.element } : {}),
            description: material.description ?? '宗门灵脉中采得的灵矿材料。',
          };
        }
        return null;
      },
    },
    modules: moduleResolver(args.runtime),
    clock: args.clock ?? systemSectClock,
    ids: args.ids ?? cryptoSectIdGenerator,
  };
}

export function createPostgresSectQueryContext(args: {
  q: DbExecutor;
  runtime: SectRuntime;
  clock?: Clock;
}): SectQueryContext {
  return {
    memberships: {
      async findByCultivator(cultivatorId) {
        const row = await memberships.findMembership(cultivatorId, args.q);
        return row
          ? {
              id: row.id,
              sectId: row.sectId,
              cultivatorId: row.cultivatorId,
              discipleRank: row.discipleRank as SectDiscipleRank,
              contribution: row.contribution,
              lifetimeContribution: row.lifetimeContribution,
            }
          : null;
      },
      countCompletedDailyTasks: (membershipId) =>
        organization.countCompletedDailySectTasks(membershipId, args.q),
      hasCompletedTask: (membershipId, taskId) =>
        organization.hasCompletedSectTask(membershipId, taskId, args.q),
    },
    tasks: {
      list: async (membershipId, periodKeys) =>
        (
          await organization.listSectTaskRecords(
            membershipId,
            periodKeys,
            args.q,
          )
        ).map(mapTask),
      find: async (membershipId, periodKey, taskId) => {
        const row = await organization.findSectTaskRecord(
          membershipId,
          periodKey,
          taskId,
          args.q,
        );
        return row ? mapTask(row) : null;
      },
      countCompletedDailySince: (membershipId, periodKey) =>
        organization.countCompletedDailySectTasksSince(
          membershipId,
          periodKey,
          args.q,
        ),
    },
    submissionInventory: submissionInventoryAdapter(args.q),
    modules: {
      require: (sectId) => args.runtime.registry.require(sectId).organization,
    },
    clock: args.clock ?? systemSectClock,
  };
}
