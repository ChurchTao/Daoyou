import {
  runDbTasks,
  type DbExecutor,
  type DbTransaction,
} from '@server/lib/drizzle/db';
import {
  consumables,
  creationProducts,
  cultivators,
  materials,
  sectFacilities,
  sectMemberships,
  sectStipendClaims,
  sectTaskRecords,
} from '@server/lib/drizzle/schema';
import type { SectDiscipleRank, SectOffice } from '@shared/engine/sect';
import type { RealmType } from '@shared/types/constants';
import { and, asc, count, desc, eq, gt, gte, inArray, lte, ne, sql } from 'drizzle-orm';

export async function ensureSectFacilities(
  sectId: string,
  facilities: readonly { key: string; initialLevel: number }[],
  q: DbExecutor | DbTransaction,
) {
  await q
    .insert(sectFacilities)
    .values(
      facilities.map((facility) => ({
        sectId,
        facilityKey: facility.key,
        level: facility.initialLevel,
      })),
    )
    .onConflictDoNothing();
}

export async function listSectFacilities(
  sectId: string,
  q: DbExecutor | DbTransaction,
) {
  return q
    .select()
    .from(sectFacilities)
    .where(eq(sectFacilities.sectId, sectId))
    .orderBy(asc(sectFacilities.facilityKey));
}

export async function lockSectFacility(
  sectId: string,
  facilityKey: string,
  tx: DbTransaction,
) {
  const [row] = await tx
    .select()
    .from(sectFacilities)
    .where(
      and(
        eq(sectFacilities.sectId, sectId),
        eq(sectFacilities.facilityKey, facilityKey),
      ),
    )
    .for('update');
  return row ?? null;
}

export async function saveSectFacilityConstruction(
  sectId: string,
  facilityKey: string,
  level: number,
  progress: number,
  tx: DbTransaction,
) {
  const [row] = await tx
    .update(sectFacilities)
    .set({
      level,
      progress,
      updatedAt: new Date(),
    })
    .where(
      and(
        eq(sectFacilities.sectId, sectId),
        eq(sectFacilities.facilityKey, facilityKey),
      ),
    )
    .returning();
  return row ?? null;
}

export async function addSectContribution(
  membershipId: string,
  amount: number,
  tx: DbTransaction,
) {
  const [membership] = await tx
    .update(sectMemberships)
    .set({
      contribution: sql`${sectMemberships.contribution} + ${amount}`,
      lifetimeContribution:
        sql`${sectMemberships.lifetimeContribution} + ${amount}`,
      updatedAt: new Date(),
    })
    .where(eq(sectMemberships.id, membershipId))
    .returning({ contribution: sectMemberships.contribution });
  if (!membership) throw new Error('宗门成员不存在');
  return membership.contribution;
}

export async function spendSectContribution(
  membershipId: string,
  amount: number,
  tx: DbTransaction,
) {
  const [membership] = await tx
    .update(sectMemberships)
    .set({
      contribution: sql`${sectMemberships.contribution} - ${amount}`,
      updatedAt: new Date(),
    })
    .where(
      and(
        eq(sectMemberships.id, membershipId),
        sql`${sectMemberships.contribution} >= ${amount}`,
      ),
    )
    .returning({ contribution: sectMemberships.contribution });
  if (!membership) return null;
  return membership.contribution;
}

export async function promoteSectMembership(
  membershipId: string,
  rank: SectDiscipleRank,
  tx: DbTransaction,
) {
  const [row] = await tx
    .update(sectMemberships)
    .set({ discipleRank: rank, promotedAt: new Date(), updatedAt: new Date() })
    .where(eq(sectMemberships.id, membershipId))
    .returning();
  return row ?? null;
}

export async function listSectTaskRecords(
  membershipId: string,
  periodKeys: readonly string[],
  q: DbExecutor | DbTransaction,
) {
  if (periodKeys.length === 0) return [];
  return q
    .select()
    .from(sectTaskRecords)
    .where(
      and(
        eq(sectTaskRecords.membershipId, membershipId),
        inArray(sectTaskRecords.periodKey, [...new Set(periodKeys)]),
      ),
    )
    .orderBy(desc(sectTaskRecords.createdAt));
}

export async function findSectTaskRecord(
  membershipId: string,
  periodKey: string,
  taskId: string,
  q: DbExecutor | DbTransaction,
) {
  const [row] = await q
    .select()
    .from(sectTaskRecords)
    .where(
      and(
        eq(sectTaskRecords.membershipId, membershipId),
        eq(sectTaskRecords.periodKey, periodKey),
        eq(sectTaskRecords.taskId, taskId),
        ne(sectTaskRecords.status, 'abandoned'),
      ),
    )
    .limit(1);
  return row ?? null;
}

export async function getNextSectTaskAttempt(
  membershipId: string,
  periodKey: string,
  taskId: string,
  q: DbExecutor | DbTransaction,
) {
  const [row] = await q
    .select({ attempt: sql<number>`coalesce(max(${sectTaskRecords.attempt}), 0)` })
    .from(sectTaskRecords)
    .where(
      and(
        eq(sectTaskRecords.membershipId, membershipId),
        eq(sectTaskRecords.periodKey, periodKey),
        eq(sectTaskRecords.taskId, taskId),
      ),
    );
  return Number(row?.attempt ?? 0) + 1;
}

export async function createSectTaskRecord(
  input: {
    membershipId: string;
    taskId: string;
    kind: 'daily' | 'weekly' | 'promotion';
    periodKey: string;
    attempt?: number;
    progress?: number;
    payload: Record<string, unknown>;
  },
  tx: DbTransaction,
) {
  const [row] = await tx
    .insert(sectTaskRecords)
    .values({
      ...input,
      attempt: input.attempt ?? 1,
      progress: input.progress ?? 0,
      payload: input.payload,
    })
    .onConflictDoNothing()
    .returning();
  return (
    row ??
    findSectTaskRecord(input.membershipId, input.periodKey, input.taskId, tx)
  );
}

export async function completeSectTaskRecord(
  id: string,
  progress: number,
  tx: DbTransaction,
) {
  const [row] = await tx
    .update(sectTaskRecords)
    .set({
      status: 'completed',
      progress,
      completedAt: new Date(),
      updatedAt: new Date(),
    })
    .where(
      and(eq(sectTaskRecords.id, id), eq(sectTaskRecords.status, 'active')),
    )
    .returning();
  return row ?? null;
}

export async function abandonSectTaskRecord(
  id: string,
  acceptedBefore: Date,
  tx: DbTransaction,
): Promise<boolean> {
  const [row] = await tx
    .update(sectTaskRecords)
    .set({ status: 'abandoned', updatedAt: new Date() })
    .where(
      and(
        eq(sectTaskRecords.id, id),
        eq(sectTaskRecords.status, 'active'),
        lte(sectTaskRecords.createdAt, acceptedBefore),
      ),
    )
    .returning({ id: sectTaskRecords.id });
  return Boolean(row);
}

export async function updateSectTaskPayload(
  id: string,
  payload: Record<string, unknown>,
  tx: DbTransaction,
) {
  const [row] = await tx
    .update(sectTaskRecords)
    .set({ payload, updatedAt: new Date() })
    .where(
      and(eq(sectTaskRecords.id, id), eq(sectTaskRecords.status, 'active')),
    )
    .returning();
  return row ?? null;
}

export async function claimCompletedSectTaskRecord(
  id: string,
  claimedAt: Date,
  tx: DbTransaction,
) {
  const [row] = await tx
    .update(sectTaskRecords)
    .set({ claimedAt, updatedAt: claimedAt })
    .where(
      and(
        eq(sectTaskRecords.id, id),
        eq(sectTaskRecords.status, 'completed'),
        sql`${sectTaskRecords.claimedAt} IS NULL`,
      ),
    )
    .returning();
  return row ?? null;
}

export async function upsertSectTaskProgress(
  input: {
    membershipId: string;
    taskId: string;
    kind: 'weekly' | 'promotion';
    periodKey: string;
    attempt?: number;
    progress: number;
    target: number;
    completed: boolean;
    payload: Record<string, unknown>;
  },
  tx: DbTransaction,
) {
  const [row] = await tx
    .insert(sectTaskRecords)
    .values({
      membershipId: input.membershipId,
      taskId: input.taskId,
      kind: input.kind,
      periodKey: input.periodKey,
      attempt: input.attempt ?? 1,
      progress: input.progress,
      payload: input.payload,
      status: input.completed ? 'completed' : 'active',
      completedAt: input.completed ? new Date() : null,
    })
    .onConflictDoUpdate({
      target: [
        sectTaskRecords.membershipId,
        sectTaskRecords.periodKey,
        sectTaskRecords.taskId,
        sectTaskRecords.attempt,
      ],
      set: {
        progress: input.progress,
        payload: input.payload,
        status: input.completed ? 'completed' : 'active',
        completedAt: input.completed ? new Date() : null,
        updatedAt: new Date(),
      },
    })
    .returning();
  return row;
}

export async function countCompletedDailySectTasks(
  membershipId: string,
  q: DbExecutor | DbTransaction,
) {
  const [row] = await q
    .select({ value: count() })
    .from(sectTaskRecords)
    .where(
      and(
        eq(sectTaskRecords.membershipId, membershipId),
        eq(sectTaskRecords.kind, 'daily'),
        eq(sectTaskRecords.status, 'completed'),
      ),
    );
  return Number(row?.value ?? 0);
}

export async function countCompletedDailySectTasksSince(
  membershipId: string,
  periodKey: string,
  q: DbExecutor | DbTransaction,
) {
  const [row] = await q
    .select({ value: count() })
    .from(sectTaskRecords)
    .where(
      and(
        eq(sectTaskRecords.membershipId, membershipId),
        eq(sectTaskRecords.kind, 'daily'),
        eq(sectTaskRecords.status, 'completed'),
        gte(sectTaskRecords.periodKey, periodKey),
      ),
    );
  return Number(row?.value ?? 0);
}

export async function hasCompletedSectTask(
  membershipId: string,
  taskId: string,
  q: DbExecutor | DbTransaction,
) {
  const [row] = await q
    .select({ id: sectTaskRecords.id })
    .from(sectTaskRecords)
    .where(
      and(
        eq(sectTaskRecords.membershipId, membershipId),
        eq(sectTaskRecords.taskId, taskId),
        eq(sectTaskRecords.status, 'completed'),
      ),
    )
    .limit(1);
  return Boolean(row);
}

export async function hasClaimedSectStipend(
  membershipId: string,
  weekKey: string,
  q: DbExecutor | DbTransaction,
) {
  const [row] = await q
    .select({ id: sectStipendClaims.id })
    .from(sectStipendClaims)
    .where(
      and(
        eq(sectStipendClaims.membershipId, membershipId),
        eq(sectStipendClaims.weekKey, weekKey),
      ),
    )
    .limit(1);
  return Boolean(row);
}

export async function createSectStipendClaim(
  input: {
    membershipId: string;
    weekKey: string;
    spiritStones: number;
  },
  tx: DbTransaction,
) {
  const [row] = await tx
    .insert(sectStipendClaims)
    .values(input)
    .onConflictDoNothing()
    .returning();
  return row ?? null;
}

export async function addCultivatorSpiritStones(
  cultivatorId: string,
  amount: number,
  tx: DbTransaction,
) {
  const [row] = await tx
    .update(cultivators)
    .set({ spirit_stones: sql`${cultivators.spirit_stones} + ${amount}` })
    .where(eq(cultivators.id, cultivatorId))
    .returning({ spiritStones: cultivators.spirit_stones });
  if (!row) throw new Error('修真者不存在');
  return row.spiritStones;
}

export async function spendCultivatorSpiritStones(
  cultivatorId: string,
  amount: number,
  tx: DbTransaction,
) {
  const [row] = await tx
    .update(cultivators)
    .set({ spirit_stones: sql`${cultivators.spirit_stones} - ${amount}` })
    .where(
      and(
        eq(cultivators.id, cultivatorId),
        sql`${cultivators.spirit_stones} >= ${amount}`,
      ),
    )
    .returning({ balance: cultivators.spirit_stones });
  return row
    ? { spent: true, balance: row.balance }
    : { spent: false as const };
}

export async function findOwnedMaterial(
  cultivatorId: string,
  itemId: string,
  q: DbExecutor | DbTransaction,
) {
  const [row] = await q
    .select()
    .from(materials)
    .where(
      and(eq(materials.cultivatorId, cultivatorId), eq(materials.id, itemId)),
    )
    .limit(1);
  return row ?? null;
}

export async function findOwnedConsumable(
  cultivatorId: string,
  itemId: string,
  q: DbExecutor | DbTransaction,
) {
  const [row] = await q
    .select()
    .from(consumables)
    .where(
      and(
        eq(consumables.cultivatorId, cultivatorId),
        eq(consumables.id, itemId),
      ),
    )
    .limit(1);
  return row ?? null;
}

export async function findOwnedArtifact(
  cultivatorId: string,
  itemId: string,
  q: DbExecutor | DbTransaction,
) {
  const [row] = await q
    .select()
    .from(creationProducts)
    .where(
      and(
        eq(creationProducts.cultivatorId, cultivatorId),
        eq(creationProducts.id, itemId),
        eq(creationProducts.productType, 'artifact'),
      ),
    )
    .limit(1);
  return row ?? null;
}

export async function listOwnedSubmissionMaterials(
  cultivatorId: string,
  page: number,
  pageSize: number,
  q: DbExecutor | DbTransaction,
) {
  const where = eq(materials.cultivatorId, cultivatorId);
  const [rows, totals] = await runDbTasks(q, [
    () =>
      q
        .select()
        .from(materials)
        .where(where)
        .orderBy(desc(materials.createdAt), asc(materials.id))
        .limit(pageSize)
        .offset((page - 1) * pageSize),
    () => q.select({ total: count() }).from(materials).where(where),
  ]);
  return { rows, total: Number(totals[0]?.total ?? 0) };
}

export async function listOwnedSubmissionConsumables(
  cultivatorId: string,
  page: number,
  pageSize: number,
  q: DbExecutor | DbTransaction,
) {
  const condition = and(
    eq(consumables.cultivatorId, cultivatorId),
    eq(consumables.type, '丹药'),
    sql`${consumables.spec} ->> 'kind' = 'pill'`,
  );
  const [rows, totals] = await runDbTasks(q, [
    () =>
      q
        .select()
        .from(consumables)
        .where(condition)
        .orderBy(desc(consumables.createdAt), asc(consumables.id))
        .limit(pageSize)
        .offset((page - 1) * pageSize),
    () => q.select({ total: count() }).from(consumables).where(condition),
  ]);
  return { rows, total: Number(totals[0]?.total ?? 0) };
}

export async function listOwnedSubmissionArtifacts(
  cultivatorId: string,
  page: number,
  pageSize: number,
  q: DbExecutor | DbTransaction,
) {
  const condition = and(
    eq(creationProducts.cultivatorId, cultivatorId),
    eq(creationProducts.productType, 'artifact'),
  );
  const [rows, totals] = await runDbTasks(q, [
    () =>
      q
        .select()
        .from(creationProducts)
        .where(condition)
        .orderBy(desc(creationProducts.createdAt), asc(creationProducts.id))
        .limit(pageSize)
        .offset((page - 1) * pageSize),
    () => q.select({ total: count() }).from(creationProducts).where(condition),
  ]);
  return { rows, total: Number(totals[0]?.total ?? 0) };
}

export async function consumeOwnedSubmissionMaterial(
  cultivatorId: string,
  itemId: string,
  quantity: number,
  tx: DbTransaction,
) {
  const [row] = await tx
    .update(materials)
    .set({ quantity: sql`${materials.quantity} - ${quantity}` })
    .where(
      and(
        eq(materials.id, itemId),
        eq(materials.cultivatorId, cultivatorId),
        gte(materials.quantity, quantity),
      ),
    )
    .returning({ id: materials.id, quantity: materials.quantity });
  if (!row) return false;
  if (row.quantity === 0)
    await tx
      .delete(materials)
      .where(
        and(
          eq(materials.id, itemId),
          eq(materials.cultivatorId, cultivatorId),
          eq(materials.quantity, 0),
        ),
      );
  return true;
}

export async function consumeOwnedSubmissionConsumable(
  cultivatorId: string,
  itemId: string,
  quantity: number,
  tx: DbTransaction,
) {
  const [row] = await tx
    .update(consumables)
    .set({ quantity: sql`${consumables.quantity} - ${quantity}` })
    .where(
      and(
        eq(consumables.id, itemId),
        eq(consumables.cultivatorId, cultivatorId),
        eq(consumables.type, '丹药'),
        gte(consumables.quantity, quantity),
      ),
    )
    .returning({ id: consumables.id, quantity: consumables.quantity });
  if (!row) return false;
  if (row.quantity === 0)
    await tx
      .delete(consumables)
      .where(
        and(
          eq(consumables.id, itemId),
          eq(consumables.cultivatorId, cultivatorId),
          eq(consumables.quantity, 0),
        ),
      );
  return true;
}

export async function consumeOwnedSubmissionArtifact(
  cultivatorId: string,
  itemId: string,
  tx: DbTransaction,
) {
  const rows = await tx
    .delete(creationProducts)
    .where(
      and(
        eq(creationProducts.id, itemId),
        eq(creationProducts.cultivatorId, cultivatorId),
        eq(creationProducts.productType, 'artifact'),
        eq(creationProducts.isEquipped, false),
      ),
    )
    .returning({ id: creationProducts.id });
  return rows.length === 1;
}

export async function consumeOwnedMaterial(
  itemId: string,
  quantity: number,
  tx: DbTransaction,
) {
  const [row] = await tx
    .select()
    .from(materials)
    .where(eq(materials.id, itemId))
    .limit(1);
  if (!row || row.quantity < quantity) return false;
  if (row.quantity === quantity)
    await tx.delete(materials).where(eq(materials.id, itemId));
  else
    await tx
      .update(materials)
      .set({ quantity: row.quantity - quantity })
      .where(eq(materials.id, itemId));
  return true;
}

export async function consumeOwnedConsumable(
  itemId: string,
  quantity: number,
  tx: DbTransaction,
) {
  const [row] = await tx
    .select()
    .from(consumables)
    .where(eq(consumables.id, itemId))
    .limit(1);
  if (!row || row.quantity < quantity) return false;
  if (row.quantity === quantity)
    await tx.delete(consumables).where(eq(consumables.id, itemId));
  else
    await tx
      .update(consumables)
      .set({ quantity: row.quantity - quantity })
      .where(eq(consumables.id, itemId));
  return true;
}

export async function consumeOwnedArtifact(itemId: string, tx: DbTransaction) {
  const rows = await tx
    .delete(creationProducts)
    .where(
      and(
        eq(creationProducts.id, itemId),
        eq(creationProducts.productType, 'artifact'),
        eq(creationProducts.isEquipped, false),
      ),
    )
    .returning({ id: creationProducts.id });
  return rows.length === 1;
}

export async function listSectMembers(
  sectId: string,
  page: number,
  pageSize: number,
  q: DbExecutor | DbTransaction,
) {
  const where = and(
    eq(sectMemberships.sectId, sectId),
    eq(sectMemberships.status, 'active'),
  );
  const [totalRow, rows] = await runDbTasks(q, [
    () => q.select({ value: count() }).from(sectMemberships).where(where),
    () =>
      q
        .select({
          cultivatorId: cultivators.id,
          name: cultivators.name,
          realm: cultivators.realm,
          realmStage: cultivators.realm_stage,
          discipleRank: sectMemberships.discipleRank,
          office: sectMemberships.office,
          joinedAt: sectMemberships.joinedAt,
          lastActiveAt: cultivators.lastActiveAt,
        })
        .from(sectMemberships)
        .innerJoin(
          cultivators,
          eq(cultivators.id, sectMemberships.cultivatorId),
        )
        .where(where)
        .orderBy(desc(sectMemberships.promotedAt), asc(cultivators.name))
        .limit(pageSize)
        .offset((page - 1) * pageSize),
  ]);
  return {
    rows: rows.map((row) => ({
      ...row,
      discipleRank: row.discipleRank as SectDiscipleRank,
      office: row.office as SectOffice,
    })),
    total: Number(totalRow[0]?.value ?? 0),
  };
}

export async function listTopSectContributionRanking(
  sectId: string,
  q: DbExecutor | DbTransaction,
) {
  return q
    .select({
      cultivatorId: cultivators.id,
      name: cultivators.name,
      discipleRank: sectMemberships.discipleRank,
      office: sectMemberships.office,
      contribution: sectMemberships.contribution,
      joinedAt: sectMemberships.joinedAt,
    })
    .from(sectMemberships)
    .innerJoin(cultivators, eq(cultivators.id, sectMemberships.cultivatorId))
    .where(
      and(
        eq(sectMemberships.sectId, sectId),
        eq(sectMemberships.status, 'active'),
      ),
    )
    .orderBy(
      desc(sectMemberships.contribution),
      asc(sectMemberships.joinedAt),
      asc(cultivators.id),
    )
    .limit(20);
}

export async function findSectContributionRankingMember(
  sectId: string,
  cultivatorId: string,
  q: DbExecutor | DbTransaction,
) {
  const [row] = await q
    .select({
      cultivatorId: cultivators.id,
      name: cultivators.name,
      discipleRank: sectMemberships.discipleRank,
      office: sectMemberships.office,
      contribution: sectMemberships.contribution,
    })
    .from(sectMemberships)
    .innerJoin(cultivators, eq(cultivators.id, sectMemberships.cultivatorId))
    .where(
      and(
        eq(sectMemberships.sectId, sectId),
        eq(sectMemberships.cultivatorId, cultivatorId),
        eq(sectMemberships.status, 'active'),
      ),
    )
    .limit(1);
  return row ?? null;
}

export async function countSectMembersAboveContribution(
  sectId: string,
  contribution: number,
  q: DbExecutor | DbTransaction,
): Promise<number> {
  const [row] = await q
    .select({ value: count() })
    .from(sectMemberships)
    .where(
      and(
        eq(sectMemberships.sectId, sectId),
        eq(sectMemberships.status, 'active'),
        gt(sectMemberships.contribution, contribution),
      ),
    );
  return Number(row?.value ?? 0);
}

export async function findSectBattleTargetCandidate(
  input: {
    requesterSectId: string;
    excludeCultivatorId: string;
    realms: readonly RealmType[];
    relation: 'same-sect' | 'other-sect';
  },
  q: DbExecutor | DbTransaction,
) {
  const [row] = await q
    .select({
      cultivatorId: sectMemberships.cultivatorId,
      sectId: sectMemberships.sectId,
    })
    .from(sectMemberships)
    .innerJoin(cultivators, eq(cultivators.id, sectMemberships.cultivatorId))
    .where(
      and(
        eq(sectMemberships.status, 'active'),
        eq(cultivators.status, 'active'),
        inArray(cultivators.realm, input.realms),
        sql`${sectMemberships.cultivatorId} <> ${input.excludeCultivatorId}`,
        input.relation === 'same-sect'
          ? eq(sectMemberships.sectId, input.requesterSectId)
          : sql`${sectMemberships.sectId} <> ${input.requesterSectId}`,
      ),
    )
    .orderBy(sql`random()`)
    .limit(1);
  return row ?? null;
}
