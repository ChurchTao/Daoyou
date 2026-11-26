import type { DbExecutor } from '@server/lib/drizzle/db.js';
import { alchemyContestEntries as entries } from '@server/lib/drizzle/schema.js';
import { and, eq, isNotNull, sql } from 'drizzle-orm';

export function contestRankedEntries(
  executor: DbExecutor,
  week: string,
  settled = false,
) {
  // Match compareContestStandings in the rules package.
  const rank = settled
    ? sql<number>`${entries.rank}`
    : sql<number>`rank() over (order by
        (${entries.standing}->>'score')::numeric desc,
        (${entries.standing}->>'effectScore')::numeric desc,
        (${entries.standing}->>'usedMaterials')::integer)`;
  return executor.$with('contest_ranked').as(
    executor
      .select({
        userId: entries.userId,
        cultivatorId: entries.cultivatorId,
        name: entries.name,
        standing: entries.standing,
        reward: entries.reward,
        rank: rank.mapWith(Number).as('rank'),
      })
      .from(entries)
      .where(and(eq(entries.week, week), isNotNull(entries.standing))),
  );
}
