import { resolveRealtimeUrl } from '@app/lib/api/url';
import type {
  RealtimeChannel,
  RealtimeServerEvent,
  RealtimeServerEventType,
} from '@shared/contracts/realtime';

export type RealtimeConnectionState =
  | 'idle'
  | 'connecting'
  | 'online'
  | 'reconnecting'
  | 'offline'
  | 'blocked';

export type RealtimeChannelStatus = {
  state: RealtimeConnectionState;
  enabled: boolean;
  lastConnectedAt: number | null;
  lastDisconnectedAt: number | null;
  lastError: string | null;
  reconnectAttempt: number;
  nextReconnectAt: number | null;
};

export type RealtimeStatusSnapshot = {
  connection: RealtimeConnectionState;
  channels: Record<RealtimeChannel, RealtimeChannelStatus>;
};

type RealtimeListener<T extends RealtimeServerEventType> = (
  event: Extract<RealtimeServerEvent, { type: T }>,
) => void;
type RealtimeStatusListener = (status: RealtimeStatusSnapshot) => void;

const RECONNECT_DELAYS_MS = [1_000, 2_000, 5_000, 10_000, 30_000] as const;
export const REALTIME_CONNECT_DEBOUNCE_MS = 80;

function createChannelStatus(enabled = false): RealtimeChannelStatus {
  return {
    state: 'idle',
    enabled,
    lastConnectedAt: null,
    lastDisconnectedAt: null,
    lastError: null,
    reconnectAttempt: 0,
    nextReconnectAt: null,
  };
}

function cloneStatus(status: RealtimeStatusSnapshot): RealtimeStatusSnapshot {
  return {
    connection: status.connection,
    channels: {
      'world-chat': { ...status.channels['world-chat'] },
      'player-state': { ...status.channels['player-state'] },
    },
  };
}

export class RealtimeClient {
  private socket: WebSocket | null = null;
  private connectTimer: ReturnType<typeof setTimeout> | null = null;
  private reconnectTimer: ReturnType<typeof setTimeout> | null = null;
  private channelRestartTimer: ReturnType<typeof setTimeout> | null = null;
  private reconnectAttempts = 0;
  private cultivatorId: string | null = null;
  private enabledChannels = new Set<RealtimeChannel>();
  private intentionallyClosedSockets = new WeakSet<WebSocket>();
  private listeners = new Map<RealtimeServerEventType, Set<(event: RealtimeServerEvent) => void>>();
  private statusListeners = new Set<RealtimeStatusListener>();
  private status: RealtimeStatusSnapshot = {
    connection: 'idle',
    channels: {
      'world-chat': createChannelStatus(),
      'player-state': createChannelStatus(),
    },
  };
  private onlineListener: (() => void) | null = null;
  private offlineListener: (() => void) | null = null;

  constructor() {
    if (typeof window !== 'undefined') {
      this.onlineListener = () => {
        if (this.shouldConnect()) {
          this.reconnectAttempts = 0;
          this.scheduleConnect(0);
        }
      };
      this.offlineListener = () => {
        this.clearConnectTimer();
        this.clearReconnectTimer();
        this.clearChannelRestartTimer();
        this.closeSocket();
        this.updateStatus('offline', {
          lastError: '浏览器离线',
          nextReconnectAt: null,
        });
      };
      window.addEventListener('online', this.onlineListener);
      window.addEventListener('offline', this.offlineListener);
    }
  }

  setCultivatorId(cultivatorId: string | null) {
    if (this.cultivatorId === cultivatorId) {
      return;
    }
    this.cultivatorId = cultivatorId;
    this.reconnectAttempts = 0;
    this.clearConnectTimer();
    this.clearReconnectTimer();
    this.clearChannelRestartTimer();
    this.closeSocket();
    this.updateStatus(this.shouldConnect() ? 'connecting' : 'idle');
    if (this.shouldConnect()) {
      this.scheduleConnect();
    }
  }

  enableChannel(channel: RealtimeChannel) {
    if (this.enabledChannels.has(channel)) {
      return;
    }
    this.enabledChannels.add(channel);
    this.status.channels[channel] = {
      ...this.status.channels[channel],
      enabled: true,
      state: this.status.connection === 'idle' ? 'idle' : this.status.connection,
    };
    this.emitStatus();
    if (!this.cultivatorId) {
      return;
    }
    if (this.connectTimer) {
      return;
    }
    this.restartForChannelChange();
  }

  disableChannel(channel: RealtimeChannel) {
    if (!this.enabledChannels.delete(channel)) {
      return;
    }
    this.status.channels[channel] = createChannelStatus(false);
    this.emitStatus();
    if (!this.cultivatorId) {
      return;
    }
    if (!this.shouldConnect()) {
      this.clearConnectTimer();
      this.clearReconnectTimer();
      this.clearChannelRestartTimer();
      this.closeSocket();
      this.updateStatus('idle');
      return;
    }
    if (this.connectTimer) {
      return;
    }
    this.restartForChannelChange();
  }

  connect() {
    if (
      typeof window === 'undefined' ||
      typeof WebSocket === 'undefined' ||
      this.socket?.readyState === WebSocket.OPEN ||
      this.socket?.readyState === WebSocket.CONNECTING ||
      !this.shouldConnect()
    ) {
      return;
    }

    this.clearConnectTimer();

    if (typeof navigator !== 'undefined' && navigator.onLine === false) {
      this.updateStatus('offline', { lastError: '浏览器离线' });
      return;
    }

    this.updateStatus(this.reconnectAttempts > 0 ? 'reconnecting' : 'connecting');
    const channels = Array.from(this.enabledChannels).sort();
    const socket = new WebSocket(resolveRealtimeUrl(channels));
    this.socket = socket;

    socket.onopen = () => {
      this.reconnectAttempts = 0;
      this.updateStatus('online', {
        lastConnectedAt: Date.now(),
        lastError: null,
        nextReconnectAt: null,
      });
    };
    socket.onmessage = (event) => {
      this.handleMessage(event.data);
    };
    socket.onerror = () => {
      this.updateStatus(this.status.connection, { lastError: '实时连接异常' });
    };
    socket.onclose = (event) => {
      if (this.intentionallyClosedSockets.delete(socket)) {
        return;
      }

      if (this.socket === socket) {
        this.socket = null;
      }
      this.clearChannelRestartTimer();

      if (!this.shouldConnect()) {
        this.updateStatus('idle', { lastDisconnectedAt: Date.now() });
        return;
      }

      if (event?.code === 1008 || event?.code === 1011) {
        this.updateStatus('blocked', {
          lastDisconnectedAt: Date.now(),
          lastError: '实时连接受限',
        });
        return;
      }

      this.scheduleReconnect();
    };
  }

  disconnect() {
    this.clearConnectTimer();
    this.clearReconnectTimer();
    this.clearChannelRestartTimer();
    this.closeSocket();
    this.updateStatus(this.shouldConnect() ? 'offline' : 'idle', {
      lastDisconnectedAt: Date.now(),
      nextReconnectAt: null,
    });
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
    };
  }

  subscribeStatus(listener: RealtimeStatusListener): () => void {
    this.statusListeners.add(listener);
    listener(cloneStatus(this.status));
    return () => {
      this.statusListeners.delete(listener);
    };
  }

  getStatus(): RealtimeStatusSnapshot {
    return cloneStatus(this.status);
  }

  private restartForChannelChange() {
    if (!this.shouldConnect()) {
      this.clearConnectTimer();
      this.clearReconnectTimer();
      this.clearChannelRestartTimer();
      this.closeSocket();
      this.updateStatus('idle');
      return;
    }

    if (!this.socket) {
      this.scheduleConnect();
      return;
    }

    if (this.channelRestartTimer) {
      return;
    }

    this.channelRestartTimer = setTimeout(() => {
      this.channelRestartTimer = null;
      this.applyRestartForChannelChange();
    }, REALTIME_CONNECT_DEBOUNCE_MS);
  }

  private applyRestartForChannelChange() {
    if (!this.shouldConnect()) {
      this.closeSocket();
      this.updateStatus('idle');
      return;
    }
    this.clearReconnectTimer();
    this.closeSocket();
    this.updateStatus(this.shouldConnect() ? 'connecting' : 'idle');
    if (this.shouldConnect()) {
      this.scheduleConnect(0);
    }
  }

  private shouldConnect() {
    return Boolean(this.cultivatorId && this.enabledChannels.size > 0);
  }

  private closeSocket() {
    const socket = this.socket;
    this.socket = null;
    if (socket && socket.readyState !== 3) {
      this.intentionallyClosedSockets.add(socket);
      socket.close();
    }
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
    if (this.reconnectTimer || this.connectTimer || !this.shouldConnect()) {
      return;
    }

    const baseDelay =
      RECONNECT_DELAYS_MS[
        Math.min(this.reconnectAttempts, RECONNECT_DELAYS_MS.length - 1)
      ];
    const jitter = Math.floor(Math.random() * 250);
    const delay = baseDelay + jitter;
    const nextReconnectAt = Date.now() + delay;
    this.reconnectAttempts += 1;
    this.updateStatus('reconnecting', {
      lastDisconnectedAt: Date.now(),
      lastError: '实时连接已断开',
      nextReconnectAt,
      reconnectAttempt: this.reconnectAttempts,
    });
    this.reconnectTimer = setTimeout(() => {
      this.reconnectTimer = null;
      this.connect();
    }, delay);
  }

  private scheduleConnect(delay = REALTIME_CONNECT_DEBOUNCE_MS) {
    if (
      this.connectTimer ||
      this.socket?.readyState === WebSocket.OPEN ||
      this.socket?.readyState === WebSocket.CONNECTING ||
      !this.shouldConnect()
    ) {
      return;
    }

    this.updateStatus(this.reconnectAttempts > 0 ? 'reconnecting' : 'connecting');
    this.connectTimer = setTimeout(() => {
      this.connectTimer = null;
      this.connect();
    }, delay);
  }

  private clearConnectTimer() {
    if (!this.connectTimer) {
      return;
    }
    clearTimeout(this.connectTimer);
    this.connectTimer = null;
  }

  private clearReconnectTimer() {
    if (!this.reconnectTimer) {
      return;
    }
    clearTimeout(this.reconnectTimer);
    this.reconnectTimer = null;
  }

  private clearChannelRestartTimer() {
    if (!this.channelRestartTimer) {
      return;
    }
    clearTimeout(this.channelRestartTimer);
    this.channelRestartTimer = null;
  }

  private updateStatus(
    connection: RealtimeConnectionState,
    patch: Partial<RealtimeChannelStatus> = {},
  ) {
    this.status = {
      connection,
      channels: {
        'world-chat': this.nextChannelStatus('world-chat', connection, patch),
        'player-state': this.nextChannelStatus('player-state', connection, patch),
      },
    };
    this.emitStatus();
  }

  private nextChannelStatus(
    channel: RealtimeChannel,
    connection: RealtimeConnectionState,
    patch: Partial<RealtimeChannelStatus>,
  ): RealtimeChannelStatus {
    const prev = this.status.channels[channel];
    if (!this.enabledChannels.has(channel)) {
      return createChannelStatus(false);
    }

    return {
      ...prev,
      ...patch,
      enabled: true,
      state: connection,
      reconnectAttempt: patch.reconnectAttempt ?? this.reconnectAttempts,
    };
  }

  private emitStatus() {
    const snapshot = cloneStatus(this.status);
    for (const listener of this.statusListeners) {
      listener(snapshot);
    }
  }
}

export const realtimeClient = new RealtimeClient();
