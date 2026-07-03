import { Hono } from 'hono';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { isAllowedRealtimeOrigin } from '@server/lib/http/realtimeOrigin';

const {
  recordRealtimeConnectionCloseMock,
  recordRealtimeConnectionOpenMock,
  upgradeWebSocketMock,
} = vi.hoisted(() => ({
  recordRealtimeConnectionCloseMock: vi.fn(),
  recordRealtimeConnectionOpenMock: vi.fn(),
  upgradeWebSocketMock: vi.fn(),
}));

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
  recordRealtimeConnectionOpen: recordRealtimeConnectionOpenMock,
}));

vi.mock('@server/lib/services/playerStateBroadcaster', () => ({
  subscribePlayerStateEvents: () => vi.fn(),
}));

vi.mock('@server/lib/services/worldChatBroadcaster', () => ({
  subscribeWorldChatMessages: () => vi.fn(),
}));

import realtimeRouter from './realtime.router';

const originalOrigins = process.env.PUBLIC_WEB_ORIGINS;

afterEach(() => {
  process.env.PUBLIC_WEB_ORIGINS = originalOrigins;
});

beforeEach(() => {
  vi.clearAllMocks();
  upgradeWebSocketMock.mockImplementation((_context, handlers) => {
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

    const response = await app.request(
      '/api/realtime?channels=player-state',
      {
        headers: {
          Origin: 'https://app.example.com',
        },
      },
    );

    expect(response.status).toBe(200);
    expect(recordRealtimeConnectionOpenMock).toHaveBeenCalledWith(
      'cultivator-1',
    );
    expect(recordRealtimeConnectionCloseMock).toHaveBeenCalledWith(
      'cultivator-1',
    );
  });
});
