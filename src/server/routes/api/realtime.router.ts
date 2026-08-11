import { requireUser } from '@server/lib/hono/middleware';
import type { AppEnv } from '@server/lib/hono/types';
import { db } from '@server/lib/drizzle/db';
import { cultivators, sectMemberships } from '@server/lib/drizzle/schema';
import { isAllowedRealtimeOrigin } from '@server/lib/http/realtimeOrigin';
import {
  recordRealtimeConnectionClose,
  recordRealtimeConnectionHeartbeat,
  recordRealtimeConnectionOpen,
} from '@server/lib/services/onlinePresenceService';
import { subscribeArenaRoomChanges } from '@server/lib/services/arenaRoomBroadcaster';
import { subscribeResourceEvents } from '@server/lib/services/playerStateBroadcaster';
import { subscribeSectChatMessages } from '@server/lib/services/sectChatBroadcaster';
import { subscribeWorldChatMessages } from '@server/lib/services/worldChatBroadcaster';
import {
  REALTIME_CHANNELS,
  type RealtimeChannel,
  type RealtimeServerEvent,
} from '@shared/contracts/realtime';
import type { ResourceScope } from '@shared/contracts/resources';
import { and, eq } from 'drizzle-orm';
import { Hono, type Context, type MiddlewareHandler } from 'hono';
import { upgradeWebSocket } from 'hono/bun';
import type { WSContext } from 'hono/ws';

const router = new Hono<AppEnv>();
const HEARTBEAT_INTERVAL_MS = 25_000;
const MAX_MISSED_HEARTBEATS = 2;
const HEARTBEAT_TIMEOUT_MS = HEARTBEAT_INTERVAL_MS * MAX_MISSED_HEARTBEATS;
const HEARTBEAT_TIMEOUT_CLOSE_CODE = 4_000;
const HEARTBEAT_TIMEOUT_CLOSE_REASON = 'heartbeat timeout';
const MAX_MESSAGE_BYTES = 512;
const MAX_CONNECTIONS_PER_USER = 3;
const MAX_CONNECTIONS_PER_CULTIVATOR = 3;
const MAX_CONNECTIONS_PER_IP = 40;

const userConnectionCounts = new Map<string, number>();
const cultivatorConnectionCounts = new Map<string, number>();
const ipConnectionCounts = new Map<string, number>();

type ConnectionIdentity = {
  userId: string;
  cultivatorId: string | null;
  sectId: string | null;
  ip: string;
};

type ConnectionReservation = ConnectionIdentity & {
  release: () => void;
};

const pendingConnectionReservations = new WeakMap<
  Context<AppEnv>,
  ConnectionReservation
>();

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

  return channels.length > 0
    ? Array.from(new Set(channels))
    : [...REALTIME_CHANNELS];
}

function reserveConnection(
  identity: ConnectionIdentity,
): ConnectionReservation | null {
  if (
    (userConnectionCounts.get(identity.userId) ?? 0) >=
      MAX_CONNECTIONS_PER_USER ||
    (identity.cultivatorId !== null &&
      (cultivatorConnectionCounts.get(identity.cultivatorId) ?? 0) >=
        MAX_CONNECTIONS_PER_CULTIVATOR) ||
    (ipConnectionCounts.get(identity.ip) ?? 0) >= MAX_CONNECTIONS_PER_IP
  ) {
    return null;
  }

  incrementCount(userConnectionCounts, identity.userId);
  if (identity.cultivatorId) {
    incrementCount(cultivatorConnectionCounts, identity.cultivatorId);
  }
  incrementCount(ipConnectionCounts, identity.ip);
  let released = false;

  return {
    ...identity,
    release() {
      if (released) {
        return;
      }
      released = true;
      decrementCount(userConnectionCounts, identity.userId);
      if (identity.cultivatorId) {
        decrementCount(cultivatorConnectionCounts, identity.cultivatorId);
      }
      decrementCount(ipConnectionCounts, identity.ip);
    },
  };
}

const requireRealtimeOrigin = (async (c, next) => {
  if (!isAllowedRealtimeOrigin(c.req.header('origin'))) {
    return c.json({ success: false, error: 'Forbidden origin' }, 403);
  }
  await next();
}) satisfies MiddlewareHandler<AppEnv>;

const reserveRealtimeConnection = (async (c, next) => {
  const user = c.get('user');
  if (!user) {
    return c.json({ success: false, error: '未授权访问' }, 401);
  }

  const active = await db.query.cultivators.findFirst({
    columns: { id: true },
    where: and(
      eq(cultivators.userId, user.id),
      eq(cultivators.status, 'active'),
    ),
  });

  const reservation = reserveConnection({
    userId: user.id,
    cultivatorId: active?.id ?? null,
    sectId:
      active
        ? (
        await db.query.sectMemberships.findFirst({
          columns: { sectId: true },
          where: and(
                eq(sectMemberships.cultivatorId, active.id),
            eq(sectMemberships.status, 'active'),
          ),
        })
          )?.sectId ?? null
        : null,
    ip: getClientIp(c),
  });
  if (!reservation) {
    return c.json({ success: false, error: '实时连接过多' }, 429);
  }

  pendingConnectionReservations.set(c, reservation);
  try {
    await next();
  } catch (error) {
    pendingConnectionReservations.delete(c);
    reservation.release();
    throw error;
  }

  if (pendingConnectionReservations.get(c) === reservation) {
    pendingConnectionReservations.delete(c);
    reservation.release();
  }
}) satisfies MiddlewareHandler<AppEnv>;

router.get(
  '/',
  requireRealtimeOrigin,
  requireUser(),
  reserveRealtimeConnection,
  upgradeWebSocket((rawContext) => {
    const c = rawContext as Context<AppEnv>;
    const reservation = pendingConnectionReservations.get(c);
    if (!reservation) {
      throw new Error('Realtime connection reservation is missing');
    }
    pendingConnectionReservations.delete(c);

    const channels = parseChannels(c.req.query('channels'));
    const { cultivatorId } = reservation;
    const resourceScopes: ResourceScope[] = [
      { kind: 'account', id: reservation.userId },
      ...(cultivatorId
        ? ([{ kind: 'cultivator', id: cultivatorId }] satisfies ResourceScope[])
        : []),
      ...(reservation.sectId
        ? ([{ kind: 'sect', id: reservation.sectId }] satisfies ResourceScope[])
        : []),
    ];
    let lastClientActivityAt = Date.now();
    let heartbeat: ReturnType<typeof setInterval> | undefined;
    let closed = false;
    const unsubscribers: Array<() => void> = [];
    const cleanup = () => {
      if (closed) {
        return;
      }
      closed = true;
      if (heartbeat) {
        clearInterval(heartbeat);
      }
      for (const unsubscribe of unsubscribers) {
        try {
          unsubscribe();
        } catch (error) {
          console.warn('[realtime] unsubscribe failed', {
            cultivatorId,
            error,
          });
        }
      }
      reservation.release();
      if (cultivatorId) recordRealtimeConnectionClose(cultivatorId);
    };
    const closeConnection = (ws: WSContext, code: number, reason: string) => {
      if (closed) {
        return;
      }
      try {
        ws.close(code, reason);
      } catch (error) {
        console.warn('[realtime] websocket close failed', {
          cultivatorId,
          error,
        });
      }
      cleanup();
    };
    const sendEnvelope = (ws: WSContext, event: RealtimeServerEvent) => {
      if (closed) {
        return false;
      }
      try {
        ws.send(JSON.stringify(event));
        return true;
      } catch (error) {
        console.warn('[realtime] websocket send failed', {
          cultivatorId,
          error,
        });
        closeConnection(ws, 1_011, 'websocket send failed');
        return false;
      }
    };

    return {
      onOpen(_event, ws) {
        lastClientActivityAt = Date.now();
        if (cultivatorId) recordRealtimeConnectionOpen(cultivatorId);

        if (channels.includes('player-state')) {
          unsubscribers.push(
            subscribeResourceEvents(resourceScopes, (changes) => {
              sendEnvelope(ws, {
                type: 'player-state.events',
                payload: { changes },
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
          if (reservation.sectId) {
            unsubscribers.push(
              subscribeSectChatMessages(reservation.sectId, (message) => {
                sendEnvelope(ws, {
                  type: 'world-chat.message',
                  payload: message,
                });
              }),
            );
          }
        }
        if (channels.includes('arena-room')) {
          unsubscribers.push(
            subscribeArenaRoomChanges(reservation.userId, (payload) => {
              sendEnvelope(ws, {
                type: 'arena-room.changed',
                payload,
              });
            }),
          );
        }

        heartbeat = setInterval(() => {
          const timeSinceLastClientActivity = Date.now() - lastClientActivityAt;
          if (timeSinceLastClientActivity > HEARTBEAT_TIMEOUT_MS) {
            closeConnection(
              ws,
              HEARTBEAT_TIMEOUT_CLOSE_CODE,
              HEARTBEAT_TIMEOUT_CLOSE_REASON,
            );
            return;
          }
          if (cultivatorId) recordRealtimeConnectionHeartbeat(cultivatorId);
          sendEnvelope(ws, {
            type: 'ping',
            payload: { serverTime: new Date().toISOString() },
          });
        }, HEARTBEAT_INTERVAL_MS);
        sendEnvelope(ws, {
          type: 'ready',
          payload: { cultivatorId, channels, resourceScopes },
        });
      },
      onMessage(event, ws) {
        const raw = event.data;
        if (typeof raw !== 'string' || raw.length > MAX_MESSAGE_BYTES) {
          closeConnection(ws, 1_003, 'invalid client message');
          return;
        }

        // Any bounded client frame proves that this connection is still alive.
        lastClientActivityAt = Date.now();
      },
      onClose() {
        cleanup();
      },
    };
  }),
);

export default router;
