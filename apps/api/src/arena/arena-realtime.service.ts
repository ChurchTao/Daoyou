import { Inject, Injectable, type OnModuleDestroy } from '@nestjs/common';
import type { ActiveCultivatorRef } from '@server/lib/auth/types.js';
import { isAllowedRealtimeOrigin } from '@server/lib/http/realtimeOrigin.js';
import {
  arenaSocketState,
  subscribeArenaSpectators,
  subscribeArenaV6,
} from '@server/combat/application/CombatV6ArenaBroadcast.js';
import {
  ArenaV6Error,
  ownedArenaV6,
  watchedArenaV6,
} from '@server/combat/application/CombatV6ArenaService.js';
import { CombatV6ArenaStore } from '@server/combat/application/CombatV6ArenaStore.js';
import { fromNodeHeaders } from 'better-auth/node';
import type { IncomingMessage } from 'node:http';
import { WebSocket } from 'ws';
import { z } from 'zod';
import { SessionService } from '../auth/session.service.js';
import type { HandshakeError } from '../http/websocket-request.js';
import { arenaSocketRoute } from './arena-socket.js';

type ArenaConnection = {
  actor: ActiveCultivatorRef;
  battleId: string;
  spectator: boolean;
};

@Injectable()
export class ArenaRealtimeService implements OnModuleDestroy {
  private readonly pending = new WeakMap<IncomingMessage, ArenaConnection>();
  private readonly counts = new Map<string, number>();
  private readonly connections = new Map<WebSocket, () => void>();
  private readonly work = new Set<Promise<unknown>>();
  private stopping = false;

  constructor(
    @Inject(SessionService) private readonly sessions: SessionService,
    @Inject(CombatV6ArenaStore) private readonly store: CombatV6ArenaStore,
  ) {}

  private track<T>(promise: Promise<T>): Promise<T> {
    this.work.add(promise);
    void promise.then(
      () => this.work.delete(promise),
      () => this.work.delete(promise),
    );
    return promise;
  }

  verify(
    request: IncomingMessage,
  ): Promise<
    HandshakeError | { connection: ArenaConnection; headers?: Headers }
  > {
    return this.track(this.verifyConnection(request));
  }

  private async verifyConnection(
    request: IncomingMessage,
  ): Promise<
    HandshakeError | { connection: ArenaConnection; headers?: Headers }
  > {
    if (this.stopping) return { status: 503, message: 'Server closing' };
    const headers = fromNodeHeaders(request.headers);
    let responseHeaders: Headers | undefined;
    try {
      const session = await this.sessions.getSession(headers);
      responseHeaders = session.headers;
      const user = session.response?.user;
      if (!user)
        return { status: 401, message: '未授权访问', headers: responseHeaders };
      const actor = await this.sessions.getActiveCultivator(user);
      if (!actor)
        return {
          status: 404,
          message: '当前没有活跃角色',
          headers: responseHeaders,
        };
      if (!isAllowedRealtimeOrigin(headers.get('origin')))
        return {
          status: 403,
          message: 'Origin forbidden',
          body: { error: 'Origin forbidden' },
          headers: responseHeaders,
        };
      const route = arenaSocketRoute(
        new URL(request.url ?? '/', 'http://localhost').pathname,
      );
      if (!route)
        return { status: 404, message: '接口不存在', headers: responseHeaders };
      const battleId = z.uuid().parse(route.battleId);
      await (route.spectator ? watchedArenaV6 : ownedArenaV6)(battleId, actor);
      if (this.stopping || request.socket.destroyed)
        return { status: 503, message: 'Connection closed' };
      const connection = {
        actor,
        battleId,
        spectator: route.spectator,
      };
      this.pending.set(request, connection);
      return { connection, headers: responseHeaders };
    } catch (error) {
      if (error instanceof ArenaV6Error)
        return {
          status: error.status,
          message: error.message,
          headers: responseHeaders,
        };
      if (error instanceof z.ZodError)
        return {
          status: 400,
          message: '请求参数无效',
          headers: responseHeaders,
        };
      console.error('[arena-v6] handshake failed', error);
      return {
        status: 500,
        message: '战斗请求失败，请刷新重试',
        headers: responseHeaders,
      };
    }
  }

  connect(socket: WebSocket, request: IncomingMessage): void {
    const identity = this.pending.get(request);
    this.pending.delete(request);
    if (!identity || this.stopping) {
      socket.close(1011, 'reconnect');
      return;
    }
    const { actor, battleId: id, spectator } = identity;
    if ((this.counts.get(actor.userId) ?? 0) >= 4) {
      socket.close(1008, 'too many connections');
      return;
    }
    this.counts.set(actor.userId, (this.counts.get(actor.userId) ?? 0) + 1);
    const connection = crypto.randomUUID();
    const authorize = spectator ? watchedArenaV6 : ownedArenaV6;
    let viewerId: string | undefined;
    let dispose: (() => void) | undefined;
    let heartbeat: ReturnType<typeof setInterval> | undefined;
    let closed = false;
    let lastPong = Date.now();
    let lastRevision = -1;
    let chain = Promise.resolve();
    const cleanup = () => {
      if (closed) return;
      closed = true;
      this.connections.delete(socket);
      const count = (this.counts.get(actor.userId) ?? 1) - 1;
      if (count) this.counts.set(actor.userId, count);
      else this.counts.delete(actor.userId);
      clearInterval(heartbeat);
      dispose?.();
      if (viewerId && !spectator)
        void this.track(
          this.store.disconnect(`${id}:${viewerId}`, connection),
        ).catch((error) => console.warn('[arena-v6] disconnect failed', error));
    };
    const close = (code: number, reason: string) => {
      socket.close(code, reason);
      cleanup();
    };
    const send = (message: string) => {
      if (closed || socket.readyState !== WebSocket.OPEN) return;
      if (socket.bufferedAmount > (spectator ? 512000 : 1_048_576)) {
        close(4001, 'slow consumer');
        return;
      }
      socket.send(message, (error) => {
        if (error) close(1011, 'reconnect');
      });
    };
    const enqueue = (action: () => Promise<void>) => {
      chain = this.track(
        chain
          .then(async () => {
            if (!closed) await action();
          })
          .catch(() => {
            if (!closed) close(1011, 'reconnect');
          }),
      );
    };
    this.connections.set(socket, cleanup);
    socket.once('close', cleanup);
    socket.once('error', cleanup);
    socket.on('message', (data, binary) => {
      if (closed) return;
      const message = data.toString();
      if (binary || message.length > 128) {
        close(1008, 'invalid message');
        return;
      }
      if (message === 'pong') {
        lastPong = Date.now();
        if (viewerId && !spectator) {
          const key = `${id}:${viewerId}`;
          void this.track(
            this.store.touch(key, connection).then(async () => {
              if (closed) await this.store.disconnect(key, connection);
            }),
          ).catch(() => close(1011, 'reconnect'));
        }
      }
    });
    const open = async () => {
      const owned = await authorize(id, actor);
      viewerId = owned.participant.unitId;
      if (closed) return;
      dispose = spectator
        ? await subscribeArenaSpectators(id, {
            ...actor,
            send,
            close: () => close(1008, 'spectator access ended'),
          })
        : await subscribeArenaV6(id, () =>
            enqueue(async () => {
              const { runtime } = await authorize(id, actor);
              if (runtime.revision <= lastRevision) return;
              lastRevision = runtime.revision;
              send(JSON.stringify(arenaSocketState(runtime, viewerId!)));
            }),
          );
      if (closed) {
        dispose();
        return;
      }
      if (!spectator) await this.store.touch(`${id}:${viewerId}`, connection);
      if (closed) {
        if (!spectator)
          await this.store.disconnect(`${id}:${viewerId}`, connection);
        return;
      }
      send(JSON.stringify({ type: 'ready', serverNow: Date.now() }));
      if (closed) return;
      heartbeat = setInterval(() => {
        if (Date.now() - lastPong > 50000) {
          close(4000, 'heartbeat timeout');
          return;
        }
        send(JSON.stringify({ type: 'ping', serverNow: Date.now() }));
        enqueue(async () => {
          const { runtime } = await authorize(id, actor);
          send(JSON.stringify({ type: 'resync', revision: runtime.revision }));
        });
      }, 25000);
    };
    void this.track(open().catch(() => close(1011, 'reconnect')));
  }

  async onModuleDestroy(): Promise<void> {
    this.stopping = true;
    for (const [socket, cleanup] of this.connections) {
      cleanup();
      socket.terminate();
    }
    while (this.work.size) await Promise.allSettled([...this.work]);
  }
}
