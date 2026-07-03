import type { PlayerStateEvent } from '@shared/contracts/player';
import type { WorldChatMessageDTO } from '@shared/types/world-chat';

export type RealtimePlayerStatePayload = {
  events?: PlayerStateEvent[];
  requiresSnapshot?: boolean;
};

export type RealtimeServerEvent =
  | {
      type: 'ready';
      payload: {
        cultivatorId: string;
      };
    }
  | {
      type: 'world-chat.message';
      payload: WorldChatMessageDTO;
    }
  | {
      type: 'player-state.events';
      payload: RealtimePlayerStatePayload;
    }
  | {
      type: 'ping';
      payload: {
        serverTime: string;
      };
    };

export type RealtimeServerEventType = RealtimeServerEvent['type'];

export type RealtimeClientEvent = {
  type: 'pong';
};
