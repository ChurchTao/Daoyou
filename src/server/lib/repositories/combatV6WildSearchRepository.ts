import {
  WildEncounterSchema,
  WildRuntimeSchema,
  type WildEncounter,
  type WildRuntime,
} from '@shared/contracts/combatV6Wild';
import { eq } from 'drizzle-orm';
import { db, type DbExecutor, type DbTransaction } from '../drizzle/db';
import { wildSearches } from '../drizzle/schema';

export async function readWildSearch(cultivatorId: string, q: DbExecutor = db) {
  const [row] = await q
    .select()
    .from(wildSearches)
    .where(eq(wildSearches.cultivatorId, cultivatorId))
    .limit(1);
  if (!row) return null;
  return {
    encounter: WildEncounterSchema.parse(row.encounter),
    preparedBattle: row.preparedBattle
      ? (WildRuntimeSchema.parse(row.preparedBattle) as unknown as WildRuntime)
      : null,
  };
}
export async function saveWildSearch(
  cultivatorId: string,
  encounter: WildEncounter,
  tx: DbTransaction,
) {
  const value = {
    encounter: WildEncounterSchema.parse(encounter),
    preparedBattle: null,
    updatedAt: new Date(),
  };
  await tx
    .insert(wildSearches)
    .values({ cultivatorId, ...value })
    .onConflictDoUpdate({ target: wildSearches.cultivatorId, set: value });
}
export async function prepareWildBattle(
  cultivatorId: string,
  runtime: WildRuntime,
  tx: DbTransaction,
) {
  await tx
    .update(wildSearches)
    .set({
      preparedBattle: WildRuntimeSchema.parse(
        runtime,
      ) as unknown as WildRuntime,
    })
    .where(eq(wildSearches.cultivatorId, cultivatorId));
}
