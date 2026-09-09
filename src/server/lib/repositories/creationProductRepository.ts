import { getExecutor, type DbExecutor } from '@server/lib/drizzle/db';
import * as schema from '@server/lib/drizzle/schema';
import type { LegacyProductType as CreationProductType } from '@shared/legacy/products';
import { and, desc, eq, inArray, sql } from 'drizzle-orm';

export type CreationProductRecord = typeof schema.creationProducts.$inferSelect;
export type CreationProductInsert = typeof schema.creationProducts.$inferInsert;

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

export async function findByTypeAndCultivatorPage(
  cultivatorId: string,
  productType: CreationProductType,
  options: { page: number; pageSize: number },
  q: DbExecutor = getExecutor(),
): Promise<CreationProductRecord[]> {
  const page = Math.max(1, options.page);
  const pageSize = Math.max(1, options.pageSize);
  return q
    .select()
    .from(schema.creationProducts)
    .where(
      and(
        eq(schema.creationProducts.cultivatorId, cultivatorId),
        eq(schema.creationProducts.productType, productType),
      ),
    )
    .orderBy(
      desc(schema.creationProducts.createdAt),
      desc(schema.creationProducts.id),
    )
    .limit(pageSize)
    .offset((page - 1) * pageSize);
}

export async function findUnequippedArtifactIdsByQualities(
  cultivatorId: string,
  qualities: string[],
  q: DbExecutor = getExecutor(),
): Promise<string[]> {
  if (qualities.length === 0) return [];
  const rows = await q
    .select({ id: schema.creationProducts.id })
    .from(schema.creationProducts)
    .where(
      and(
        eq(schema.creationProducts.cultivatorId, cultivatorId),
        eq(schema.creationProducts.productType, 'artifact'),
        eq(schema.creationProducts.isEquipped, false),
        inArray(schema.creationProducts.quality, qualities),
      ),
    )
    .orderBy(
      desc(schema.creationProducts.createdAt),
      desc(schema.creationProducts.id),
    );
  return rows.map((row) => row.id);
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
  return findEquippedByType(cultivatorId, 'artifact', q);
}

export async function findEquippedByType(
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
