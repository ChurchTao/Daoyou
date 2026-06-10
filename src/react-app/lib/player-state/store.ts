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
  PlayerStateStreamPayload,
} from '@shared/contracts/player';
import { PLAYER_STATE_DOMAINS } from '@shared/contracts/player';
import { useCallback, useMemo, useRef, useSyncExternalStore } from 'react';

export type PlayerStateStoreData = {
  userId: string | null;
  cultivatorId: string | null;
  globalVersion: number;
  domainVersions: PlayerStateDomainVersions;
  snapshot: Partial<PlayerStateSnapshot>;
  loading: boolean;
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

const initialState: PlayerStateStoreData = {
  userId: null,
  cultivatorId: null,
  globalVersion: 0,
  domainVersions: emptyDomainVersions,
  snapshot: {},
  loading: false,
  staleDomains: new Set(),
  lastSyncAt: null,
  error: null,
};

type Listener = () => void;

export class PlayerStateStore {
  private state: PlayerStateStoreData = initialState;
  private listeners = new Set<Listener>();
  private initializePromise: Promise<void> | null = null;
  private eventSource: EventSource | null = null;
  private streamCultivatorId: string | null = null;
  private recoveryPromise: Promise<void> | null = null;
  private staleRefreshPromise: Promise<void> | null = null;
  private streamErrorTimer: ReturnType<typeof setTimeout> | null = null;
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
      this.disconnectStream();
      this.processedEventIds.clear();
      this.setState({ ...initialState });
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
      this.disconnectStream();
      this.processedEventIds.clear();
      this.setState({ ...initialState });
      return;
    }

    this.setState({ ...this.state, userId, loading: true, error: null });

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
            ...initialState,
            userId,
            loading: true,
          }
        : this.state;
      if (cultivatorChanged) {
        this.disconnectStream();
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
        staleDomains,
        lastSyncAt: Date.now(),
        error: null,
      });
      this.connectStream();
    } catch (error) {
      this.setState({
        ...this.state,
        userId,
        loading: false,
        error: error instanceof Error ? error.message : '玩家状态同步失败',
      });
    }
  }

  applyEvents(events: PlayerStateEvent[]): void {
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
      nextState = this.applyEvent(nextState, event);
    }

    this.setState(nextState);

    if (needsRecovery) {
      this.scheduleEventRecovery(recoveryAfter);
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

    if (json.state?.events?.length) {
      this.applyEvents(json.state.events);
    }

    if (json.state?.domainVersions) {
      this.setState({
        ...this.state,
        domainVersions: {
          ...this.state.domainVersions,
          ...json.state.domainVersions,
        },
        globalVersion: Math.max(
          this.state.globalVersion,
          json.state.globalVersion,
        ),
      });
    }

    return json.data;
  }

  private applyEvent(
    state: PlayerStateStoreData,
    event: PlayerStateEvent,
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

    if (event.globalVersion > state.globalVersion + 1) {
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

    this.rememberProcessedEvent(event.id);

    return {
      ...state,
      cultivatorId: event.cultivatorId,
      globalVersion: Math.max(state.globalVersion, event.globalVersion),
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
          error:
            refreshError instanceof Error
              ? refreshError.message
              : error instanceof Error
                ? error.message
                : '玩家状态同步失败',
        });
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

  private connectStream() {
    if (
      typeof window === 'undefined' ||
      typeof EventSource === 'undefined' ||
      !this.state.cultivatorId
    ) {
      return;
    }

    if (
      this.eventSource &&
      this.streamCultivatorId === this.state.cultivatorId
    ) {
      return;
    }

    this.disconnectStream();
    const params = new URLSearchParams({
      after: String(this.state.globalVersion),
    });
    const source = new EventSource(`/api/player/state/stream?${params}`);
    source.onopen = () => {
      this.clearStreamErrorTimer();
    };
    source.addEventListener('player-state', (event) => {
      try {
        const payload = JSON.parse((event as MessageEvent).data) as {
          events?: PlayerStateEvent[];
        } & PlayerStateStreamPayload;
        if (payload.requiresSnapshot) {
          void this.refresh();
          return;
        }
        if (payload.events?.length) {
          this.applyEvents(payload.events);
        }
      } catch (error) {
        console.warn('[player-state] failed to parse SSE payload', error);
      }
    });
    source.onerror = () => {
      if (this.streamErrorTimer) {
        return;
      }
      this.streamErrorTimer = setTimeout(() => {
        this.streamErrorTimer = null;
        this.markStale([...PLAYER_STATE_DOMAINS]);
      }, 2_000);
    };
    this.eventSource = source;
    this.streamCultivatorId = this.state.cultivatorId;
  }

  private disconnectStream() {
    this.clearStreamErrorTimer();
    this.eventSource?.close();
    this.eventSource = null;
    this.streamCultivatorId = null;
  }

  private clearStreamErrorTimer() {
    if (!this.streamErrorTimer) {
      return;
    }
    clearTimeout(this.streamErrorTimer);
    this.streamErrorTimer = null;
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
        qi: 0,
        qiLastRefreshedAt: null,
      }),
      ...(patch.currency as Partial<PlayerStateSnapshot['currency']>),
    };
  }

  if (event.domain === 'progress' && patch.progress) {
    next.progress = patch.progress as PlayerStateSnapshot['progress'];
  }

  return next;
}

export const playerStateStore = new PlayerStateStore();

export async function consumePlayerStateMutation<T>(
  input: Response | PlayerStateMutationResponse<T> | ApiFailure,
): Promise<T> {
  return playerStateStore.mutate(Promise.resolve(input));
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
      applyEvents: playerStateStore.applyEvents.bind(playerStateStore),
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
