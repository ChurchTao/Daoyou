import { Inject } from '@nestjs/common';
import { WebSocketGateway, type OnGatewayConnection } from '@nestjs/websockets';
import type { IncomingMessage } from 'node:http';
import type { WebSocket } from 'ws';
import { RealtimeService } from './realtime.service.js';

@WebSocketGateway({ path: '/api/realtime', maxPayload: 2048 })
export class RealtimeGateway implements OnGatewayConnection {
  constructor(
    @Inject(RealtimeService) private readonly realtime: RealtimeService,
  ) {}

  handleConnection(socket: WebSocket, request: IncomingMessage): void {
    this.realtime.connect(socket, request);
  }
}
