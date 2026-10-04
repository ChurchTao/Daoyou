import { useContext } from 'react';
import { WorldChatFeedProvider } from './WorldChatFeedProvider';
import { WorldChatFeedContext } from './worldChatFeedContext';
export type {
  SendWorldChatShowcaseInput,
  WorldChatFeedModel,
} from './worldChatFeedContext';
export {
  countNewWorldChatMessages,
  filterWorldChatMessagesByChannel,
  mergeWorldChatMessages,
} from './worldChatFeedHelpers';
export { WorldChatFeedProvider };

export function useWorldChatFeedModel() {
  const context = useContext(WorldChatFeedContext);

  if (!context) {
    throw new Error(
      'useWorldChatFeedModel 必须在 WorldChatFeedProvider 内使用',
    );
  }

  return context;
}
