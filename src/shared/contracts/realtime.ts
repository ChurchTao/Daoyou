import type { ResourceChange } from '@shared/contracts/resources';
import type { ResourceScope } from '@shared/contracts/resources';
import type { ArenaRoomStatusV1, ArenaRoomV1 } from '@shared/contracts/arena';
import type { WorldChatMessageDTO } from '@shared/types/world-chat';

export const REALTIME_CHANNELS = [
  'world-chat',
  'player-state',
  'arena-room',
] as const;

export type RealtimeChannel = (typeof REALTIME_CHANNELS)[number];

export type RealtimePlayerStatePayload = {
  changes: ResourceChange[];
};

export type ArenaRoomChangedPayloadV1 = {
  roomId: string;
  revision: number;
  status: ArenaRoomStatusV1;
  /** Full Redis-authoritative room snapshot when the room still exists. */
  room?: ArenaRoomV1;
};

export type RealtimeServerEvent =
  | {
      type: 'ready';
      payload: {
        cultivatorId: string | null;
        channels: RealtimeChannel[];
        resourceScopes: ResourceScope[];
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
      type: 'arena-room.changed';
      payload: ArenaRoomChangedPayloadV1;
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
