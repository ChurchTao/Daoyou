import type { PlayerStateEvent } from '@shared/contracts/player';
import type { WorldChatMessageDTO } from '@shared/types/world-chat';

export const REALTIME_CHANNELS = ['world-chat', 'player-state'] as const;

export type RealtimeChannel = (typeof REALTIME_CHANNELS)[number];

export type RealtimePlayerStatePayload = {
  events?: PlayerStateEvent[];
  requiresSnapshot?: boolean;
};

export type RealtimeServerEvent =
  | {
      type: 'ready';
      payload: {
        cultivatorId: string;
        channels: RealtimeChannel[];
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
