import { db, type DbExecutor } from '@server/lib/drizzle/db';
import { cultivatorTasks } from '@server/lib/drizzle/schema';
import { and, eq, sql } from 'drizzle-orm';

export async function activeBreakthroughBattle(
  owner: string,
  q: DbExecutor = db,
) {
  const [row] = await q
    .select()
    .from(cultivatorTasks)
    .where(
      and(
        eq(cultivatorTasks.cultivatorId, owner),
        sql`${cultivatorTasks.metadata}->'breakthroughBattle'->>'battleId' IS NOT NULL`,
        sql`${cultivatorTasks.metadata}->'breakthroughBattle'->>'settled' = 'false'`,
      ),
    )
    .limit(1);
  return row ?? null;
}
export async function hasActiveBreakthroughBattle(owner: string) {
  return !!(await activeBreakthroughBattle(owner));
}
