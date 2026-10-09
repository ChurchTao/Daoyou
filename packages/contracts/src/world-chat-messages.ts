import type { BeastTradePreview } from '@daoyou/game-domain/beasts';
import type { InventoryShowcasePayload } from '@daoyou/game-domain/items/catalog';

export type WorldChatMessageChannel = 'system' | 'world' | 'sect';

export type WorldChatChannel = WorldChatMessageChannel;

export const WORLD_CHAT_MESSAGE_TYPES = [
  'hunt_rumor',
  'text',
  'item_showcase',
  'beast_showcase',
  'combat_v6_replay',
  'hunt_recruit',
] as const;
export type WorldChatMessageType = (typeof WORLD_CHAT_MESSAGE_TYPES)[number];

export interface WorldChatCombatV6ReplayPayload {
  version: 1;
  shareCode: string;
  sides: [string[], string[]];
  roundCount: number;
  text?: string;
}

export interface WorldChatTextPayload {
  text: string;
}

export type WorldChatItemShowcasePayload = InventoryShowcasePayload;

export interface WorldChatBeastShowcasePayload {
  version: 1;
  beast: BeastTradePreview;
  text?: string;
}

export interface WorldChatHuntRecruitPayload {
  version: 1;
  teamId: string;
  text: string;
  minRealm: string;
  maxRealm: string;
  memberCount: number;
  eventId?: string;
  targetLabel?: string;
}

export interface WorldChatPayloadMap {
  hunt_rumor: { text: string; eventId: string; nodeId: string };
  text: WorldChatTextPayload;
  item_showcase: WorldChatItemShowcasePayload;
  beast_showcase: WorldChatBeastShowcasePayload;
  combat_v6_replay: WorldChatCombatV6ReplayPayload;
  hunt_recruit: WorldChatHuntRecruitPayload;
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
