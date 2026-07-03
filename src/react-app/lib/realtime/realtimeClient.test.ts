import type { RealtimeServerEvent } from '@shared/contracts/realtime';
import { afterEach, describe, expect, it, vi } from 'vitest';
import {
  REALTIME_CONNECT_DEBOUNCE_MS,
  RealtimeClient,
} from './realtimeClient';

vi.mock('@app/lib/api/url', () => ({
  resolveRealtimeUrl: (channels?: string[]) =>
    `wss://api.example.com/api/realtime${
      channels?.length ? `?channels=${channels.join(',')}` : ''
    }`,
}));

class MockWebSocket {
  static OPEN = 1;
  static CONNECTING = 0;
  static CLOSED = 3;
  static instances: MockWebSocket[] = [];

  readyState = MockWebSocket.CONNECTING;
  onopen: (() => void) | null = null;
  onmessage: ((event: { data: string }) => void) | null = null;
  onerror: (() => void) | null = null;
  onclose: (() => void) | null = null;
  sent: string[] = [];
  url: string;

  constructor(url: string) {
    this.url = url;
    MockWebSocket.instances.push(this);
  }

  send(message: string) {
    this.sent.push(message);
  }

  close() {
    this.readyState = 3;
    this.onclose?.();
  }

  open() {
    this.readyState = MockWebSocket.OPEN;
    this.onopen?.();
  }

  receive(event: RealtimeServerEvent | string) {
    this.onmessage?.({
      data: typeof event === 'string' ? event : JSON.stringify(event),
    });
  }
}

afterEach(() => {
  vi.useRealTimers();
  vi.unstubAllGlobals();
  MockWebSocket.instances = [];
});

describe('RealtimeClient', () => {
  async function flushConnectDebounce() {
    await vi.advanceTimersByTimeAsync(REALTIME_CONNECT_DEBOUNCE_MS);
  }

  it('dispatches subscribed events and responds to ping', async () => {
    vi.useFakeTimers();
    vi.stubGlobal('window', {
      location: { protocol: 'http:', host: 'localhost:5173' },
      addEventListener: vi.fn(),
      removeEventListener: vi.fn(),
    });
    vi.stubGlobal('WebSocket', MockWebSocket);
    const client = new RealtimeClient();
    const listener = vi.fn();

    client.subscribe('world-chat.message', listener);
    client.setCultivatorId('cultivator-1');
    client.enableChannel('world-chat');
    await flushConnectDebounce();
    const socket = MockWebSocket.instances[0];
    socket.open();
    socket.receive({
      type: 'ping',
      payload: { serverTime: '2026-07-03T00:00:00.000Z' },
    });
    socket.receive({
      type: 'world-chat.message',
      payload: {
        id: 'm1',
        channel: 'world',
        senderUserId: 'user-1',
        senderCultivatorId: 'cultivator-1',
        senderName: '林玄',
        senderRealm: '炼气',
        senderRealmStage: '初期',
        messageType: 'text',
        textContent: 'hello',
        payload: { text: 'hello' },
        status: 'active',
        createdAt: '2026-07-03T00:00:00.000Z',
      },
    });

    expect(socket.url).toBe(
      'wss://api.example.com/api/realtime?channels=world-chat',
    );
    expect(socket.sent).toContain(JSON.stringify({ type: 'pong' }));
    expect(listener).toHaveBeenCalledWith(
      expect.objectContaining({ type: 'world-chat.message' }),
    );
  });

  it('ignores invalid messages and removes listeners', async () => {
    vi.useFakeTimers();
    vi.stubGlobal('window', {
      location: { protocol: 'https:', host: 'example.test' },
      addEventListener: vi.fn(),
      removeEventListener: vi.fn(),
    });
    vi.stubGlobal('WebSocket', MockWebSocket);
    const client = new RealtimeClient();
    const listener = vi.fn();
    const unsubscribe = client.subscribe('ready', listener);

    client.setCultivatorId('cultivator-1');
    client.enableChannel('player-state');
    await flushConnectDebounce();
    const socket = MockWebSocket.instances[0];
    socket.receive('{bad json');
    unsubscribe();
    socket.receive({
      type: 'ready',
      payload: { cultivatorId: 'cultivator-1' },
    });

    expect(listener).not.toHaveBeenCalled();
  });

  it('does not connect without cultivator and channel intent', async () => {
    vi.useFakeTimers();
    vi.stubGlobal('window', {
      location: { protocol: 'https:', host: 'example.test' },
      addEventListener: vi.fn(),
      removeEventListener: vi.fn(),
    });
    vi.stubGlobal('WebSocket', MockWebSocket);
    const client = new RealtimeClient();

    client.enableChannel('world-chat');
    await flushConnectDebounce();
    expect(MockWebSocket.instances).toHaveLength(0);

    client.setCultivatorId('cultivator-1');
    await flushConnectDebounce();
    expect(MockWebSocket.instances).toHaveLength(1);
  });

  it('does not close a newly opened socket when channel intent was set before cultivator', async () => {
    vi.useFakeTimers();
    vi.stubGlobal('window', {
      location: { protocol: 'https:', host: 'example.test' },
      addEventListener: vi.fn(),
      removeEventListener: vi.fn(),
    });
    vi.stubGlobal('WebSocket', MockWebSocket);
    const client = new RealtimeClient();

    client.enableChannel('player-state');
    client.setCultivatorId('cultivator-1');
    await flushConnectDebounce();

    expect(MockWebSocket.instances).toHaveLength(1);
    expect(MockWebSocket.instances[0].readyState).toBe(MockWebSocket.CONNECTING);
  });

  it('batches initial channel intents into one physical socket', async () => {
    vi.useFakeTimers();
    vi.stubGlobal('window', {
      location: { protocol: 'https:', host: 'example.test' },
      addEventListener: vi.fn(),
      removeEventListener: vi.fn(),
    });
    vi.stubGlobal('WebSocket', MockWebSocket);
    const client = new RealtimeClient();

    client.enableChannel('player-state');
    client.setCultivatorId('cultivator-1');
    client.enableChannel('world-chat');
    await flushConnectDebounce();

    expect(MockWebSocket.instances).toHaveLength(1);
    expect(MockWebSocket.instances[0].url).toBe(
      'wss://api.example.com/api/realtime?channels=player-state,world-chat',
    );
  });

  it('restarts once when a channel is added after the socket is established', async () => {
    vi.useFakeTimers();
    vi.stubGlobal('window', {
      location: { protocol: 'https:', host: 'example.test' },
      addEventListener: vi.fn(),
      removeEventListener: vi.fn(),
    });
    vi.stubGlobal('WebSocket', MockWebSocket);
    const client = new RealtimeClient();

    client.enableChannel('player-state');
    client.setCultivatorId('cultivator-1');
    await flushConnectDebounce();
    const firstSocket = MockWebSocket.instances[0];
    firstSocket.open();

    client.enableChannel('world-chat');
    await flushConnectDebounce();
    await vi.runOnlyPendingTimersAsync();

    expect(MockWebSocket.instances).toHaveLength(2);
    expect(firstSocket.readyState).toBe(MockWebSocket.CLOSED);
    expect(MockWebSocket.instances[1].url).toBe(
      'wss://api.example.com/api/realtime?channels=player-state,world-chat',
    );
  });

  it('does not emit reconnecting state until the socket closes', async () => {
    vi.useFakeTimers();
    vi.stubGlobal('window', {
      location: { protocol: 'https:', host: 'example.test' },
      addEventListener: vi.fn(),
      removeEventListener: vi.fn(),
    });
    vi.stubGlobal('WebSocket', MockWebSocket);
    const client = new RealtimeClient();
    const statuses: string[] = [];
    client.subscribeStatus((status) => statuses.push(status.connection));

    client.enableChannel('player-state');
    client.setCultivatorId('cultivator-1');
    await flushConnectDebounce();
    const socket = MockWebSocket.instances[0];
    socket.open();
    socket.onerror?.();

    expect(statuses.at(-1)).toBe('online');

    socket.close();
    expect(statuses.at(-1)).toBe('reconnecting');
  });

  it('clears reconnect intent when cultivator is removed', async () => {
    vi.useFakeTimers();
    vi.stubGlobal('window', {
      location: { protocol: 'https:', host: 'example.test' },
      addEventListener: vi.fn(),
      removeEventListener: vi.fn(),
    });
    vi.stubGlobal('WebSocket', MockWebSocket);
    const client = new RealtimeClient();
    client.setCultivatorId('cultivator-1');
    client.enableChannel('world-chat');
    await flushConnectDebounce();
    const socket = MockWebSocket.instances[0];
    socket.open();
    socket.close();

    client.setCultivatorId(null);
    vi.runOnlyPendingTimers();

    expect(MockWebSocket.instances).toHaveLength(1);
    vi.useRealTimers();
  });
});
