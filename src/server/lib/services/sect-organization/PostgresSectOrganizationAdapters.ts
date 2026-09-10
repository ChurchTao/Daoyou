import type { DbExecutor, DbTransaction } from '@server/lib/drizzle/db';
import {
  combatV6EquipmentLoadouts,
  inventoryItems,
} from '@server/lib/drizzle/schema';
import { createPostgresDomainEventWriter } from '@server/lib/mq/domainEventWriter';
import * as organization from '@server/lib/repositories/sectOrganizationRepository';
import * as memberships from '@server/lib/repositories/sectRepository';
import {
  materialLibraryEntryToMaterial,
  sampleMaterialLibraryEntryDeterministic,
} from '@server/lib/services/MaterialLibraryService';
import { updateCultivationExp } from '@server/lib/services/cultivator/CultivatorStateRepository';
import {
  SectTaskRecordPayloadSchema,
  projectSectPillTraits,
  type SectDiscipleRank,
  type SectRuntime,
  type SectSubmissionItemFacts,
  type SectSubmissionItemKind,
} from '@shared/engine/sect';
import { itemDefinition } from '@shared/inventory';
import { InventoryEquipmentSchema } from '@shared/inventory/equipment';
import { ConsumableFactsSchema } from '@shared/items/definitions/consumables';
import { MaterialFactsSchema } from '@shared/items/definitions/materials';
import { materialFactsOf } from '@shared/items/material';
import { and, eq, inArray } from 'drizzle-orm';
import {
  assertInventoryIdle,
  grantInventory,
  inventoryItemOf,
  saveInventoryPlan,
} from '../InventoryService';
import { SectError } from '../SectError';
import {
  freezeSectTaskTarget,
  startSectTaskBattle,
} from '../combat-v6/CombatV6SectTaskService';
import { emptySectCommandEffects } from './SectCommandEffects';
import { getSectDateKey, getSectWeekKey } from './SectOrganizationClock';
import type {
  Clock,
  IdGenerator,
  SectAdmissionRepository,
  SectAdmissionResourceReader,
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
  SectRewardGateway,
  SectTaskRecord,
} from './ports';

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

export function createPostgresSectAdmissionResourceReader(args: {
  q: DbExecutor | DbTransaction;
}): SectAdmissionResourceReader {
  return {
    load: (cultivatorId) =>
      memberships.loadSectCultivatorProgress(cultivatorId, args.q),
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

function submissionInventoryAdapter(q: DbExecutor | DbTransaction) {
  async function list(
    cultivatorId: string,
  ): Promise<SectSubmissionItemFacts[]> {
    const rows = await q
      .select()
      .from(inventoryItems)
      .where(
        and(
          eq(inventoryItems.cultivatorId, cultivatorId),
          eq(inventoryItems.location, 'bag'),
        ),
      );
    const loadouts = rows.length
      ? await q
          .select()
          .from(combatV6EquipmentLoadouts)
          .where(
            inArray(
              combatV6EquipmentLoadouts.equipmentInstanceId,
              rows.map((row) => row.id),
            ),
          )
      : [];
    return rows.flatMap((row): SectSubmissionItemFacts[] => {
      const common = { id: row.id, quantity: row.quantity };
      if (itemDefinition(row.definitionId).kind === 'material') {
        const facts = materialFactsOf(row.definitionId, row.instanceData);
        return [
          {
            ...common,
            kind: 'material',
            name: facts.name,
            quality: facts.rank,
            materialType: facts.type,
            element: facts.element ?? undefined,
          },
        ];
      }
      if (row.definitionId === 'consumable.v1') {
        const facts = ConsumableFactsSchema.parse(row.instanceData);
        if (facts.spec.kind !== 'pill') return [];
        return [
          {
            ...common,
            kind: 'pill',
            name: facts.name,
            quality: facts.quality,
            family: facts.spec.family,
            appearance: facts.spec.alchemyMeta.appearance,
            traits: projectSectPillTraits(facts.spec),
          },
        ];
      }
      if (row.definitionId === 'equipment.v6') {
        const facts = InventoryEquipmentSchema.parse(row.instanceData);
        return [
          {
            ...common,
            quantity: 1,
            kind: 'equipment',
            name: facts.name,
            slot: facts.slot,
            equipmentLevel: facts.equipmentLevel,
            isEquipped: loadouts.some((l) => l.equipmentInstanceId === row.id),
          },
        ];
      }
      return [];
    });
  }
  return {
    async listSubmissionItems(input: {
      cultivatorId: string;
      kind: SectSubmissionItemKind;
    }) {
      return (await list(input.cultivatorId)).filter(
        (item) => item.kind === input.kind,
      );
    },
    async findSubmissionItem(
      cultivatorId: string,
      kind: SectSubmissionItemKind,
      itemId: string,
    ) {
      return (
        (await list(cultivatorId)).find(
          (item) => item.id === itemId && item.kind === kind,
        ) ?? null
      );
    },
    async consumeSubmissionItem(input: {
      cultivatorId: string;
      kind: SectSubmissionItemKind;
      itemId: string;
      revision: number;
      quantity: number;
    }) {
      if (!('rollback' in q)) throw new Error('宗门物品提交必须在事务中执行');
      await assertInventoryIdle(input.cultivatorId);
      const rows = await q
        .select()
        .from(inventoryItems)
        .where(
          and(
            eq(inventoryItems.cultivatorId, input.cultivatorId),
            eq(inventoryItems.location, 'bag'),
            eq(inventoryItems.id, input.itemId),
          ),
        );
      const before = rows.map(inventoryItemOf);
      const item = before[0];
      if (
        !item ||
        item.revision !== input.revision ||
        item.quantity < input.quantity
      )
        throw new SectError(
          'SECT_ORGANIZATION_INVALID',
          '物品已变化，请重新选择',
          409,
        );
      const facts = (await list(input.cultivatorId)).find(
        (i) => i.id === input.itemId && i.kind === input.kind,
      );
      if (!facts || (facts.kind === 'equipment' && facts.isEquipped))
        throw new SectError('SECT_ORGANIZATION_INVALID', '物品不可交付', 409);
      const remainingQuantity = item.quantity - input.quantity;
      await saveInventoryPlan(
        input.cultivatorId,
        before,
        remainingQuantity
          ? [
              {
                ...item,
                quantity: remainingQuantity,
                revision: item.revision + 1,
              },
            ]
          : [],
        q,
      );
      return {
        consumed: true,
        settlement: {
          topic: 'inventory-v6' as const,
          itemId: item.id,
          remainingQuantity,
          removed: !remainingQuantity,
        },
      };
    },
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
      input: Parameters<SectRewardGateway['grantMaterial']>[1],
    ) {
      if (!('rollback' in q)) throw new Error('宗门奖励必须在事务中执行');
      await grantInventory(
        cultivatorId,
        [
          {
            definitionId: 'material.v1',
            quantity: input.quantity,
            instanceData: MaterialFactsSchema.parse({
              name: input.name,
              type: input.type,
              rank: input.rank,
              element: input.element ?? null,
              description: input.description ?? '',
            }),
          },
        ],
        q,
      );
      return emptySectCommandEffects();
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
      return organization.spendSectContribution(membershipId, amount, tx);
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
      return organization.addSectContribution(membershipId, amount, tx);
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
        organization.getNextSectTaskAttempt(
          membershipId,
          periodKey,
          taskId,
          tx,
        ),
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
      loadProgress: (cultivatorId) =>
        memberships.loadSectCultivatorProgress(cultivatorId, tx),
    },
    battle: {
      freeze: (context) => freezeSectTaskTarget(context, tx),
      start: (context) => startSectTaskBattle(context, tx),
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
