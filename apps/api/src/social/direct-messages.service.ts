import type {
  DirectConversationDTO,
  DirectConversationsPage,
  DirectConversationsQuery,
  DirectMessageDTO,
  DirectMessagesPage,
  DirectMessagesQuery,
  SendDirectMessageRequest,
} from '@daoyou/contracts/direct-messages';
import { HttpException, Injectable } from '@nestjs/common';
import { authUsers } from '@server/lib/auth/schema.js';
import { db, type DbExecutor } from '@server/lib/drizzle/db.js';
import {
  accountDeletionRecords,
  cultivatorFriends,
  cultivators,
  directConversationMembers,
  directConversations,
  directMessages,
  socialBlocks,
} from '@server/lib/drizzle/schema.js';
import { redis } from '@server/lib/redis/index.js';
import {
  and,
  asc,
  desc,
  eq,
  gt,
  inArray,
  lt,
  lte,
  ne,
  or,
  sql,
} from 'drizzle-orm';
import { alias } from 'drizzle-orm/pg-core';
import { areFriends } from './application/FriendService.js';
import {
  assertSocialContactAllowed,
  lockSocialAccounts,
  readSocialActor,
  socialError,
  type SocialActor,
} from './application/SocialTransaction.js';
import { chatRequestFingerprint } from './application/chatError.js';
import { textFilter } from './application/textFilter.js';
import { enqueueSocialNotification } from './social-notifications.js';

const RETENTION_MS = 30 * 86_400_000;
type Member = typeof directConversationMembers.$inferSelect;
type Message = typeof directMessages.$inferSelect;
type MessagePreviewRow = Pick<
  Message,
  'textContent' | 'expiredAt' | 'createdAt' | 'senderMemberId'
>;
const SEND_LIMIT_SCRIPT = `
local cooldown = redis.call('pttl', KEYS[1])
if cooldown > 0 then return 0 end
local count = tonumber(redis.call('get', KEYS[2]) or '0')
if count >= 30 then return 0 end
redis.call('set', KEYS[1], '1', 'PX', 1000)
if redis.call('incr', KEYS[2]) == 1 then redis.call('expire', KEYS[2], 60) end
return 1
`;

function isExpired(
  row: Pick<Message, 'textContent' | 'expiredAt' | 'createdAt'>,
) {
  return (
    row.expiredAt !== null ||
    row.createdAt.getTime() <= Date.now() - RETENTION_MS ||
    row.textContent === null
  );
}

function lastMessageDTO(
  row: MessagePreviewRow | undefined,
  mine: Member,
): DirectConversationDTO['lastMessage'] {
  if (!row) return null;
  const expired = isExpired(row);
  return {
    text: expired ? null : row.textContent,
    mine: row.senderMemberId === mine.id,
    createdAt: row.createdAt.toISOString(),
    expired,
  };
}

function messageDTO(
  row: Message,
  sender: Member,
  mine: Member,
): DirectMessageDTO {
  const expired = isExpired(row);
  return {
    id: row.id,
    conversationId: row.conversationId,
    sequence: row.sequence,
    clientMessageId: row.clientMessageId,
    senderName: row.senderName,
    senderCultivatorId: sender.originalCultivatorId,
    mine: sender.id === mine.id,
    text: expired ? null : row.textContent,
    expired,
    createdAt: row.createdAt.toISOString(),
  };
}

async function loadConversation(q: DbExecutor, userId: string, id: string) {
  const [conversation] = await q
    .select()
    .from(directConversations)
    .where(eq(directConversations.id, id))
    .limit(1);
  if (!conversation) socialError('会话不存在', 404);
  const members = await q
    .select()
    .from(directConversationMembers)
    .where(eq(directConversationMembers.conversationId, id));
  const mine = members.find((member) => member.userId === userId);
  const peer = members.find((member) => member.id !== mine?.id);
  if (!mine || !peer) socialError('会话不存在', 404);
  return { conversation, mine, peer, members };
}

async function sendBlockReason(
  q: DbExecutor,
  mine: Member,
  peer: Member,
  actor?: SocialActor,
) {
  if (
    !mine.userId ||
    !peer.userId ||
    !mine.originalCultivatorId ||
    !peer.originalCultivatorId
  )
    return '该角色的道途已结束，此会话仅供查阅';
  const current = await readSocialActor(q, mine.originalCultivatorId);
  const other = await readSocialActor(q, peer.originalCultivatorId);
  if (
    !current ||
    !other ||
    current.status !== 'active' ||
    other.status !== 'active' ||
    current.userId !== mine.userId ||
    other.userId !== peer.userId
  )
    return '角色已离开，此会话仅供查阅';
  if (
    actor &&
    (actor.userId !== mine.userId ||
      actor.cultivatorId !== mine.originalCultivatorId)
  )
    return '请使用此会话对应的角色发送';
  try {
    await assertSocialContactAllowed(q, mine.userId, peer.userId);
  } catch (error) {
    if (!(error instanceof HttpException) || error.getStatus() !== 403)
      throw error;
    return '当前无法联系该道友';
  }
  if (
    !(await areFriends(mine.originalCultivatorId, peer.originalCultivatorId, q))
  )
    return '重新成为好友后才可继续私聊';
  return null;
}

async function conversationDTO(
  q: DbExecutor,
  loaded: Awaited<ReturnType<typeof loadConversation>>,
): Promise<DirectConversationDTO> {
  const { conversation, mine, peer } = loaded;
  const unavailableReason = await sendBlockReason(q, mine, peer);
  const [unread] = await q
    .select({ count: sql<number>`count(*)::int` })
    .from(directMessages)
    .where(
      and(
        eq(directMessages.conversationId, conversation.id),
        ne(directMessages.senderMemberId, mine.id),
        gt(directMessages.sequence, mine.lastReadSequence),
        gt(directMessages.createdAt, new Date(Date.now() - RETENTION_MS)),
        sql`${directMessages.textContent} is not null`,
        sql`${directMessages.expiredAt} is null`,
      ),
    );
  const own = mine.originalCultivatorId
    ? await readSocialActor(q, mine.originalCultivatorId)
    : null;
  const other = peer.originalCultivatorId
    ? await readSocialActor(q, peer.originalCultivatorId)
    : null;
  const [lastMessage] = await q
    .select()
    .from(directMessages)
    .where(
      and(
        eq(directMessages.conversationId, conversation.id),
        eq(directMessages.sequence, conversation.lastSequence),
      ),
    )
    .limit(1);
  return {
    id: conversation.id,
    peer: {
      cultivatorId: peer.originalCultivatorId,
      name: other?.name ?? peer.name,
    },
    myCultivatorId: mine.originalCultivatorId,
    archived:
      !own || !other || own.status !== 'active' || other.status !== 'active',
    canSend: unavailableReason === null,
    unavailableReason,
    lastSequence: conversation.lastSequence,
    lastReadSequence: mine.lastReadSequence,
    unreadCount: unread?.count ?? 0,
    lastMessage: lastMessageDTO(lastMessage, mine),
    updatedAt: conversation.updatedAt.toISOString(),
  };
}

@Injectable()
export class DirectMessagesService {
  async list(
    userId: string,
    query: DirectConversationsQuery = { limit: 50 },
  ): Promise<DirectConversationsPage> {
    const anchor = query.beforeCursor
      ? (await loadConversation(db, userId, query.beforeCursor)).conversation
      : undefined;
    const rows = await db
      .select({
        conversation: directConversations,
        mine: directConversationMembers,
      })
      .from(directConversations)
      .innerJoin(
        directConversationMembers,
        eq(directConversationMembers.conversationId, directConversations.id),
      )
      .where(
        and(
          eq(directConversationMembers.userId, userId),
          anchor
            ? or(
                lt(directConversations.updatedAt, anchor.updatedAt),
                and(
                  eq(directConversations.updatedAt, anchor.updatedAt),
                  lt(directConversations.id, anchor.id),
                ),
              )
            : undefined,
        ),
      )
      .orderBy(
        desc(directConversations.updatedAt),
        desc(directConversations.id),
      )
      .limit(query.limit + 1);
    const hasMore = rows.length > query.limit;
    const page = rows.slice(0, query.limit);
    if (!page.length)
      return {
        conversations: [],
        pagination: { nextCursor: null, hasMore: false },
      };
    const ids = page.map((row) => row.conversation.id);
    // The sequence and message are committed together; read each captured head
    // in one indexed query so concurrent sends cannot mix a newer preview with
    // an older conversation watermark.
    const lastMessages = await db
      .select()
      .from(directMessages)
      .where(
        or(
          ...page.map(({ conversation }) =>
            and(
              eq(directMessages.conversationId, conversation.id),
              eq(directMessages.sequence, conversation.lastSequence),
            ),
          ),
        ),
      );
    const lastMessagesByConversation = new Map(
      lastMessages.map((message) => [message.conversationId, message]),
    );
    const members = await db
      .select()
      .from(directConversationMembers)
      .where(inArray(directConversationMembers.conversationId, ids));
    const characterIds = members.flatMap((member) =>
      member.originalCultivatorId ? [member.originalCultivatorId] : [],
    );
    const characters = characterIds.length
      ? await db
          .select({
            id: cultivators.id,
            userId: cultivators.userId,
            name: cultivators.name,
            status: cultivators.status,
          })
          .from(cultivators)
          .where(inArray(cultivators.id, characterIds))
      : [];
    const owners = [
      ...new Set(
        members.flatMap((member) => (member.userId ? [member.userId] : [])),
      ),
    ];
    const users = await db
      .select({ id: authUsers.id })
      .from(authUsers)
      .where(inArray(authUsers.id, owners));
    const deleted = await db
      .select({ userId: accountDeletionRecords.userId })
      .from(accountDeletionRecords)
      .where(
        and(
          inArray(accountDeletionRecords.userId, owners),
          eq(accountDeletionRecords.status, 'completed'),
        ),
      );
    const blocks = await db
      .select()
      .from(socialBlocks)
      .where(
        or(
          eq(socialBlocks.userId, userId),
          eq(socialBlocks.blockedUserId, userId),
        ),
      );
    const mineIds = page.flatMap((row) =>
      row.mine.originalCultivatorId ? [row.mine.originalCultivatorId] : [],
    );
    const friends = mineIds.length
      ? await db
          .select()
          .from(cultivatorFriends)
          .where(inArray(cultivatorFriends.cultivatorId, mineIds))
      : [];
    const ownMember = alias(directConversationMembers, 'inbox_member');
    const unreadRows = await db
      .select({
        conversationId: directMessages.conversationId,
        count: sql<number>`count(*)::int`,
      })
      .from(directMessages)
      .innerJoin(
        ownMember,
        eq(ownMember.conversationId, directMessages.conversationId),
      )
      .where(
        and(
          eq(ownMember.userId, userId),
          inArray(directMessages.conversationId, ids),
          ne(directMessages.senderMemberId, ownMember.id),
          gt(directMessages.sequence, ownMember.lastReadSequence),
          gt(directMessages.createdAt, new Date(Date.now() - RETENTION_MS)),
          sql`${directMessages.textContent} is not null`,
          sql`${directMessages.expiredAt} is null`,
        ),
      )
      .groupBy(directMessages.conversationId);
    const conversations = page.map(
      ({ conversation, mine }): DirectConversationDTO => {
        const peer = members.find(
          (member) =>
            member.conversationId === conversation.id && member.id !== mine.id,
        )!;
        const current = characters.find(
          (row) => row.id === mine.originalCultivatorId,
        );
        const other = characters.find(
          (row) => row.id === peer.originalCultivatorId,
        );
        const archived =
          !current ||
          !other ||
          current.status !== 'active' ||
          other.status !== 'active';
        const blocked = blocks.some(
          (row) =>
            row.userId === peer.userId || row.blockedUserId === peer.userId,
        );
        const absent =
          !peer.userId ||
          !users.some((row) => row.id === peer.userId) ||
          deleted.some((row) => row.userId === peer.userId);
        const friend = friends.some(
          (row) =>
            row.cultivatorId === mine.originalCultivatorId &&
            row.friendCultivatorId === peer.originalCultivatorId,
        );
        const unavailableReason = archived
          ? '角色已离开，此会话仅供查阅'
          : blocked || absent
            ? '当前无法联系该道友'
            : !friend
              ? '重新成为好友后才可继续私聊'
              : null;
        return {
          id: conversation.id,
          peer: {
            cultivatorId: peer.originalCultivatorId,
            name: other?.name ?? peer.name,
          },
          myCultivatorId: mine.originalCultivatorId,
          archived,
          canSend: unavailableReason === null,
          unavailableReason,
          lastSequence: conversation.lastSequence,
          lastReadSequence: mine.lastReadSequence,
          unreadCount: blocked
            ? 0
            : (unreadRows.find((row) => row.conversationId === conversation.id)
                ?.count ?? 0),
          lastMessage: lastMessageDTO(
            lastMessagesByConversation.get(conversation.id),
            mine,
          ),
          updatedAt: conversation.updatedAt.toISOString(),
        };
      },
    );
    return {
      conversations,
      pagination: {
        nextCursor: hasMore ? page.at(-1)!.conversation.id : null,
        hasMore,
      },
    };
  }

  async unreadSummary(userId: string, activeCultivatorId: string | null) {
    const mine = alias(directConversationMembers, 'unread_member');
    const sender = alias(directConversationMembers, 'unread_sender');
    const peer = alias(cultivators, 'unread_peer');
    const archived = (
      activeCultivatorId
        ? sql<boolean>`(${mine.originalCultivatorId} is distinct from ${activeCultivatorId}::uuid or ${peer.status} is distinct from 'active')`
        : sql<boolean>`true`
    ).as('is_archived');
    const rows = await db
      .select({ archived, count: sql<number>`count(*)::int` })
      .from(directMessages)
      .innerJoin(mine, eq(mine.conversationId, directMessages.conversationId))
      .innerJoin(sender, eq(sender.id, directMessages.senderMemberId))
      .leftJoin(peer, eq(peer.id, sender.originalCultivatorId))
      .where(
        and(
          eq(mine.userId, userId),
          ne(mine.id, sender.id),
          gt(directMessages.sequence, mine.lastReadSequence),
          gt(directMessages.createdAt, new Date(Date.now() - RETENTION_MS)),
          sql`${directMessages.textContent} is not null`,
          sql`${directMessages.expiredAt} is null`,
          sql`not exists (select 1 from ${socialBlocks} where (${socialBlocks.userId} = ${userId}::uuid and ${socialBlocks.blockedUserId} = ${sender.userId}) or (${socialBlocks.blockedUserId} = ${userId}::uuid and ${socialBlocks.userId} = ${sender.userId}))`,
        ),
      )
      .groupBy(sql`is_archived`);
    return {
      unreadMessages: rows.find((row) => !row.archived)?.count ?? 0,
      archivedUnreadMessages: rows.find((row) => row.archived)?.count ?? 0,
    };
  }

  async open(actor: SocialActor, targetId: string) {
    const target = await readSocialActor(db, targetId);
    if (!target) socialError('未找到该道友', 404);
    return db.transaction(async (tx) => {
      await lockSocialAccounts(tx, [actor.userId, target.userId]);
      await assertSocialContactAllowed(tx, actor.userId, target.userId);
      const current = await readSocialActor(tx, actor.cultivatorId);
      const peer = await readSocialActor(tx, targetId);
      if (
        !current ||
        current.userId !== actor.userId ||
        current.status !== 'active' ||
        peer?.status !== 'active'
      )
        socialError('道友状态已变化', 409);
      if (!(await areFriends(actor.cultivatorId, targetId, tx)))
        socialError('成为好友后才可私聊', 403);
      const pairKey = [actor.cultivatorId, targetId].sort().join(':');
      let [conversation] = await tx
        .select()
        .from(directConversations)
        .where(eq(directConversations.pairKey, pairKey));
      if (!conversation) {
        [conversation] = await tx
          .insert(directConversations)
          .values({ pairKey })
          .returning();
        await tx.insert(directConversationMembers).values([
          {
            conversationId: conversation!.id,
            userId: actor.userId,
            originalCultivatorId: current.id,
            name: current.name,
          },
          {
            conversationId: conversation!.id,
            userId: target.userId,
            originalCultivatorId: targetId,
            name: peer.name,
          },
        ]);
      }
      return {
        conversation: await conversationDTO(
          tx,
          await loadConversation(tx, actor.userId, conversation!.id),
        ),
      };
    });
  }

  async messages(
    userId: string,
    id: string,
    query: DirectMessagesQuery,
  ): Promise<DirectMessagesPage> {
    const loaded = await loadConversation(db, userId, id);
    const upper = loaded.conversation.lastSequence;
    const forward = query.afterCursor !== undefined;
    const rows = await db
      .select()
      .from(directMessages)
      .where(
        and(
          eq(directMessages.conversationId, id),
          lte(directMessages.sequence, upper),
          query.beforeCursor
            ? lt(directMessages.sequence, Number(query.beforeCursor))
            : undefined,
          query.afterCursor
            ? gt(directMessages.sequence, Number(query.afterCursor))
            : undefined,
        ),
      )
      .orderBy(
        forward ? asc(directMessages.sequence) : desc(directMessages.sequence),
      )
      .limit(query.limit + 1);
    const hasMore = rows.length > query.limit;
    const page = rows.slice(0, query.limit);
    if (!forward) page.reverse();
    const beforeBoundary = page[0]?.sequence ?? (forward ? upper + 1 : null);
    const earlier =
      forward && beforeBoundary !== null
        ? await db
            .select({ id: directMessages.id })
            .from(directMessages)
            .where(
              and(
                eq(directMessages.conversationId, id),
                lt(directMessages.sequence, beforeBoundary),
                lte(directMessages.sequence, upper),
              ),
            )
            .limit(1)
        : [];
    const hasMoreBefore = forward ? earlier.length > 0 : hasMore;
    return {
      conversation: await conversationDTO(db, loaded),
      messages: page.map((row) =>
        messageDTO(
          row,
          loaded.members.find((member) => member.id === row.senderMemberId)!,
          loaded.mine,
        ),
      ),
      pagination: {
        beforeCursor:
          page[0]?.sequence.toString() ??
          (hasMoreBefore ? beforeBoundary!.toString() : null),
        afterCursor: query.beforeCursor
          ? (page.at(-1)?.sequence.toString() ?? query.beforeCursor)
          : forward && hasMore
            ? page.at(-1)!.sequence.toString()
            : upper.toString(),
        hasMoreBefore,
        hasMoreAfter: forward && hasMore,
      },
    };
  }

  async send(
    actor: SocialActor,
    id: string,
    request: SendDirectMessageRequest,
  ) {
    const initial = await loadConversation(db, actor.userId, id);
    if (!initial.peer.userId) socialError('当前无法联系该道友', 403);
    const fingerprint = chatRequestFingerprint({
      conversationId: id,
      cultivatorId: actor.cultivatorId,
      text: request.text,
    });
    return db.transaction(async (tx) => {
      await lockSocialAccounts(tx, [actor.userId, initial.peer.userId!]);
      const loaded = await loadConversation(tx, actor.userId, id);
      if (loaded.mine.originalCultivatorId !== actor.cultivatorId)
        socialError('不能使用其他角色发送消息', 403);
      const [existingRequest] = await tx
        .select({ message: directMessages })
        .from(directMessages)
        .innerJoin(
          directConversationMembers,
          eq(directConversationMembers.id, directMessages.senderMemberId),
        )
        .where(
          and(
            eq(directConversationMembers.userId, actor.userId),
            eq(directMessages.clientMessageId, request.clientMessageId),
          ),
        )
        .limit(1);
      const existing = existingRequest?.message;
      if (existing) {
        if (existing.requestFingerprint !== fingerprint)
          socialError('同一发送标识不能用于不同消息', 409);
        return { message: messageDTO(existing, loaded.mine, loaded.mine) };
      }
      const reason = await sendBlockReason(tx, loaded.mine, loaded.peer, actor);
      if (reason) socialError(reason, 403);
      const allowed = await redis.eval(
        SEND_LIMIT_SCRIPT,
        2,
        `social:direct:second:${actor.userId}`,
        `social:direct:minute:${actor.userId}`,
      );
      if (Number(allowed) !== 1) socialError('发送过于频繁，请稍后再试', 429);
      const [conversation] = await tx
        .update(directConversations)
        .set({
          lastSequence: sql`${directConversations.lastSequence} + 1`,
          updatedAt: new Date(),
        })
        .where(eq(directConversations.id, id))
        .returning();
      const [row] = await tx
        .insert(directMessages)
        .values({
          conversationId: id,
          senderMemberId: loaded.mine.id,
          senderName: (await readSocialActor(tx, actor.cultivatorId))!.name,
          sequence: conversation!.lastSequence,
          clientMessageId: request.clientMessageId,
          requestFingerprint: fingerprint,
          textContent: textFilter.mask(request.text).text,
        })
        .returning();
      for (const member of loaded.members)
        if (member.userId)
          await enqueueSocialNotification(tx, member.userId, {
            cultivatorId: member.originalCultivatorId,
            kind: 'direct-chat',
            conversationId: id,
            sequence: conversation!.lastSequence,
          });
      return { message: messageDTO(row!, loaded.mine, loaded.mine) };
    });
  }

  async read(userId: string, id: string, messageId: string) {
    return db.transaction(async (tx) => {
      await lockSocialAccounts(tx, [userId]);
      const loaded = await loadConversation(tx, userId, id);
      const [message] = await tx
        .select({ sequence: directMessages.sequence })
        .from(directMessages)
        .where(
          and(
            eq(directMessages.id, messageId),
            eq(directMessages.conversationId, id),
          ),
        )
        .limit(1);
      if (!message) socialError('消息不属于此会话', 404);
      const [member] = await tx
        .update(directConversationMembers)
        .set({
          lastReadSequence: sql`greatest(${directConversationMembers.lastReadSequence}, ${message.sequence})`,
        })
        .where(eq(directConversationMembers.id, loaded.mine.id))
        .returning();
      await enqueueSocialNotification(tx, userId, {
        cultivatorId: loaded.mine.originalCultivatorId,
        kind: 'direct-chat',
        conversationId: id,
        sequence: member!.lastReadSequence,
      });
      return { lastReadSequence: member!.lastReadSequence };
    });
  }
}

export async function pruneDirectMessageBodies() {
  const rows = await db
    .update(directMessages)
    .set({ textContent: null, expiredAt: new Date() })
    .where(
      and(
        sql`${directMessages.textContent} is not null`,
        lte(directMessages.createdAt, new Date(Date.now() - RETENTION_MS)),
      ),
    )
    .returning({ id: directMessages.id });
  return rows.length;
}
