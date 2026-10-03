import { WORLD_CHAT_MESSAGE_TYPES } from '@daoyou/shared/types/world-chat';
import { redis } from '@server/lib/redis/index.js';
import type {
  WorldChatMessageDTO,
  WorldChatMessageType,
  WorldChatPayload,
} from '@daoyou/shared/types/world-chat';
import { randomUUID } from 'crypto';

const SECT_CHAT_MAX_MESSAGES = 100;

function listKey(sectId: string) {
  return `sect_chat:${sectId}:messages`;
}

function parseStoredMessage(
  raw: unknown,
  sectId: string,
): WorldChatMessageDTO | null {
  try {
    const parsed =
      typeof raw === 'string'
        ? (JSON.parse(raw) as Partial<WorldChatMessageDTO>)
        : (raw as Partial<WorldChatMessageDTO>);
    if (
      !parsed ||
      parsed.channel !== 'sect' ||
      parsed.sectId !== sectId ||
      typeof parsed.id !== 'string' ||
      typeof parsed.senderName !== 'string' ||
      typeof parsed.createdAt !== 'string' ||
      !WORLD_CHAT_MESSAGE_TYPES.includes(parsed.messageType as WorldChatMessageType)
    ) {
      return null;
    }
    return parsed as WorldChatMessageDTO;
  } catch {
    return null;
  }
}

export async function createSectChatMessage(data: {
  senderUserId: string;
  senderCultivatorId: string;
  senderName: string;
  senderRealm: string;
  senderRealmStage: string;
  channel: 'sect';
  sectId: string;
  messageType: WorldChatMessageType;
  textContent?: string;
  payload: WorldChatPayload;
}): Promise<WorldChatMessageDTO> {
  const message: WorldChatMessageDTO = {
    id: randomUUID(),
    channel: 'sect',
    sectId: data.sectId,
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
  await redis.lpush(listKey(data.sectId), JSON.stringify(message));
  await redis.ltrim(listKey(data.sectId), 0, SECT_CHAT_MAX_MESSAGES - 1);
  return message;
}

export async function listSectChatMessages(options: {
  sectId: string;
  page: number;
  pageSize: number;
}): Promise<{ messages: WorldChatMessageDTO[]; hasMore: boolean }> {
  const start = (options.page - 1) * options.pageSize;
  const end = start + options.pageSize;
  const rows = await redis.lrange(listKey(options.sectId), start, end);
  const parsed = (rows || [])
    .map((raw) => parseStoredMessage(raw, options.sectId))
    .filter((message): message is WorldChatMessageDTO => Boolean(message));
  const hasMore = parsed.length > options.pageSize;
  return {
    messages: hasMore ? parsed.slice(0, options.pageSize) : parsed,
    hasMore,
  };
}
