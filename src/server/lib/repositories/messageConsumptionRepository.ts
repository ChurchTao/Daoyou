import type { DbExecutor, DbTransaction } from '@server/lib/drizzle/db';
import { getExecutor } from '@server/lib/drizzle/db';
import { messageConsumptions } from '@server/lib/drizzle/schema';
import { and, lt, ne } from 'drizzle-orm';

export const COMBAT_V6_CONDITION_CONSUMER = 'combat-v6-condition-v1';

export async function claimMessageForConsumer(
  input: {
    consumerName: string;
    messageId: string;
    messageKey: string;
  },
  tx: DbTransaction,
): Promise<boolean> {
  const [row] = await tx
    .insert(messageConsumptions)
    .values(input)
    .onConflictDoNothing()
    .returning({ messageId: messageConsumptions.messageId });
  return Boolean(row);
}

export async function pruneMessageConsumptions(
  cutoff: Date,
  q: DbExecutor | DbTransaction = getExecutor(),
): Promise<number> {
  const rows = await q
    .delete(messageConsumptions)
    // Settlement may commit in PG while Redis unlock keeps failing indefinitely.
    // Keep these receipts until a settlement-aware retention policy is available.
    .where(
      and(
        lt(messageConsumptions.processedAt, cutoff),
        ne(messageConsumptions.consumerName, COMBAT_V6_CONDITION_CONSUMER),
      ),
    )
    .returning({ messageId: messageConsumptions.messageId });
  return rows.length;
}
