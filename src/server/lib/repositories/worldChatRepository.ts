import { redis } from '@server/lib/redis';
import type {
  WorldChatChannel,
  WorldChatMessageChannel,
  WorldChatMessageDTO,
  WorldChatMessageType,
  WorldChatPayload,
} from '@shared/types/world-chat';
import { randomUUID } from 'crypto';

const WORLD_CHAT_LIST_KEY = 'world_chat:messages';
const WORLD_CHAT_MAX_MESSAGES = 100;

type StoredWorldChatMessage = {
  id: string;
  channel?: WorldChatMessageChannel;
  senderUserId: string;
  senderCultivatorId: string | null;
  senderName: string;
  senderRealm: string;
  senderRealmStage: string;
  messageType: WorldChatMessageType;
  textContent: string | null;
  payload: WorldChatPayload;
  status: 'active';
  createdAt: string;
};

function resolveStoredChannel(
  message: Partial<StoredWorldChatMessage>,
): WorldChatMessageChannel {
  if (
    message.senderCultivatorId === null &&
    message.senderName === '修仙界传闻'
  ) {
    return 'system';
  }

  if (message.channel === 'system' || message.channel === 'world') {
    return message.channel;
  }

  return 'world';
}

function parseStoredMessage(raw: unknown): WorldChatMessageDTO | null {
  if (typeof raw === 'object' && raw !== null) {
    const parsed = raw as Partial<StoredWorldChatMessage>;
    if (
      typeof parsed.id === 'string' &&
      typeof parsed.senderName === 'string' &&
      typeof parsed.createdAt === 'string'
    ) {
      return {
        ...parsed,
        channel: resolveStoredChannel(parsed),
      } as WorldChatMessageDTO;
    }
    return null;
  }

  if (typeof raw === 'string') {
    try {
      const parsed = JSON.parse(raw) as StoredWorldChatMessage;
      if (!parsed || typeof parsed.id !== 'string') return null;
      return {
        ...parsed,
        channel: resolveStoredChannel(parsed),
      };
    } catch {
      return null;
    }
  }

  if (raw == null) {
    return null;
  }

  return null;
}

export async function createMessage(data: {
  senderUserId: string;
  senderCultivatorId: string | null;
  senderName: string;
  senderRealm: string;
  senderRealmStage: string;
  channel?: WorldChatMessageChannel;
  messageType: WorldChatMessageType;
  textContent?: string;
  payload: WorldChatPayload;
}): Promise<WorldChatMessageDTO> {
  const message: WorldChatMessageDTO = {
    id: randomUUID(),
    channel: data.channel ?? 'world',
    senderUserId: data.senderUserId,
    senderCultivatorId: data.senderCultivatorId,
    senderName: data.senderName,
    senderRealm: data.senderRealm,
    senderRealmStage: data.senderRealmStage,
    messageType: data.messageType,
    textContent: data.textContent ?? null,
    payload: data.payload,
    status: 'active',
    createdAt: new Date().toISOString(),
  };

  await redis.lpush(WORLD_CHAT_LIST_KEY, JSON.stringify(message));
  await redis.ltrim(WORLD_CHAT_LIST_KEY, 0, WORLD_CHAT_MAX_MESSAGES - 1);

  return message;
}

export async function listMessages(options: {
  channel: WorldChatChannel;
  page: number;
  pageSize: number;
}): Promise<{
  messages: WorldChatMessageDTO[];
  hasMore: boolean;
}> {
  const start = (options.page - 1) * options.pageSize;
  const end = start + options.pageSize + 1;
  const rows = await redis.lrange(
    WORLD_CHAT_LIST_KEY,
    0,
    WORLD_CHAT_MAX_MESSAGES - 1,
  );
  const parsedRows = (rows || [])
    .map((raw) => parseStoredMessage(raw))
    .filter((item): item is WorldChatMessageDTO => Boolean(item))
    .filter(
      (item) => options.channel === 'all' || item.channel === options.channel,
    );
  const pageRows = parsedRows.slice(start, end);
  const hasMore = pageRows.length > options.pageSize;
  const trimmedRows = hasMore ? pageRows.slice(0, options.pageSize) : pageRows;

  return {
    messages: trimmedRows,
    hasMore,
  };
}

export async function listLatestMessages(
  limit: number,
  channel: WorldChatChannel = 'all',
): Promise<WorldChatMessageDTO[]> {
  const rows = await redis.lrange(
    WORLD_CHAT_LIST_KEY,
    0,
    WORLD_CHAT_MAX_MESSAGES - 1,
  );
  return (rows || [])
    .map((raw) => parseStoredMessage(raw))
    .filter((item): item is WorldChatMessageDTO => Boolean(item))
    .filter((item) => channel === 'all' || item.channel === channel)
    .slice(0, limit);
}
