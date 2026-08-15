import {
  getExecutor,
  runDbTasks,
  type DbExecutor,
  type DbTransaction,
} from '@server/lib/drizzle/db';
import {
  cultivators,
  playerMutationRequests,
  resourceEvents,
  resourceScopes,
  resourceVersions,
} from '@server/lib/drizzle/schema';
import {
  RESOURCE_TOPICS,
  ResourceChangeSchema,
  type ResourceChange,
  type ResourceChangeDescriptor,
  type ResourceScope,
  type ResourceTopic,
} from '@shared/contracts/resources';
import { and, asc, eq, inArray, like, lt, min, sql } from 'drizzle-orm';
import { ZodError } from 'zod';

type ResourceEventRow = typeof resourceEvents.$inferSelect;

export const RESOURCE_EVENT_PAGE_LIMIT = 200;

export type ScopedResourceChangeDescriptor = ResourceChangeDescriptor & {
  scope: ResourceScope;
};

export type ScopeVersionCommit = {
  scope: ResourceScope;
  scopeId: string;
  scopeVersion: number;
  resourceVersions: Partial<Record<ResourceTopic, number>>;
};

function assertResourceTopics(
  topics: readonly unknown[],
): asserts topics is readonly ResourceTopic[] {
  for (const topic of topics) {
    if (!RESOURCE_TOPICS.includes(topic as ResourceTopic)) {
      throw new Error(`未知资源: ${String(topic)}`);
    }
  }
}

export function resourceScopeMapKey(scope: ResourceScope): string {
  return `${scope.kind}:${scope.id}`;
}

export function mapResourceEventRow(
  row: ResourceEventRow,
  scope: ResourceScope,
): ResourceChange {
  const base = {
    id: row.id,
    mutationOrdinal: row.mutationOrdinal,
    scope,
    scopeVersion: row.scopeVersion,
    resourceVersion: row.resourceVersion,
    resourceTopic: row.resourceKey,
    eventType: row.eventType,
    source: row.source,
    createdAt: row.createdAt.toISOString(),
  };
  return ResourceChangeSchema.parse(
    row.operation === 'invalidate'
      ? { ...base, operation: 'invalidate' }
      : { ...base, operation: row.operation, payload: row.payload },
  );
}

export async function lockCultivatorForStateMutation(
  tx: DbTransaction,
  cultivatorId: string,
): Promise<void> {
  const [row] = await tx
    .select({ id: cultivators.id })
    .from(cultivators)
    .where(eq(cultivators.id, cultivatorId))
    .for('update')
    .limit(1);
  if (!row) throw new Error('角色不存在');
}

export async function readScopeVersion(
  scope: ResourceScope,
  q: DbExecutor | DbTransaction = getExecutor(),
): Promise<number> {
  const [row] = await q
    .select({ scopeVersion: resourceScopes.scopeVersion })
    .from(resourceScopes)
    .where(
      and(
        eq(resourceScopes.scopeKind, scope.kind),
        eq(resourceScopes.scopeKey, scope.id),
      ),
    )
    .limit(1);
  return row?.scopeVersion ?? 0;
}

export async function readResourceVersions(
  scope: ResourceScope,
  topics: readonly ResourceTopic[],
  q: DbExecutor | DbTransaction = getExecutor(),
): Promise<Partial<Record<ResourceTopic, number>>> {
  if (topics.length === 0) return {};
  assertResourceTopics(topics);
  const rows = await q
    .select({
      resourceKey: resourceVersions.resourceKey,
      version: resourceVersions.version,
    })
    .from(resourceVersions)
    .innerJoin(resourceScopes, eq(resourceVersions.scopeId, resourceScopes.id))
    .where(
      and(
        eq(resourceScopes.scopeKind, scope.kind),
        eq(resourceScopes.scopeKey, scope.id),
        inArray(resourceVersions.resourceKey, [...topics]),
      ),
    );
  return Object.fromEntries(
    rows.map((row) => [row.resourceKey, row.version]),
  ) as Partial<Record<ResourceTopic, number>>;
}

export async function bumpResourceVersions(
  tx: DbTransaction,
  changes: readonly ScopedResourceChangeDescriptor[],
): Promise<Map<string, ScopeVersionCommit>> {
  assertResourceTopics(changes.map((change) => change.resourceTopic));
  const grouped = new Map<
    string,
    { scope: ResourceScope; topics: Set<ResourceTopic> }
  >();
  for (const change of changes) {
    const key = resourceScopeMapKey(change.scope);
    const group = grouped.get(key) ?? {
      scope: change.scope,
      topics: new Set<ResourceTopic>(),
    };
    group.topics.add(change.resourceTopic);
    grouped.set(key, group);
  }

  const result = new Map<string, ScopeVersionCommit>();
  for (const [key, group] of [...grouped.entries()].sort(([left], [right]) =>
    left.localeCompare(right),
  )) {
    const [scopeRow] = await tx
      .insert(resourceScopes)
      .values({
        scopeKind: group.scope.kind,
        scopeKey: group.scope.id,
        scopeVersion: 1,
      })
      .onConflictDoUpdate({
        target: [resourceScopes.scopeKind, resourceScopes.scopeKey],
        set: {
          scopeVersion: sql`${resourceScopes.scopeVersion} + 1`,
          updatedAt: sql`now()`,
        },
      })
      .returning({
        id: resourceScopes.id,
        scopeVersion: resourceScopes.scopeVersion,
      });
    if (!scopeRow) throw new Error('资源作用域版本递增失败');

    const topics = [...group.topics];
    const rows = await tx
      .insert(resourceVersions)
      .values(
        topics.map((resourceKey) => ({
          scopeId: scopeRow.id,
          resourceKey,
          version: 1,
        })),
      )
      .onConflictDoUpdate({
        target: [resourceVersions.scopeId, resourceVersions.resourceKey],
        set: {
          version: sql`${resourceVersions.version} + 1`,
          updatedAt: sql`now()`,
        },
      })
      .returning({
        resourceKey: resourceVersions.resourceKey,
        version: resourceVersions.version,
      });
    if (rows.length !== topics.length) {
      throw new Error('资源版本批量递增不完整');
    }
    result.set(key, {
      scope: group.scope,
      scopeId: scopeRow.id,
      scopeVersion: scopeRow.scopeVersion,
      resourceVersions: Object.fromEntries(
        rows.map((row) => [row.resourceKey, row.version]),
      ),
    });
  }
  return result;
}

export async function insertResourceChanges(
  tx: DbTransaction,
  input: {
    actorUserId?: string | null;
    actorCultivatorId?: string | null;
    commits: Map<string, ScopeVersionCommit>;
    changes: Array<
      ScopedResourceChangeDescriptor & {
        source: string;
        requestId?: string | null;
      }
    >;
  },
): Promise<ResourceChange[]> {
  if (input.changes.length === 0) return [];
  const rows = await tx
    .insert(resourceEvents)
    .values(
      input.changes.map((change, mutationOrdinal) => {
        const commit = input.commits.get(resourceScopeMapKey(change.scope));
        const resourceVersion =
          commit?.resourceVersions[change.resourceTopic];
        if (!commit || typeof resourceVersion !== 'number') {
          throw new Error(
            `缺少资源版本: ${change.scope.kind}:${change.scope.id}:${change.resourceTopic}`,
          );
        }
        return {
          scopeId: commit.scopeId,
          scopeVersion: commit.scopeVersion,
          resourceVersion,
          resourceKey: change.resourceTopic,
          operation: change.operation,
          eventType: change.eventType,
          payload: change.operation === 'invalidate' ? null : change.payload,
          actorUserId: input.actorUserId ?? null,
          actorCultivatorId: input.actorCultivatorId ?? null,
          source: change.source,
          requestId: change.requestId ?? null,
          mutationOrdinal,
        };
      }),
    )
    .returning();

  const scopeById = new Map(
    [...input.commits.values()].map((commit) => [commit.scopeId, commit.scope]),
  );
  return rows.map((row) => {
    const scope = scopeById.get(row.scopeId);
    if (!scope) throw new Error('资源事件缺少作用域');
    return mapResourceEventRow(row, scope);
  });
}

export async function findPlayerMutationRequest(
  cultivatorId: string,
  source: string,
  requestId: string,
  q: DbExecutor | DbTransaction = getExecutor(),
) {
  const [row] = await q
    .select()
    .from(playerMutationRequests)
    .where(
      and(
        eq(playerMutationRequests.cultivatorId, cultivatorId),
        eq(playerMutationRequests.source, source),
        eq(playerMutationRequests.requestId, requestId),
      ),
    )
    .limit(1);
  return row ?? null;
}

export async function listPlayerMutationRequestsByPrefix(
  cultivatorId: string,
  source: string,
  requestIdPrefix: string,
  q: DbExecutor | DbTransaction = getExecutor(),
) {
  return q
    .select()
    .from(playerMutationRequests)
    .where(
      and(
        eq(playerMutationRequests.cultivatorId, cultivatorId),
        eq(playerMutationRequests.source, source),
        like(playerMutationRequests.requestId, `${requestIdPrefix}%`),
      ),
    )
    .orderBy(asc(playerMutationRequests.createdAt));
}

export async function insertPlayerMutationRequest(
  input: {
    cultivatorId: string;
    source: string;
    requestId: string;
    requestFingerprint: string;
    result: unknown;
  },
  tx: DbTransaction,
) {
  const [row] = await tx
    .insert(playerMutationRequests)
    .values(input)
    .returning();
  return row;
}

export async function prunePlayerMutationRequestsOlderThan(
  cutoff: Date,
  q: DbExecutor | DbTransaction = getExecutor(),
): Promise<number> {
  const deleted = await q
    .delete(playerMutationRequests)
    .where(lt(playerMutationRequests.createdAt, cutoff))
    .returning({ id: playerMutationRequests.id });
  return deleted.length;
}

export async function readResourceEventWindow(
  scope: ResourceScope,
  after: number,
  q: DbExecutor | DbTransaction = getExecutor(),
): Promise<{
  changes: ResourceChange[];
  currentScopeVersion: number;
  earliestAvailableVersion: number;
  hasIncompatibleEvents: boolean;
}> {
  const [scopeRow] = await q
    .select({
      id: resourceScopes.id,
      scopeVersion: resourceScopes.scopeVersion,
    })
    .from(resourceScopes)
    .where(
      and(
        eq(resourceScopes.scopeKind, scope.kind),
        eq(resourceScopes.scopeKey, scope.id),
      ),
    )
    .limit(1);
  if (!scopeRow) {
    return {
      changes: [],
      currentScopeVersion: 0,
      earliestAvailableVersion: 0,
      hasIncompatibleEvents: false,
    };
  }
  const [[watermark], rows] = await runDbTasks(q, [
    () =>
      q
        .select({ version: min(resourceEvents.scopeVersion) })
        .from(resourceEvents)
        .where(eq(resourceEvents.scopeId, scopeRow.id)),
    () =>
      q
        .select()
        .from(resourceEvents)
        .where(
          and(
            eq(resourceEvents.scopeId, scopeRow.id),
            sql`${resourceEvents.scopeVersion} > ${after}`,
          ),
        )
        .orderBy(
          asc(resourceEvents.scopeVersion),
          asc(resourceEvents.mutationOrdinal),
        )
        .limit(RESOURCE_EVENT_PAGE_LIMIT + 1),
  ]);

  const changes: ResourceChange[] = [];
  let hasIncompatibleEvents = false;
  for (const row of rows) {
    try {
      changes.push(mapResourceEventRow(row, scope));
    } catch (error) {
      if (!(error instanceof ZodError)) throw error;
      hasIncompatibleEvents = true;
    }
  }

  return {
    // A persisted event may outlive the contract version that produced it.
    // Do not apply later events across that compatibility boundary; callers
    // must advance to the current version by reloading authoritative snapshots.
    changes: hasIncompatibleEvents ? [] : changes,
    currentScopeVersion: scopeRow.scopeVersion,
    earliestAvailableVersion:
      watermark?.version ?? scopeRow.scopeVersion + 1,
    hasIncompatibleEvents,
  };
}

export async function listResourceChangesForRequest(
  cultivatorId: string,
  source: string,
  requestId: string,
  q: DbExecutor | DbTransaction = getExecutor(),
): Promise<ResourceChange[]> {
  const rows = await q
    .select({
      event: resourceEvents,
      scopeKind: resourceScopes.scopeKind,
      scopeKey: resourceScopes.scopeKey,
    })
    .from(resourceEvents)
    .innerJoin(resourceScopes, eq(resourceEvents.scopeId, resourceScopes.id))
    .where(
      and(
        eq(resourceEvents.actorCultivatorId, cultivatorId),
        eq(resourceEvents.source, source),
        eq(resourceEvents.requestId, requestId),
      ),
    )
    .orderBy(asc(resourceEvents.mutationOrdinal));
  return rows.map((row) =>
    mapResourceEventRow(row.event, {
      kind: row.scopeKind,
      id: row.scopeKey,
    }),
  );
}

export async function pruneResourceEventsOlderThan(
  cutoff: Date,
  q: DbExecutor | DbTransaction = getExecutor(),
): Promise<number> {
  const deleted = await q
    .delete(resourceEvents)
    .where(
      and(
        lt(resourceEvents.createdAt, cutoff),
        sql`(
          ${resourceEvents.requestId} IS NULL
          OR NOT EXISTS (
            SELECT 1
            FROM ${playerMutationRequests}
            WHERE ${playerMutationRequests.cultivatorId} = ${resourceEvents.actorCultivatorId}
              AND ${playerMutationRequests.source} = ${resourceEvents.source}
              AND ${playerMutationRequests.requestId} = ${resourceEvents.requestId}
          )
        )`,
      ),
    )
    .returning({ id: resourceEvents.id });
  return deleted.length;
}
