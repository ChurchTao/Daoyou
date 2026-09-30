import {
  getExecutor,
  type DbExecutor,
  type DbTransaction,
} from '@server/lib/drizzle/db';
import { playerJournal } from '@server/lib/drizzle/schema';
import {
  JOURNAL_ACTIVITIES,
  PlayerJournalEventSchema,
  StoredJournalEventSchema,
  type JournalActivity,
  type PlayerJournalEvent,
  type PlayerJournalPage,
  type PlayerJournalQuerySchema,
  type StoredJournalEvent,
} from '@shared/contracts/playerJournal';
import { and, desc, eq, sql } from 'drizzle-orm';
import { createHash } from 'node:crypto';
import type { z } from 'zod';

export class JournalIdempotencyError extends Error {
  readonly status = 409;
}

export async function findJournalOperation(
  cultivatorId: string,
  operationKey: string,
  fingerprint: string | null,
  tx?: DbTransaction,
) {
  const [row] = await getExecutor(tx)
    .select()
    .from(playerJournal)
    .where(
      and(
        eq(playerJournal.cultivatorId, cultivatorId),
        eq(playerJournal.operationKey, operationKey),
      ),
    )
    .limit(1);
  if (!row) return null;
  if (row.requestFingerprint !== fingerprint) {
    throw new JournalIdempotencyError('同一请求编号不能用于不同的操作参数');
  }
  return { ...row, event: StoredJournalEventSchema.parse(row.event) };
}

/** Claim before any side effect. The caller must finish the row in this transaction. */
export async function claimJournalOperation(
  tx: DbTransaction,
  input: {
    cultivatorId: string;
    operationKey: string;
    fingerprint: string | null;
  },
): Promise<{ id: string; previous: StoredJournalEvent | null }> {
  const [row] = await tx
    .insert(playerJournal)
    .values({
      cultivatorId: input.cultivatorId,
      operationKey: input.operationKey,
      requestFingerprint: input.fingerprint,
    })
    .onConflictDoNothing({
      target: [playerJournal.cultivatorId, playerJournal.operationKey],
    })
    .returning({ id: playerJournal.id });
  if (row) return { id: row.id, previous: null };
  const previous = await findJournalOperation(
    input.cultivatorId,
    input.operationKey,
    input.fingerprint,
    tx,
  );
  if (!previous) throw new Error('执行记录不存在');
  return { id: previous.id, previous: previous.event };
}

export async function completeJournalOperation(
  tx: DbTransaction,
  id: string,
  event: StoredJournalEvent,
) {
  await tx
    .update(playerJournal)
    .set({ event: StoredJournalEventSchema.parse(event) })
    .where(eq(playerJournal.id, id));
}

export async function listPlayerJournal(
  cultivatorId: string,
  query: z.infer<typeof PlayerJournalQuerySchema>,
): Promise<PlayerJournalPage> {
  const rows = await getExecutor()
    .select({
      id: playerJournal.id,
      event: sql<PlayerJournalEvent>`${playerJournal.event} - 'result'`,
      createdAt: playerJournal.createdAt,
    })
    .from(playerJournal)
    .where(
      and(
        eq(playerJournal.cultivatorId, cultivatorId),
        sql`(
          (${playerJournal.event}->>'type' = 'resources.settled' AND jsonb_array_length(${playerJournal.event}->'changes') > 0)
          OR (${playerJournal.event}->>'type' = 'retreat.completed' AND (
            (${playerJournal.event}->'summary'->>'exp_gained')::numeric <> 0 OR
            (${playerJournal.event}->'summary'->>'insight_gained')::numeric <> 0))
          OR (${playerJournal.event}->>'type' = 'breakthrough.completed' AND (
            (${playerJournal.event}->>'expSpent')::numeric <> 0 OR
            (${playerJournal.event}->'summary'->>'insight_change')::numeric <> 0))
        )`,
        query.activity
          ? sql`${playerJournal.event}->>'activity' = ${query.activity}`
          : undefined,
        query.type
          ? sql`${playerJournal.event}->>'type' = ${query.type}`
          : undefined,
        query.before && query.beforeId
          ? sql`(${playerJournal.createdAt}, ${playerJournal.id}) < (${new Date(query.before)}, ${query.beforeId}::uuid)`
          : undefined,
      ),
    )
    .orderBy(desc(playerJournal.createdAt), desc(playerJournal.id))
    .limit(31);
  const items = rows.slice(0, 30).map((row) => ({
    id: row.id,
    event: PlayerJournalEventSchema.parse(row.event),
    createdAt: row.createdAt.toISOString(),
  }));
  const last = items.at(-1);
  return {
    items,
    nextCursor:
      rows.length > 30 && last
        ? { id: last.id, createdAt: last.createdAt }
        : null,
  };
}

export function isJournalActivity(source: string): source is JournalActivity {
  return Object.hasOwn(JOURNAL_ACTIVITIES, source);
}

export function journalOperationKey(source: string, requestId: string) {
  const key = `${source}:${requestId}`;
  return Buffer.byteLength(key, 'utf8') <= 160
    ? key
    : `sha256:${createHash('sha256').update(key).digest('hex')}`;
}

/** Read-through for preflight replay checks while old receipts remain valid. */
export async function findJournalMutationRequest(
  cultivatorId: string,
  source: string,
  requestId: string,
  q: DbExecutor,
) {
  if (!isJournalActivity(source)) return null;
  const [row] = await q
    .select()
    .from(playerJournal)
    .where(
      and(
        eq(playerJournal.cultivatorId, cultivatorId),
        eq(playerJournal.operationKey, journalOperationKey(source, requestId)),
      ),
    )
    .limit(1);
  if (!row) return null;
  const event = StoredJournalEventSchema.parse(row.event);
  return {
    id: row.id,
    cultivatorId,
    source,
    requestId,
    requestFingerprint: row.requestFingerprint ?? '',
    result: event.result,
    createdAt: row.createdAt,
  };
}
