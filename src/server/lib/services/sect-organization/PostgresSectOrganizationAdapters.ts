import type { DbExecutor, DbTransaction } from '@server/lib/drizzle/db';
import * as organization from '@server/lib/repositories/sectOrganizationRepository';
import * as memberships from '@server/lib/repositories/sectRepository';
import {
  addConsumableToInventory,
  getPlayerRuntimeCultivatorByIdUnsafe,
  updateCultivationExp,
} from '@server/lib/services/cultivatorService';
import { addMaterialStackToInventory } from '@server/lib/services/materialInventory';
import { SeededBattleRandomSource } from '@shared/engine/battle-v5/core/BattleRandom';
import type { SectDiscipleRank, SectRuntime } from '@shared/engine/sect';
import { simulateBattleV5 } from '@shared/lib/battle/simulateBattleV5';
import type { SectTaskRecord } from './ports';
import type {
  Clock,
  IdGenerator,
  SectBenefitQueryContext,
  SectCommandContext,
  SectConstructionCommandContext,
  SectConstructionProjectRecord,
  SectEconomyCommandContext,
  SectEconomyQueryContext,
  SectFacilityRepository,
  SectMembershipCommandContext,
  SectMembershipRepository,
  SectQueryContext,
} from './ports';
import { getSectDateKey, getSectWeekKey } from './SectOrganizationClock';

function mapTask(row: {
  id: string;
  membershipId: string;
  taskId: string;
  kind: string;
  periodKey: string;
  status: string;
  progress: number;
  payload: unknown;
  completedAt: Date | null;
}): SectTaskRecord {
  return {
    id: row.id,
    membershipId: row.membershipId,
    taskId: row.taskId,
    kind: row.kind as SectTaskRecord['kind'],
    periodKey: row.periodKey,
    status: row.status as SectTaskRecord['status'],
    progress: row.progress,
    payload: (row.payload ?? {}) as Record<string, unknown>,
    completedAt: row.completedAt ?? undefined,
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

function mapProject(row: {
  id: string;
  sectId: string;
  facilityKey: string;
  targetLevel: number;
  progress: number;
  target: number;
  status: string;
  startedWeekKey: string;
  completedAt: Date | null;
} | null): SectConstructionProjectRecord | null {
  return row
    ? {
        id: row.id,
        sectId: row.sectId,
        facilityKey: row.facilityKey,
        targetLevel: row.targetLevel,
        progress: row.progress,
        target: row.target,
        status: row.status as SectConstructionProjectRecord['status'],
        startedWeekKey: row.startedWeekKey,
        completedAt: row.completedAt,
      }
    : null;
}

function membershipAdapter(q: DbExecutor | DbTransaction): SectMembershipRepository {
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
          }
        : null;
    },
    countCompletedDailyTasks: (membershipId) =>
      organization.countCompletedDailySectTasks(membershipId, q),
    hasCompletedTask: (membershipId, taskId) =>
      organization.hasCompletedSectTask(membershipId, taskId, q),
    loadState: (cultivatorId) => memberships.loadCultivatorSectState(cultivatorId, q),
    async promote(membershipId, rank) {
      if (!('rollback' in q))
        throw new Error('宗门晋升必须在事务中执行');
      return Boolean(await organization.promoteSectMembership(membershipId, rank, q));
    },
    async listMembers(sectId, page, pageSize) {
      const result = await organization.listSectMembers(sectId, page, pageSize, q);
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

function facilityAdapter(
  q: DbExecutor | DbTransaction,
  runtime: SectRuntime,
): SectFacilityRepository {
  return {
    ensure: (sectId) =>
      organization.ensureSectFacilities(
        sectId,
        runtime.registry.require(sectId).organization.construction.facilities,
        q,
      ),
    list: (sectId) => organization.listSectFacilities(sectId, q),
  };
}

function inventoryAdapter(q: DbExecutor | DbTransaction) {
  return {
    findMaterial: (cultivatorId: string, itemId: string) =>
      organization.findOwnedMaterial(cultivatorId, itemId, q),
    findConsumable: (cultivatorId: string, itemId: string) =>
      organization.findOwnedConsumable(cultivatorId, itemId, q),
    async findArtifact(cultivatorId: string, itemId: string) {
      const row = await organization.findOwnedArtifact(cultivatorId, itemId, q);
      return row ? { ...row, quality: row.quality ?? '凡品' } : null;
    },
    consumeMaterial: (itemId: string, quantity: number) => {
      if (!('rollback' in q)) throw new Error('宗门物品提交必须在事务中执行');
      return organization.consumeOwnedMaterial(itemId, quantity, q);
    },
    consumeConsumable: (itemId: string, quantity: number) => {
      if (!('rollback' in q)) throw new Error('宗门物品提交必须在事务中执行');
      return organization.consumeOwnedConsumable(itemId, quantity, q);
    },
    consumeArtifact: (itemId: string) => {
      if (!('rollback' in q)) throw new Error('宗门物品提交必须在事务中执行');
      return organization.consumeOwnedArtifact(itemId, q);
    },
  };
}

function rewardAdapter(q: DbExecutor | DbTransaction, userId: string) {
  return {
    async grantContribution(membershipId: string, amount: number, reason: string, referenceId: string) {
      if (!('rollback' in q)) throw new Error('宗门奖励必须在事务中执行');
      await organization.addSectContribution(membershipId, amount, reason, referenceId, q);
    },
    async grantSpiritStones(cultivatorId: string, amount: number) {
      if (!('rollback' in q)) throw new Error('宗门奖励必须在事务中执行');
      await organization.addCultivatorSpiritStones(cultivatorId, amount, q);
    },
    async grantCultivationExp(_userId: string, cultivatorId: string, amount: number) {
      if (!('rollback' in q)) throw new Error('宗门奖励必须在事务中执行');
      await updateCultivationExp(userId, cultivatorId, amount, undefined, q);
    },
    async grantMaterial(cultivatorId: string, input: Parameters<typeof addMaterialStackToInventory>[1]) {
      if (!('rollback' in q)) throw new Error('宗门奖励必须在事务中执行');
      await addMaterialStackToInventory(cultivatorId, input, q);
    },
    async grantPill(_userId: string, cultivatorId: string, input: Omit<Parameters<typeof addConsumableToInventory>[2], 'type'>) {
      if (!('rollback' in q)) throw new Error('宗门奖励必须在事务中执行');
      await addConsumableToInventory(userId, cultivatorId, { ...input, type: '丹药' }, q);
    },
  };
}

function economyAdapter(q: DbExecutor | DbTransaction) {
  return {
    purchasedQuantity: (membershipId: string, weekKey: string, itemId: string) =>
      organization.getPurchasedSectShopQuantity(membershipId, weekKey, itemId, q),
    async spendContribution(membershipId: string, amount: number, reason: string, referenceId: string) {
      if (!('rollback' in q)) throw new Error('宗门贡献消费必须在事务中执行');
      return (await organization.spendSectContribution(membershipId, amount, reason, referenceId, q)) !== null;
    },
    async recordPurchase(membershipId: string, weekKey: string, itemId: string, quantity: number) {
      if (!('rollback' in q)) throw new Error('宗门兑换必须在事务中执行');
      return Boolean(await organization.addSectShopPurchase(membershipId, weekKey, itemId, quantity, undefined, q));
    },
    hasClaimedStipend: (membershipId: string, weekKey: string) =>
      organization.hasClaimedSectStipend(membershipId, weekKey, q),
    async recordStipendClaim(input: {
      membershipId: string;
      weekKey: string;
      spiritStones: number;
      rewards: unknown[];
    }) {
      if (!('rollback' in q)) throw new Error('宗门俸禄必须在事务中执行');
      return Boolean(await organization.createSectStipendClaim(input, q));
    },
    async spendSpiritStones(cultivatorId: string, amount: number) {
      if (!('rollback' in q)) throw new Error('宗门捐献必须在事务中执行');
      return organization.spendCultivatorSpiritStones(cultivatorId, amount, q);
    },
  };
}

function constructionAdapter(q: DbExecutor | DbTransaction) {
  return {
    async findActiveProject(sectId: string) {
      return mapProject(
        await ('rollback' in q
          ? organization.lockActiveSectProject(sectId, q)
          : organization.findActiveSectProject(sectId, q)),
      );
    },
    async findLatestCompletedProject(sectId: string) {
      return mapProject(await organization.findLatestCompletedSectProject(sectId, q));
    },
    async createProject(input: {
      sectId: string;
      facilityKey: string;
      targetLevel: number;
      target: number;
      startedWeekKey: string;
    }) {
      return mapProject(
        await organization.createSectProject(
          {
            ...input,
            facilityKey: input.facilityKey,
          },
          q,
        ),
      );
    },
    countRecentlyActiveMembers: (sectId: string, since: Date) =>
      organization.countRecentlyActiveSectMembers(sectId, since, q),
    async saveProjectProgress(projectId: string, progress: number) {
      if (!('rollback' in q)) throw new Error('宗门建设必须在事务中执行');
      return mapProject(
        await organization.saveSectProjectProgress(projectId, progress, q),
      );
    },
    async completeProject(projectId: string, completedAt: Date) {
      if (!('rollback' in q)) throw new Error('宗门建设必须在事务中执行');
      return mapProject(
        await organization.completeSectProject(projectId, completedAt, q),
      );
    },
    async upgradeFacility(sectId: string, facilityKey: string, level: number) {
      if (!('rollback' in q)) throw new Error('宗门建设必须在事务中执行');
      return Boolean(
        await organization.upgradeSectFacility(sectId, facilityKey, level, q),
      );
    },
    donatedContribution: (membershipId: string, dateKey: string) =>
      organization.sumSectDonationContributionForDate(membershipId, dateKey, q),
    async recordDonation(input: {
      membershipId: string;
      projectId: string;
      dateKey: string;
      demandId: string;
      contribution: number;
      constructionPoints: number;
      itemSnapshot: Record<string, unknown>;
    }) {
      if (!('rollback' in q)) throw new Error('宗门捐献必须在事务中执行');
      return organization.insertSectDonation(input, q);
    },
    listRecentDonations: (sectId: string, limit: number) =>
      organization.listRecentSectDonations(sectId, limit, q),
    async grantContribution(membershipId: string, amount: number, reason: string, referenceId: string) {
      if (!('rollback' in q)) throw new Error('宗门贡献发放必须在事务中执行');
      await organization.addSectContribution(membershipId, amount, reason, referenceId, q);
    },
  };
}

export function createPostgresSectMembershipContext(args: {
  q: DbExecutor | DbTransaction;
  runtime: SectRuntime;
  clock?: Clock;
}): SectMembershipCommandContext {
  return {
    memberships: membershipAdapter(args.q),
    facilities: facilityAdapter(args.q, args.runtime),
    economy: economyAdapter(args.q),
    construction: constructionAdapter(args.q),
    modules: moduleResolver(args.runtime),
    clock: args.clock ?? systemSectClock,
  };
}

export function createPostgresSectEconomyContext(args: {
  q: DbExecutor | DbTransaction;
  runtime: SectRuntime;
  userId: string;
  clock?: Clock;
  ids?: IdGenerator;
}): SectEconomyCommandContext;
export function createPostgresSectEconomyContext(args: {
  q: DbExecutor | DbTransaction;
  runtime: SectRuntime;
  userId?: undefined;
  clock?: Clock;
  ids?: IdGenerator;
}): SectEconomyQueryContext;
export function createPostgresSectEconomyContext(args: {
  q: DbExecutor | DbTransaction;
  runtime: SectRuntime;
  userId?: string;
  clock?: Clock;
  ids?: IdGenerator;
}): SectEconomyQueryContext | SectEconomyCommandContext {
  const base: SectEconomyQueryContext = {
    memberships: membershipAdapter(args.q),
    facilities: facilityAdapter(args.q, args.runtime),
    economy: economyAdapter(args.q),
    modules: moduleResolver(args.runtime),
    clock: args.clock ?? systemSectClock,
  };
  if (!args.userId) return base;
  return {
    ...base,
    rewards: rewardAdapter(args.q, args.userId),
    ids: args.ids ?? cryptoSectIdGenerator,
  };
}

export function createPostgresSectConstructionContext(args: {
  q: DbExecutor | DbTransaction;
  runtime: SectRuntime;
  clock?: Clock;
}): SectConstructionCommandContext {
  return {
    memberships: membershipAdapter(args.q),
    facilities: facilityAdapter(args.q, args.runtime),
    construction: constructionAdapter(args.q),
    economy: economyAdapter(args.q),
    inventory: inventoryAdapter(args.q),
    modules: moduleResolver(args.runtime),
    clock: args.clock ?? systemSectClock,
  };
}

export function createPostgresSectBenefitContext(args: {
  q: DbExecutor | DbTransaction;
  runtime: SectRuntime;
}): SectBenefitQueryContext {
  return {
    memberships: membershipAdapter(args.q),
    facilities: facilityAdapter(args.q, args.runtime),
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
            }
          : null;
      },
      countCompletedDailyTasks: (membershipId) =>
        organization.countCompletedDailySectTasks(membershipId, tx),
      hasCompletedTask: (membershipId, taskId) =>
        organization.hasCompletedSectTask(membershipId, taskId, tx),
    },
    tasks: {
      list: async (membershipId) =>
        (await organization.listSectTaskRecords(membershipId, tx)).map(mapTask),
      find: async (membershipId, periodKey, taskId) => {
        const row = await organization.findSectTaskRecord(membershipId, periodKey, taskId, tx);
        return row ? mapTask(row) : null;
      },
      findDaily: async (membershipId, dateKey) => {
        const row = await organization.findDailySectTask(membershipId, dateKey, tx);
        return row ? mapTask(row) : null;
      },
      create: async (input) => mapTask(await organization.createSectTaskRecord(input, tx)),
      complete: async (id, progress) => {
        const row = await organization.completeSectTaskRecord(id, progress, tx);
        return row ? mapTask(row) : null;
      },
      updatePayload: async (id, payload) => {
        const row = await organization.updateSectTaskPayload(id, payload, tx);
        return row ? mapTask(row) : null;
      },
      upsertProgress: async (input) => mapTask(await organization.upsertSectTaskProgress(input, tx)),
      countCompletedDailySince: (membershipId, periodKey) =>
        organization.countCompletedDailySectTasksSince(membershipId, periodKey, tx),
    },
    inventory: inventoryAdapter(tx),
    cultivators: {
      async loadRuntime(cultivatorId) {
        return (await getPlayerRuntimeCultivatorByIdUnsafe(cultivatorId, tx))?.cultivator ?? null;
      },
      findMirrorCultivatorId: (sectId, excludeCultivatorId) =>
        organization.findSectMirrorCultivatorId(sectId, excludeCultivatorId, tx),
      loadProgress: (cultivatorId) => memberships.loadSectCultivatorProgress(cultivatorId, tx),
    },
    battle: {
      simulate: (player, opponent, seed) =>
        simulateBattleV5(player, opponent, undefined, new SeededBattleRandomSource(seed)),
    },
    rewards: rewardAdapter(tx, args.userId),
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
            }
          : null;
      },
      countCompletedDailyTasks: (membershipId) =>
        organization.countCompletedDailySectTasks(membershipId, args.q),
      hasCompletedTask: (membershipId, taskId) =>
        organization.hasCompletedSectTask(membershipId, taskId, args.q),
    },
    tasks: {
      list: async (membershipId) =>
        (await organization.listSectTaskRecords(membershipId, args.q)).map(mapTask),
      find: async (membershipId, periodKey, taskId) => {
        const row = await organization.findSectTaskRecord(
          membershipId,
          periodKey,
          taskId,
          args.q,
        );
        return row ? mapTask(row) : null;
      },
      findDaily: async (membershipId, dateKey) => {
        const row = await organization.findDailySectTask(membershipId, dateKey, args.q);
        return row ? mapTask(row) : null;
      },
      countCompletedDailySince: (membershipId, periodKey) =>
        organization.countCompletedDailySectTasksSince(membershipId, periodKey, args.q),
    },
    modules: {
      require: (sectId) => args.runtime.registry.require(sectId).organization,
    },
    clock: args.clock ?? systemSectClock,
  };
}
