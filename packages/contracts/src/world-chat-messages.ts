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
  'red_packet',
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

export interface RedPacketSummary {
  id: string;
  amount: number;
  count: number;
  remainingCount: number;
  mode: 'random' | 'equal';
  greeting: string;
  expiresAt: string;
  status: 'open' | 'exhausted' | 'expired';
  revision: number;
  refundStatus: 'none' | 'pending' | 'refunded';
  refundAmount: number;
}

export type RedPacketMode = RedPacketSummary['mode'];
export type RedPacketCreateInput = {
  amount: number;
  count: number;
  mode: RedPacketMode;
  greeting: string;
  clientMessageId: string;
};

export interface RedPacketClaimDTO {
  amount: number;
  claimedAt: string;
}

export interface RedPacketDetails {
  packet: RedPacketSummary;
  isSender: boolean;
  myClaim: RedPacketClaimDTO | null;
  claims: (RedPacketClaimDTO & { senderName: string })[];
}

export type RedPacketDetail = RedPacketDetails;
export type RedPacketClaim = RedPacketClaimDTO;

export interface WorldChatReply {
  messageId: string;
  senderName: string;
  messageType: WorldChatMessageType;
  summary: string;
  availability: 'available' | 'expired' | 'hidden';
}

export interface WorldChatPagination {
  beforeCursor: string | null;
  afterCursor: string | null;
  hasMore: boolean;
  hasMoreBefore?: boolean;
  hasMoreAfter?: boolean;
}

export interface WorldChatPayloadMap {
  hunt_rumor: { text: string; eventId: string; nodeId: string };
  text: WorldChatTextPayload;
  item_showcase: WorldChatItemShowcasePayload;
  beast_showcase: WorldChatBeastShowcasePayload;
  combat_v6_replay: WorldChatCombatV6ReplayPayload;
  hunt_recruit: WorldChatHuntRecruitPayload;
  red_packet: { version: 1; packet: RedPacketSummary };
}

export type WorldChatPayload = WorldChatPayloadMap[WorldChatMessageType];

export interface WorldChatMessageDTO {
  id: string;
  sequence: number;
  clientMessageId: string | null;
  reply: WorldChatReply | null;
  channel: WorldChatMessageChannel;
  sectId: string | null;
  senderUserId: string;
  senderCultivatorId: string | null;
  senderName: string;
  senderRealm: string;
  senderRealmStage: string;
  senderTitle?: string | null;
  messageType: WorldChatMessageType;
  textContent: string | null;
  payload: WorldChatPayload;
  status: 'active' | 'hidden' | 'deleted';
  createdAt: string;
}
