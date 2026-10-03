import { z } from 'zod';
import type {
  ResourceChange,
  ResourceDataMap,
  ResourceTopic,
} from './registry.js';

export const RESOURCE_SCOPE_KINDS = [
  'account',
  'cultivator',
  'sect',
  'global',
] as const;

export const ResourceScopeKindSchema = z.enum(RESOURCE_SCOPE_KINDS);
export type ResourceScopeKind = (typeof RESOURCE_SCOPE_KINDS)[number];

export const ResourceScopeSchema = z
  .object({
    kind: ResourceScopeKindSchema,
    id: z.string().min(1).max(128),
  })
  .strict();
export type ResourceScope = z.infer<typeof ResourceScopeSchema>;

export type ResourceAddress<TTopic extends ResourceTopic = ResourceTopic> = {
  scope: ResourceScope;
  topic: TTopic;
};

export type ResourceReadMeta<TTopic extends ResourceTopic = ResourceTopic> = {
  scope: ResourceScope;
  topic: TTopic;
  resourceVersion: number;
  scopeVersion: number;
};

export type ResourceReadResponse<TTopic extends ResourceTopic> = {
  success: true;
  data: ResourceDataMap[TTopic];
  resource: ResourceReadMeta<TTopic>;
};

declare const resourceCacheKeyBrand: unique symbol;
export type ResourceCacheKey = string & {
  readonly [resourceCacheKeyBrand]: true;
};

export function canonicalizeResourceParams(value: unknown): string {
  if (value === undefined) return '';
  if (value === null || typeof value !== 'object') return JSON.stringify(value);
  if (Array.isArray(value)) {
    return `[${value.map(canonicalizeResourceParams).join(',')}]`;
  }

  return `{${Object.entries(value as Record<string, unknown>)
    .filter(([, item]) => item !== undefined)
    .sort(([left], [right]) => left.localeCompare(right))
    .map(
      ([key, item]) =>
        `${JSON.stringify(key)}:${canonicalizeResourceParams(item)}`,
    )
    .join(',')}}`;
}

export function createResourceCacheKey(
  scope: ResourceScope,
  topic: ResourceTopic,
  params?: unknown,
): ResourceCacheKey {
  const serialized = canonicalizeResourceParams(params);
  const address = `${scope.kind}:${scope.id}:${topic}`;
  return `${address}${serialized ? `:${serialized}` : ''}` as ResourceCacheKey;
}

export function applyResourceChange<TTopic extends ResourceTopic>(
  current: ResourceDataMap[TTopic] | undefined,
  change: ResourceChange<TTopic>,
): ResourceDataMap[TTopic] | undefined {
  switch (change.operation) {
    case 'replace':
      return change.payload as ResourceDataMap[TTopic];
    case 'merge':
      if (!isRecord(current)) return current;
      return {
        ...current,
        ...change.payload,
      } as ResourceDataMap[TTopic];
    case 'upsert-items':
      return updateItems(current, change.payload.idKey, (items) => {
        const byId = new Map<unknown, Record<string, unknown>>();
        for (const item of items) byId.set(item[change.payload.idKey], item);
        for (const item of change.payload.items) {
          if (isRecord(item)) byId.set(item[change.payload.idKey], item);
        }
        return Array.from(byId.values());
      });
    case 'remove-items': {
      const ids = new Set<unknown>(change.payload.ids);
      return updateItems(current, change.payload.idKey, (items) =>
        items.filter((item) => !ids.has(item[change.payload.idKey])),
      );
    }
    case 'invalidate':
      return current;
  }
}

export function hasResourceVersionGap(
  changes: readonly Pick<ResourceChange, 'scopeVersion'>[],
  after: number,
): boolean {
  if (changes.length === 0) return false;
  let expected = after + 1;
  const versions = Array.from(
    new Set(
      changes
        .map((change) => change.scopeVersion)
        .filter((version) => version > after),
    ),
  ).sort((left, right) => left - right);
  for (const version of versions) {
    if (version !== expected) return true;
    expected += 1;
  }
  return false;
}

export function advanceContiguousResourceCursor(
  current: number,
  changes: readonly Pick<ResourceChange, 'scopeVersion'>[],
): { cursor: number; hasGap: boolean } {
  const versions = Array.from(
    new Set(
      changes
        .map((change) => change.scopeVersion)
        .filter((version) => version > current),
    ),
  ).sort((left, right) => left - right);
  if (versions.length === 0) return { cursor: current, hasGap: false };
  let cursor = current;
  for (const version of versions) {
    if (version !== cursor + 1) return { cursor: current, hasGap: true };
    cursor = version;
  }
  return { cursor, hasGap: false };
}

export function requiresResourceEventReload(
  window: {
    changes: readonly ResourceChange[];
    currentScopeVersion: number;
    earliestAvailableVersion: number;
  },
  after: number,
  pageLimit: number,
): boolean {
  if (after >= window.currentScopeVersion) return false;
  if (window.changes.length > pageLimit) return true;
  if (after + 1 < window.earliestAvailableVersion) return true;
  if (window.changes.length === 0) return true;
  return hasResourceVersionGap(window.changes, after);
}

export function orderResourceChanges(
  changes: readonly ResourceChange[],
): ResourceChange[] {
  return [...changes].sort(
    (left, right) =>
      left.scope.kind.localeCompare(right.scope.kind) ||
      left.scope.id.localeCompare(right.scope.id) ||
      left.scopeVersion - right.scopeVersion ||
      left.mutationOrdinal - right.mutationOrdinal ||
      left.id.localeCompare(right.id),
  );
}

export function getResourceScopeTransitionKinds(
  previous: {
    accountId: string | null;
    cultivatorId: string | null;
    sectId: string | null;
  },
  next: {
    accountId: string | null;
    cultivatorId: string | null;
    sectId: string | null;
  },
): ResourceScopeKind[] {
  if (previous.accountId !== next.accountId) {
    return ['account', 'cultivator', 'sect', 'global'];
  }
  const changed: ResourceScopeKind[] = [];
  if (previous.cultivatorId !== next.cultivatorId) changed.push('cultivator');
  if (
    previous.cultivatorId !== next.cultivatorId ||
    previous.sectId !== next.sectId
  ) {
    changed.push('sect');
  }
  return changed;
}

function updateItems<T>(
  current: T | undefined,
  _idKey: string,
  updater: (
    items: Array<Record<string, unknown>>,
  ) => Array<Record<string, unknown>>,
): T | undefined {
  if (Array.isArray(current)) {
    return updater(current.filter(isRecord)) as T;
  }
  if (isRecord(current) && Array.isArray(current.items)) {
    return {
      ...current,
      items: updater(current.items.filter(isRecord)),
    } as T;
  }
  return current;
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return Boolean(value && typeof value === 'object' && !Array.isArray(value));
}
