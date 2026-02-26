import { redis } from '@/lib/redis';
import type {
  WorldChatMessageDTO,
  WorldChatMessageType,
  WorldChatPayload,
} from '@/types/world-chat';
import { randomUUID } from 'crypto';

const WORLD_CHAT_LIST_KEY = 'world_chat:messages';
const WORLD_CHAT_MAX_MESSAGES = 100;

type StoredWorldChatMessage = {
  id: string;
  channel: 'world';
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

function parseStoredMessage(raw: unknown): WorldChatMessageDTO | null {
  if (typeof raw === 'object' && raw !== null) {
    const parsed = raw as Partial<StoredWorldChatMessage>;
    if (
      typeof parsed.id === 'string' &&
      parsed.channel === 'world' &&
      typeof parsed.senderName === 'string' &&
      typeof parsed.createdAt === 'string'
    ) {
      return parsed as WorldChatMessageDTO;
    }
    return null;
  }

  if (typeof raw === 'string') {
    try {
      const parsed = JSON.parse(raw) as StoredWorldChatMessage;
      if (!parsed || typeof parsed.id !== 'string') return null;
      return parsed;
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
  messageType: WorldChatMessageType;
  textContent?: string;
  payload: WorldChatPayload;
}): Promise<WorldChatMessageDTO> {
  const message: WorldChatMessageDTO = {
    id: randomUUID(),
    channel: 'world',
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
  page: number;
  pageSize: number;
}): Promise<{
  messages: WorldChatMessageDTO[];
  hasMore: boolean;
}> {
  const start = (options.page - 1) * options.pageSize;
  const end = start + options.pageSize;
  const rows = await redis.lrange(WORLD_CHAT_LIST_KEY, start, end);
  const parsedRows = (rows || [])
    .map((raw) => parseStoredMessage(raw))
    .filter((item): item is WorldChatMessageDTO => Boolean(item));
  const hasMore = parsedRows.length > options.pageSize;
  const trimmedRows = hasMore
    ? parsedRows.slice(0, options.pageSize)
    : parsedRows;

  return {
    messages: trimmedRows,
    hasMore,
  };
}

export async function listLatestMessages(
  limit: number,
): Promise<WorldChatMessageDTO[]> {
  const rows = await redis.lrange(WORLD_CHAT_LIST_KEY, 0, limit - 1);
  return (rows || [])
    .map((raw) => parseStoredMessage(raw))
    .filter((item): item is WorldChatMessageDTO => Boolean(item));
}
