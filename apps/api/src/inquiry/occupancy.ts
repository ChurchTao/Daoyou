import { db, type DbExecutor } from '@server/lib/drizzle/db.js';
import { inquiryRuns } from '@server/lib/drizzle/schema.js';
import { and, eq, isNotNull, isNull, or } from 'drizzle-orm';

export async function hasOpenInquiry(owner: string, q: DbExecutor = db) {
  const rows = await q
    .select({ id: inquiryRuns.id })
    .from(inquiryRuns)
    .where(and(eq(inquiryRuns.cultivatorId, owner), isNull(inquiryRuns.endedAt)))
    .limit(1);
  return rows.length > 0;
}

export async function hasInquiryBattle(owner: string, q: DbExecutor = db) {
  const rows = await q
    .select({ id: inquiryRuns.id })
    .from(inquiryRuns)
    .where(
      and(
        eq(inquiryRuns.cultivatorId, owner),
        isNull(inquiryRuns.endedAt),
        or(isNotNull(inquiryRuns.activeBattleId), eq(inquiryRuns.status, 'IN_BATTLE')),
      ),
    )
    .limit(1);
  return rows.length > 0;
}
