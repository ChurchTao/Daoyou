import type { DbTransaction } from '@server/lib/drizzle/db.js';
import { achievementMetrics } from '@server/lib/drizzle/schema.js';
import { sql } from 'drizzle-orm';

/** Preserve observed peaks; an expired membership or consumed asset cannot revoke progress. */
export async function recordAchievementMaximum(
  tx: DbTransaction,
  cultivatorId: string,
  metric: string,
  value: number,
): Promise<boolean> {
  if (!Number.isSafeInteger(value) || value < 0 || value > 2_147_483_647)
    throw new Error('成就进度超出合法范围');
  const rows = await tx
    .insert(achievementMetrics)
    .values({ cultivatorId, metric, value })
    .onConflictDoUpdate({
      target: [achievementMetrics.cultivatorId, achievementMetrics.metric],
      set: {
        value: sql`greatest(${achievementMetrics.value}, excluded.value)`,
        updatedAt: new Date(),
      },
      setWhere: sql`${achievementMetrics.value} < excluded.value`,
    })
    .returning({ metric: achievementMetrics.metric });
  return rows.length > 0;
}

export async function recordAchievementOutcomes(
  tx: DbTransaction,
  cultivatorId: string,
  metrics: Readonly<Record<string, number>>,
) {
  let changed = false;
  for (const [metric, value] of Object.entries(metrics)) {
    if (
      value > 0 &&
      (await recordAchievementMaximum(tx, cultivatorId, metric, value))
    )
      changed = true;
  }
  return changed;
}
