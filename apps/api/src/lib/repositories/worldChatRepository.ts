import { WORLD_CHAT_MESSAGE_TYPES } from '@daoyou/contracts/world-chat';
import { redis } from '@server/lib/redis/index.js';
import type {
  WorldChatChannel,
  WorldChatMessageChannel,
  WorldChatMessageDTO,
  WorldChatMessageType,
  WorldChatPayload,
} from '@daoyou/contracts/world-chat';
import { randomUUID } from 'crypto';

const WORLD_CHAT_LIST_KEY = 'world_chat:messages';
const WORLD_CHAT_MAX_MESSAGES = 100;

type WorldChatListChannel = 'all' | Exclude<WorldChatChannel, 'sect'>;

type StoredWorldChatMessage = {
  id: string;
  channel?: Exclude<WorldChatMessageChannel, 'sect'>;
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
      typeof parsed.createdAt === 'string' &&
      WORLD_CHAT_MESSAGE_TYPES.includes(parsed.messageType as WorldChatMessageType)
    ) {
      return {
        ...parsed,
        channel: resolveStoredChannel(parsed),
        sectId: null,
      } as WorldChatMessageDTO;
    }
    return null;
  }

  if (typeof raw === 'string') {
    try {
      const parsed = JSON.parse(raw) as StoredWorldChatMessage;
      if (!parsed || typeof parsed.id !== 'string' || !WORLD_CHAT_MESSAGE_TYPES.includes(parsed.messageType)) return null;
      return {
        ...parsed,
        channel: resolveStoredChannel(parsed),
        sectId: null,
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

function newestFirst(
  left: WorldChatMessageDTO,
  right: WorldChatMessageDTO,
): number {
  const difference =
    Date.parse(right.createdAt) - Date.parse(left.createdAt);
  return Number.isFinite(difference) ? difference : 0;
}

export async function createMessage(data: {
  id?: string;
  createdAt?: string;
  senderUserId: string;
  senderCultivatorId: string | null;
  senderName: string;
  senderRealm: string;
  senderRealmStage: string;
  channel?: Exclude<WorldChatMessageChannel, 'sect'>;
  messageType: WorldChatMessageType;
  textContent?: string;
  payload: WorldChatPayload;
}): Promise<WorldChatMessageDTO> {
  const message: WorldChatMessageDTO = {
    id: data.id ?? randomUUID(),
    channel: data.channel ?? 'world',
    sectId: null,
    senderUserId: data.senderUserId,
    senderCultivatorId: data.senderCultivatorId,
    senderName: data.senderName,
    senderRealm: data.senderRealm,
    senderRealmStage: data.senderRealmStage,
    messageType: data.messageType,
    textContent: data.textContent ?? null,
    payload: data.payload,
    status: 'active',
    createdAt: data.createdAt ?? new Date().toISOString(),
  };

  const encoded = JSON.stringify(message);
  await redis
    .multi()
    .lrem(WORLD_CHAT_LIST_KEY, 0, encoded)
    .lpush(WORLD_CHAT_LIST_KEY, encoded)
    .ltrim(WORLD_CHAT_LIST_KEY, 0, WORLD_CHAT_MAX_MESSAGES - 1)
    .exec();

  return message;
}

export async function listMessages(options: {
  channel: WorldChatListChannel;
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
    )
    .sort(newestFirst);
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
  channel: WorldChatListChannel = 'world',
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
    .sort(newestFirst)
    .slice(0, limit);
}
