import type {
  Artifact,
  Consumable,
  Material,
} from './cultivator';
import type { ElementType, Quality } from './constants';

export type WorldChatChannel = 'world';

export type WorldChatMessageType = 'text' | 'duel_invite' | 'item_showcase';

export interface WorldChatTextPayload {
  text: string;
}

export interface WorldChatDuelInvitePayload {
  battleId?: string;
  routePath?: string;
  targetCultivatorId?: string;
  taunt?: string;
  wager?: {
    spiritStones?: number;
  };
  expiresAt?: string;
}

export type WorldChatShowcaseItemType =
  | 'artifact'
  | 'material'
  | 'consumable'
  | 'skill'
  | 'gongfa';

export type ItemShowcaseSnapshotMap = {
  artifact: Pick<
    Artifact,
    'id' | 'name' | 'slot' | 'element' | 'quality' | 'description' | 'productModel'
  >;
  material: Pick<
    Material,
    'id' | 'name' | 'type' | 'rank' | 'element' | 'description' | 'quantity'
  >;
  consumable: Pick<
    Consumable,
    'id' | 'name' | 'type' | 'quality' | 'quantity' | 'description' | 'spec'
  >;
  skill: {
    id: string;
    name: string;
    productType: 'skill';
    element: ElementType | null;
    quality: Quality | null;
    description: string | null;
    score: number;
    productModel: unknown;
  };
  gongfa: {
    id: string;
    name: string;
    productType: 'gongfa';
    element: ElementType | null;
    quality: Quality | null;
    description: string | null;
    score: number;
    productModel: unknown;
  };
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
