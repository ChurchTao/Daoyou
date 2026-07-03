import type {
  RealtimeServerEvent,
  RealtimeServerEventType,
} from '@shared/contracts/realtime';

type RealtimeListener<T extends RealtimeServerEventType> = (
  event: Extract<RealtimeServerEvent, { type: T }>,
) => void;
type RealtimeErrorListener = () => void;

const RECONNECT_DELAYS_MS = [1_000, 2_000, 5_000, 10_000, 30_000] as const;

export class RealtimeClient {
  private socket: WebSocket | null = null;
  private reconnectTimer: ReturnType<typeof setTimeout> | null = null;
  private reconnectAttempts = 0;
  private manuallyClosed = false;
  private listeners = new Map<RealtimeServerEventType, Set<(event: RealtimeServerEvent) => void>>();
  private errorListeners = new Set<RealtimeErrorListener>();

  connect() {
    if (
      typeof window === 'undefined' ||
      typeof WebSocket === 'undefined' ||
      this.socket?.readyState === WebSocket.OPEN ||
      this.socket?.readyState === WebSocket.CONNECTING
    ) {
      return;
    }

    this.manuallyClosed = false;
    const protocol = window.location.protocol === 'https:' ? 'wss:' : 'ws:';
    const socket = new WebSocket(
      `${protocol}//${window.location.host}/api/realtime`,
    );
    this.socket = socket;

    socket.onopen = () => {
      this.reconnectAttempts = 0;
    };
    socket.onmessage = (event) => {
      this.handleMessage(event.data);
    };
    socket.onerror = () => {
      this.emitError();
    };
    socket.onclose = () => {
      if (this.socket === socket) {
        this.socket = null;
      }
      if (!this.manuallyClosed) {
        this.scheduleReconnect();
      }
    };
  }

  disconnect() {
    if (this.hasListeners()) {
      this.connect();
      return;
    }

    this.manuallyClosed = true;
    this.clearReconnectTimer();
    this.socket?.close();
    this.socket = null;
  }

  subscribe<T extends RealtimeServerEventType>(
    type: T,
    listener: RealtimeListener<T>,
  ): () => void {
    const set = this.listeners.get(type) ?? new Set();
    const wrapped = listener as (event: RealtimeServerEvent) => void;
    set.add(wrapped);
    this.listeners.set(type, set);

    return () => {
      set.delete(wrapped);
      if (set.size === 0) {
        this.listeners.delete(type);
      }
      if (!this.hasListeners()) {
        this.disconnect();
      }
    };
  }

  subscribeError(listener: RealtimeErrorListener): () => void {
    this.errorListeners.add(listener);
    return () => {
      this.errorListeners.delete(listener);
      if (!this.hasListeners()) {
        this.disconnect();
      }
    };
  }

  private handleMessage(raw: unknown) {
    if (typeof raw !== 'string') {
      return;
    }

    let event: RealtimeServerEvent;
    try {
      event = JSON.parse(raw) as RealtimeServerEvent;
    } catch {
      return;
    }

    if (!event || typeof event.type !== 'string') {
      return;
    }

    if (event.type === 'ping') {
      this.socket?.send(JSON.stringify({ type: 'pong' }));
    }

    const set = this.listeners.get(event.type);
    if (!set) {
      return;
    }

    for (const listener of set) {
      listener(event);
    }
  }

  private scheduleReconnect() {
    if (this.reconnectTimer) {
      return;
    }

    this.emitError();
    const delay =
      RECONNECT_DELAYS_MS[
        Math.min(this.reconnectAttempts, RECONNECT_DELAYS_MS.length - 1)
      ];
    this.reconnectAttempts += 1;
    this.reconnectTimer = setTimeout(() => {
      this.reconnectTimer = null;
      this.connect();
    }, delay);
  }

  private clearReconnectTimer() {
    if (!this.reconnectTimer) {
      return;
    }
    clearTimeout(this.reconnectTimer);
    this.reconnectTimer = null;
  }

  private hasListeners() {
    if (this.errorListeners.size > 0) {
      return true;
    }

    for (const set of this.listeners.values()) {
      if (set.size > 0) {
        return true;
      }
    }

    return false;
  }

  private emitError() {
    for (const listener of this.errorListeners) {
      listener();
    }
  }
}

export const realtimeClient = new RealtimeClient();
