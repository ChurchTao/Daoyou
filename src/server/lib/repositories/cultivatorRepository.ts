import { getExecutor, type DbExecutor } from '@server/lib/drizzle/db';
import type { CreationProductRecord } from '@server/lib/repositories/creationProductRepository';
import type { RealmStage, RealmType } from '@shared/types/constants';
import * as schema from '@server/lib/drizzle/schema';
import { and, eq, inArray, notInArray, sql } from 'drizzle-orm';

export type CultivatorRecord = typeof schema.cultivators.$inferSelect;
export type SpiritualRootRecord = typeof schema.spiritualRoots.$inferSelect;
export type PreHeavenFateRecord = typeof schema.preHeavenFates.$inferSelect;
export type ConsumableRecord = typeof schema.consumables.$inferSelect;
export type MaterialRecord = typeof schema.materials.$inferSelect;
export interface CultivatorBreakthroughPillRecord {
  spec: typeof schema.consumables.$inferSelect.spec;
  quantity: number;
}

export interface CultivatorTechniqueQualityRecord {
  quality: string | null;
}

export interface CultivatorRelations {
  spiritualRoots: SpiritualRootRecord[];
  preHeavenFates: PreHeavenFateRecord[];
  creationProducts: CreationProductRecord[];
  consumables: ConsumableRecord[];
  materials: MaterialRecord[];
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
  const consumables = await q
    .select()
    .from(schema.consumables)
    .where(eq(schema.consumables.cultivatorId, cultivatorId));
  const materials = await q
    .select()
    .from(schema.materials)
    .where(eq(schema.materials.cultivatorId, cultivatorId));

  return {
    spiritualRoots,
    preHeavenFates,
    creationProducts,
    consumables,
    materials,
  };
}

export async function listCultivatorBreakthroughPills(
  cultivatorId: string,
  q: DbExecutor = getExecutor(),
): Promise<CultivatorBreakthroughPillRecord[]> {
  return q
    .select({
      spec: schema.consumables.spec,
      quantity: schema.consumables.quantity,
    })
    .from(schema.consumables)
    .where(
      and(
        eq(schema.consumables.cultivatorId, cultivatorId),
        eq(schema.consumables.type, '丹药'),
        sql`${schema.consumables.spec} ->> 'kind' = 'pill'`,
        sql`${schema.consumables.spec} ->> 'family' = 'breakthrough'`,
      ),
    );
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

export async function listCultivatorTechniqueQualities(
  cultivatorId: string,
  q: DbExecutor = getExecutor(),
): Promise<CultivatorTechniqueQualityRecord[]> {
  return q
    .select({
      quality: schema.creationProducts.quality,
    })
    .from(schema.creationProducts)
    .where(
      and(
        eq(schema.creationProducts.cultivatorId, cultivatorId),
        eq(schema.creationProducts.productType, 'gongfa'),
      ),
    );
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

export async function sampleActiveCultivatorIds(args: {
  limit: number;
  realms?: RealmType[];
  realmStages?: RealmStage[];
  excludeIds?: string[];
  q?: DbExecutor;
}): Promise<string[]> {
  const q = args.q ?? getExecutor();
  const filters = [eq(schema.cultivators.status, 'active')];

  if (args.realms?.length) {
    filters.push(inArray(schema.cultivators.realm, args.realms));
  }
  if (args.realmStages?.length) {
    filters.push(inArray(schema.cultivators.realm_stage, args.realmStages));
  }
  if (args.excludeIds?.length) {
    filters.push(notInArray(schema.cultivators.id, args.excludeIds));
  }

  const rows = await q
    .select({ id: schema.cultivators.id })
    .from(schema.cultivators)
    .where(and(...filters))
    .orderBy(sql`random()`)
    .limit(Math.max(1, Math.min(100, Math.floor(args.limit))));

  return rows.map((row) => row.id);
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
