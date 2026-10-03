import { Inject } from '@nestjs/common';
import { WebSocketGateway, type OnGatewayConnection } from '@nestjs/websockets';
import type { IncomingMessage } from 'node:http';
import type { WebSocket } from 'ws';
import { ArenaRealtimeService } from './arena-realtime.service.js';
import { ARENA_SOCKET_PATH } from './arena-socket.js';

@WebSocketGateway({ path: ARENA_SOCKET_PATH, maxPayload: 2048 })
export class ArenaGateway implements OnGatewayConnection {
  constructor(
    @Inject(ArenaRealtimeService) private readonly arena: ArenaRealtimeService,
  ) {}
  handleConnection(socket: WebSocket, request: IncomingMessage): void {
    this.arena.connect(socket, request);
  }
}
