import type { DbExecutor } from '@server/lib/drizzle/db';
import {
  combatV6BeastLineups,
  combatV6Beasts,
} from '@server/lib/drizzle/schema';
import {
  BeastLineupSchema,
  type BeastRoster,
  BeastSchema,
  loseBeastLifespan,
} from '@shared/engine/combat-v6/beasts';
import { and, eq, inArray } from 'drizzle-orm';

export async function readBeastRoster(
  cultivatorId: string,
  tx: DbExecutor,
): Promise<BeastRoster & { starterClaimed: boolean }> {
  const rows = await tx
    .select({ individual: combatV6Beasts.individual })
    .from(combatV6Beasts)
    .where(eq(combatV6Beasts.cultivatorId, cultivatorId))
    .orderBy(combatV6Beasts.createdAt, combatV6Beasts.id);
  const [state] = await tx
    .select()
    .from(combatV6BeastLineups)
    .where(eq(combatV6BeastLineups.cultivatorId, cultivatorId));
  return {
    beasts: rows.map((row) => BeastSchema.parse(row.individual)),
    lineup: BeastLineupSchema.parse(
      state?.lineup ?? { carriedBeastIds: [], revision: 0 },
    ),
    starterClaimed: !!state?.starterBeastId,
  };
}

/** Caller holds the character lock and claims the battle settlement in the same transaction. */
export async function settleBeastDeaths(
  cultivatorId: string,
  ids: string[],
  tx: DbExecutor,
) {
  if (!ids.length) return;
  const rows = await tx
    .select()
    .from(combatV6Beasts)
    .where(
      and(
        eq(combatV6Beasts.cultivatorId, cultivatorId),
        inArray(combatV6Beasts.id, [...new Set(ids)]),
      ),
    );
  for (const row of rows)
    await tx
      .update(combatV6Beasts)
      .set({ individual: loseBeastLifespan(BeastSchema.parse(row.individual)) })
      .where(eq(combatV6Beasts.id, row.id));
}
