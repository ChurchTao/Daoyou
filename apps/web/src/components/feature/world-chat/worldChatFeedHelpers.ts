import type {
  WorldChatChannel,
  WorldChatMessageDTO,
} from '@daoyou/contracts/world-chat';

export const PAGE_SIZE = 30;
export const MAX_CHAT_WINDOW = 150;

export function mergeWorldChatMessages(
  base: WorldChatMessageDTO[],
  incoming: WorldChatMessageDTO[],
) {
  const merged = new Map(base.map((message) => [message.id, message]));
  for (const message of incoming) {
    const previous = merged.get(message.id);
    if (
      previous?.messageType === 'red_packet' &&
      message.messageType === 'red_packet' &&
      'packet' in previous.payload &&
      'packet' in message.payload &&
      previous.payload.packet.revision > message.payload.packet.revision
    ) {
      merged.set(message.id, { ...message, payload: previous.payload });
    } else merged.set(message.id, message);
  }

  return [...merged.values()].sort(
    (a, b) =>
      b.sequence - a.sequence ||
      +new Date(b.createdAt) - +new Date(a.createdAt) ||
      b.id.localeCompare(a.id),
  );
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
  if (seenIndex < 0) {
    return messages.length;
  }
  if (seenIndex === 0) {
    return 0;
  }

  return seenIndex;
}

export function filterWorldChatMessagesByChannel(
  messages: WorldChatMessageDTO[],
  channel: WorldChatChannel,
) {
  return messages.filter((message) => message.channel === channel);
}
