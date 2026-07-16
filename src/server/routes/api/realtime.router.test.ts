import { isAllowedRealtimeOrigin } from '@server/lib/http/realtimeOrigin';
import { Hono } from 'hono';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

const {
  recordRealtimeConnectionCloseMock,
  recordRealtimeConnectionHeartbeatMock,
  recordRealtimeConnectionOpenMock,
  subscribePlayerStateEventsMock,
  subscribeWorldChatMessagesMock,
  upgradeRequestMock,
  upgradeWebSocketMock,
} = vi.hoisted(() => {
  const upgradeRequestMock = vi.fn();
  return {
    recordRealtimeConnectionCloseMock: vi.fn(),
    recordRealtimeConnectionHeartbeatMock: vi.fn(),
    recordRealtimeConnectionOpenMock: vi.fn(),
    subscribePlayerStateEventsMock: vi.fn(),
    subscribeWorldChatMessagesMock: vi.fn(),
    upgradeRequestMock,
    upgradeWebSocketMock: vi.fn((createEvents: (context: any) => any) => {
      return async (context: any) => {
        const handlers = await createEvents(context);
        return upgradeRequestMock(context, handlers);
      };
    }),
  };
});

vi.mock('@server/lib/hono/middleware', () => ({
  requireActiveCultivatorRef:
    () => async (context: any, next: () => Promise<void>) => {
      context.set('user', {
        id: 'user-1',
        email: 'user@example.com',
      });
      context.set('activeCultivatorRef', {
        cultivatorId: 'cultivator-1',
      });
      await next();
    },
}));

vi.mock('hono/bun', () => ({
  upgradeWebSocket: upgradeWebSocketMock,
}));

vi.mock('@server/lib/services/onlinePresenceService', () => ({
  recordRealtimeConnectionClose: recordRealtimeConnectionCloseMock,
  recordRealtimeConnectionHeartbeat: recordRealtimeConnectionHeartbeatMock,
  recordRealtimeConnectionOpen: recordRealtimeConnectionOpenMock,
}));

vi.mock('@server/lib/services/playerStateBroadcaster', () => ({
  subscribePlayerStateEvents: subscribePlayerStateEventsMock,
}));

vi.mock('@server/lib/services/worldChatBroadcaster', () => ({
  subscribeWorldChatMessages: subscribeWorldChatMessagesMock,
}));

import realtimeRouter from './realtime.router';

const originalOrigins = process.env.PUBLIC_WEB_ORIGINS;

afterEach(() => {
  vi.useRealTimers();
  process.env.PUBLIC_WEB_ORIGINS = originalOrigins;
});

beforeEach(() => {
  vi.clearAllMocks();
  subscribePlayerStateEventsMock.mockImplementation(() => vi.fn());
  subscribeWorldChatMessagesMock.mockImplementation(() => vi.fn());
  upgradeRequestMock.mockImplementation((_context, handlers) => {
    const ws = {
      readyState: 1,
      send: vi.fn(),
      close: vi.fn(),
    };
    handlers.onOpen?.({}, ws);
    handlers.onClose?.();
    return new Response(null, { status: 200 });
  });
});

describe('realtime origin guard', () => {
  it('allows configured public web origins', () => {
    process.env.PUBLIC_WEB_ORIGINS = 'https://app.example.com';

    expect(isAllowedRealtimeOrigin('https://app.example.com')).toBe(true);
  });

  it('rejects browser websocket origins outside the allowlist', () => {
    process.env.PUBLIC_WEB_ORIGINS = 'https://app.example.com';

    expect(isAllowedRealtimeOrigin('https://evil.example.com')).toBe(false);
  });

  it('allows missing origin for non-browser probes', () => {
    process.env.PUBLIC_WEB_ORIGINS = 'https://app.example.com';

    expect(isAllowedRealtimeOrigin(undefined)).toBe(true);
  });

  it('records online presence when realtime websocket opens and closes', async () => {
    process.env.PUBLIC_WEB_ORIGINS = 'https://app.example.com';
    const app = new Hono().route('/api/realtime', realtimeRouter);

    const response = await app.request('/api/realtime?channels=player-state', {
      headers: {
        Origin: 'https://app.example.com',
      },
    });

    expect(response.status).toBe(200);
    expect(recordRealtimeConnectionOpenMock).toHaveBeenCalledWith(
      'cultivator-1',
    );
    expect(recordRealtimeConnectionCloseMock).toHaveBeenCalledWith(
      'cultivator-1',
    );
  });

  it('keeps the connection alive when client activity uses a new Hono WSContext', async () => {
    vi.useFakeTimers();
    process.env.PUBLIC_WEB_ORIGINS = 'https://app.example.com';
    let handlers: any;
    upgradeRequestMock.mockImplementation((_context, nextHandlers) => {
      handlers = nextHandlers;
      return new Response(null, { status: 200 });
    });
    const app = new Hono().route('/api/realtime', realtimeRouter);

    const response = await app.request('/api/realtime?channels=player-state', {
      headers: {
        Origin: 'https://app.example.com',
      },
    });
    expect(response.status).toBe(200);

    const send = vi.fn();
    const close = vi.fn();
    const openContext = { readyState: 1, send, close };
    const messageContext = { readyState: 1, send, close };
    handlers.onOpen?.({}, openContext);

    await vi.advanceTimersByTimeAsync(25_000);
    expect(send).toHaveBeenCalledWith(expect.stringContaining('"type":"ping"'));

    handlers.onMessage?.(
      { data: JSON.stringify({ type: 'client.activity' }) },
      messageContext,
    );
    await vi.advanceTimersByTimeAsync(50_000);

    expect(close).not.toHaveBeenCalled();
    handlers.onClose?.();
  });

  it('uses elapsed time when a heartbeat interval callback is delayed', async () => {
    process.env.PUBLIC_WEB_ORIGINS = 'https://app.example.com';
    let handlers: any;
    upgradeRequestMock.mockImplementation((_context, nextHandlers) => {
      handlers = nextHandlers;
      return new Response(null, { status: 200 });
    });
    let heartbeatTick: (() => void) | undefined;
    vi.spyOn(globalThis, 'setInterval').mockImplementation((callback) => {
      heartbeatTick = callback as () => void;
      return {} as ReturnType<typeof setInterval>;
    });
    vi.spyOn(globalThis, 'clearInterval').mockImplementation(() => {});
    const now = vi.spyOn(Date, 'now').mockReturnValue(1_000);
    const app = new Hono().route('/api/realtime', realtimeRouter);

    const response = await app.request('/api/realtime?channels=player-state', {
      headers: {
        Origin: 'https://app.example.com',
      },
    });
    expect(response.status).toBe(200);

    const send = vi.fn();
    const close = vi.fn();
    handlers.onOpen?.({}, { readyState: 1, send, close });
    now.mockReturnValue(51_001);
    heartbeatTick?.();

    expect(close).toHaveBeenCalledWith(4_000, 'heartbeat timeout');
  });

  it('isolates heartbeat activity between websocket upgrade closures', async () => {
    vi.useFakeTimers();
    process.env.PUBLIC_WEB_ORIGINS = 'https://app.example.com';
    const handlers: any[] = [];
    upgradeRequestMock.mockImplementation((_context, nextHandlers) => {
      handlers.push(nextHandlers);
      return new Response(null, { status: 200 });
    });
    const app = new Hono().route('/api/realtime', realtimeRouter);
    const request = () =>
      app.request('/api/realtime?channels=player-state', {
        headers: { Origin: 'https://app.example.com' },
      });

    await request();
    await request();
    expect(handlers).toHaveLength(2);

    const firstSocket = { readyState: 1, send: vi.fn(), close: vi.fn() };
    const secondSocket = { readyState: 1, send: vi.fn(), close: vi.fn() };
    handlers[0].onOpen?.({}, firstSocket);
    handlers[1].onOpen?.({}, secondSocket);

    await vi.advanceTimersByTimeAsync(25_000);
    handlers[0].onMessage?.(
      { data: JSON.stringify({ type: 'pong' }) },
      firstSocket,
    );
    await vi.advanceTimersByTimeAsync(50_000);

    expect(firstSocket.close).not.toHaveBeenCalled();
    expect(secondSocket.close).toHaveBeenCalledWith(4_000, 'heartbeat timeout');
    handlers[0].onClose?.();
  });

  it('reserves connection capacity before websocket open', async () => {
    process.env.PUBLIC_WEB_ORIGINS = 'https://app.example.com';
    const handlers: any[] = [];
    upgradeRequestMock.mockImplementation((_context, nextHandlers) => {
      handlers.push(nextHandlers);
      return new Response(null, { status: 200 });
    });
    const app = new Hono().route('/api/realtime', realtimeRouter);
    const request = () =>
      app.request('/api/realtime?channels=player-state', {
        headers: { Origin: 'https://app.example.com' },
      });

    const responses = await Promise.all([
      request(),
      request(),
      request(),
      request(),
    ]);

    expect(responses.map((response) => response.status)).toEqual([
      200, 200, 200, 429,
    ]);
    expect(handlers).toHaveLength(3);
    for (const websocketHandlers of handlers) {
      const socket = { readyState: 1, send: vi.fn(), close: vi.fn() };
      websocketHandlers.onOpen?.({}, socket);
      websocketHandlers.onClose?.();
    }
  });

  it('finishes cleanup when an unsubscribe callback throws', async () => {
    process.env.PUBLIC_WEB_ORIGINS = 'https://app.example.com';
    const throwingUnsubscribe = vi.fn(() => {
      throw new Error('unsubscribe failed');
    });
    const safeUnsubscribe = vi.fn();
    subscribePlayerStateEventsMock.mockReturnValue(throwingUnsubscribe);
    subscribeWorldChatMessagesMock.mockReturnValue(safeUnsubscribe);
    vi.spyOn(console, 'warn').mockImplementation(() => {});
    let handlers: any;
    upgradeRequestMock.mockImplementation((_context, nextHandlers) => {
      handlers = nextHandlers;
      return new Response(null, { status: 200 });
    });
    const app = new Hono().route('/api/realtime', realtimeRouter);
    await app.request('/api/realtime?channels=player-state%2Cworld-chat', {
      headers: { Origin: 'https://app.example.com' },
    });
    handlers.onOpen?.({}, { readyState: 1, send: vi.fn(), close: vi.fn() });

    expect(() => handlers.onClose?.()).not.toThrow();
    expect(throwingUnsubscribe).toHaveBeenCalledOnce();
    expect(safeUnsubscribe).toHaveBeenCalledOnce();
    expect(recordRealtimeConnectionCloseMock).toHaveBeenCalledOnce();
  });

  it('cleans up when sending to the websocket throws', async () => {
    process.env.PUBLIC_WEB_ORIGINS = 'https://app.example.com';
    let handlers: any;
    upgradeRequestMock.mockImplementation((_context, nextHandlers) => {
      handlers = nextHandlers;
      return new Response(null, { status: 200 });
    });
    const app = new Hono().route('/api/realtime', realtimeRouter);
    await app.request('/api/realtime?channels=player-state', {
      headers: { Origin: 'https://app.example.com' },
    });
    const socket = {
      readyState: 1,
      send: vi.fn(() => {
        throw new Error('socket ended');
      }),
      close: vi.fn(),
    };

    expect(() => handlers.onOpen?.({}, socket)).not.toThrow();
    expect(recordRealtimeConnectionCloseMock).toHaveBeenCalledOnce();
  });
});
