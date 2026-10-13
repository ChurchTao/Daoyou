import type {
  RedPacketSummary,
  WorldChatChannel,
  WorldChatMessageDTO,
} from '@daoyou/contracts/world-chat';
import { createContext } from 'react';

export type SendWorldChatShowcaseInput =
  | {
      revision: number;
      itemId: string;
      textContent?: string;
      replyToMessageId?: string;
    }
  | {
      revision: number;
      beastId: string;
      textContent?: string;
      replyToMessageId?: string;
    };

export interface PendingWorldChatMessage {
  clientMessageId: string;
  text: string;
  replyToMessageId?: string;
  status: 'sending' | 'failed';
  error?: string;
}

export interface SendRedPacketInput {
  amount: number;
  count: number;
  mode: 'random' | 'equal';
  greeting: string;
  clientMessageId: string;
}

export interface WorldChatFeedModel {
  messages: WorldChatMessageDTO[];
  latestMessage: WorldChatMessageDTO | null;
  newMessageCount: number;
  unreadCounts: Record<WorldChatChannel, number>;
  loading: boolean;
  loadingMore: boolean;
  hasMore: boolean;
  hasNewer: boolean;
  loadingNewer: boolean;
  loadError: string | null;
  cooldownRemaining: number;
  pendingMessages: PendingWorldChatMessage[];
  posting: boolean;
  hasSect: boolean;
  isWorldChatRoute: boolean;
  activeChannel: WorldChatChannel;
  setActiveChannel: (channel: WorldChatChannel) => void;
  loadMore: () => Promise<void>;
  loadNewer: () => Promise<void>;
  locateMessage: (id: string) => Promise<boolean>;
  returnToLatest: () => Promise<void>;
  markVisible: (id: string) => void;
  retryMessage: (clientMessageId: string) => Promise<boolean>;
  sendTextMessage: (
    text: string,
    replyToMessageId?: string,
  ) => Promise<boolean>;
  sendShowcaseMessage: (input: SendWorldChatShowcaseInput) => Promise<boolean>;
  sendRedPacket: (input: SendRedPacketInput) => Promise<boolean>;
  refreshRedPacket: (packet: RedPacketSummary) => void;
  pendingRedPacket: SendRedPacketInput | null;
  redPacketOutcome: 'idle' | 'confirming' | 'unknown';
}

export const WorldChatFeedContext = createContext<WorldChatFeedModel | null>(
  null,
);
