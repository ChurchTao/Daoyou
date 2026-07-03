import type {
  ApiFailure,
} from '@shared/contracts/http';
import type {
  PlayerStateDomain,
  PlayerStateDomainVersions,
  PlayerStateEvent,
  PlayerStateEventsResponse,
  PlayerStateMutationResponse,
  PlayerStateSnapshot,
  PlayerStateSnapshotResponse,
} from '@shared/contracts/player';
import { PLAYER_STATE_DOMAINS } from '@shared/contracts/player';
import { realtimeClient } from '@app/lib/realtime/realtimeClient';
import { useCallback, useMemo, useRef, useSyncExternalStore } from 'react';

export type PlayerStateStoreData = {
  userId: string | null;
  cultivatorId: string | null;
  globalVersion: number;
  domainVersions: PlayerStateDomainVersions;
  snapshot: Partial<PlayerStateSnapshot>;
  loading: boolean;
  isRefreshing: boolean;
  isRecovering: boolean;
  refreshingDomains: Set<PlayerStateDomain>;
  staleDomains: Set<PlayerStateDomain>;
  lastSyncAt: number | null;
  error: string | null;
};

const emptyDomainVersions = PLAYER_STATE_DOMAINS.reduce(
  (acc, domain) => {
    acc[domain] = 0;
    return acc;
  },
  {} as PlayerStateDomainVersions,
);

function createInitialState(): PlayerStateStoreData {
  return {
    userId: null,
    cultivatorId: null,
    globalVersion: 0,
    domainVersions: { ...emptyDomainVersions },
    snapshot: {},
    loading: false,
    isRefreshing: false,
    isRecovering: false,
    refreshingDomains: new Set(),
    staleDomains: new Set(),
    lastSyncAt: null,
    error: null,
  };
}

const initialState: PlayerStateStoreData = createInitialState();

type Listener = () => void;
type MutationOptions = {
  deferRecovery?: boolean;
};

export class PlayerStateStore {
  private state: PlayerStateStoreData = initialState;
  private listeners = new Set<Listener>();
  private initializePromise: Promise<void> | null = null;
  private realtimeCultivatorId: string | null = null;
  private unsubscribeRealtimeState: (() => void) | null = null;
  private unsubscribeRealtimeError: (() => void) | null = null;
  private recoveryPromise: Promise<void> | null = null;
  private staleRefreshPromise: Promise<void> | null = null;
  private realtimeErrorTimer: ReturnType<typeof setTimeout> | null = null;
  private processedEventIds = new Set<number>();

  getSnapshot = () => this.state;

  subscribe = (listener: Listener) => {
    this.listeners.add(listener);
    return () => {
      this.listeners.delete(listener);
    };
  };

  async initialize(userId: string | null): Promise<void> {
    if (!userId) {
      this.initializePromise = null;
      this.disconnectRealtime();
      this.processedEventIds.clear();
      this.setState(createInitialState());
      return;
    }

    if (this.state.userId === userId && this.state.loading) {
      return this.initializePromise ?? Promise.resolve();
    }

    this.initializePromise = this.refresh(undefined, userId).finally(() => {
      this.initializePromise = null;
    });
    return this.initializePromise;
  }

  async refresh(
    domains?: PlayerStateDomain[],
    userId = this.state.userId,
  ): Promise<void> {
    if (!userId) {
      this.disconnectRealtime();
      this.processedEventIds.clear();
      this.setState(createInitialState());
      return;
    }

    const hasUsableSnapshot = Boolean(this.state.snapshot.profile);
    this.setState({
      ...this.state,
      userId,
      loading: !hasUsableSnapshot,
      isRefreshing: hasUsableSnapshot,
      refreshingDomains: new Set(domains ?? PLAYER_STATE_DOMAINS),
      error: null,
    });

    try {
      const params = domains?.length
        ? `?domains=${encodeURIComponent(domains.join(','))}`
        : '';
      const response = await fetch(`/api/player/state${params}`);
      const json = (await response.json()) as
        | PlayerStateSnapshotResponse
        | ApiFailure;

      if (!response.ok || !json.success) {
        throw new Error(
          'error' in json ? String(json.error) : `HTTP ${response.status}`,
        );
      }

      const nextCultivatorId = json.data.cultivatorId;
      const cultivatorChanged =
        Boolean(this.state.cultivatorId) &&
        this.state.cultivatorId !== nextCultivatorId;
      const baseState = cultivatorChanged
        ? {
            ...createInitialState(),
            userId,
            loading: true,
          }
        : this.state;
      if (cultivatorChanged) {
        this.disconnectRealtime();
        this.processedEventIds.clear();
      }
      const staleDomains = clearStaleDomains(baseState.staleDomains, domains);

      this.setState({
        ...baseState,
        userId,
        cultivatorId: nextCultivatorId,
        globalVersion: json.data.globalVersion,
        domainVersions: json.data.domainVersions,
        snapshot: {
          ...baseState.snapshot,
          ...json.data.snapshot,
        },
        loading: false,
        isRefreshing: false,
        refreshingDomains: new Set(),
        staleDomains,
        lastSyncAt: Date.now(),
        error: null,
      });
      this.connectRealtime();
    } catch (error) {
      this.setState({
        ...this.state,
        userId,
        loading: false,
        isRefreshing: false,
        refreshingDomains: new Set(),
        error: error instanceof Error ? error.message : '玩家状态同步失败',
      });
    }
  }

  applyEvents(events: PlayerStateEvent[], options: MutationOptions = {}): void {
    if (events.length === 0) {
      return;
    }

    const sortedEvents = events
      .slice()
      .sort((a, b) => a.globalVersion - b.globalVersion || a.id - b.id);
    const recoveryAfter = this.state.globalVersion;
    let needsRecovery = false;
    let nextState = this.state;

    for (const event of sortedEvents) {
      if (event.globalVersion > nextState.globalVersion + 1) {
        needsRecovery = true;
      }
      nextState = this.applyEvent(nextState, event, {
        allowGapPatch: options.deferRecovery === true,
      });
    }

    this.setState(nextState);

    if (needsRecovery) {
      if (options.deferRecovery) {
        setTimeout(() => this.scheduleEventRecovery(recoveryAfter), 0);
      } else {
        this.scheduleEventRecovery(recoveryAfter);
      }
      return;
    }

    if (nextState.staleDomains.size > 0) {
      this.scheduleStaleRefresh();
    }
  }

  markStale(domains: PlayerStateDomain[]): void {
    this.setState({
      ...this.state,
      staleDomains: new Set([...this.state.staleDomains, ...domains]),
    });
    this.scheduleStaleRefresh();
  }

  async mutate<T>(
    request: Promise<Response | PlayerStateMutationResponse<T> | ApiFailure>,
    options: MutationOptions = {},
  ): Promise<T> {
    const raw = await request;
    const json =
      raw instanceof Response
        ? ((await raw.json()) as PlayerStateMutationResponse<T> | ApiFailure)
        : raw;

    if (!json.success) {
      throw new Error(getMutationErrorMessage(json));
    }

    if (
      json.state?.cultivatorId &&
      this.state.cultivatorId &&
      json.state.cultivatorId !== this.state.cultivatorId
    ) {
      await this.refresh(undefined, this.state.userId);
      return json.data;
    }

    const localGlobalVersionBeforeEvents = this.state.globalVersion;
    const hasDeferredGap =
      options.deferRecovery === true &&
      Boolean(json.state?.events?.length) &&
      hasVersionGap(json.state?.events ?? [], localGlobalVersionBeforeEvents);

    if (json.state?.events?.length) {
      this.applyEvents(json.state.events, options);
    }

    if (json.state?.domainVersions) {
      this.setState({
        ...this.state,
        domainVersions: {
          ...this.state.domainVersions,
          ...json.state.domainVersions,
        },
        globalVersion: hasDeferredGap
          ? this.state.globalVersion
          : Math.max(this.state.globalVersion, json.state.globalVersion),
      });
    }

    return json.data;
  }

  private applyEvent(
    state: PlayerStateStoreData,
    event: PlayerStateEvent,
    options: { allowGapPatch?: boolean } = {},
  ): PlayerStateStoreData {
    if (
      state.cultivatorId &&
      event.cultivatorId &&
      event.cultivatorId !== state.cultivatorId
    ) {
      void this.refresh(undefined, state.userId);
      return state;
    }

    if (this.processedEventIds.has(event.id)) {
      return state;
    }

    if (event.globalVersion < state.globalVersion) {
      return state;
    }

    const isDeferredGapPatch =
      event.globalVersion > state.globalVersion + 1 &&
      options.allowGapPatch === true;

    if (event.globalVersion > state.globalVersion + 1 && !isDeferredGapPatch) {
      const staleDomains = new Set(state.staleDomains);
      staleDomains.add(event.domain);
      for (const domain of event.invalidates) {
        staleDomains.add(domain);
      }
      return { ...state, staleDomains, error: '玩家状态版本缺口，等待刷新' };
    }

    const staleDomains = new Set(state.staleDomains);
    for (const domain of event.invalidates) {
      staleDomains.add(domain);
    }

    if (!isDeferredGapPatch) {
      this.rememberProcessedEvent(event.id);
    }

    return {
      ...state,
      cultivatorId: event.cultivatorId,
      globalVersion: isDeferredGapPatch
        ? state.globalVersion
        : Math.max(state.globalVersion, event.globalVersion),
      domainVersions: {
        ...state.domainVersions,
        [event.domain]: Math.max(
          state.domainVersions[event.domain] ?? 0,
          event.domainVersion,
        ),
      },
      snapshot: applyEventPatch(state.snapshot, event),
      staleDomains,
      lastSyncAt: Date.now(),
    };
  }

  private setState(nextState: PlayerStateStoreData) {
    this.state = nextState;
    for (const listener of this.listeners) {
      listener();
    }
  }

  private scheduleEventRecovery(after: number) {
    if (this.recoveryPromise) {
      return;
    }

    this.recoveryPromise = this.recoverEvents(after).finally(() => {
      this.recoveryPromise = null;
    });
  }

  private async recoverEvents(after: number): Promise<void> {
    this.setState({
      ...this.state,
      isRecovering: true,
      error: null,
    });
    try {
      const response = await fetch(
        `/api/player/state/events?after=${encodeURIComponent(String(after))}`,
      );
      const json = (await response.json()) as
        | PlayerStateEventsResponse
        | ApiFailure;

      if (!response.ok || !json.success) {
        throw new Error(
          'error' in json ? String(json.error) : `HTTP ${response.status}`,
        );
      }

      if (
        json.data.requiresSnapshot ||
        hasVersionGap(json.data.events, after)
      ) {
        await this.refresh();
        return;
      }

      if (json.data.events.length > 0) {
        this.applyEvents(json.data.events);
        return;
      }

      await this.refresh(
        this.state.staleDomains.size > 0
          ? Array.from(this.state.staleDomains)
          : undefined,
      );
    } catch (error) {
      await this.refresh().catch((refreshError) => {
        this.setState({
          ...this.state,
          loading: false,
          isRecovering: false,
          error:
            refreshError instanceof Error
              ? refreshError.message
              : error instanceof Error
                ? error.message
                : '玩家状态同步失败',
        });
      });
    } finally {
      this.setState({
        ...this.state,
        isRecovering: false,
      });
    }
  }

  private scheduleStaleRefresh() {
    if (this.staleRefreshPromise || this.state.staleDomains.size === 0) {
      return;
    }

    const domains = Array.from(this.state.staleDomains);
    this.staleRefreshPromise = this.refresh(domains).finally(() => {
      this.staleRefreshPromise = null;
    });
  }

  private connectRealtime() {
    if (typeof window === 'undefined' || !this.state.cultivatorId) {
      return;
    }

    if (
      this.realtimeCultivatorId === this.state.cultivatorId &&
      this.unsubscribeRealtimeState
    ) {
      realtimeClient.connect();
      return;
    }

    this.disconnectRealtime();
    this.unsubscribeRealtimeState = realtimeClient.subscribe(
      'player-state.events',
      (event) => {
        const payload = event.payload;
        if (payload.requiresSnapshot) {
          void this.refresh();
          return;
        }
        if (payload.events?.length) {
          this.applyEvents(payload.events);
        }
      },
    );
    this.unsubscribeRealtimeError = realtimeClient.subscribeError(() => {
      if (this.realtimeErrorTimer) {
        return;
      }
      this.realtimeErrorTimer = setTimeout(() => {
        this.realtimeErrorTimer = null;
        this.markStale([...PLAYER_STATE_DOMAINS]);
      }, 2_000);
    });
    this.realtimeCultivatorId = this.state.cultivatorId;
    realtimeClient.connect();
  }

  private disconnectRealtime() {
    this.clearRealtimeErrorTimer();
    this.unsubscribeRealtimeState?.();
    this.unsubscribeRealtimeError?.();
    this.unsubscribeRealtimeState = null;
    this.unsubscribeRealtimeError = null;
    this.realtimeCultivatorId = null;
    realtimeClient.disconnect();
  }

  private clearRealtimeErrorTimer() {
    if (!this.realtimeErrorTimer) {
      return;
    }
    clearTimeout(this.realtimeErrorTimer);
    this.realtimeErrorTimer = null;
  }

  private rememberProcessedEvent(id: number) {
    this.processedEventIds.add(id);
    if (this.processedEventIds.size <= 1_000) {
      return;
    }

    const oldestId = this.processedEventIds.values().next().value;
    if (typeof oldestId === 'number') {
      this.processedEventIds.delete(oldestId);
    }
  }
}

function getMutationErrorMessage(json: unknown): string {
  if (json && typeof json === 'object') {
    const record = json as Record<string, unknown>;
    if (typeof record.message === 'string' && record.message.trim()) {
      return record.message;
    }
    if (typeof record.error === 'string' && record.error.trim()) {
      return record.error;
    }
  }

  return '操作失败';
}

function applyEventPatch(
  snapshot: Partial<PlayerStateSnapshot>,
  event: PlayerStateEvent,
): Partial<PlayerStateSnapshot> {
  if (!event.patch || typeof event.patch !== 'object') {
    return snapshot;
  }

  const patch = event.patch as Record<string, unknown>;
  const next: Partial<PlayerStateSnapshot> = { ...snapshot };

  if (event.domain === 'mail') {
    const unreadCount =
      typeof patch.unreadMailCount === 'number'
        ? patch.unreadMailCount
        : typeof patch.unreadCount === 'number'
          ? patch.unreadCount
          : undefined;
    if (unreadCount !== undefined) {
      next.mail = { ...(snapshot.mail ?? { unreadCount: 0 }), unreadCount };
    }
  }

  if (event.domain === 'condition' && patch.condition) {
    next.condition = patch.condition as PlayerStateSnapshot['condition'];
  }

  if (event.domain === 'currency' && patch.currency) {
    next.currency = {
      ...(snapshot.currency ?? {
        spiritStones: 0,
        reputation: 0,
        qi: 0,
        qiLastRefreshedAt: null,
      }),
      ...(patch.currency as Partial<PlayerStateSnapshot['currency']>),
    };
  }

  if (event.domain === 'progress' && patch.progress) {
    next.progress = patch.progress as PlayerStateSnapshot['progress'];
  }

  if (event.domain === 'profile' && snapshot.profile) {
    const profilePatch = patch.profile as
      | Partial<PlayerStateSnapshot['profile']>
      | undefined;
    const cultivatorPatch = (patch.cultivator ??
      (typeof patch.last_yield_at !== 'undefined'
        ? { last_yield_at: patch.last_yield_at }
        : undefined)) as
      | Partial<PlayerStateSnapshot['profile']['cultivator']>
      | undefined;

    next.profile = {
      ...snapshot.profile,
      ...(profilePatch ?? {}),
      cultivator: {
        ...snapshot.profile.cultivator,
        ...(profilePatch?.cultivator ?? {}),
        ...(cultivatorPatch ?? {}),
      },
    };
  }

  return next;
}

export const playerStateStore = new PlayerStateStore();

export async function consumePlayerStateMutation<T>(
  input: Response | PlayerStateMutationResponse<T> | ApiFailure,
  options?: MutationOptions,
): Promise<T> {
  return playerStateStore.mutate(Promise.resolve(input), options);
}

export async function consumePlayerStateMeta(
  state: PlayerStateMutationResponse<unknown>['state'],
  options?: MutationOptions,
): Promise<null> {
  return consumePlayerStateMutation(
    {
      success: true,
      data: null,
      state,
    },
    options,
  );
}

export function usePlayerState<T>(
  selector: (state: PlayerStateStoreData) => T,
  isEqual: (a: T, b: T) => boolean = Object.is,
): T {
  const lastSelection = useRef<{
    state: PlayerStateStoreData;
    selected: T;
  } | null>(null);
  const getSelectedSnapshot = useCallback(() => {
    const state = playerStateStore.getSnapshot();
    const previous = lastSelection.current;
    if (previous?.state === state) {
      return previous.selected;
    }

    const selected = selector(state);
    if (previous && isEqual(previous.selected, selected)) {
      lastSelection.current = { state, selected: previous.selected };
      return previous.selected;
    }

    lastSelection.current = { state, selected };
    return selected;
  }, [isEqual, selector]);

  return useSyncExternalStore(
    playerStateStore.subscribe,
    getSelectedSnapshot,
    getSelectedSnapshot,
  );
}

export function usePlayerStateActions() {
  return useMemo(
    () => ({
      initialize: playerStateStore.initialize.bind(playerStateStore),
      refresh: playerStateStore.refresh.bind(playerStateStore),
      consumeMutationResponse: consumePlayerStateMutation,
      consumeStateMeta: consumePlayerStateMeta,
      markStale: playerStateStore.markStale.bind(playerStateStore),
      mutate: playerStateStore.mutate.bind(playerStateStore),
    }),
    [],
  );
}

export function useInitializePlayerState(userId: string | null) {
  const actions = usePlayerStateActions();
  return useCallback(() => actions.initialize(userId), [actions, userId]);
}

function clearStaleDomains(
  staleDomains: Set<PlayerStateDomain>,
  refreshedDomains?: PlayerStateDomain[],
): Set<PlayerStateDomain> {
  if (!refreshedDomains?.length) {
    return new Set();
  }

  const next = new Set(staleDomains);
  for (const domain of refreshedDomains) {
    next.delete(domain);
  }
  return next;
}

function hasVersionGap(events: PlayerStateEvent[], after: number): boolean {
  if (events.length === 0) {
    return false;
  }

  let expected = after + 1;
  const versions = Array.from(
    new Set(events.map((event) => event.globalVersion)),
  ).sort((left, right) => left - right);
  for (const version of versions) {
    if (version !== expected) {
      return true;
    }
    expected += 1;
  }
  return false;
}
