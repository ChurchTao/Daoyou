import { db, type DbExecutor } from '@server/lib/drizzle/db';
import { sectMemberships, sectTaskRecords } from '@server/lib/drizzle/schema';
import { and, eq, sql } from 'drizzle-orm';

export async function activeSectTaskBattle(owner: string, q: DbExecutor = db) {
  const [row] = await q
    .select({ record: sectTaskRecords })
    .from(sectTaskRecords)
    .innerJoin(
      sectMemberships,
      eq(sectMemberships.id, sectTaskRecords.membershipId),
    )
    .where(
      and(
        eq(sectMemberships.cultivatorId, owner),
        sql`${sectTaskRecords.payload}->'executorData'->>'activeBattleId' IS NOT NULL`,
        sql`${sectTaskRecords.payload}->'executorData'->>'battleSettled' = 'false'`,
      ),
    )
    .limit(1);
  return row?.record ?? null;
}
export async function hasActiveSectTaskBattle(owner: string) {
  return !!(await activeSectTaskBattle(owner));
}
