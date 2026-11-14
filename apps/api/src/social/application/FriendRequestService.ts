import type {
  FriendCultivatorSummary,
  FriendRequestDTO,
  FriendRequestResult,
  FriendRequestStatus,
} from '@daoyou/contracts/friends';
import type { DbExecutor, DbTransaction } from '@server/lib/drizzle/db.js';
import { db } from '@server/lib/drizzle/db.js';
import { friendRequests } from '@server/lib/drizzle/schema.js';
import { and, desc, eq, gt, lte, or, sql } from 'drizzle-orm';
import { enqueueSocialNotification } from '../social-notifications.js';
import { areFriends } from './FriendService.js';
import {
  assertSocialContactAllowed,
  ensureFriendPairInTransaction,
  lockSocialAccounts,
  readSocialActor,
  socialError,
  type SocialActor,
} from './SocialTransaction.js';

type RequestRow = typeof friendRequests.$inferSelect;
const DAY = 86_400_000;

async function summary(
  q: DbExecutor,
  id: string,
): Promise<FriendCultivatorSummary> {
  const row = await readSocialActor(q, id);
  return row
    ? {
        id: row.id,
        name: row.name,
        title: row.title,
        realm: row.realm,
        realmStage: row.realmStage,
        status: row.status,
      }
    : {
        id,
        name: '已离去的道友',
        title: null,
        realm: '',
        realmStage: '',
        status: 'deleted',
      };
}

export async function friendRequestDTO(
  q: DbExecutor,
  row: RequestRow,
  cultivatorId: string,
): Promise<FriendRequestDTO> {
  return {
    id: row.id,
    requester: await summary(q, row.requesterCultivatorId),
    recipient: await summary(q, row.recipientCultivatorId),
    direction:
      row.recipientCultivatorId === cultivatorId ? 'incoming' : 'outgoing',
    status:
      row.status === 'pending' && row.expiresAt <= new Date()
        ? 'expired'
        : (row.status as FriendRequestStatus),
    revision: row.revision,
    createdAt: row.createdAt.toISOString(),
    expiresAt: row.expiresAt.toISOString(),
  };
}

export async function pendingFriendRequest(
  q: DbExecutor,
  cultivatorId: string,
  targetId: string,
  at = new Date(),
) {
  const [row] = await q
    .select()
    .from(friendRequests)
    .where(
      and(
        eq(friendRequests.pairKey, [cultivatorId, targetId].sort().join(':')),
        eq(friendRequests.status, 'pending'),
        gt(friendRequests.expiresAt, at),
      ),
    )
    .limit(1);
  return row;
}

export async function listFriendRequests(actor: SocialActor) {
  const rows = await db
    .select()
    .from(friendRequests)
    .where(
      or(
        eq(friendRequests.requesterCultivatorId, actor.cultivatorId),
        eq(friendRequests.recipientCultivatorId, actor.cultivatorId),
      ),
    )
    .orderBy(desc(friendRequests.createdAt))
    .limit(100);
  const requests: FriendRequestDTO[] = [];
  for (const row of rows)
    requests.push(await friendRequestDTO(db, row, actor.cultivatorId));
  return { requests };
}

async function notify(tx: DbTransaction, row: RequestRow) {
  await enqueueSocialNotification(tx, row.requesterUserId, {
    cultivatorId: row.requesterCultivatorId,
    kind: 'friends',
  });
  await enqueueSocialNotification(tx, row.recipientUserId, {
    cultivatorId: row.recipientCultivatorId,
    kind: 'friends',
  });
}

export async function createFriendRequest(
  actor: SocialActor,
  targetId: string,
  requestId: string,
): Promise<FriendRequestResult> {
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
    const [existing] = await tx
      .select()
      .from(friendRequests)
      .where(
        and(
          eq(friendRequests.requesterUserId, actor.userId),
          eq(friendRequests.requestId, requestId),
        ),
      )
      .limit(1);
    if (existing) {
      if (
        existing.requesterCultivatorId !== actor.cultivatorId ||
        existing.recipientCultivatorId !== targetId
      )
        socialError('同一请求标识不能用于不同道友', 409);
      return {
        relationship: (await areFriends(actor.cultivatorId, targetId, tx))
          ? 'friend'
          : existing.status === 'pending' && existing.expiresAt > new Date()
            ? 'outgoing'
            : 'none',
        request: await friendRequestDTO(tx, existing, actor.cultivatorId),
        message: '申请已处理',
      };
    }
    if (await areFriends(actor.cultivatorId, targetId, tx))
      return {
        relationship: 'friend',
        friend: await summary(tx, targetId),
        message: '已在好友名录中',
      };
    const pairKey = [actor.cultivatorId, targetId].sort().join(':');
    const evaluatedAt = new Date();
    await tx
      .update(friendRequests)
      .set({
        status: 'expired',
        updatedAt: new Date(),
        revision: sql`${friendRequests.revision} + 1`,
      })
      .where(
        and(
          eq(friendRequests.pairKey, pairKey),
          eq(friendRequests.status, 'pending'),
          lte(friendRequests.expiresAt, evaluatedAt),
        ),
      );
    const pending = await pendingFriendRequest(
      tx,
      actor.cultivatorId,
      targetId,
      evaluatedAt,
    );
    if (pending)
      return {
        relationship:
          pending.requesterCultivatorId === actor.cultivatorId
            ? 'outgoing'
            : 'incoming',
        request: await friendRequestDTO(tx, pending, actor.cultivatorId),
        message:
          pending.requesterCultivatorId === actor.cultivatorId
            ? '已发出结缘申请'
            : '请先处理对方的结缘申请',
      };
    const [recentRejection] = await tx
      .select({ id: friendRequests.id })
      .from(friendRequests)
      .where(
        and(
          eq(friendRequests.pairKey, pairKey),
          eq(friendRequests.requesterUserId, actor.userId),
          eq(friendRequests.status, 'rejected'),
          gt(friendRequests.updatedAt, new Date(Date.now() - DAY)),
        ),
      )
      .limit(1);
    if (recentRejection) socialError('请在拒绝后的 24 小时后再发出申请', 429);
    const [count] = await tx
      .select({ count: sql<number>`count(*)::int` })
      .from(friendRequests)
      .where(
        and(
          eq(friendRequests.requesterUserId, actor.userId),
          gt(friendRequests.createdAt, new Date(Date.now() - DAY)),
        ),
      );
    if ((count?.count ?? 0) >= 20)
      socialError('24 小时内最多发出 20 次结缘申请', 429);
    const [row] = await tx
      .insert(friendRequests)
      .values({
        pairKey,
        requesterCultivatorId: actor.cultivatorId,
        recipientCultivatorId: targetId,
        requesterUserId: actor.userId,
        recipientUserId: target.userId,
        requestId,
        status: 'pending',
        expiresAt: new Date(Date.now() + 7 * DAY),
      })
      .returning();
    await notify(tx, row!);
    return {
      relationship: 'outgoing',
      request: await friendRequestDTO(tx, row!, actor.cultivatorId),
      message: '已发出结缘申请',
    };
  });
}

export async function actOnFriendRequest(
  actor: SocialActor,
  id: string,
  action: 'accept' | 'reject' | 'cancel',
  expectedRevision: number,
): Promise<FriendRequestResult> {
  const [initial] = await db
    .select()
    .from(friendRequests)
    .where(eq(friendRequests.id, id))
    .limit(1);
  if (!initial) socialError('结缘申请不存在', 404);
  return db.transaction(async (tx) => {
    await lockSocialAccounts(tx, [
      initial.requesterUserId,
      initial.recipientUserId,
    ]);
    const [row] = await tx
      .select()
      .from(friendRequests)
      .where(eq(friendRequests.id, id))
      .for('update');
    if (!row) socialError('结缘申请不存在', 404);
    const allowed =
      action === 'cancel'
        ? row.requesterUserId === actor.userId &&
          row.requesterCultivatorId === actor.cultivatorId
        : row.recipientUserId === actor.userId &&
          row.recipientCultivatorId === actor.cultivatorId;
    if (!allowed) socialError('不能处理这份结缘申请', 403);
    const status =
      action === 'accept'
        ? 'accepted'
        : action === 'reject'
          ? 'rejected'
          : 'cancelled';
    if (row.status === status)
      return {
        relationship: (await areFriends(
          row.requesterCultivatorId,
          row.recipientCultivatorId,
          tx,
        ))
          ? 'friend'
          : 'none',
        request: await friendRequestDTO(tx, row, actor.cultivatorId),
        message: '申请已处理',
      };
    if (row.status !== 'pending' || row.expiresAt <= new Date())
      socialError('这份结缘申请已失效', 409);
    if (row.revision !== expectedRevision)
      socialError('申请已变化，请刷新后重试', 409);
    let friend: FriendCultivatorSummary | undefined;
    if (action === 'accept')
      friend = await ensureFriendPairInTransaction(
        tx,
        {
          userId: row.recipientUserId,
          cultivatorId: row.recipientCultivatorId,
        },
        {
          userId: row.requesterUserId,
          cultivatorId: row.requesterCultivatorId,
        },
      );
    const [updated] = await tx
      .update(friendRequests)
      .set({
        status,
        revision: sql`${friendRequests.revision} + 1`,
        updatedAt: new Date(),
      })
      .where(eq(friendRequests.id, id))
      .returning();
    await notify(tx, row);
    return {
      relationship: action === 'accept' ? 'friend' : 'none',
      friend,
      request: await friendRequestDTO(tx, updated!, actor.cultivatorId),
      message: action === 'accept' ? '已加入好友名录' : '申请已处理',
    };
  });
}
