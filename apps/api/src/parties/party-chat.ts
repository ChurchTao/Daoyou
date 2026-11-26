import type {
  PartyChatMessage,
  PartyChatReply,
  PartyChatSend,
} from '@daoyou/contracts/party';
import { PARTY_CHAT_MAX_CHARS } from '@daoyou/contracts/party';
import {
  readCultivatorPublicIdentity,
  readCultivatorTitles,
} from '@server/cultivator/facts.js';
import type { ActiveCultivatorRef } from '@server/lib/auth/types.js';
import { db } from '@server/lib/drizzle/db.js';
import { acquireRedisCooldown } from '@server/lib/redis/cooldownLimiter.js';
import { redis } from '@server/lib/redis/index.js';
import { partyOwns, readParty } from '@server/parties/party.service.js';
import { publishHuntTeamChat } from '@server/realtime/infrastructure/huntTeamChatBroadcaster.js';
import { ChatError } from '@server/social/application/chatError.js';
import { textFilter } from '@server/social/application/textFilter.js';

// Reuse histories previously written by the hunt entry point.
export const partyChatKey = (id: string) => `hunt:v1:chat:${id}`;

const CHAT_LIMIT = 50;
const CHAT_TTL_SECONDS = 60 * 60 * 48;
const COOLDOWN_SECONDS = 1;

function countChars(input: string) {
  return Array.from(input).length;
}

function parseReply(value: unknown): PartyChatReply | null {
  if (!value || typeof value !== 'object') return null;
  const reply = value as Partial<PartyChatReply>;
  if (
    typeof reply.messageId !== 'string' ||
    !reply.messageId ||
    typeof reply.senderName !== 'string' ||
    !reply.senderName ||
    typeof reply.summary !== 'string' ||
    !reply.summary
  ) {
    return null;
  }
  return {
    messageId: reply.messageId,
    senderName: reply.senderName,
    summary: reply.summary,
  };
}

function parseMessage(raw: string, teamId: string): PartyChatMessage | null {
  try {
    const parsed = JSON.parse(raw) as Partial<PartyChatMessage>;
    if (
      parsed.teamId !== teamId ||
      typeof parsed.id !== 'string' ||
      typeof parsed.senderCultivatorId !== 'string' ||
      typeof parsed.senderName !== 'string' ||
      typeof parsed.text !== 'string' ||
      typeof parsed.createdAt !== 'string'
    ) {
      return null;
    }
    return {
      id: parsed.id,
      teamId,
      senderCultivatorId: parsed.senderCultivatorId,
      senderName: parsed.senderName,
      senderTitle:
        typeof parsed.senderTitle === 'string' ? parsed.senderTitle : null,
      senderRealm:
        typeof parsed.senderRealm === 'string' ? parsed.senderRealm : '',
      senderRealmStage:
        typeof parsed.senderRealmStage === 'string'
          ? parsed.senderRealmStage
          : '',
      text: parsed.text,
      reply: parseReply(parsed.reply),
      createdAt: parsed.createdAt,
    };
  } catch {
    return null;
  }
}

async function requireMember(actor: ActiveCultivatorRef, teamId: string) {
  const party = await readParty(teamId);
  if (!party || !partyOwns(party, actor))
    throw new ChatError('你尚未加入这支队伍', 403);
  return party;
}

export async function listPartyChat(
  actor: ActiveCultivatorRef,
  teamId: string,
): Promise<PartyChatMessage[]> {
  await requireMember(actor, teamId);
  const rows = await redis.lrange(partyChatKey(teamId), 0, CHAT_LIMIT - 1);
  const messages = rows
    .map((raw) => parseMessage(raw, teamId))
    .filter((message): message is PartyChatMessage => Boolean(message))
    .reverse();
  const titles = await readCultivatorTitles([
    ...new Set(messages.map((message) => message.senderCultivatorId)),
  ]);
  return messages.map((message) => ({
    ...message,
    senderTitle: titles.has(message.senderCultivatorId)
      ? titles.get(message.senderCultivatorId)
      : message.senderTitle,
  }));
}

async function replySnapshot(
  teamId: string,
  messageId: string,
): Promise<PartyChatReply> {
  const rows = await redis.lrange(partyChatKey(teamId), 0, CHAT_LIMIT - 1);
  const target = rows
    .map((raw) => parseMessage(raw, teamId))
    .find((message) => message?.id === messageId);
  if (!target) throw new ChatError('原消息已不在记录中', 400);
  return {
    messageId: target.id,
    senderName: target.senderName,
    summary: Array.from(target.text).slice(0, 80).join(''),
  };
}

export async function sendPartyChat(
  actor: ActiveCultivatorRef,
  teamId: string,
  input: PartyChatSend,
): Promise<PartyChatMessage> {
  await requireMember(actor, teamId);
  const trimmed = input.text.trim();
  const length = countChars(trimmed);
  if (length < 1 || length > PARTY_CHAT_MAX_CHARS) {
    throw new ChatError(`消息长度需在 1-${PARTY_CHAT_MAX_CHARS} 字之间`, 400);
  }
  const reply = input.replyToMessageId
    ? await replySnapshot(teamId, input.replyToMessageId)
    : null;
  const cooldown = await acquireRedisCooldown({
    key: `hunt:v1:chat:cooldown:${actor.cultivatorId}`,
    cooldownSeconds: COOLDOWN_SECONDS,
  });
  if (!cooldown.allowed) {
    throw new ChatError(`请 ${cooldown.remainingSeconds} 秒后再发言`, 409);
  }
  const identity = await readCultivatorPublicIdentity(actor.cultivatorId);
  const titles = await readCultivatorTitles([actor.cultivatorId]);
  const message: PartyChatMessage = {
    id: crypto.randomUUID(),
    teamId,
    senderCultivatorId: actor.cultivatorId,
    senderName: identity.name,
    senderTitle: titles.get(actor.cultivatorId) ?? null,
    senderRealm: identity.realm,
    senderRealmStage: identity.realmStage,
    text: textFilter.mask(trimmed).text,
    reply,
    createdAt: new Date().toISOString(),
  };
  const team = await db.transaction(async (tx) => {
    const party = await readParty(teamId, tx, 'update');
    if (!party || !partyOwns(party, actor))
      throw new ChatError('你尚未加入这支队伍', 403);
    await redis
      .multi()
      .lpush(partyChatKey(teamId), JSON.stringify(message))
      .ltrim(partyChatKey(teamId), 0, CHAT_LIMIT - 1)
      .expire(partyChatKey(teamId), CHAT_TTL_SECONDS)
      .exec();
    return party;
  });
  publishHuntTeamChat(
    team.members.map((member) => member.userId),
    message,
  );
  return message;
}
