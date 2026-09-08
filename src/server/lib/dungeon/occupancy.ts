import { db } from '@server/lib/drizzle/db';
import { dungeonRuns } from '@server/lib/drizzle/schema';
import { and, eq, ne } from 'drizzle-orm';

export async function hasActiveDungeon(owner: string) {
  const rows = await db
    .select({ id: dungeonRuns.id })
    .from(dungeonRuns)
    .where(
      and(
        eq(dungeonRuns.cultivatorId, owner),
        ne(dungeonRuns.status, 'FINISHED'),
      ),
    )
    .limit(1);
  return rows.length > 0;
}
