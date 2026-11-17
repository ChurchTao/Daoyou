import { productionAchievementMetrics } from '@daoyou/game-rules/achievements';
import type { DbTransaction } from '@server/lib/drizzle/db.js';
import {
  achievementMetrics,
  playerJournal,
} from '@server/lib/drizzle/schema.js';
import { and, asc, eq, gt, sql } from 'drizzle-orm';
import {
  recordAchievementMaximum,
  recordAchievementOutcomes,
} from './achievement-metrics.js';

const HISTORY_VERSION = 'production.outcomes.history.v1';

/** Caller holds the character lock. Backfill immutable receipts once, without recounting crafts. */
export async function backfillAchievementOutcomes(
  tx: DbTransaction,
  cultivatorId: string,
): Promise<boolean> {
  const [done] = await tx
    .select({ value: achievementMetrics.value })
    .from(achievementMetrics)
    .where(
      and(
        eq(achievementMetrics.cultivatorId, cultivatorId),
        eq(achievementMetrics.metric, HISTORY_VERSION),
      ),
    );
  if (done?.value === 1) return false;
  let cursor: string | undefined;
  const maxima: Record<string, number> = {};
  for (;;) {
    const rows = await tx
      .select({
        id: playerJournal.id,
        activity: sql<string>`${playerJournal.event}->>'activity'`,
        result: sql<unknown>`${playerJournal.event}->'result'`,
      })
      .from(playerJournal)
      .where(
        and(
          eq(playerJournal.cultivatorId, cultivatorId),
          sql`${playerJournal.event}->>'type' = 'resources.settled'`,
          sql`${playerJournal.event}->>'activity' in ('forging', 'alchemy_formula', 'alchemy_improvised')`,
          cursor ? gt(playerJournal.id, cursor) : undefined,
        ),
      )
      .orderBy(asc(playerJournal.id))
      .limit(200);
    for (const row of rows) {
      const metrics = productionAchievementMetrics(row.activity, row.result);
      for (const [metric, value] of Object.entries(metrics ?? {}))
        maxima[metric] = Math.max(maxima[metric] ?? 0, value);
    }
    if (rows.length < 200) break;
    cursor = rows[rows.length - 1].id;
  }
  const changed = await recordAchievementOutcomes(tx, cultivatorId, maxima);
  await recordAchievementMaximum(tx, cultivatorId, HISTORY_VERSION, 1);
  return changed;
}
