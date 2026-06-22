import { getExecutor, type DbExecutor, type DbTransaction } from '@server/lib/drizzle/db';
import * as schema from '@server/lib/drizzle/schema';
import { isTalismanConsumable } from '@shared/lib/consumables';
import { and, eq } from 'drizzle-orm';
import { mapConsumableRow } from './consumablePersistence';

export class TalismanScenarioError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'TalismanScenarioError';
  }
}

export async function consumeFirstTalismanByScenario(
  cultivatorId: string,
  scenario: string,
  executor?: DbExecutor | DbTransaction,
): Promise<void> {
  const q = executor ?? getExecutor();
  const rows = await q
    .select()
    .from(schema.consumables)
    .where(
      and(
        eq(schema.consumables.cultivatorId, cultivatorId),
        eq(schema.consumables.type, '符箓'),
      ),
    )
    .limit(200);

  const row = rows
    .filter((candidate) => candidate.quantity > 0)
    .find((candidate) => {
      const consumable = mapConsumableRow(candidate);
      return (
        isTalismanConsumable(consumable) &&
        consumable.spec.scenario === scenario
      );
    });

  if (!row) {
    throw new TalismanScenarioError('缺少对应符箓，无法完成此操作');
  }

  if (row.quantity <= 1) {
    await q
      .delete(schema.consumables)
      .where(eq(schema.consumables.id, row.id));
    return;
  }

  await q
    .update(schema.consumables)
    .set({ quantity: row.quantity - 1 })
    .where(eq(schema.consumables.id, row.id));
}
