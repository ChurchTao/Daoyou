import type {
  WorldChatChannel,
  WorldChatMessageDTO,
} from '@shared/types/world-chat';
import { createContext } from 'react';

export interface SendWorldChatShowcaseInput {
  revision: number;
  itemId: string;
  textContent?: string;
}

export interface WorldChatFeedModel {
  messages: WorldChatMessageDTO[];
  latestMessage: WorldChatMessageDTO | null;
  newMessageCount: number;
  unreadCounts: Record<WorldChatChannel, number>;
  loading: boolean;
  loadingMore: boolean;
  hasMore: boolean;
  posting: boolean;
  hasSect: boolean;
  isWorldChatRoute: boolean;
  activeChannel: WorldChatChannel;
  setActiveChannel: (channel: WorldChatChannel) => void;
  loadMore: () => Promise<void>;
  sendTextMessage: (text: string) => Promise<boolean>;
  sendShowcaseMessage: (input: SendWorldChatShowcaseInput) => Promise<boolean>;
}

export const WorldChatFeedContext = createContext<WorldChatFeedModel | null>(
  null,
);
