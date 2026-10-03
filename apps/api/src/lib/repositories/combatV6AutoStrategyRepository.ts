import type { DbExecutor } from '@server/lib/drizzle/db.js';
import { cultivatorAutoStrategies } from '@server/lib/drizzle/schema.js';
import {
  AutoStrategySchema,
  type AutoStrategy,
} from '@daoyou/shared/combat-v6/auto-strategy';
import { and, eq } from 'drizzle-orm';

export async function readCustomAutoStrategy(
  cultivatorId: string,
  pathId: string,
  q: DbExecutor,
): Promise<AutoStrategy | null> {
  const [row] = await q
    .select({ strategy: cultivatorAutoStrategies.strategy })
    .from(cultivatorAutoStrategies)
    .where(
      and(
        eq(cultivatorAutoStrategies.cultivatorId, cultivatorId),
        eq(cultivatorAutoStrategies.pathId, pathId),
      ),
    )
    .limit(1);
  return row ? AutoStrategySchema.parse(row.strategy) : null;
}

export async function saveCustomAutoStrategy(
  cultivatorId: string,
  pathId: string,
  strategy: AutoStrategy,
  q: DbExecutor,
) {
  await q
    .insert(cultivatorAutoStrategies)
    .values({ cultivatorId, pathId, strategy })
    .onConflictDoUpdate({
      target: [
        cultivatorAutoStrategies.cultivatorId,
        cultivatorAutoStrategies.pathId,
      ],
      set: { strategy, updatedAt: new Date() },
    });
}

export async function removeCustomAutoStrategy(
  cultivatorId: string,
  pathId: string,
  q: DbExecutor,
) {
  await q
    .delete(cultivatorAutoStrategies)
    .where(
      and(
        eq(cultivatorAutoStrategies.cultivatorId, cultivatorId),
        eq(cultivatorAutoStrategies.pathId, pathId),
      ),
    );
}
