import type { INestApplicationContext } from '@nestjs/common';
import { WsAdapter } from '@nestjs/platform-ws';
import { fromNodeHeaders } from 'better-auth/node';
import {
  createServer,
  STATUS_CODES,
  type IncomingMessage,
  type Server,
} from 'node:http';
import type { Duplex } from 'node:stream';
import type { ServerOptions, WebSocketServer } from 'ws';
import { ArenaRealtimeService } from '../arena/arena-realtime.service.js';
import { ARENA_SOCKET_PATH, arenaSocketRoute } from '../arena/arena-socket.js';
import { RequestWorkService } from '../http/request-work.service.js';
import {
  verifyWebSocketRequest,
  type HandshakeError,
} from '../http/websocket-request.js';
import { RealtimeService } from './realtime.service.js';

export class RealtimeAdapter extends WsAdapter {
  private readonly handshakeHeaders = new WeakMap<IncomingMessage, Headers>();
  private readonly upgradeListeners = new Map<
    number,
    (request: IncomingMessage, socket: Duplex, head: Buffer) => void
  >();

  constructor(
    app: INestApplicationContext,
    private readonly realtime: RealtimeService,
    private readonly arena: ArenaRealtimeService,
    private readonly work: RequestWorkService,
  ) {
    super(app);
  }

  override create(
    port: number,
    options: ServerOptions & { path?: string } = {},
  ): WebSocketServer {
    const service =
      options.path === ARENA_SOCKET_PATH ? this.arena : this.realtime;
    const verifyClient: ServerOptions['verifyClient'] = (info, callback) => {
      const done = this.work.begin();
      let headers = new Headers();
      const reject = (result: HandshakeError) => {
        const body = JSON.stringify(
          result.body ?? { success: false, error: result.message },
        );
        headers.set('Content-Type', 'application/json; charset=utf-8');
        headers.set('Content-Length', String(Buffer.byteLength(body)));
        headers.set('Connection', 'close');
        const lines: string[] = [];
        headers.forEach((value, key) => {
          if (key !== 'set-cookie') lines.push(`${key}: ${value}`);
        });
        for (const cookie of headers.getSetCookie())
          lines.push(`Set-Cookie: ${cookie}`);
        // ws's rejection callback joins array headers with commas. Serialize
        // validated Headers here so renewed cookies remain separate fields.
        const socket = info.req.socket;
        socket.once('finish', () => socket.destroy());
        socket.end(
          `HTTP/1.1 ${result.status} ${STATUS_CODES[result.status]}\r\n${lines.join('\r\n')}\r\n\r\n${body}`,
        );
      };
      const verify = async () => {
        const admission = await verifyWebSocketRequest(
          fromNodeHeaders(info.req.headers),
        );
        headers = admission.headers ?? headers;
        if ('status' in admission) return reject(admission);
        const result = await service.verify(info.req);
        result.headers?.forEach((value, key) => {
          if (key !== 'set-cookie') headers.set(key, value);
        });
        for (const cookie of result.headers?.getSetCookie() ?? [])
          headers.append('Set-Cookie', cookie);
        if ('status' in result) return reject(result);
        this.handshakeHeaders.set(info.req, headers);
        callback(true);
      };
      void verify()
        .catch((error: unknown) => {
          console.error('[realtime] handshake failed', error);
          reject({ status: 500, message: '服务器内部错误' });
        })
        .finally(done);
    };
    const server = super.create(port, {
      ...options,
      verifyClient,
    }) as WebSocketServer;
    server.on('headers', (headers, request) => {
      const responseHeaders = this.handshakeHeaders.get(request);
      this.handshakeHeaders.delete(request);
      responseHeaders?.forEach((value, key) => {
        if (key !== 'set-cookie') headers.push(`${key}: ${value}`);
      });
      for (const cookie of responseHeaders?.getSetCookie() ?? [])
        headers.push(`Set-Cookie: ${cookie}`);
    });
    return server;
  }

  // WsAdapter only matches literal paths. Keep a single upgrade listener for
  // both the general realtime channel and battle-specific participant/watch URLs.
  protected override ensureHttpServerExists(
    port: number,
    httpServer: Server = createServer(),
  ): Server | undefined {
    if (this.httpServersRegistry.has(port)) return;
    this.httpServersRegistry.set(port, httpServer);
    const listener = (
      request: IncomingMessage,
      socket: Duplex,
      head: Buffer,
    ) => {
      try {
        const pathname = new URL(request.url ?? '/', 'http://localhost')
          .pathname;
        const server = (
          this.wsServersRegistry.get(port) as
            (WebSocketServer & { path: string })[] | undefined
        )?.find((candidate) =>
          candidate.path === ARENA_SOCKET_PATH
            ? arenaSocketRoute(pathname) !== null
            : pathname === candidate.path,
        );
        if (!server) {
          socket.destroy();
          return;
        }
        server.handleUpgrade(request, socket, head, (ws) =>
          server.emit('connection', ws, request),
        );
      } catch {
        socket.end(
          'HTTP/1.1 400 Bad Request\r\nConnection: close\r\nContent-Length: 0\r\n\r\n',
        );
      }
    };
    httpServer.on('upgrade', listener);
    this.upgradeListeners.set(port, listener);
    return httpServer;
  }

  override async dispose(): Promise<void> {
    for (const [port, listener] of this.upgradeListeners)
      this.httpServersRegistry.get(port)?.off('upgrade', listener);
    this.upgradeListeners.clear();
    await super.dispose();
  }
}
