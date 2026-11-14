import type { FriendCultivatorSummary } from '@daoyou/contracts/friends';
import { MAX_FRIENDS_PER_CULTIVATOR } from '@daoyou/game-content/social/config';
import { HttpException } from '@nestjs/common';
import { authUsers } from '@server/lib/auth/schema.js';
import type { DbExecutor, DbTransaction } from '@server/lib/drizzle/db.js';
import {
  accountDeletionRecords,
  cultivatorFriends,
  cultivators,
  socialAccounts,
  socialBlocks,
} from '@server/lib/drizzle/schema.js';
import { and, eq, inArray, or, sql } from 'drizzle-orm';

export type SocialActor = { userId: string; cultivatorId: string };

export function socialError(message: string, status = 400): never {
  throw new HttpException({ error: message }, status);
}

/** All social writes lock stable account rows before any character/relationship row. */
export async function lockSocialAccounts(
  tx: DbTransaction,
  userIds: readonly string[],
) {
  const ids = [...new Set(userIds)].sort();
  for (const userId of ids) {
    await tx.insert(socialAccounts).values({ userId }).onConflictDoNothing();
  }
  await tx
    .select({ userId: socialAccounts.userId })
    .from(socialAccounts)
    .where(inArray(socialAccounts.userId, ids))
    .orderBy(socialAccounts.userId)
    .for('update');
  await tx
    .select({ id: cultivators.id })
    .from(cultivators)
    .where(
      and(inArray(cultivators.userId, ids), eq(cultivators.status, 'active')),
    )
    .orderBy(cultivators.id)
    .for('no key update');
}

export async function assertSocialContactAllowed(
  tx: DbExecutor,
  userId: string,
  targetUserId: string,
) {
  if (userId === targetUserId) socialError('不能与自己的角色建立此关系');
  await assertSocialAccountsAvailable(tx, [userId, targetUserId]);
  const [blocked] = await tx
    .select({ id: socialBlocks.id })
    .from(socialBlocks)
    .where(
      or(
        and(
          eq(socialBlocks.userId, userId),
          eq(socialBlocks.blockedUserId, targetUserId),
        ),
        and(
          eq(socialBlocks.userId, targetUserId),
          eq(socialBlocks.blockedUserId, userId),
        ),
      ),
    )
    .limit(1);
  if (blocked) socialError('当前无法联系该道友', 403);
}

export async function assertSocialAccountsAvailable(
  tx: DbExecutor,
  userIds: readonly string[],
) {
  const ids = [...new Set(userIds)];
  const [deleted] = await tx
    .select({ userId: accountDeletionRecords.userId })
    .from(accountDeletionRecords)
    .where(
      and(
        inArray(accountDeletionRecords.userId, ids),
        eq(accountDeletionRecords.status, 'completed'),
      ),
    )
    .limit(1);
  const users = await tx
    .select({ id: authUsers.id })
    .from(authUsers)
    .where(inArray(authUsers.id, ids));
  if (deleted || users.length !== ids.length)
    socialError('当前无法联系该道友', 403);
}

export async function readSocialActor(tx: DbExecutor, cultivatorId: string) {
  const [row] = await tx
    .select({
      id: cultivators.id,
      userId: cultivators.userId,
      name: cultivators.name,
      title: cultivators.title,
      realm: cultivators.realm,
      realmStage: cultivators.realm_stage,
      status: cultivators.status,
    })
    .from(cultivators)
    .where(eq(cultivators.id, cultivatorId))
    .limit(1);
  return row;
}

/** Caller has explicitly obtained both parties' consent and locked their accounts. */
export async function ensureFriendPairInTransaction(
  tx: DbTransaction,
  actor: SocialActor,
  target: SocialActor,
): Promise<FriendCultivatorSummary> {
  await assertSocialContactAllowed(tx, actor.userId, target.userId);
  const ids = [actor.cultivatorId, target.cultivatorId].sort();
  const rows = await tx
    .select()
    .from(cultivators)
    .where(inArray(cultivators.id, ids))
    .orderBy(cultivators.id)
    .for('no key update');
  const current = rows.find((row) => row.id === actor.cultivatorId);
  const peer = rows.find((row) => row.id === target.cultivatorId);
  if (
    !current ||
    !peer ||
    current.userId !== actor.userId ||
    peer.userId !== target.userId ||
    current.status !== 'active' ||
    peer.status !== 'active'
  ) {
    socialError('道友状态已变化，请刷新后重试', 409);
  }
  const existing = await tx
    .select({
      cultivatorId: cultivatorFriends.cultivatorId,
      friendCultivatorId: cultivatorFriends.friendCultivatorId,
    })
    .from(cultivatorFriends)
    .where(
      and(
        inArray(cultivatorFriends.cultivatorId, ids),
        inArray(cultivatorFriends.friendCultivatorId, ids),
      ),
    );
  const counts = await tx
    .select({
      cultivatorId: cultivatorFriends.cultivatorId,
      count: sql<number>`count(*)::int`,
    })
    .from(cultivatorFriends)
    .where(inArray(cultivatorFriends.cultivatorId, ids))
    .groupBy(cultivatorFriends.cultivatorId);
  for (const id of ids) {
    if (
      !existing.some((row) => row.cultivatorId === id) &&
      (counts.find((row) => row.cultivatorId === id)?.count ?? 0) >=
        MAX_FRIENDS_PER_CULTIVATOR
    ) {
      socialError(
        id === actor.cultivatorId
          ? '好友名录已满，请先移除一位道友'
          : '该道友的好友名录已满',
        409,
      );
    }
  }
  await tx
    .insert(cultivatorFriends)
    .values([
      {
        cultivatorId: actor.cultivatorId,
        friendCultivatorId: target.cultivatorId,
      },
      {
        cultivatorId: target.cultivatorId,
        friendCultivatorId: actor.cultivatorId,
      },
    ])
    .onConflictDoNothing();
  return {
    id: peer.id,
    name: peer.name,
    title: peer.title,
    realm: peer.realm,
    realmStage: peer.realm_stage,
    status: peer.status,
  };
}
