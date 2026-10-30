import type { DbExecutor } from '@server/lib/drizzle/db.js';
import { cultivatorAutoStrategies } from '@server/lib/drizzle/schema.js';
import {
  type AutoStrategy,
  type AutoStrategyBook,
  activeStoredAutoStrategy,
  parseStoredAutoStrategyBook,
} from '@daoyou/game-domain/combat/auto';
import { is } from 'drizzle-orm';
import { PgTransaction } from 'drizzle-orm/pg-core';
import { and, eq } from 'drizzle-orm';

async function readStoredBook(
  cultivatorId: string,
  pathId: string,
  q: DbExecutor,
  lock: boolean,
): Promise<AutoStrategyBook | null> {
  const query = q
    .select({ strategy: cultivatorAutoStrategies.strategy })
    .from(cultivatorAutoStrategies)
    .where(
      and(
        eq(cultivatorAutoStrategies.cultivatorId, cultivatorId),
        eq(cultivatorAutoStrategies.pathId, pathId),
      ),
    )
    .limit(1);
  const [row] = await (lock ? query.for('update') : query);
  return row ? parseStoredAutoStrategyBook(row.strategy) : null;
}

async function writeStoredBook(
  cultivatorId: string,
  pathId: string,
  book: AutoStrategyBook | null,
  q: DbExecutor,
) {
  if (!book) {
    await q
      .delete(cultivatorAutoStrategies)
      .where(
        and(
          eq(cultivatorAutoStrategies.cultivatorId, cultivatorId),
          eq(cultivatorAutoStrategies.pathId, pathId),
        ),
      );
    return;
  }
  await q
    .insert(cultivatorAutoStrategies)
    .values({ cultivatorId, pathId, strategy: book })
    .onConflictDoUpdate({
      target: [
        cultivatorAutoStrategies.cultivatorId,
        cultivatorAutoStrategies.pathId,
      ],
      set: { strategy: book, updatedAt: new Date() },
    });
}

export async function readAutoStrategyBook(
  cultivatorId: string,
  pathId: string,
  q: DbExecutor,
): Promise<AutoStrategyBook | null> {
  return readStoredBook(cultivatorId, pathId, q, false);
}

export async function readCustomAutoStrategy(
  cultivatorId: string,
  pathId: string,
  q: DbExecutor,
): Promise<AutoStrategy | null> {
  return activeStoredAutoStrategy(
    await readAutoStrategyBook(cultivatorId, pathId, q),
  );
}

export async function mutateAutoStrategyBook(
  cultivatorId: string,
  pathId: string,
  mutate: (current: AutoStrategyBook | null) => AutoStrategyBook | null,
  q: DbExecutor,
): Promise<AutoStrategyBook | null> {
  const apply = async (executor: DbExecutor) => {
    const current = await readStoredBook(cultivatorId, pathId, executor, true);
    const next = mutate(current);
    if (next === current) return current;
    await writeStoredBook(cultivatorId, pathId, next, executor);
    return next;
  };
  if (is(q, PgTransaction)) return apply(q);
  return q.transaction(apply);
}
