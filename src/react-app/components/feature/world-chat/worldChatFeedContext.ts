import type {
  WorldChatChannel,
  WorldChatMessageDTO,
  WorldChatShowcaseItemType,
} from '@shared/types/world-chat';
import { createContext } from 'react';

export interface SendWorldChatShowcaseInput {
  itemType: WorldChatShowcaseItemType;
  itemId: string;
  textContent?: string;
}

export interface WorldChatFeedModel {
  messages: WorldChatMessageDTO[];
  latestMessage: WorldChatMessageDTO | null;
  newMessageCount: number;
  loading: boolean;
  loadingMore: boolean;
  hasMore: boolean;
  posting: boolean;
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
