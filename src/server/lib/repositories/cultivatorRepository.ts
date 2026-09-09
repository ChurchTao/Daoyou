import { getExecutor, type DbExecutor } from '@server/lib/drizzle/db';
import * as schema from '@server/lib/drizzle/schema';
import { and, eq, sql } from 'drizzle-orm';

export interface CultivatorBreakthroughPillRecord {
  targetRealm: string | null;
  quantity: number;
}

export async function getCultivatorBreakthroughPillQuantities(
  cultivatorId: string,
  q: DbExecutor = getExecutor(),
): Promise<CultivatorBreakthroughPillRecord[]> {
  const targetRealm = sql<
    string | null
  >`${schema.consumables.spec} -> 'alchemyMeta' ->> 'breakthroughTargetRealm'`;
  return q
    .select({
      targetRealm,
      quantity: sql<number>`coalesce(sum(${schema.consumables.quantity}), 0)::int`,
    })
    .from(schema.consumables)
    .where(
      and(
        eq(schema.consumables.cultivatorId, cultivatorId),
        eq(schema.consumables.type, '丹药'),
        sql`${schema.consumables.spec} ->> 'kind' = 'pill'`,
        sql`${schema.consumables.spec} ->> 'family' = 'breakthrough'`,
        sql`${schema.consumables.quantity} > 0`,
      ),
    )
    .groupBy(targetRealm);
}

export async function hasCultivatorRecoveryPill(
  cultivatorId: string,
  q: DbExecutor = getExecutor(),
): Promise<boolean> {
  const [result] = await q
    .select({ count: sql<number>`count(*)::int` })
    .from(schema.consumables)
    .where(
      and(
        eq(schema.consumables.cultivatorId, cultivatorId),
        eq(schema.consumables.type, '丹药'),
        sql`${schema.consumables.quantity} > 0`,
        sql`${schema.consumables.spec} ->> 'kind' = 'pill'`,
        sql`jsonb_path_exists(${schema.consumables.spec}, '$.operations[*] ? (@.type == "restore_resource" && (@.resource == "hp" || @.resource == "mp"))')`,
      ),
    );

  return Number(result?.count ?? 0) > 0;
}

export async function findHighestCultivatorTechniqueQuality(
  cultivatorId: string,
  q: DbExecutor = getExecutor(),
): Promise<string | null> {
  const [row] = await q
    .select({
      quality: schema.creationProducts.quality,
    })
    .from(schema.creationProducts)
    .where(
      and(
        eq(schema.creationProducts.cultivatorId, cultivatorId),
        eq(schema.creationProducts.productType, 'gongfa'),
      ),
    )
    .orderBy(
      sql`case ${schema.creationProducts.quality}
        when '神品' then 7
        when '仙品' then 6
        when '天品' then 5
        when '地品' then 4
        when '真品' then 3
        when '玄品' then 2
        when '灵品' then 1
        when '凡品' then 0
        else -1
      end desc`,
    )
    .limit(1);
  return row?.quality ?? null;
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

export async function findActiveCultivatorTaskProgressById(
  cultivatorId: string,
  q: DbExecutor = getExecutor(),
): Promise<{
  id: string;
  realm: string;
  realmStage: string;
  cultivationProgress: unknown;
  condition: unknown;
} | null> {
  const records = await q
    .select({
      id: schema.cultivators.id,
      realm: schema.cultivators.realm,
      realmStage: schema.cultivators.realm_stage,
      cultivationProgress: schema.cultivators.cultivation_progress,
      condition: schema.cultivators.condition,
    })
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

export async function findActiveCultivatorOwnerId(
  cultivatorId: string,
  q: DbExecutor = getExecutor(),
): Promise<string | null> {
  const record = await findCultivatorOwnerStatusById(cultivatorId, q);
  return record?.status === 'active' ? record.userId : null;
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
