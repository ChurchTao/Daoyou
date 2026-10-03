import {
  REALTIME_CHANNELS,
  type RealtimeChannel,
  type RealtimeServerEvent,
} from '@daoyou/shared/contracts/realtime';
import type { ResourceScope } from '@daoyou/shared/contracts/resources';
import { Inject, Injectable } from '@nestjs/common';
import { DRIZZLE_DATABASE } from '@server/database/database.service.js';
import type { DbClient } from '@server/lib/drizzle/db.js';
import { cultivators, sectMemberships } from '@server/lib/drizzle/schema.js';
import { isAllowedRealtimeOrigin } from '@server/lib/http/realtimeOrigin.js';
import { getRequestIp } from '@server/lib/http/requestIp.js';
import { subscribeArenaRoomChanges } from '@server/realtime/infrastructure/arenaRoomBroadcaster.js';
import {
  recordRealtimeConnectionClose,
  recordRealtimeConnectionHeartbeat,
  recordRealtimeConnectionOpen,
} from '@server/realtime/infrastructure/onlinePresenceService.js';
import { subscribeResourceEvents } from '@server/realtime/infrastructure/playerStateBroadcaster.js';
import { subscribeSectChatMessages } from '@server/realtime/infrastructure/sectChatBroadcaster.js';
import { subscribeWorldChatMessages } from '@server/realtime/infrastructure/worldChatBroadcaster.js';
import { fromNodeHeaders } from 'better-auth/node';
import { and, eq } from 'drizzle-orm';
import type { IncomingMessage } from 'node:http';
import { WebSocket } from 'ws';
import { SessionService } from '../auth/session.service.js';

type Reservation = {
  userId: string;
  cultivatorId: string | null;
  sectId: string | null;
  release: () => void;
};

type Verification = (
  { status: number; message: string } | { reservation: Reservation }
) & { headers?: Headers };

@Injectable()
export class RealtimeService {
  private readonly users = new Map<string, number>();
  private readonly cultivators = new Map<string, number>();
  private readonly ips = new Map<string, number>();
  private readonly pending = new WeakMap<IncomingMessage, Reservation>();

  constructor(
    @Inject(DRIZZLE_DATABASE) private readonly database: DbClient,
    @Inject(SessionService) private readonly sessions: SessionService,
  ) {}

  async verify(request: IncomingMessage): Promise<Verification> {
    const headers = fromNodeHeaders(request.headers);
    const result = await this.reserveConnection(headers);
    if ('status' in result) return result;
    const { reservation } = result;
    if (request.socket.destroyed) {
      reservation.release();
      return { status: 400, message: 'Connection closed' };
    }
    this.pending.set(request, reservation);
    request.socket.once('close', reservation.release);
    return result;
  }

  // HTTP fallback and upgrades share identity and quota checks. HTTP has already
  // passed the API admission middleware and must not count that rate limit twice.
  async reserveConnection(headers: Headers): Promise<Verification> {
    if (!isAllowedRealtimeOrigin(headers.get('origin')))
      return { status: 403, message: 'Forbidden origin' };
    const session = await this.sessions.getSession(headers);
    const user = session.response?.user;
    if (!user)
      return { status: 401, message: '未授权访问', headers: session.headers };
    const active = await this.database.query.cultivators.findFirst({
      columns: { id: true },
      where: and(
        eq(cultivators.userId, user.id),
        eq(cultivators.status, 'active'),
      ),
    });
    const sect = active
      ? await this.database.query.sectMemberships.findFirst({
          columns: { sectId: true },
          where: and(
            eq(sectMemberships.cultivatorId, active.id),
            eq(sectMemberships.status, 'active'),
          ),
        })
      : undefined;
    const counters: [Map<string, number>, string, number][] = [
      [this.users, user.id, 3],
      [this.ips, getRequestIp(headers) ?? 'unknown', 40],
      ...(active
        ? [
            [this.cultivators, active.id, 3] as [
              Map<string, number>,
              string,
              number,
            ],
          ]
        : []),
    ];
    if (counters.some(([map, key, max]) => (map.get(key) ?? 0) >= max)) {
      return { status: 429, message: '实时连接过多', headers: session.headers };
    }
    for (const [map, key] of counters) map.set(key, (map.get(key) ?? 0) + 1);
    let released = false;
    const reservation: Reservation = {
      userId: user.id,
      cultivatorId: active?.id ?? null,
      sectId: sect?.sectId ?? null,
      release: () => {
        if (released) return;
        released = true;
        for (const [map, key] of counters) {
          const next = (map.get(key) ?? 0) - 1;
          if (next <= 0) map.delete(key);
          else map.set(key, next);
        }
      },
    };
    return { reservation, headers: session.headers };
  }

  connect(socket: WebSocket, request: IncomingMessage): void {
    const reservation = this.pending.get(request);
    this.pending.delete(request);
    if (!reservation) {
      socket.close(1011, 'Missing connection identity');
      return;
    }
    const rawChannels = new URL(
      request.url ?? '/',
      'http://localhost',
    ).searchParams.get('channels');
    const selected =
      rawChannels
        ?.split(',')
        .map((value) => value.trim())
        .filter((value): value is RealtimeChannel =>
          REALTIME_CHANNELS.some((channel) => channel === value),
        ) ?? [];
    const channels = selected.length
      ? [...new Set(selected)]
      : [...REALTIME_CHANNELS];
    const { cultivatorId } = reservation;
    const resourceScopes: ResourceScope[] = [
      { kind: 'account', id: reservation.userId },
      ...(cultivatorId
        ? [{ kind: 'cultivator', id: cultivatorId } as const]
        : []),
      ...(reservation.sectId
        ? [{ kind: 'sect', id: reservation.sectId } as const]
        : []),
    ];
    let lastActivityAt = Date.now();
    let closed = false;
    let heartbeat: ReturnType<typeof setInterval> | undefined;
    const unsubscribers: (() => void)[] = [];
    const cleanup = () => {
      if (closed) return;
      closed = true;
      if (heartbeat) clearInterval(heartbeat);
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
    const close = (code: number, reason: string) => {
      socket.close(code, reason);
      cleanup();
    };
    const send = (event: RealtimeServerEvent) => {
      if (closed || socket.readyState !== WebSocket.OPEN) return;
      if (socket.bufferedAmount > 1_048_576) {
        close(1013, 'backpressure limit');
        return;
      }
      socket.send(JSON.stringify(event), (error) => {
        if (error) {
          cleanup();
          socket.terminate();
        }
      });
    };
    socket.once('close', cleanup);
    socket.once('error', cleanup);
    socket.on('message', (data, binary) => {
      if (binary || data.toString().length > 512) {
        close(1003, 'invalid client message');
        return;
      }
      lastActivityAt = Date.now();
    });
    if (cultivatorId) recordRealtimeConnectionOpen(cultivatorId);
    try {
      if (channels.includes('player-state')) {
        unsubscribers.push(
          subscribeResourceEvents(resourceScopes, (changes) =>
            send({ type: 'player-state.events', payload: { changes } }),
          ),
        );
      }
      if (channels.includes('world-chat')) {
        unsubscribers.push(
          subscribeWorldChatMessages((message) =>
            send({ type: 'world-chat.message', payload: message }),
          ),
        );
        if (reservation.sectId) {
          unsubscribers.push(
            subscribeSectChatMessages(reservation.sectId, (message) =>
              send({ type: 'world-chat.message', payload: message }),
            ),
          );
        }
      }
      if (channels.includes('arena-room')) {
        unsubscribers.push(
          subscribeArenaRoomChanges(reservation.userId, (payload) =>
            send({ type: 'arena-room.changed', payload }),
          ),
        );
      }
      heartbeat = setInterval(() => {
        if (Date.now() - lastActivityAt > 50_000) {
          close(4000, 'heartbeat timeout');
          return;
        }
        if (cultivatorId) recordRealtimeConnectionHeartbeat(cultivatorId);
        send({
          type: 'ping',
          payload: { serverTime: new Date().toISOString() },
        });
      }, 25_000);
      send({
        type: 'ready',
        payload: { cultivatorId, channels, resourceScopes },
      });
    } catch (error) {
      console.error('[realtime] connection setup failed', error);
      close(1011, 'Connection setup failed');
    }
  }
}
