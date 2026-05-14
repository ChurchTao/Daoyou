import { getExecutor, type DbExecutor } from '@server/lib/drizzle/db';
import type { CreationProductRecord } from '@server/lib/repositories/creationProductRepository';
import * as schema from '@server/lib/drizzle/schema';
import { and, eq } from 'drizzle-orm';

export type CultivatorRecord = typeof schema.cultivators.$inferSelect;
export type SpiritualRootRecord = typeof schema.spiritualRoots.$inferSelect;
export type PreHeavenFateRecord = typeof schema.preHeavenFates.$inferSelect;

export interface CultivatorRelations {
  spiritualRoots: SpiritualRootRecord[];
  preHeavenFates: PreHeavenFateRecord[];
  creationProducts: CreationProductRecord[];
}

export async function loadCultivatorRelations(
  q: DbExecutor,
  cultivatorId: string,
): Promise<CultivatorRelations> {
  const spiritualRoots = await q
    .select()
    .from(schema.spiritualRoots)
    .where(eq(schema.spiritualRoots.cultivatorId, cultivatorId));
  const preHeavenFates = await q
    .select()
    .from(schema.preHeavenFates)
    .where(eq(schema.preHeavenFates.cultivatorId, cultivatorId));
  const creationProducts = await q
    .select()
    .from(schema.creationProducts)
    .where(eq(schema.creationProducts.cultivatorId, cultivatorId));

  return {
    spiritualRoots,
    preHeavenFates,
    creationProducts,
  };
}

export async function findActiveCultivatorIdByUserId(
  userId: string,
  q: DbExecutor = getExecutor(),
): Promise<string | null> {
  const record = await q
    .select({ id: schema.cultivators.id })
    .from(schema.cultivators)
    .where(
      and(
        eq(schema.cultivators.userId, userId),
        eq(schema.cultivators.status, 'active'),
      ),
    )
    .limit(1);

  return record[0]?.id ?? null;
}

export async function findActiveCultivatorRecordByUserId(
  userId: string,
  q: DbExecutor = getExecutor(),
): Promise<CultivatorRecord | null> {
  const records = await q
    .select()
    .from(schema.cultivators)
    .where(
      and(
        eq(schema.cultivators.userId, userId),
        eq(schema.cultivators.status, 'active'),
      ),
    )
    .limit(1);

  return records[0] ?? null;
}

export async function findActiveCultivatorRecordByIdAndUser(
  userId: string,
  cultivatorId: string,
  q: DbExecutor = getExecutor(),
): Promise<CultivatorRecord | null> {
  const records = await q
    .select()
    .from(schema.cultivators)
    .where(
      and(
        eq(schema.cultivators.id, cultivatorId),
        eq(schema.cultivators.userId, userId),
        eq(schema.cultivators.status, 'active'),
      ),
    )
    .limit(1);

  return records[0] ?? null;
}

export async function findActiveCultivatorRecordById(
  cultivatorId: string,
  q: DbExecutor = getExecutor(),
): Promise<CultivatorRecord | null> {
  const records = await q
    .select()
    .from(schema.cultivators)
    .where(
      and(
        eq(schema.cultivators.id, cultivatorId),
        eq(schema.cultivators.status, 'active'),
      ),
    )
    .limit(1);

  return records[0] ?? null;
}

export async function findCultivatorOwnerStatusById(
  cultivatorId: string,
  q: DbExecutor = getExecutor(),
): Promise<{ userId: string; status: string } | null> {
  const records = await q
    .select({
      userId: schema.cultivators.userId,
      status: schema.cultivators.status,
    })
    .from(schema.cultivators)
    .where(eq(schema.cultivators.id, cultivatorId))
    .limit(1);

  return records[0] ?? null;
}

export async function existsCultivatorById(
  cultivatorId: string,
  q: DbExecutor = getExecutor(),
): Promise<boolean> {
  const rows = await q
    .select({ id: schema.cultivators.id })
    .from(schema.cultivators)
    .where(eq(schema.cultivators.id, cultivatorId))
    .limit(1);

  return rows.length > 0;
}

export async function hasCultivatorOwnership(
  userId: string,
  cultivatorId: string,
  q: DbExecutor = getExecutor(),
): Promise<boolean> {
  const rows = await q
    .select({ id: schema.cultivators.id })
    .from(schema.cultivators)
    .where(
      and(
        eq(schema.cultivators.id, cultivatorId),
        eq(schema.cultivators.userId, userId),
      ),
    )
    .limit(1);

  return rows.length > 0;
}

export async function hasDeadCultivatorByUserId(
  userId: string,
  q: DbExecutor = getExecutor(),
): Promise<boolean> {
  const rows = await q
    .select({ id: schema.cultivators.id })
    .from(schema.cultivators)
    .where(
      and(
        eq(schema.cultivators.userId, userId),
        eq(schema.cultivators.status, 'dead'),
      ),
    )
    .limit(1);

  return rows.length > 0;
}
