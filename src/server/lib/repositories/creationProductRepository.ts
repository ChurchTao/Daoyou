import { getExecutor, type DbExecutor } from '@server/lib/drizzle/db';
import * as schema from '@server/lib/drizzle/schema';
import type { CreationProductType } from '@shared/engine/creation-v2/types';
import { and, desc, eq, inArray, sql } from 'drizzle-orm';

export type CreationProductRecord =
  typeof schema.creationProducts.$inferSelect;
export type CreationProductInsert =
  typeof schema.creationProducts.$inferInsert;

export async function insert(
  row: CreationProductInsert,
  q: DbExecutor = getExecutor(),
): Promise<CreationProductRecord> {
  const [result] = await q
    .insert(schema.creationProducts)
    .values(row)
    .returning();
  return result;
}

export async function findById(
  id: string,
  q: DbExecutor = getExecutor(),
): Promise<CreationProductRecord | undefined> {
  const [result] = await q
    .select()
    .from(schema.creationProducts)
    .where(eq(schema.creationProducts.id, id))
    .limit(1);
  return result;
}

export async function findByCultivator(
  cultivatorId: string,
  q: DbExecutor = getExecutor(),
): Promise<CreationProductRecord[]> {
  return q
    .select()
    .from(schema.creationProducts)
    .where(eq(schema.creationProducts.cultivatorId, cultivatorId))
    .orderBy(desc(schema.creationProducts.createdAt));
}

export async function findByTypeAndCultivator(
  cultivatorId: string,
  productType: CreationProductType,
  q: DbExecutor = getExecutor(),
): Promise<CreationProductRecord[]> {
  return q
    .select()
    .from(schema.creationProducts)
    .where(
      and(
        eq(schema.creationProducts.cultivatorId, cultivatorId),
        eq(schema.creationProducts.productType, productType),
      ),
    );
}

export async function findArtifactsByIdsAndCultivator(
  cultivatorId: string,
  artifactIds: string[],
  q: DbExecutor = getExecutor(),
): Promise<CreationProductRecord[]> {
  if (artifactIds.length === 0) return [];

  return q
    .select()
    .from(schema.creationProducts)
    .where(
      and(
        eq(schema.creationProducts.cultivatorId, cultivatorId),
        eq(schema.creationProducts.productType, 'artifact'),
        inArray(schema.creationProducts.id, artifactIds),
      ),
    );
}

export async function findEquippedArtifacts(
  cultivatorId: string,
  q: DbExecutor = getExecutor(),
): Promise<CreationProductRecord[]> {
  return q
    .select()
    .from(schema.creationProducts)
    .where(
      and(
        eq(schema.creationProducts.cultivatorId, cultivatorId),
        eq(schema.creationProducts.productType, 'artifact'),
        eq(schema.creationProducts.isEquipped, true),
      ),
    );
}

export async function countByType(
  cultivatorId: string,
  productType: CreationProductType,
  q: DbExecutor = getExecutor(),
): Promise<number> {
  const [result] = await q
    .select({ count: sql<number>`count(*)::int` })
    .from(schema.creationProducts)
    .where(
      and(
        eq(schema.creationProducts.cultivatorId, cultivatorId),
        eq(schema.creationProducts.productType, productType),
      ),
    );
  return result.count;
}

export async function deleteById(
  id: string,
  q: DbExecutor = getExecutor(),
): Promise<void> {
  await q
    .delete(schema.creationProducts)
    .where(eq(schema.creationProducts.id, id));
}

export async function deleteArtifactsByIdsAndCultivator(
  cultivatorId: string,
  artifactIds: string[],
  q: DbExecutor = getExecutor(),
): Promise<CreationProductRecord[]> {
  if (artifactIds.length === 0) return [];

  return q
    .delete(schema.creationProducts)
    .where(
      and(
        eq(schema.creationProducts.cultivatorId, cultivatorId),
        eq(schema.creationProducts.productType, 'artifact'),
        inArray(schema.creationProducts.id, artifactIds),
      ),
    )
    .returning();
}

export async function equipArtifact(
  id: string,
  cultivatorId: string,
  slot: string,
  q: DbExecutor = getExecutor(),
): Promise<void> {
  // 先卸下同槽位已装备的法宝
  await q
    .update(schema.creationProducts)
    .set({ isEquipped: false })
    .where(
      and(
        eq(schema.creationProducts.cultivatorId, cultivatorId),
        eq(schema.creationProducts.productType, 'artifact'),
        eq(schema.creationProducts.slot, slot),
        eq(schema.creationProducts.isEquipped, true),
      ),
    );
  // 装备新法宝
  await q
    .update(schema.creationProducts)
    .set({ isEquipped: true })
    .where(eq(schema.creationProducts.id, id));
}

export async function unequipArtifact(
  id: string,
  q: DbExecutor = getExecutor(),
): Promise<void> {
  await q
    .update(schema.creationProducts)
    .set({ isEquipped: false })
    .where(eq(schema.creationProducts.id, id));
}

export async function findForRanking(
  productType: CreationProductType,
  limit: number = 100,
  q: DbExecutor = getExecutor(),
): Promise<CreationProductRecord[]> {
  return q
    .select()
    .from(schema.creationProducts)
    .where(eq(schema.creationProducts.productType, productType))
    .orderBy(desc(schema.creationProducts.score))
    .limit(limit);
}
