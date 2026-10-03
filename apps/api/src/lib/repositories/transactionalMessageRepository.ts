import type { DbExecutor, DbTransaction } from '@server/lib/drizzle/db.js';
import { getExecutor } from '@server/lib/drizzle/db.js';
import { transactionalMessages } from '@server/lib/drizzle/schema.js';
import { and, asc, eq, isNull, lt, sql } from 'drizzle-orm';
import { randomUUID } from 'node:crypto';

export async function createTransactionalMessage(
  input: {
    id?: string;
    messageKey: string;
    destination: string;
    payload: unknown;
    deduplicationKey?: string;
  },
  tx: DbTransaction,
): Promise<{ id: string }> {
  const [row] = await tx
    .insert(transactionalMessages)
    .values({
      id: input.id ?? randomUUID(),
      messageKey: input.messageKey,
      destination: input.destination,
      payload: input.payload,
      deduplicationKey: input.deduplicationKey,
    })
    .returning({ id: transactionalMessages.id });
  if (!row) throw new Error('创建本地事务消息失败');
  return row;
}

export async function findPendingTransactionalMessage(
  messageId: string,
  q: DbExecutor | DbTransaction = getExecutor(),
) {
  const [row] = await q
    .select()
    .from(transactionalMessages)
    .where(
      and(
        eq(transactionalMessages.id, messageId),
        isNull(transactionalMessages.publishedAt),
      ),
    )
    .limit(1);
  return row ?? null;
}

export function listPendingTransactionalMessages(
  limit: number,
  q: DbExecutor | DbTransaction = getExecutor(),
) {
  return q
    .select()
    .from(transactionalMessages)
    .where(isNull(transactionalMessages.publishedAt))
    .orderBy(asc(transactionalMessages.createdAt))
    .limit(limit);
}

export async function recordTransactionalMessagePublishAttempt(
  messageId: string,
  q: DbExecutor | DbTransaction = getExecutor(),
): Promise<void> {
  await q
    .update(transactionalMessages)
    .set({
      publishAttempts: sql`${transactionalMessages.publishAttempts} + 1`,
      lastPublishError: null,
    })
    .where(eq(transactionalMessages.id, messageId));
}

export async function markTransactionalMessagePublished(
  messageId: string,
  q: DbExecutor | DbTransaction = getExecutor(),
): Promise<void> {
  await q
    .update(transactionalMessages)
    .set({ publishedAt: new Date(), lastPublishError: null })
    .where(
      and(
        eq(transactionalMessages.id, messageId),
        isNull(transactionalMessages.publishedAt),
      ),
    );
}

export async function recordTransactionalMessagePublishFailure(
  messageId: string,
  error: unknown,
  q: DbExecutor | DbTransaction = getExecutor(),
): Promise<void> {
  const message = error instanceof Error ? error.message : String(error);
  await q
    .update(transactionalMessages)
    .set({ lastPublishError: message.slice(0, 2_000) })
    .where(eq(transactionalMessages.id, messageId));
}

export async function prunePublishedTransactionalMessages(
  cutoff: Date,
  q: DbExecutor | DbTransaction = getExecutor(),
): Promise<number> {
  const rows = await q
    .delete(transactionalMessages)
    .where(lt(transactionalMessages.publishedAt, cutoff))
    .returning({ id: transactionalMessages.id });
  return rows.length;
}
