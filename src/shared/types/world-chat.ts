import type { BattleRecordUnitSummary } from './battle';
import type { ElementType, Quality } from './constants';
import type { Artifact, Consumable, Material } from './cultivator';

export type WorldChatMessageChannel = 'system' | 'world' | 'sect';

export type WorldChatChannel = WorldChatMessageChannel;

export type WorldChatMessageType = 'text' | 'item_showcase' | 'battle_showcase';

export interface WorldChatTextPayload {
  text: string;
}

export type WorldChatShowcaseItemType =
  'artifact' | 'material' | 'consumable' | 'skill' | 'gongfa';

export type ItemShowcaseSnapshotMap = {
  artifact: Pick<
    Artifact,
    | 'id'
    | 'name'
    | 'slot'
    | 'element'
    | 'quality'
    | 'description'
    | 'productModel'
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

export interface WorldChatBattleShowcasePayload {
  shareCode: string;
  winner: BattleRecordUnitSummary;
  loser: BattleRecordUnitSummary;
  turns: number;
  battleCreatedAt: string;
  text?: string;
}

export interface WorldChatPayloadMap {
  text: WorldChatTextPayload;
  item_showcase: WorldChatItemShowcasePayload;
  battle_showcase: WorldChatBattleShowcasePayload;
}

export type WorldChatPayload = WorldChatPayloadMap[WorldChatMessageType];

export interface WorldChatMessageDTO {
  id: string;
  channel: WorldChatMessageChannel;
  sectId: string | null;
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
