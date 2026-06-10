import type { DbExecutor, DbTransaction } from '@server/lib/drizzle/db';
import { getExecutor } from '@server/lib/drizzle/db';
import {
  cultivatorStateVersions,
  playerStateEvents,
} from '@server/lib/drizzle/schema';
import {
  PLAYER_STATE_DOMAINS,
  type PlayerStateDomain,
  type PlayerStateDomainVersions,
  type PlayerStateEvent,
} from '@shared/contracts/player';
import { asc, eq, lt, sql } from 'drizzle-orm';

type StateVersionRow = typeof cultivatorStateVersions.$inferSelect;
type PlayerStateEventRow = typeof playerStateEvents.$inferSelect;

const VERSION_COLUMNS = {
  profile: 'profileVersion',
  condition: 'conditionVersion',
  progress: 'progressVersion',
  currency: 'currencyVersion',
  inventory: 'inventoryVersion',
  products: 'productsVersion',
  mail: 'mailVersion',
  tasks: 'tasksVersion',
} satisfies Record<PlayerStateDomain, string>;

function domainVersionsFromRow(
  row: StateVersionRow,
): PlayerStateDomainVersions {
  return {
    profile: row.profileVersion,
    condition: row.conditionVersion,
    progress: row.progressVersion,
    currency: row.currencyVersion,
    inventory: row.inventoryVersion,
    products: row.productsVersion,
    mail: row.mailVersion,
    tasks: row.tasksVersion,
  };
}

export function mapPlayerStateEventRow(
  row: PlayerStateEventRow,
): PlayerStateEvent {
  return {
    id: row.id,
    cultivatorId: row.cultivatorId,
    globalVersion: row.globalVersion,
    domainVersion: row.domainVersion,
    domain: row.domain,
    eventType: row.eventType,
    patch: row.patch,
    invalidates: row.invalidates ?? [],
    source: row.source,
    createdAt: row.createdAt.toISOString(),
  };
}

export async function getOrCreateStateVersion(
  cultivatorId: string,
  q: DbExecutor | DbTransaction = getExecutor(),
): Promise<{
  globalVersion: number;
  domainVersions: PlayerStateDomainVersions;
}> {
  await q
    .insert(cultivatorStateVersions)
    .values({ cultivatorId })
    .onConflictDoNothing();

  const [row] = await q
    .select()
    .from(cultivatorStateVersions)
    .where(eq(cultivatorStateVersions.cultivatorId, cultivatorId))
    .limit(1);

  if (!row) {
    throw new Error('状态版本初始化失败');
  }

  return {
    globalVersion: row.globalVersion,
    domainVersions: domainVersionsFromRow(row),
  };
}

export async function bumpStateVersions(
  tx: DbTransaction,
  cultivatorId: string,
  domains: PlayerStateDomain[],
): Promise<{
  globalVersion: number;
  domainVersions: PlayerStateDomainVersions;
}> {
  const uniqueDomains = Array.from(
    new Set(domains.filter((domain) => PLAYER_STATE_DOMAINS.includes(domain))),
  );
  const insertValues: typeof cultivatorStateVersions.$inferInsert = {
    cultivatorId,
    globalVersion: 1,
  };
  const updateSet: Record<string, unknown> = {
    globalVersion: sql`${cultivatorStateVersions.globalVersion} + 1`,
    updatedAt: sql`now()`,
  };

  for (const domain of uniqueDomains) {
    const property = VERSION_COLUMNS[domain];
    insertValues[property as keyof typeof insertValues] = 1 as never;
    updateSet[property] =
      sql`${cultivatorStateVersions[property as keyof typeof cultivatorStateVersions]} + 1`;
  }

  const [row] = await tx
    .insert(cultivatorStateVersions)
    .values(insertValues)
    .onConflictDoUpdate({
      target: cultivatorStateVersions.cultivatorId,
      set: updateSet,
    })
    .returning();

  if (!row) {
    throw new Error('状态版本递增失败');
  }

  return {
    globalVersion: row.globalVersion,
    domainVersions: domainVersionsFromRow(row),
  };
}

export async function insertStateEvents(
  tx: DbTransaction,
  input: {
    userId: string;
    cultivatorId: string;
    globalVersion: number;
    domainVersions: Partial<PlayerStateDomainVersions>;
    events: Array<{
      domain: PlayerStateDomain;
      eventType: string;
      patch?: unknown;
      invalidates?: PlayerStateDomain[];
      source: string;
      requestId?: string | null;
    }>;
  },
): Promise<PlayerStateEvent[]> {
  if (input.events.length === 0) {
    return [];
  }

  const rows = await tx
    .insert(playerStateEvents)
    .values(
      input.events.map((event) => ({
        userId: input.userId,
        cultivatorId: input.cultivatorId,
        globalVersion: input.globalVersion,
        domainVersion: input.domainVersions[event.domain] ?? input.globalVersion,
        domain: event.domain,
        eventType: event.eventType,
        patch: event.patch ?? {},
        invalidates: event.invalidates ?? [],
        source: event.source,
        requestId: event.requestId ?? null,
      })),
    )
    .returning();

  return rows.map(mapPlayerStateEventRow);
}

export async function listStateEventsAfter(
  cultivatorId: string,
  after: number,
  q: DbExecutor | DbTransaction = getExecutor(),
): Promise<PlayerStateEvent[]> {
  const rows = await q
    .select()
    .from(playerStateEvents)
    .where(
      sql`${playerStateEvents.cultivatorId} = ${cultivatorId} and ${playerStateEvents.globalVersion} > ${after}`,
    )
    .orderBy(asc(playerStateEvents.globalVersion), asc(playerStateEvents.id))
    .limit(200);

  return rows.map(mapPlayerStateEventRow);
}

export async function prunePlayerStateEventsOlderThan(
  cutoff: Date,
  q: DbExecutor | DbTransaction = getExecutor(),
): Promise<number> {
  const deleted = await q
    .delete(playerStateEvents)
    .where(lt(playerStateEvents.createdAt, cutoff))
    .returning({ id: playerStateEvents.id });

  return deleted.length;
}
