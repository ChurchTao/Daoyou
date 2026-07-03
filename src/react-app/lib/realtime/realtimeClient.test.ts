import type { RealtimeServerEvent } from '@shared/contracts/realtime';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { RealtimeClient } from './realtimeClient';

class MockWebSocket {
  static OPEN = 1;
  static CONNECTING = 0;
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
  vi.unstubAllGlobals();
  MockWebSocket.instances = [];
});

describe('RealtimeClient', () => {
  it('dispatches subscribed events and responds to ping', () => {
    vi.stubGlobal('window', {
      location: { protocol: 'http:', host: 'localhost:5173' },
    });
    vi.stubGlobal('WebSocket', MockWebSocket);
    const client = new RealtimeClient();
    const listener = vi.fn();

    client.subscribe('world-chat.message', listener);
    client.connect();
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

    expect(socket.url).toBe('ws://localhost:5173/api/realtime');
    expect(socket.sent).toContain(JSON.stringify({ type: 'pong' }));
    expect(listener).toHaveBeenCalledWith(
      expect.objectContaining({ type: 'world-chat.message' }),
    );
  });

  it('ignores invalid messages and removes listeners', () => {
    vi.stubGlobal('window', {
      location: { protocol: 'https:', host: 'example.test' },
    });
    vi.stubGlobal('WebSocket', MockWebSocket);
    const client = new RealtimeClient();
    const listener = vi.fn();
    const unsubscribe = client.subscribe('ready', listener);

    client.connect();
    const socket = MockWebSocket.instances[0];
    socket.receive('{bad json');
    unsubscribe();
    socket.receive({
      type: 'ready',
      payload: { cultivatorId: 'cultivator-1' },
    });

    expect(listener).not.toHaveBeenCalled();
  });
});
