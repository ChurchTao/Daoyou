import type { DbExecutor, DbTransaction } from '@server/lib/drizzle/db';
import {
  creationProducts,
  cultivators,
  materials,
  consumables,
  sectConstructionProjects,
  sectContributionLedger,
  sectDonationLedger,
  sectFacilities,
  sectMemberships,
  sectShopPurchases,
  sectStipendClaims,
  sectTaskRecords,
} from '@server/lib/drizzle/schema';
import type {
  SectDiscipleRank,
  SectFacilityKey,
  SectOffice,
  UpgradeableSectFacilityKey,
} from '@shared/engine/sect';
import { and, asc, count, desc, eq, gte, sql } from 'drizzle-orm';

const INITIAL_FACILITIES: SectFacilityKey[] = [
  'archive',
  'cultivation_room',
  'workshop',
  'spirit_vein',
  'herb_garden',
  'formation',
];

export async function ensureSectFacilities(
  sectId: string,
  q: DbExecutor | DbTransaction,
) {
  await q
    .insert(sectFacilities)
    .values(INITIAL_FACILITIES.map((facilityKey) => ({ sectId, facilityKey })))
    .onConflictDoNothing();
}

export async function listActiveSectIds(q: DbExecutor | DbTransaction) {
  const rows = await q
    .selectDistinct({ sectId: sectMemberships.sectId })
    .from(sectMemberships)
    .where(eq(sectMemberships.status, 'active'));
  return rows.map((row) => row.sectId);
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

export async function findActiveSectProject(
  sectId: string,
  q: DbExecutor | DbTransaction,
) {
  const [row] = await q
    .select()
    .from(sectConstructionProjects)
    .where(
      and(
        eq(sectConstructionProjects.sectId, sectId),
        eq(sectConstructionProjects.status, 'active'),
      ),
    )
    .limit(1);
  return row ?? null;
}

export async function findLatestCompletedSectProject(
  sectId: string,
  q: DbExecutor | DbTransaction,
) {
  const [row] = await q
    .select()
    .from(sectConstructionProjects)
    .where(
      and(
        eq(sectConstructionProjects.sectId, sectId),
        eq(sectConstructionProjects.status, 'completed'),
      ),
    )
    .orderBy(desc(sectConstructionProjects.completedAt))
    .limit(1);
  return row ?? null;
}

export async function createSectProject(
  input: {
    sectId: string;
    facilityKey: UpgradeableSectFacilityKey;
    targetLevel: number;
    target: number;
    startedWeekKey: string;
  },
  q: DbExecutor | DbTransaction,
) {
  await q.insert(sectConstructionProjects).values(input).onConflictDoNothing();
  return findActiveSectProject(input.sectId, q);
}

export async function countRecentlyActiveSectMembers(
  sectId: string,
  since: Date,
  q: DbExecutor | DbTransaction,
): Promise<number> {
  const [row] = await q
    .select({ value: count() })
    .from(sectMemberships)
    .innerJoin(cultivators, eq(cultivators.id, sectMemberships.cultivatorId))
    .where(
      and(
        eq(sectMemberships.sectId, sectId),
        eq(sectMemberships.status, 'active'),
        gte(cultivators.updatedAt, since),
      ),
    );
  return Number(row?.value ?? 0);
}

export async function advanceSectProject(
  projectId: string,
  points: number,
  tx: DbTransaction,
) {
  const [advanced] = await tx
    .update(sectConstructionProjects)
    .set({
      progress: sql`LEAST(${sectConstructionProjects.target}, ${sectConstructionProjects.progress} + ${points})`,
      updatedAt: new Date(),
    })
    .where(
      and(
        eq(sectConstructionProjects.id, projectId),
        eq(sectConstructionProjects.status, 'active'),
      ),
    )
    .returning();
  if (!advanced) return null;
  if (advanced.progress < advanced.target) return advanced;

  const [completed] = await tx
    .update(sectConstructionProjects)
    .set({ status: 'completed', completedAt: new Date(), updatedAt: new Date() })
    .where(
      and(
        eq(sectConstructionProjects.id, projectId),
        eq(sectConstructionProjects.status, 'active'),
      ),
    )
    .returning();
  if (completed) {
    await tx
      .update(sectFacilities)
      .set({ level: completed.targetLevel, updatedAt: new Date() })
      .where(
        and(
          eq(sectFacilities.sectId, completed.sectId),
          eq(sectFacilities.facilityKey, completed.facilityKey),
          sql`${sectFacilities.level} < ${completed.targetLevel}`,
        ),
      );
  }
  return completed ?? advanced;
}

export async function addSectContribution(
  membershipId: string,
  amount: number,
  source: string,
  referenceId: string | null,
  tx: DbTransaction,
) {
  const [membership] = await tx
    .update(sectMemberships)
    .set({
      contribution: sql`${sectMemberships.contribution} + ${amount}`,
      updatedAt: new Date(),
    })
    .where(eq(sectMemberships.id, membershipId))
    .returning({ contribution: sectMemberships.contribution });
  if (!membership) throw new Error('宗门成员不存在');
  await tx.insert(sectContributionLedger).values({
    membershipId,
    delta: amount,
    balanceAfter: membership.contribution,
    source,
    referenceId,
  });
  return membership.contribution;
}

export async function spendSectContribution(
  membershipId: string,
  amount: number,
  source: string,
  referenceId: string | null,
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
  await tx.insert(sectContributionLedger).values({
    membershipId,
    delta: -amount,
    balanceAfter: membership.contribution,
    source,
    referenceId,
  });
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
  q: DbExecutor | DbTransaction,
) {
  return q
    .select()
    .from(sectTaskRecords)
    .where(eq(sectTaskRecords.membershipId, membershipId))
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
      ),
    )
    .limit(1);
  return row ?? null;
}

export async function findDailySectTask(
  membershipId: string,
  dateKey: string,
  q: DbExecutor | DbTransaction,
) {
  const [row] = await q
    .select()
    .from(sectTaskRecords)
    .where(
      and(
        eq(sectTaskRecords.membershipId, membershipId),
        eq(sectTaskRecords.periodKey, dateKey),
        eq(sectTaskRecords.kind, 'daily'),
      ),
    )
    .limit(1);
  return row ?? null;
}

export async function createSectTaskRecord(
  input: {
    membershipId: string;
    taskId: string;
    kind: 'daily' | 'weekly' | 'promotion';
    periodKey: string;
    progress?: number;
    payload?: Record<string, unknown>;
  },
  tx: DbTransaction,
) {
  const [row] = await tx
    .insert(sectTaskRecords)
    .values({ ...input, progress: input.progress ?? 0, payload: input.payload ?? {} })
    .onConflictDoNothing()
    .returning();
  return row ?? findSectTaskRecord(input.membershipId, input.periodKey, input.taskId, tx);
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

export async function upsertSectTaskProgress(
  input: {
    membershipId: string;
    taskId: string;
    kind: 'weekly' | 'promotion';
    periodKey: string;
    progress: number;
    target: number;
    payload?: Record<string, unknown>;
  },
  tx: DbTransaction,
) {
  const completed = input.progress >= input.target;
  const [row] = await tx
    .insert(sectTaskRecords)
    .values({
      membershipId: input.membershipId,
      taskId: input.taskId,
      kind: input.kind,
      periodKey: input.periodKey,
      progress: input.progress,
      payload: input.payload ?? { target: input.target },
      status: completed ? 'completed' : 'active',
      completedAt: completed ? new Date() : null,
    })
    .onConflictDoUpdate({
      target: [
        sectTaskRecords.membershipId,
        sectTaskRecords.periodKey,
        sectTaskRecords.taskId,
      ],
      set: {
        progress: input.progress,
        payload: input.payload ?? { target: input.target },
        status: completed ? 'completed' : 'active',
        completedAt: completed ? new Date() : null,
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

export async function getPurchasedSectShopQuantity(
  membershipId: string,
  weekKey: string,
  itemId: string,
  q: DbExecutor | DbTransaction,
) {
  const [row] = await q
    .select({ quantity: sql<number>`COALESCE(SUM(${sectShopPurchases.quantity}), 0)` })
    .from(sectShopPurchases)
    .where(
      and(
        eq(sectShopPurchases.membershipId, membershipId),
        eq(sectShopPurchases.weekKey, weekKey),
        eq(sectShopPurchases.itemId, itemId),
      ),
    )
    .limit(1);
  return Number(row?.quantity ?? 0);
}

export async function addSectShopPurchase(
  membershipId: string,
  weekKey: string,
  itemId: string,
  quantity: number,
  requestId: string | undefined,
  tx: DbTransaction,
) {
  const [row] = await tx
    .insert(sectShopPurchases)
    .values({ membershipId, weekKey, itemId, quantity, requestId })
    .onConflictDoNothing()
    .returning();
  return row ?? null;
}

export async function findSectShopPurchaseByRequestId(
  membershipId: string,
  requestId: string,
  q: DbExecutor | DbTransaction,
) {
  const [row] = await q
    .select()
    .from(sectShopPurchases)
    .where(
      and(
        eq(sectShopPurchases.membershipId, membershipId),
        eq(sectShopPurchases.requestId, requestId),
      ),
    )
    .limit(1);
  return row ?? null;
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
    rewards: unknown[];
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
  await tx
    .update(cultivators)
    .set({ spirit_stones: sql`${cultivators.spirit_stones} + ${amount}` })
    .where(eq(cultivators.id, cultivatorId));
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
    .returning({ id: cultivators.id });
  return Boolean(row);
}

export async function findOwnedMaterial(
  cultivatorId: string,
  itemId: string,
  q: DbExecutor | DbTransaction,
) {
  const [row] = await q
    .select()
    .from(materials)
    .where(and(eq(materials.cultivatorId, cultivatorId), eq(materials.id, itemId)))
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
      and(eq(consumables.cultivatorId, cultivatorId), eq(consumables.id, itemId)),
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

export async function consumeOwnedMaterial(
  itemId: string,
  quantity: number,
  tx: DbTransaction,
) {
  const [row] = await tx.select().from(materials).where(eq(materials.id, itemId)).limit(1);
  if (!row || row.quantity < quantity) return false;
  if (row.quantity === quantity) await tx.delete(materials).where(eq(materials.id, itemId));
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

export async function sumSectDonationContributionForDate(
  membershipId: string,
  dateKey: string,
  q: DbExecutor | DbTransaction,
) {
  const [row] = await q
    .select({ value: sql<number>`COALESCE(SUM(${sectDonationLedger.contribution}), 0)` })
    .from(sectDonationLedger)
    .where(
      and(
        eq(sectDonationLedger.membershipId, membershipId),
        eq(sectDonationLedger.dateKey, dateKey),
      ),
    );
  return Number(row?.value ?? 0);
}

export async function insertSectDonation(
  input: {
    membershipId: string;
    projectId: string;
    dateKey: string;
    demandId: string;
    contribution: number;
    constructionPoints: number;
    itemSnapshot: Record<string, unknown>;
    requestId?: string;
  },
  tx: DbTransaction,
) {
  const [row] = await tx
    .insert(sectDonationLedger)
    .values(input)
    .onConflictDoNothing()
    .returning();
  return row ?? null;
}

export async function findSectDonationByRequestId(
  membershipId: string,
  requestId: string,
  q: DbExecutor | DbTransaction,
) {
  const [row] = await q
    .select()
    .from(sectDonationLedger)
    .where(
      and(
        eq(sectDonationLedger.membershipId, membershipId),
        eq(sectDonationLedger.requestId, requestId),
      ),
    )
    .limit(1);
  return row ?? null;
}

export async function listRecentSectDonations(
  sectId: string,
  limit: number,
  q: DbExecutor | DbTransaction,
) {
  return q
    .select({
      id: sectDonationLedger.id,
      memberName: cultivators.name,
      demandId: sectDonationLedger.demandId,
      contribution: sectDonationLedger.contribution,
      constructionPoints: sectDonationLedger.constructionPoints,
      createdAt: sectDonationLedger.createdAt,
    })
    .from(sectDonationLedger)
    .innerJoin(
      sectMemberships,
      eq(sectMemberships.id, sectDonationLedger.membershipId),
    )
    .innerJoin(cultivators, eq(cultivators.id, sectMemberships.cultivatorId))
    .where(eq(sectMemberships.sectId, sectId))
    .orderBy(desc(sectDonationLedger.createdAt))
    .limit(limit);
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
  const [totalRow, rows] = await Promise.all([
    q.select({ value: count() }).from(sectMemberships).where(where),
    q
      .select({
        cultivatorId: cultivators.id,
        name: cultivators.name,
        realm: cultivators.realm,
        realmStage: cultivators.realm_stage,
        discipleRank: sectMemberships.discipleRank,
        office: sectMemberships.office,
        joinedAt: sectMemberships.joinedAt,
      })
      .from(sectMemberships)
      .innerJoin(cultivators, eq(cultivators.id, sectMemberships.cultivatorId))
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

export async function findSectMirrorCultivatorId(
  sectId: string,
  excludeCultivatorId: string,
  q: DbExecutor | DbTransaction,
) {
  const [row] = await q
    .select({ cultivatorId: sectMemberships.cultivatorId })
    .from(sectMemberships)
    .where(
      and(
        eq(sectMemberships.sectId, sectId),
        eq(sectMemberships.status, 'active'),
        sql`${sectMemberships.cultivatorId} <> ${excludeCultivatorId}`,
      ),
    )
    .orderBy(asc(sectMemberships.cultivatorId))
    .limit(1);
  return row?.cultivatorId ?? null;
}
