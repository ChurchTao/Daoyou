import { requireActiveCultivatorRef } from '@server/lib/hono/middleware';
import type { AppEnv } from '@server/lib/hono/types';
import { isAllowedRealtimeOrigin } from '@server/lib/http/realtimeOrigin';
import {
  recordRealtimeConnectionClose,
  recordRealtimeConnectionHeartbeat,
  recordRealtimeConnectionOpen,
} from '@server/lib/services/onlinePresenceService';
import { subscribePlayerStateEvents } from '@server/lib/services/playerStateBroadcaster';
import { subscribeWorldChatMessages } from '@server/lib/services/worldChatBroadcaster';
import {
  REALTIME_CHANNELS,
  type RealtimeChannel,
  type RealtimeServerEvent,
} from '@shared/contracts/realtime';
import { upgradeWebSocket } from 'hono/bun';
import type { WSContext } from 'hono/ws';
import { Hono, type Context } from 'hono';

const router = new Hono<AppEnv>();
const HEARTBEAT_INTERVAL_MS = 25_000;
const MAX_MISSED_PONGS = 2;
const MAX_MESSAGE_BYTES = 512;
const MAX_CONNECTIONS_PER_USER = 3;
const MAX_CONNECTIONS_PER_CULTIVATOR = 3;
const MAX_CONNECTIONS_PER_IP = 40;

const userConnectionCounts = new Map<string, number>();
const cultivatorConnectionCounts = new Map<string, number>();
const ipConnectionCounts = new Map<string, number>();

function incrementCount(map: Map<string, number>, key: string) {
  map.set(key, (map.get(key) ?? 0) + 1);
}

function decrementCount(map: Map<string, number>, key: string) {
  const next = (map.get(key) ?? 0) - 1;
  if (next <= 0) {
    map.delete(key);
    return;
  }
  map.set(key, next);
}

function getClientIp(c: Context<AppEnv>) {
  return (
    c.req.header('cf-connecting-ip') ||
    c.req.header('x-forwarded-for')?.split(',')[0]?.trim() ||
    c.req.header('x-real-ip') ||
    'unknown'
  );
}

function parseChannels(raw: string | undefined): RealtimeChannel[] {
  if (!raw) {
    return [...REALTIME_CHANNELS];
  }

  const allowed = new Set<RealtimeChannel>(REALTIME_CHANNELS);
  const channels = raw
    .split(',')
    .map((item) => item.trim())
    .filter((item): item is RealtimeChannel =>
      allowed.has(item as RealtimeChannel),
    );

  return channels.length > 0 ? Array.from(new Set(channels)) : [...REALTIME_CHANNELS];
}

function canAcceptConnection(args: {
  userId: string;
  cultivatorId: string;
  ip: string;
}) {
  return (
    (userConnectionCounts.get(args.userId) ?? 0) < MAX_CONNECTIONS_PER_USER &&
    (cultivatorConnectionCounts.get(args.cultivatorId) ?? 0) <
      MAX_CONNECTIONS_PER_CULTIVATOR &&
    (ipConnectionCounts.get(args.ip) ?? 0) < MAX_CONNECTIONS_PER_IP
  );
}

function sendEnvelope(ws: WSContext, event: RealtimeServerEvent) {
  if (ws.readyState !== 1) {
    return;
  }

  ws.send(JSON.stringify(event));
}

router.get('/', async (c, next) => {
  if (!isAllowedRealtimeOrigin(c.req.header('origin'))) {
    return c.json({ success: false, error: 'Forbidden origin' }, 403);
  }
  await next();
});

router.get('/', requireActiveCultivatorRef(), async (c) => {
  const user = c.get('user');
  if (!user) {
    return c.json({ success: false, error: '未授权访问' }, 401);
  }

  const ref = c.get('activeCultivatorRef');
  if (!ref) {
    return c.json({ success: false, error: '当前没有活跃角色' }, 404);
  }

  const channels = parseChannels(c.req.query('channels'));
  const ip = getClientIp(c);
  if (
    !canAcceptConnection({
      userId: user.id,
      cultivatorId: ref.cultivatorId,
      ip,
    })
  ) {
    return c.json({ success: false, error: '实时连接过多' }, 429);
  }

  let cleanup: () => void = () => {};

  return upgradeWebSocket(c, {
    onOpen(_event, ws) {
      incrementCount(userConnectionCounts, user.id);
      incrementCount(cultivatorConnectionCounts, ref.cultivatorId);
      incrementCount(ipConnectionCounts, ip);
      recordRealtimeConnectionOpen(ref.cultivatorId);

      const unsubscribers: Array<() => void> = [];
      if (channels.includes('player-state')) {
        unsubscribers.push(
          subscribePlayerStateEvents(ref.cultivatorId, (events) => {
            sendEnvelope(ws, {
              type: 'player-state.events',
              payload: { events },
            });
          }),
        );
      }
      if (channels.includes('world-chat')) {
        unsubscribers.push(
          subscribeWorldChatMessages((message) => {
            sendEnvelope(ws, {
              type: 'world-chat.message',
              payload: message,
            });
          }),
        );
      }

      let missedPongs = 0;
      let closed = false;
      let heartbeat: ReturnType<typeof setInterval> | null = setInterval(() => {
        missedPongs += 1;
        if (missedPongs > MAX_MISSED_PONGS) {
          ws.close();
          cleanup();
          return;
        }
        recordRealtimeConnectionHeartbeat(ref.cultivatorId);
        sendEnvelope(ws, {
          type: 'ping',
          payload: { serverTime: new Date().toISOString() },
        });
      }, HEARTBEAT_INTERVAL_MS);
      cleanup = () => {
        if (closed) {
          return;
        }
        closed = true;
        for (const unsubscribe of unsubscribers) {
          unsubscribe();
        }
        decrementCount(userConnectionCounts, user.id);
        decrementCount(cultivatorConnectionCounts, ref.cultivatorId);
        decrementCount(ipConnectionCounts, ip);
        recordRealtimeConnectionClose(ref.cultivatorId);
        if (heartbeat) {
          clearInterval(heartbeat);
          heartbeat = null;
        }
      };

      sendEnvelope(ws, {
        type: 'ready',
        payload: { cultivatorId: ref.cultivatorId, channels },
      });
      Object.assign(ws, {
        __daoyouPong: () => {
          missedPongs = 0;
        },
      });
    },
    onMessage(event, ws) {
      const raw = event.data;
      if (typeof raw !== 'string' || raw.length > MAX_MESSAGE_BYTES) {
        ws.close();
        return;
      }

      try {
        const parsed = JSON.parse(raw) as { type?: unknown };
        if (parsed.type === 'pong') {
          (ws as unknown as { __daoyouPong?: () => void }).__daoyouPong?.();
        }
      } catch {
        // Ignore invalid client frames; realtime v1 is server-push only.
      }
    },
    onClose() {
      cleanup();
    },
    onError() {
      cleanup();
    },
  });
});

export default router;
