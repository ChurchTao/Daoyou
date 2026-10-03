import { apiFetch } from '@app/lib/api/fetch';
import { realtimeClient } from '@app/lib/realtime/realtimeClient';
import type { ApiFailure } from '@daoyou/shared/contracts/http';
import type {
  PlayerResourceEventsResponse,
  PlayerStateMutationResponse,
} from '@daoyou/shared/contracts/player';
import {
  advanceContiguousResourceCursor,
  createResourceCacheKey,
  getResourceScopeTransitionKinds,
  orderResourceChanges,
  ResourceChangeSchema,
  type ResourceCacheKey,
  type ResourceChange,
  type ResourceDataMap,
  type ResourceScope,
  type ResourceScopeKind,
  type ResourceTopic,
} from '@daoyou/shared/contracts/resources';

export type ResourceStatus = 'idle' | 'loading' | 'ready' | 'stale' | 'error';

export interface ResourceSnapshot<T> {
  status: ResourceStatus;
  data?: T;
  error?: string;
  version: number;
  isRefreshing: boolean;
}

export type ResourceRuntimeScopes = {
  accountId: string | null;
  cultivatorId: string | null;
  sectId: string | null;
};

export type ResourceReducerResult<T> =
  | { status: 'applied'; data: T }
  | { status: 'ignored' }
  | { status: 'stale' };

export interface ResourceDefinition<
  TTopic extends ResourceTopic,
  TParams = void,
> {
  topic: TTopic;
  resolveScope(
    scopes: Readonly<ResourceRuntimeScopes>,
    params: TParams,
  ): ResourceScope | null;
  normalizeParams(params: TParams): TParams;
  load(
    scope: ResourceScope,
    params: TParams,
    signal: AbortSignal,
  ): Promise<{
    data: ResourceDataMap[TTopic];
    resourceVersion: number;
    scopeVersion: number;
  }>;
  reduce(
    current: ResourceDataMap[TTopic] | undefined,
    change: ResourceChange<TTopic>,
    params: TParams,
  ): ResourceReducerResult<ResourceDataMap[TTopic]>;
}

type Listener = () => void;
type AnyResourceDefinition = {
  topic: ResourceTopic;
  resolveScope(
    scopes: Readonly<ResourceRuntimeScopes>,
    params: unknown,
  ): ResourceScope | null;
  normalizeParams(params: unknown): unknown;
  load(
    scope: ResourceScope,
    params: unknown,
    signal: AbortSignal,
  ): Promise<{
    data: unknown;
    resourceVersion: number;
    scopeVersion: number;
  }>;
  reduce(
    current: unknown,
    change: ResourceChange,
    params: unknown,
  ): ResourceReducerResult<unknown>;
};
type ResourceEntry = ResourceSnapshot<unknown> & {
  key: ResourceCacheKey;
  scope: ResourceScope;
  topic: ResourceTopic;
  params: unknown;
  definition: AnyResourceDefinition;
  subscribers: number;
  listeners: Set<Listener>;
  parameterized: boolean;
  cleanupTimer?: ReturnType<typeof setTimeout>;
  controller?: AbortController;
  requestSequence: number;
  request?: Promise<void>;
};

const idleSnapshot: ResourceSnapshot<never> = {
  status: 'idle',
  version: 0,
  isRefreshing: false,
};

const scopeKey = (scope: ResourceScope) => `${scope.kind}:${scope.id}`;
const sameScope = (left: ResourceScope, right: ResourceScope) =>
  left.kind === right.kind && left.id === right.id;

export class ResourceStore {
  private readonly entries = new Map<ResourceCacheKey, ResourceEntry>();
  private readonly eventCursors = new Map<string, number>();
  private readonly seenChangeIds = new Set<string>();
  private readonly recoveringScopes = new Map<string, Promise<void>>();
  private readonly scopeListeners = new Set<Listener>();
  private scopes: ResourceRuntimeScopes = {
    accountId: null,
    cultivatorId: null,
    sectId: null,
  };
  private scopeRevision = 0;
  private realtimeIdentityKey: string | null = null;
  private unsubscribeRealtime?: () => void;
  private unsubscribeRealtimeStatus?: () => void;
  private needsRealtimeRecovery = false;

  bindAccount(accountId: string): void {
    if (this.scopes.accountId === accountId) return;
    this.disconnectRealtime();
    this.clearEntries();
    this.eventCursors.clear();
    this.seenChangeIds.clear();
    this.scopes = { accountId, cultivatorId: null, sectId: null };
    this.notifyScopeChange();
  }

  isBoundToAccount(accountId: string): boolean {
    return this.scopes.accountId === accountId;
  }

  bindSession(cultivatorId: string | null, sectId: string | null): void {
    const nextScopes = {
      ...this.scopes,
      cultivatorId,
      sectId: cultivatorId ? sectId : null,
    };
    const changedKinds = getResourceScopeTransitionKinds(
      this.scopes,
      nextScopes,
    );
    if (changedKinds.length === 0) return;
    this.removeEntriesForKinds(changedKinds);
    this.scopes = nextScopes;
    this.notifyScopeChange();
  }

  getScopeRevision = (): number => this.scopeRevision;

  subscribeScopes = (listener: Listener): (() => void) => {
    this.scopeListeners.add(listener);
    return () => this.scopeListeners.delete(listener);
  };

  register<TTopic extends ResourceTopic, TParams>(
    definition: ResourceDefinition<TTopic, TParams>,
    params: TParams,
  ): ResourceCacheKey | null {
    const normalizedParams = definition.normalizeParams(params);
    const scope = definition.resolveScope(this.scopes, normalizedParams);
    if (!scope) return null;
    const key = createResourceCacheKey(scope, definition.topic, normalizedParams);
    const existing = this.entries.get(key);
    if (!existing) {
      this.entries.set(key, {
        ...idleSnapshot,
        key,
        scope,
        topic: definition.topic,
        params: normalizedParams,
        definition: definition as unknown as AnyResourceDefinition,
        subscribers: 0,
        listeners: new Set(),
        parameterized: normalizedParams !== undefined,
        requestSequence: 0,
      });
    } else {
      existing.params = normalizedParams;
      existing.definition = definition as unknown as AnyResourceDefinition;
      if (existing.cleanupTimer) {
        clearTimeout(existing.cleanupTimer);
        existing.cleanupTimer = undefined;
      }
    }
    return key;
  }

  getSnapshot<T>(key: ResourceCacheKey): ResourceSnapshot<T> {
    return (this.entries.get(key) ?? idleSnapshot) as ResourceSnapshot<T>;
  }

  subscribe(key: ResourceCacheKey, listener: Listener): () => void {
    const entry = this.requireEntry(key);
    if (entry.cleanupTimer) {
      clearTimeout(entry.cleanupTimer);
      entry.cleanupTimer = undefined;
    }
    entry.subscribers += 1;
    entry.listeners.add(listener);
    if (entry.status === 'idle' || entry.status === 'stale') {
      queueMicrotask(() => {
        const current = this.entries.get(key);
        if (current && current.subscribers > 0) void this.loadEntry(current);
      });
    }
    return () => {
      const current = this.entries.get(key);
      if (!current) return;
      current.listeners.delete(listener);
      current.subscribers = Math.max(0, current.subscribers - 1);
      if (current.subscribers === 0 && current.status === 'loading') {
        current.controller?.abort();
        this.updateEntry(current, {
          ...current,
          status: current.data === undefined ? 'idle' : 'stale',
          isRefreshing: false,
          controller: undefined,
          request: undefined,
          requestSequence: current.requestSequence + 1,
        });
      }
      if (current.subscribers === 0 && current.parameterized) {
        current.cleanupTimer = setTimeout(() => {
          const candidate = this.entries.get(key);
          if (!candidate || candidate.subscribers > 0) return;
          candidate.controller?.abort();
          this.entries.delete(key);
        }, 5 * 60 * 1_000);
      }
    };
  }

  async reload(key: ResourceCacheKey): Promise<void> {
    await this.loadEntry(this.requireEntry(key), true);
  }

  invalidate(key: ResourceCacheKey): void {
    const entry = this.requireEntry(key);
    this.markEntryStale(entry);
  }

  setData<T>(key: ResourceCacheKey, data: T): void {
    const entry = this.requireEntry(key);
    entry.controller?.abort();
    this.updateEntry(entry, {
      ...entry,
      data,
      status: 'ready',
      error: undefined,
      isRefreshing: false,
      controller: undefined,
      request: undefined,
      requestSequence: entry.requestSequence + 1,
    });
  }

  consumeChanges(changes: ResourceChange[]): void {
    if (changes.length === 0) return;
    const ordered = orderResourceChanges(
      ResourceChangeSchema.array()
        .parse(changes)
        .filter((change) => !this.seenChangeIds.has(change.id)),
    );
    if (ordered.length === 0) return;
    const byScope = new Map<string, ResourceChange[]>();
    for (const change of ordered) {
      const key = scopeKey(change.scope);
      const group = byScope.get(key) ?? [];
      group.push(change);
      byScope.set(key, group);
    }

    for (const scopedChanges of byScope.values()) {
      const scope = scopedChanges[0].scope;
      const cursor = this.eventCursors.get(scopeKey(scope)) ?? 0;
      const pending = scopedChanges.filter(
        (change) => change.scopeVersion > cursor,
      );
      const next = advanceContiguousResourceCursor(cursor, pending);
      if (next.hasGap) {
        void this.recoverScope(scope);
        continue;
      }
      for (const change of pending) {
        this.applyChange(change);
        this.rememberChange(change.id);
      }
      this.setEventCursor(scope, next.cursor);
    }
  }

  async consumeMutation<T>(
    input: Response | PlayerStateMutationResponse<T> | ApiFailure,
  ): Promise<T> {
    const json =
      input instanceof Response
        ? ((await input.json()) as PlayerStateMutationResponse<T> | ApiFailure)
        : input;
    if (!json.success) throw new Error(getErrorMessage(json));
    this.consumeChanges(json.state.changes);
    for (const baseline of json.state.baselines) {
      const cursor = this.eventCursors.get(scopeKey(baseline.scope)) ?? 0;
      if (baseline.scopeVersion > cursor) void this.recoverScope(baseline.scope);
    }
    return json.data;
  }

  setRealtimeScopes(
    accountId: string,
    cultivatorId: string | null,
    sectId: string | null,
  ): void {
    const identityKey = `${accountId}:${cultivatorId ?? ''}:${sectId ?? ''}`;
    if (this.realtimeIdentityKey === identityKey) return;
    this.disconnectRealtime();
    this.realtimeIdentityKey = identityKey;
    if (typeof window === 'undefined') return;
    realtimeClient.enableChannel('player-state');
    realtimeClient.setIdentityKey(identityKey);
    this.unsubscribeRealtime = realtimeClient.subscribe(
      'player-state.events',
      ({ payload }) => {
        if (payload.changes.length) this.consumeChanges(payload.changes);
      },
    );
    this.unsubscribeRealtimeStatus = realtimeClient.subscribeStatus((status) => {
      const channel = status.channels['player-state'];
      if (channel.state === 'online') {
        if (this.needsRealtimeRecovery) void this.recoverChanges();
        this.needsRealtimeRecovery = false;
      } else if (channel.state === 'offline' || channel.state === 'blocked') {
        this.needsRealtimeRecovery = true;
      }
    });
  }

  clear(): void {
    this.disconnectRealtime();
    this.clearEntries();
    this.eventCursors.clear();
    this.seenChangeIds.clear();
    this.scopes = { accountId: null, cultivatorId: null, sectId: null };
    this.notifyScopeChange();
  }

  private applyChange(change: ResourceChange): void {
    for (const entry of this.entries.values()) {
      if (entry.topic !== change.resourceTopic || !sameScope(entry.scope, change.scope)) {
        continue;
      }
      if (change.resourceVersion < entry.version) continue;
      const result =
        change.operation === 'invalidate'
          ? ({ status: 'stale' } as const)
          : entry.definition.reduce(entry.data, change, entry.params);
      if (result.status === 'ignored') {
        this.updateEntry(entry, {
          ...entry,
          version: Math.max(entry.version, change.resourceVersion),
        });
        continue;
      }
      entry.controller?.abort();
      const requestSequence = entry.requestSequence + 1;
      const stale = result.status === 'stale';
      const data = result.status === 'applied' ? result.data : entry.data;
      const next = this.updateEntry(entry, {
        ...entry,
        data,
        status: stale
          ? entry.status === 'idle'
            ? 'idle'
            : 'stale'
          : entry.status === 'idle' && data === undefined
            ? 'idle'
            : 'ready',
        version: change.resourceVersion,
        error: undefined,
        isRefreshing: stale && entry.subscribers > 0,
        controller: undefined,
        request: undefined,
        requestSequence,
      });
      if (stale && next.subscribers > 0) void this.loadEntry(next);
    }
  }

  private async loadEntry(entry: ResourceEntry, force = false): Promise<void> {
    if (entry.request && !force) return entry.request;
    if (entry.subscribers === 0 && !force) return;
    if (force) entry.controller?.abort();
    const controller = new AbortController();
    const sequence = entry.requestSequence + 1;
    const hasData = entry.data !== undefined;
    this.updateEntry(entry, {
      ...entry,
      status: hasData ? 'stale' : 'loading',
      isRefreshing: hasData,
      error: undefined,
      controller,
      requestSequence: sequence,
    });
    const request = entry.definition
      .load(entry.scope, entry.params, controller.signal)
      .then((result) => {
        const current = this.entries.get(entry.key);
        if (!current || controller.signal.aborted || current.requestSequence !== sequence) {
          return;
        }
        const cursorKey = scopeKey(current.scope);
        if (
          !this.eventCursors.has(cursorKey) &&
          !this.hasMaterializedScopeEntry(current.scope, current.key)
        ) {
          this.eventCursors.set(cursorKey, result.scopeVersion);
        }
        if (result.resourceVersion < current.version) {
          this.updateEntry(current, {
            ...current,
            isRefreshing: false,
            controller: undefined,
            request: undefined,
          });
          return;
        }
        this.updateEntry(current, {
          ...current,
          data: result.data,
          status: 'ready',
          version: Math.max(current.version, result.resourceVersion),
          error: undefined,
          isRefreshing: false,
          controller: undefined,
          request: undefined,
        });
      })
      .catch((error) => {
        if (controller.signal.aborted) return;
        const current = this.entries.get(entry.key);
        if (!current || current.requestSequence !== sequence) return;
        this.updateEntry(current, {
          ...current,
          status: current.data === undefined ? 'error' : 'stale',
          error: error instanceof Error ? error.message : '资源读取失败',
          isRefreshing: false,
          controller: undefined,
          request: undefined,
        });
      });
    const current = this.entries.get(entry.key);
    if (current?.requestSequence === sequence) current.request = request;
    await request;
  }

  private markEntryStale(entry: ResourceEntry, reloadActive = true): void {
    if (entry.status === 'idle') return;
    entry.controller?.abort();
    const next = this.updateEntry(entry, {
      ...entry,
      status: 'stale',
      isRefreshing: reloadActive && entry.subscribers > 0,
      controller: undefined,
      request: undefined,
      requestSequence: entry.requestSequence + 1,
    });
    if (reloadActive && next.subscribers > 0) void this.loadEntry(next);
  }

  private markScopeStale(scope: ResourceScope, reloadActive = true): void {
    for (const entry of this.entries.values()) {
      if (sameScope(entry.scope, scope)) this.markEntryStale(entry, reloadActive);
    }
  }

  private async recoverChanges(): Promise<void> {
    const scopes = this.activeScopes();
    await Promise.all(scopes.map((scope) => this.recoverScope(scope)));
  }

  private activeScopes(): ResourceScope[] {
    const scopes = new Map<string, ResourceScope>();
    for (const entry of this.entries.values()) {
      if (entry.subscribers <= 0 || entry.status === 'idle') continue;
      scopes.set(scopeKey(entry.scope), entry.scope);
    }
    return [...scopes.values()];
  }

  private setEventCursor(scope: ResourceScope, version: number): void {
    const key = scopeKey(scope);
    this.eventCursors.set(
      key,
      Math.max(this.eventCursors.get(key) ?? 0, version),
    );
  }

  private rememberChange(id: string): void {
    this.seenChangeIds.add(id);
    if (this.seenChangeIds.size <= 10_000) return;
    const oldest = this.seenChangeIds.values().next().value;
    if (oldest) this.seenChangeIds.delete(oldest);
  }

  private hasMaterializedScopeEntry(
    scope: ResourceScope,
    exceptKey: ResourceCacheKey,
  ): boolean {
    for (const entry of this.entries.values()) {
      if (
        entry.key !== exceptKey &&
        entry.data !== undefined &&
        sameScope(entry.scope, scope)
      ) {
        return true;
      }
    }
    return false;
  }

  private recoverScope(scope: ResourceScope): Promise<void> {
    const key = scopeKey(scope);
    const existing = this.recoveringScopes.get(key);
    if (existing) return existing;
    const revision = this.scopeRevision;
    const request = this.fetchScopeChanges(scope, revision).finally(() => {
      if (this.recoveringScopes.get(key) === request) {
        this.recoveringScopes.delete(key);
      }
    });
    this.recoveringScopes.set(key, request);
    return request;
  }

  private async fetchScopeChanges(
    scope: ResourceScope,
    revision: number,
  ): Promise<void> {
    try {
      const after = this.eventCursors.get(scopeKey(scope)) ?? 0;
      const query = new URLSearchParams({
        after: String(after),
        scopeKind: scope.kind,
        scopeId: scope.id,
      });
      const response = await apiFetch(`/api/player/resources/events?${query}`);
      const json = (await response.json()) as
        | PlayerResourceEventsResponse
        | ApiFailure;
      if (revision !== this.scopeRevision || !this.isActiveScope(scope)) return;
      if (!response.ok || !json.success) {
        this.markScopeStale(scope);
        return;
      }
      if (json.data.requiresReload) {
        this.markScopeStale(scope);
        this.setEventCursor(scope, json.data.currentScopeVersion);
        return;
      }
      this.consumeChanges(json.data.changes);
      const cursor = this.eventCursors.get(scopeKey(scope)) ?? 0;
      if (cursor < json.data.currentScopeVersion) {
        this.markScopeStale(scope);
        this.setEventCursor(scope, json.data.currentScopeVersion);
      }
    } catch {
      if (revision === this.scopeRevision && this.isActiveScope(scope)) {
        this.markScopeStale(scope);
      }
    }
  }

  private isActiveScope(scope: ResourceScope): boolean {
    if (scope.kind === 'global') return scope.id === 'global';
    if (scope.kind === 'account') return scope.id === this.scopes.accountId;
    if (scope.kind === 'cultivator')
      return scope.id === this.scopes.cultivatorId;
    return scope.id === this.scopes.sectId;
  }

  private removeEntriesForKinds(kinds: readonly ResourceScopeKind[]): void {
    const targets = new Set(kinds);
    for (const [key, entry] of this.entries) {
      if (!targets.has(entry.scope.kind)) continue;
      entry.controller?.abort();
      if (entry.cleanupTimer) clearTimeout(entry.cleanupTimer);
      for (const listener of entry.listeners) listener();
      this.entries.delete(key);
    }
    for (const key of this.eventCursors.keys()) {
      const kind = key.slice(0, key.indexOf(':')) as ResourceScopeKind;
      if (targets.has(kind)) this.eventCursors.delete(key);
    }
  }

  private clearEntries(): void {
    for (const entry of this.entries.values()) {
      entry.controller?.abort();
      if (entry.cleanupTimer) clearTimeout(entry.cleanupTimer);
      for (const listener of entry.listeners) listener();
    }
    this.entries.clear();
  }

  private notifyScopeChange(): void {
    this.scopeRevision += 1;
    for (const listener of this.scopeListeners) listener();
  }

  private disconnectRealtime(): void {
    this.unsubscribeRealtime?.();
    this.unsubscribeRealtimeStatus?.();
    this.unsubscribeRealtime = undefined;
    this.unsubscribeRealtimeStatus = undefined;
    this.needsRealtimeRecovery = false;
    this.realtimeIdentityKey = null;
    realtimeClient.disableChannel('player-state');
    realtimeClient.setIdentityKey(null);
  }

  private requireEntry(key: ResourceCacheKey): ResourceEntry {
    const entry = this.entries.get(key);
    if (!entry) throw new Error(`资源尚未注册: ${key}`);
    return entry;
  }

  private updateEntry(entry: ResourceEntry, next: ResourceEntry): ResourceEntry {
    this.entries.set(entry.key, next);
    for (const listener of entry.listeners) listener();
    return next;
  }
}

function getErrorMessage(value: unknown): string {
  if (value && typeof value === 'object') {
    const record = value as Record<string, unknown>;
    if (typeof record.error === 'string') return record.error;
    if (typeof record.message === 'string') return record.message;
  }
  return '操作失败';
}

export const resourceStore = new ResourceStore();
