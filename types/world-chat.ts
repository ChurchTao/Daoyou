import type { Artifact, Consumable, Material } from './cultivator';

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

export type WorldChatShowcaseItemType = 'artifact' | 'material' | 'consumable';

export type ItemShowcaseSnapshotMap = {
  artifact: Pick<
    Artifact,
    | 'id'
    | 'name'
    | 'slot'
    | 'element'
    | 'quality'
    | 'required_realm'
    | 'description'
    | 'effects'
  >;
  material: Pick<
    Material,
    'id' | 'name' | 'type' | 'rank' | 'element' | 'description' | 'quantity'
  >;
  consumable: Pick<
    Consumable,
    'id' | 'name' | 'type' | 'quality' | 'effects' | 'quantity' | 'description'
  >;
};

export type ItemShowcaseSnapshot =
  ItemShowcaseSnapshotMap[WorldChatShowcaseItemType];

export interface WorldChatItemShowcasePayload {
  itemType: WorldChatShowcaseItemType;
  itemId: string;
  snapshot: ItemShowcaseSnapshot;
  text?: string;
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
