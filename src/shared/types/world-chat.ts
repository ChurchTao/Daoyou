import type { BeastTradePreview } from '../contracts/beastTrade';
import type { InventoryShowcaseSnapshot } from '../items/showcase';
import type { BattleRecordUnitSummary } from './battle';

export type WorldChatMessageChannel = 'system' | 'world' | 'sect';

export type WorldChatChannel = WorldChatMessageChannel;

export type WorldChatMessageType =
  'text' | 'item_showcase' | 'beast_showcase' | 'battle_showcase';

export interface WorldChatTextPayload {
  text: string;
}

export interface WorldChatItemShowcasePayload {
  version: 1;
  snapshot: InventoryShowcaseSnapshot;
  text?: string;
}

export interface WorldChatBeastShowcasePayload {
  version: 1;
  beast: BeastTradePreview;
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
  beast_showcase: WorldChatBeastShowcasePayload;
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
