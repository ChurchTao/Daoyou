export type WorldChatChannel = 'world';

export type WorldChatMessageType = 'text' | 'duel_invite' | 'item_showcase';

export interface WorldChatTextPayload {
  text: string;
}

export interface WorldChatDuelInvitePayload {
  targetCultivatorId?: string;
  wager?: {
    spiritStones?: number;
  };
  expiresAt?: string;
}

export interface WorldChatItemShowcasePayload {
  itemType: 'artifact' | 'consumable' | 'skill' | 'technique';
  itemId: string;
  snapshot?: Record<string, unknown>;
}

export interface WorldChatPayloadMap {
  text: WorldChatTextPayload;
  duel_invite: WorldChatDuelInvitePayload;
  item_showcase: WorldChatItemShowcasePayload;
}

export type WorldChatPayload = WorldChatPayloadMap[WorldChatMessageType];

export interface WorldChatMessageDTO {
  id: string;
  channel: WorldChatChannel;
  senderUserId: string;
  senderCultivatorId: string | null;
  senderName: string;
  senderRealm: string;
  senderRealmStage: string;
  messageType: WorldChatMessageType;
  textContent: string | null;
  payload: WorldChatPayload;
  status: 'active' | 'hidden' | 'deleted';
  createdAt: string;
}
