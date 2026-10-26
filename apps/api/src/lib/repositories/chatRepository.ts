import type {
  WorldChatMessageDTO,
  WorldChatMessageType,
  WorldChatPagination,
  WorldChatPayload,
  WorldChatReply,
} from '@daoyou/contracts/world-chat';
import {
  db,
  type DbExecutor,
  type DbTransaction,
} from '@server/lib/drizzle/db.js';
import {
  chatMessages,
  chatRedPackets,
  chatSequence,
} from '@server/lib/drizzle/schema.js';
import { encodeNatsSubjectToken } from '@server/realtime/infrastructure/natsCorePubSub.js';
import { ChatError } from '@server/social/application/chatError.js';
import { readCultivatorTitles } from '@server/cultivator/facts.js';
import { and, asc, desc, eq, gt, inArray, lt, sql } from 'drizzle-orm';
import { randomUUID } from 'node:crypto';
import { createTransactionalMessage } from './transactionalMessageRepository.js';

export const CHAT_RETENTION_DAYS = 30;
export type ChatScope = {
  channel: 'world' | 'system' | 'sect' | 'all';
  sectId?: string | null;
};
type MessageRow = typeof chatMessages.$inferSelect;

export function chatScopePredicate(scope: ChatScope) {
  return scope.channel === 'all'
    ? inArray(chatMessages.channel, ['world', 'system'])
    : and(
        eq(chatMessages.channel, scope.channel),
        scope.channel === 'sect'
          ? eq(chatMessages.sectId, scope.sectId!)
          : undefined,
      );
}

function cutoff() {
  return new Date(Date.now() - CHAT_RETENTION_DAYS * 86_400_000);
}

export function messageFromRow(
  row: MessageRow,
  senderTitle: string | null = null,
): WorldChatMessageDTO {
  return {
    id: row.id,
    sequence: row.sequence,
    channel: row.channel,
    sectId: row.sectId,
    senderUserId: row.senderUserId,
    senderCultivatorId: row.senderCultivatorId,
    senderName: row.senderName,
    senderTitle,
    senderRealm: row.senderRealm,
    senderRealmStage: row.senderRealmStage,
    messageType: row.messageType,
    textContent: row.textContent,
    payload: row.payload,
    reply: row.reply,
    clientMessageId: row.clientMessageId,
    status: row.status,
    createdAt: row.createdAt.toISOString(),
  };
}

export async function findChatMessage(id: string, q: DbExecutor = db) {
  const [row] = await q
    .select()
    .from(chatMessages)
    .where(eq(chatMessages.id, id))
    .limit(1);
  return row;
}

export async function findChatMessageRequest(
  userId: string,
  clientMessageId: string | undefined,
  fingerprint: string,
  q: DbExecutor = db,
) {
  if (!clientMessageId) return undefined;
  const [row] = await q
    .select()
    .from(chatMessages)
    .where(
      and(
        eq(chatMessages.senderUserId, userId),
        eq(chatMessages.clientMessageId, clientMessageId),
      ),
    )
    .limit(1);
  if (row && row.requestFingerprint !== fingerprint)
    throw new ChatError('同一发送标识不能用于不同消息', 409);
  return row ? messageFromRow(row) : undefined;
}

function replySummary(message: MessageRow): string {
  if (message.messageType === 'red_packet') return '灵石红包';
  if (message.textContent)
    return Array.from(message.textContent).slice(0, 80).join('');
  if (message.messageType === 'item_showcase') return '物品展示';
  if (message.messageType === 'beast_showcase') return '灵兽展示';
  if (message.messageType === 'combat_v6_replay') return '战绩回放';
  if (message.messageType === 'hunt_recruit') return '组队招募';
  return '传音';
}

async function createReply(
  id: string | undefined,
  scope: ChatScope,
  tx: DbTransaction,
): Promise<WorldChatReply | null> {
  if (!id) return null;
  const [target] = await tx
    .select()
    .from(chatMessages)
    .where(
      and(
        eq(chatMessages.id, id),
        chatScopePredicate(scope),
        eq(chatMessages.status, 'active'),
        gt(chatMessages.createdAt, cutoff()),
      ),
    )
    .limit(1);
  if (!target || target.channel === 'system')
    throw new ChatError('原消息已过期或无权回复', 404);
  return {
    messageId: target.id,
    senderName: target.senderName,
    messageType: target.messageType,
    summary: replySummary(target),
    availability: 'available',
  };
}

export function chatSubject(
  channel: 'world' | 'system' | 'sect',
  sectId: string | null,
) {
  return channel === 'sect'
    ? `daoyou.realtime.sect-chat.${encodeNatsSubjectToken(sectId!)}`
    : 'daoyou.realtime.world-chat';
}

export async function queueChatNotification(
  tx: DbTransaction,
  input: { destination: string; payload: unknown; deduplicationKey: string },
) {
  return createTransactionalMessage(
    { messageKey: 'chat.notification', ...input },
    tx,
  );
}

export type CreateChatMessageInput = {
  id?: string;
  createdAt?: string;
  senderUserId: string;
  senderCultivatorId: string | null;
  senderName: string;
  senderRealm: string;
  senderRealmStage: string;
  channel: 'world' | 'system' | 'sect';
  sectId: string | null;
  messageType: WorldChatMessageType;
  textContent?: string;
  payload: WorldChatPayload;
  clientMessageId?: string;
  requestFingerprint?: string;
  replyToMessageId?: string;
};

export async function insertChatMessage(
  input: CreateChatMessageInput,
  tx: DbTransaction,
  notify = true,
) {
  await tx
    .insert(chatSequence)
    .values({ key: 'global', value: 0 })
    .onConflictDoNothing();
  const [counter] = await tx
    .update(chatSequence)
    .set({ value: sql`${chatSequence.value} + 1` })
    .where(eq(chatSequence.key, 'global'))
    .returning({ value: chatSequence.value });
  const existing =
    input.clientMessageId && input.requestFingerprint
      ? await findChatMessageRequest(
          input.senderUserId,
          input.clientMessageId,
          input.requestFingerprint,
          tx,
        )
      : undefined;
  if (existing) return { message: existing, outboxId: undefined };
  if (input.id) {
    const duplicate = await findChatMessage(input.id, tx);
    if (duplicate)
      return { message: messageFromRow(duplicate), outboxId: undefined };
  }
  const reply = await createReply(
    input.replyToMessageId,
    { channel: input.channel, sectId: input.sectId },
    tx,
  );
  const [row] = await tx
    .insert(chatMessages)
    .values({
      id: input.id ?? randomUUID(),
      sequence: counter!.value,
      channel: input.channel,
      sectId: input.sectId,
      senderUserId: input.senderUserId,
      senderCultivatorId: input.senderCultivatorId,
      senderName: input.senderName,
      senderRealm: input.senderRealm,
      senderRealmStage: input.senderRealmStage,
      messageType: input.messageType,
      textContent: input.textContent ?? null,
      payload: input.payload,
      reply,
      clientMessageId: input.clientMessageId ?? null,
      requestFingerprint: input.requestFingerprint ?? null,
      createdAt: input.createdAt ? new Date(input.createdAt) : new Date(),
    })
    .returning();
  const titles = await readCultivatorTitles(
    input.senderCultivatorId ? [input.senderCultivatorId] : [], tx,
  );
  const message = messageFromRow(
    row!, titles.get(input.senderCultivatorId ?? '') ?? null,
  );
  if (!notify) return { message, outboxId: undefined };
  const outbox = await queueChatNotification(tx, {
    destination: chatSubject(input.channel, input.sectId),
    payload: message,
    deduplicationKey: `message:${message.id}`,
  });
  return { message, outboxId: outbox.id };
}

async function hydrateMessages(rows: MessageRow[], q: DbExecutor) {
  const senderIds = [...new Set(rows.flatMap((row) =>
    row.senderCultivatorId ? [row.senderCultivatorId] : [],
  ))];
  const senderTitles = await readCultivatorTitles(senderIds, q);
  const replyIds = rows.flatMap((row) =>
    row.reply ? [row.reply.messageId] : [],
  );
  const targets = replyIds.length
    ? await q
        .select({
          id: chatMessages.id,
          status: chatMessages.status,
          createdAt: chatMessages.createdAt,
        })
        .from(chatMessages)
        .where(inArray(chatMessages.id, replyIds))
    : [];
  const targetById = new Map(targets.map((target) => [target.id, target]));
  const packetIds = rows.flatMap((row) =>
    row.messageType === 'red_packet'
      ? [(row.payload as { packet: { id: string } }).packet.id]
      : [],
  );
  const packets = packetIds.length
    ? await q
        .select()
        .from(chatRedPackets)
        .where(inArray(chatRedPackets.id, packetIds))
    : [];
  const packetById = new Map(packets.map((packet) => [packet.id, packet]));
  return rows.map((row) => {
    const message = messageFromRow(
      row, senderTitles.get(row.senderCultivatorId ?? '') ?? null,
    );
    if (message.reply) {
      const target = targetById.get(message.reply.messageId);
      if (target && target.status !== 'active')
        message.reply = {
          ...message.reply,
          summary: '原消息不可见',
          availability: 'hidden',
        };
      else if (!target || target.createdAt < cutoff())
        message.reply = { ...message.reply, availability: 'expired' };
    }
    if (message.messageType === 'red_packet') {
      const payload = message.payload as { version: 1; packet: { id: string } };
      const packet = packetById.get(payload.packet.id);
      if (packet)
        message.payload = { version: 1, packet: redPacketSummary(packet) };
    }
    return message;
  });
}

export function redPacketSummary(row: typeof chatRedPackets.$inferSelect) {
  return {
    id: row.id,
    amount: row.amount,
    count: row.count,
    remainingCount: row.remainingCount,
    mode: row.mode,
    greeting: row.greeting,
    expiresAt: row.expiresAt.toISOString(),
    status: row.status,
    revision: row.revision,
    refundStatus: row.refundStatus,
    refundAmount: row.refundAmount,
  };
}

export async function listChatMessages(
  options: ChatScope & {
    pageSize: number;
    beforeCursor?: string;
    afterCursor?: string;
    aroundMessageId?: string;
    page?: number;
  },
  q: DbExecutor = db,
): Promise<{
  messages: WorldChatMessageDTO[];
  pagination: WorldChatPagination;
}> {
  const base = and(
    chatScopePredicate(options),
    eq(chatMessages.status, 'active'),
    gt(chatMessages.createdAt, cutoff()),
  );
  let rows: MessageRow[];
  let hasMore: boolean;
  let hasMoreAfter = false;
  if (options.aroundMessageId) {
    const [target] = await q
      .select()
      .from(chatMessages)
      .where(and(base, eq(chatMessages.id, options.aroundMessageId)))
      .limit(1);
    if (!target) throw new ChatError('原消息已过期或无权查看', 404);
    const half = Math.max(1, Math.floor(options.pageSize / 2));
    const older = await q
      .select()
      .from(chatMessages)
      .where(and(base, sql`${chatMessages.sequence} <= ${target.sequence}`))
      .orderBy(desc(chatMessages.sequence))
      .limit(half + 1);
    const newer = await q
      .select()
      .from(chatMessages)
      .where(and(base, gt(chatMessages.sequence, target.sequence)))
      .orderBy(asc(chatMessages.sequence))
      .limit(half + 1);
    hasMore = older.length > half;
    hasMoreAfter = newer.length > half;
    rows = [...newer.slice(0, half).reverse(), ...older.slice(0, half)];
  } else {
    const forward = Boolean(options.afterCursor);
    const selected = await q
      .select()
      .from(chatMessages)
      .where(
        and(
          base,
          options.beforeCursor
            ? lt(chatMessages.sequence, Number(options.beforeCursor))
            : undefined,
          options.afterCursor
            ? gt(chatMessages.sequence, Number(options.afterCursor))
            : undefined,
        ),
      )
      .orderBy(
        forward ? asc(chatMessages.sequence) : desc(chatMessages.sequence),
      )
      .limit(options.pageSize + 1)
      .offset(
        options.beforeCursor || options.afterCursor
          ? 0
          : Math.max(0, (options.page ?? 1) - 1) * options.pageSize,
      );
    hasMore = selected.length > options.pageSize;
    rows = selected.slice(0, options.pageSize);
    if (forward) rows.reverse();
  }
  return {
    messages: await hydrateMessages(rows, q),
    pagination: {
      beforeCursor: rows.at(-1)?.sequence.toString() ?? null,
      afterCursor: rows[0]?.sequence.toString() ?? options.afterCursor ?? null,
      hasMore,
      hasMoreBefore: options.afterCursor ? false : hasMore,
      hasMoreAfter: options.afterCursor ? hasMore : hasMoreAfter,
    },
  };
}

export async function pruneChatHistory() {
  const removed = await db
    .delete(chatMessages)
    .where(lt(chatMessages.createdAt, cutoff()))
    .returning({ id: chatMessages.id });
  return removed.length;
}
