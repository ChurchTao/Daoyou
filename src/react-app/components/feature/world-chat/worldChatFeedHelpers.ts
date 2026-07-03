import type {
  WorldChatChannel,
  WorldChatMessageDTO,
} from '@shared/types/world-chat';

export const PAGE_SIZE = 20;
export const POLL_INTERVAL_MS = 15 * 1000;

export function mergeWorldChatMessages(
  base: WorldChatMessageDTO[],
  incoming: WorldChatMessageDTO[],
) {
  const seen = new Set<string>();
  const merged = [...incoming, ...base].filter((item) => {
    if (seen.has(item.id)) return false;
    seen.add(item.id);
    return true;
  });

  return merged.sort((a, b) => +new Date(b.createdAt) - +new Date(a.createdAt));
}

export function countNewWorldChatMessages(
  messages: WorldChatMessageDTO[],
  lastSeenMessageId: string | null,
) {
  if (!lastSeenMessageId || messages.length === 0) {
    return 0;
  }

  const seenIndex = messages.findIndex(
    (message) => message.id === lastSeenMessageId,
  );
  if (seenIndex <= 0) {
    return 0;
  }

  return seenIndex;
}

export function filterWorldChatMessagesByChannel(
  messages: WorldChatMessageDTO[],
  channel: WorldChatChannel,
) {
  if (channel === 'all') {
    return messages;
  }

  return messages.filter((message) => message.channel === channel);
}
