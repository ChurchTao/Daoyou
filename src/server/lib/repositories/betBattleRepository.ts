import { and, desc, eq, gte, sql } from 'drizzle-orm';
import { getExecutor, type DbTransaction } from '../drizzle/db';
import * as schema from '../drizzle/schema';

export type BetBattleRecord = typeof schema.betBattles.$inferSelect;
export type BetBattleListingRecord = BetBattleRecord & {
  creatorRealm: string;
  creatorRealmStage: string;
};

function toListingRecord(row: {
  battle: BetBattleRecord;
  creatorRealm: string;
  creatorRealmStage: string;
}): BetBattleListingRecord {
  return {
    ...row.battle,
    creatorRealm: row.creatorRealm,
    creatorRealmStage: row.creatorRealmStage,
  };
}

export interface FindPendingBetBattlesOptions {
  page?: number;
  limit?: number;
}

export async function createBetBattle(
  data: Omit<
    typeof schema.betBattles.$inferInsert,
    'id' | 'createdAt' | 'status'
  > & { status?: 'pending' | 'matched' | 'cancelled' | 'expired' | 'settled' },
  tx?: DbTransaction,
): Promise<BetBattleRecord> {
  const q = getExecutor(tx);
  const [row] = await q
    .insert(schema.betBattles)
    .values({
      ...data,
      status: data.status ?? 'pending',
    })
    .returning();
  return row;
}

export async function findById(id: string): Promise<BetBattleRecord | null> {
  const q = getExecutor();
  const [row] = await q
    .select()
    .from(schema.betBattles)
    .where(eq(schema.betBattles.id, id))
    .limit(1);
  return row || null;
}

export async function countPendingByCreator(
  creatorId: string,
): Promise<number> {
  const q = getExecutor();
  const [row] = await q
    .select({ count: sql<number>`count(*)::int` })
    .from(schema.betBattles)
    .where(
      and(
        eq(schema.betBattles.creatorId, creatorId),
        eq(schema.betBattles.status, 'pending'),
      ),
    );
  return row?.count || 0;
}

export async function findPendingBetBattles(
  options: FindPendingBetBattlesOptions = {},
): Promise<{ listings: BetBattleListingRecord[]; total: number }> {
  const q = getExecutor();
  const page = options.page ?? 1;
  const limit = options.limit ?? 20;

  const whereClause = and(
    eq(schema.betBattles.status, 'pending'),
    gte(schema.betBattles.expiresAt, new Date()),
  );

  const rows = await q
    .select({
      battle: schema.betBattles,
      creatorRealm: schema.cultivators.realm,
      creatorRealmStage: schema.cultivators.realm_stage,
    })
    .from(schema.betBattles)
    .innerJoin(
      schema.cultivators,
      eq(schema.betBattles.creatorId, schema.cultivators.id),
    )
    .where(whereClause)
    .orderBy(desc(schema.betBattles.createdAt))
    .limit(limit)
    .offset((page - 1) * limit);

  const [countRow] = await q
    .select({ count: sql<number>`count(*)::int` })
    .from(schema.betBattles)
    .where(whereClause);

  return {
    listings: rows.map(toListingRecord),
    total: countRow?.count || 0,
  };
}

export async function findMyBetBattles(
  cultivatorId: string,
  options: FindPendingBetBattlesOptions = {},
): Promise<{ listings: BetBattleListingRecord[]; total: number }> {
  const q = getExecutor();
  const page = options.page ?? 1;
  const limit = options.limit ?? 20;

  const whereClause = sql`${schema.betBattles.creatorId} = ${cultivatorId} OR ${schema.betBattles.challengerId} = ${cultivatorId}`;

  const rows = await q
    .select({
      battle: schema.betBattles,
      creatorRealm: schema.cultivators.realm,
      creatorRealmStage: schema.cultivators.realm_stage,
    })
    .from(schema.betBattles)
    .innerJoin(
      schema.cultivators,
      eq(schema.betBattles.creatorId, schema.cultivators.id),
    )
    .where(whereClause)
    .orderBy(desc(schema.betBattles.createdAt))
    .limit(limit)
    .offset((page - 1) * limit);

  const [countRow] = await q
    .select({ count: sql<number>`count(*)::int` })
    .from(schema.betBattles)
    .where(whereClause);

  return {
    listings: rows.map(toListingRecord),
    total: countRow?.count || 0,
  };
}

export async function updateBetBattleById(
  tx: DbTransaction,
  id: string,
  patch: Partial<typeof schema.betBattles.$inferInsert>,
): Promise<void> {
  await tx
    .update(schema.betBattles)
    .set(patch)
    .where(eq(schema.betBattles.id, id));
}

export async function markExpiredPendingBetBattles(
  tx: DbTransaction,
): Promise<BetBattleRecord[]> {
  return tx
    .update(schema.betBattles)
    .set({ status: 'expired' })
    .where(
      and(
        eq(schema.betBattles.status, 'pending'),
        sql`${schema.betBattles.expiresAt} < NOW()`,
      ),
    )
    .returning();
}
