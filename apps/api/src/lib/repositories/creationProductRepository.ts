import { getExecutor, type DbExecutor } from '@server/lib/drizzle/db.js';
import * as schema from '@server/lib/drizzle/schema.js';

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
