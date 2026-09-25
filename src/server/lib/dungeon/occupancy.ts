import { db, type DbExecutor } from '@server/lib/drizzle/db';
import { dungeonRuns } from '@server/lib/drizzle/schema';
import { and, eq, inArray, isNotNull, ne, or } from 'drizzle-orm';

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

/** 已开战或正在结算。探索、休整和待迎战只保留进度，不构成战斗占用。 */
export async function hasDungeonBattle(owner: string, q: DbExecutor = db) {
  const rows = await q
    .select({ id: dungeonRuns.id })
    .from(dungeonRuns)
    .where(
      and(
        eq(dungeonRuns.cultivatorId, owner),
        ne(dungeonRuns.status, 'FINISHED'),
        or(
          isNotNull(dungeonRuns.activeBattleId),
          inArray(dungeonRuns.status, ['IN_BATTLE', 'SETTLING']),
        ),
      ),
    )
    .limit(1);
  return rows.length > 0;
}
