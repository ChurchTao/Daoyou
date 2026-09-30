import type { DbTransaction } from '@server/lib/drizzle/db';
import {
  cultivators,
  playerJournal,
  sectMemberships,
} from '@server/lib/drizzle/schema';
import { journalOperationKey } from '@server/lib/repositories/playerJournalRepository';
import {
  PlayerJournalEventSchema,
  type JournalActivity,
  type JournalChange,
  type PlayerJournalEvent,
} from '@shared/contracts/playerJournal';
import type { InventoryItem } from '@shared/inventory';
import {
  compactJournalChanges,
  inventoryJournalChanges,
} from '@shared/playerJournal';
import type { CultivationProgress } from '@shared/types/cultivator';
import { and, eq } from 'drizzle-orm';

// Only explicitly enrolled settlements collect changes. The transaction owns the
// buffer; rollback/retry gets a fresh buffer and nothing is published out of band.
const captures = new WeakMap<
  DbTransaction,
  {
    owner: string;
    changes: JournalChange[];
    detail?: string;
  }
>();

export function recordJournalItems(
  tx: DbTransaction,
  owner: string,
  before: readonly InventoryItem[],
  after: readonly InventoryItem[],
) {
  const capture = captures.get(tx);
  if (capture?.owner === owner)
    capture.changes.push(...inventoryJournalChanges(before, after));
}

export function recordJournalChange(
  tx: DbTransaction,
  owner: string,
  change: JournalChange,
) {
  const capture = captures.get(tx);
  if (capture?.owner === owner && change.amount) capture.changes.push(change);
}

export function describeJournal(
  tx: DbTransaction,
  owner: string,
  detail: string,
) {
  const capture = captures.get(tx);
  if (capture?.owner === owner) capture.detail = detail;
}

async function readResources(tx: DbTransaction, owner: string) {
  const [row] = await tx
    .select({
      spiritStones: cultivators.spirit_stones,
      reputation: cultivators.reputation,
      contribution: sectMemberships.contribution,
      progress: cultivators.cultivation_progress,
    })
    .from(cultivators)
    .leftJoin(
      sectMemberships,
      and(
        eq(sectMemberships.cultivatorId, cultivators.id),
        eq(sectMemberships.status, 'active'),
      ),
    )
    .where(eq(cultivators.id, owner));
  if (!row) throw new Error('日志结算角色不存在');
  const progress = row.progress as Partial<CultivationProgress> | null;
  return {
    spiritStones: row.spiritStones,
    reputation: row.reputation,
    contribution: row.contribution ?? 0,
    exp: progress?.cultivation_exp ?? 0,
    insight: progress?.comprehension_insight ?? 0,
  };
}

export async function captureJournalSettlement<T>(
  tx: DbTransaction,
  owner: string,
  activity: JournalActivity,
  run: () => Promise<T>,
): Promise<{
  value: T;
  event: Extract<PlayerJournalEvent, { type: 'resources.settled' }>;
}> {
  if (captures.has(tx)) throw new Error('同一事务不能重复开启日志结算');
  const before = await readResources(tx, owner);
  const capture: { owner: string; changes: JournalChange[]; detail?: string } =
    { owner, changes: [] };
  captures.set(tx, capture);
  try {
    const value = await run();
    const after = await readResources(tx, owner);
    for (const resource of [
      'spiritStones',
      'exp',
      'insight',
      'reputation',
      'contribution',
    ] as const) {
      const amount = after[resource] - before[resource];
      if (amount) capture.changes.push({ kind: 'resource', resource, amount });
    }
    return {
      value,
      event: {
        type: 'resources.settled',
        activity,
        ...(capture.detail ? { detail: capture.detail } : {}),
        changes: compactJournalChanges(capture.changes),
      },
    };
  } finally {
    captures.delete(tx);
  }
}

/** Caller already guards delivery with its transport receipt or battle archive. */
export async function runJournalSettlement<T>(
  tx: DbTransaction,
  owner: string,
  activity: JournalActivity,
  operationId: string,
  run: () => Promise<T>,
): Promise<T> {
  const { value, event } = await captureJournalSettlement(
    tx,
    owner,
    activity,
    run,
  );
  if (event.changes.length) {
    await tx.insert(playerJournal).values({
      cultivatorId: owner,
      operationKey: journalOperationKey(activity, operationId),
      event: PlayerJournalEventSchema.parse(event),
    });
  }
  return value;
}
