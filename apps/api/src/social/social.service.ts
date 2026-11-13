import type { SocialBlockDTO, SocialSummary } from '@daoyou/contracts/social';
import { Inject, Injectable } from '@nestjs/common';
import { db } from '@server/lib/drizzle/db.js';
import {
  cultivatorFriends,
  cultivators,
  friendRequests,
  mentorshipRelations,
  mentorshipRequests,
  socialBlocks,
} from '@server/lib/drizzle/schema.js';
import { getMentorshipSummary } from '@server/mentorship/application/MentorshipQueries.js';
import { and, desc, eq, gt, inArray, or, sql } from 'drizzle-orm';
import {
  assertSocialAccountsAvailable,
  lockSocialAccounts,
  readSocialActor,
  socialError,
  type SocialActor,
} from './application/SocialTransaction.js';
import { DirectMessagesService } from './direct-messages.service.js';
import { enqueueSocialNotification } from './social-notifications.js';

@Injectable()
export class SocialService {
  constructor(
    @Inject(DirectMessagesService)
    private readonly directMessages: DirectMessagesService,
  ) {}

  async summary(userId: string): Promise<SocialSummary> {
    const [active] = await db
      .select({ id: cultivators.id })
      .from(cultivators)
      .where(
        and(eq(cultivators.userId, userId), eq(cultivators.status, 'active')),
      )
      .limit(1);
    const unread = await this.directMessages.unreadSummary(
      userId,
      active?.id ?? null,
    );
    const [requests] = active
      ? await db
          .select({ count: sql<number>`count(*)::int` })
          .from(friendRequests)
          .where(
            and(
              eq(friendRequests.recipientCultivatorId, active.id),
              eq(friendRequests.status, 'pending'),
              gt(friendRequests.expiresAt, new Date()),
            ),
          )
      : [];
    return {
      ...unread,
      friendRequests: requests?.count ?? 0,
      ...(await getMentorshipSummary(userId, active?.id ?? null)),
    };
  }

  async blocks(userId: string): Promise<{ blocks: SocialBlockDTO[] }> {
    const rows = await db
      .select()
      .from(socialBlocks)
      .where(eq(socialBlocks.userId, userId))
      .orderBy(desc(socialBlocks.createdAt));
    return {
      blocks: rows.map((row) => ({
        id: row.id,
        name: row.targetName,
        createdAt: row.createdAt.toISOString(),
      })),
    };
  }

  async block(actor: SocialActor, targetId: string) {
    const peer = await readSocialActor(db, targetId);
    if (!peer) socialError('未找到该道友', 404);
    if (peer.userId === actor.userId) socialError('不能屏蔽自己的角色');
    await db.transaction(async (tx) => {
      await lockSocialAccounts(tx, [actor.userId, peer.userId]);
      await assertSocialAccountsAvailable(tx, [actor.userId, peer.userId]);
      const rows = await tx
        .select({ id: cultivators.id, userId: cultivators.userId })
        .from(cultivators)
        .where(inArray(cultivators.userId, [actor.userId, peer.userId]));
      const mine = rows
        .filter((row) => row.userId === actor.userId)
        .map((row) => row.id);
      const theirs = rows
        .filter((row) => row.userId === peer.userId)
        .map((row) => row.id);
      await tx
        .insert(socialBlocks)
        .values({
          userId: actor.userId,
          blockedUserId: peer.userId,
          targetName: peer.name,
        })
        .onConflictDoNothing();
      if (mine.length && theirs.length)
        await tx
          .delete(cultivatorFriends)
          .where(
            or(
              and(
                inArray(cultivatorFriends.cultivatorId, mine),
                inArray(cultivatorFriends.friendCultivatorId, theirs),
              ),
              and(
                inArray(cultivatorFriends.cultivatorId, theirs),
                inArray(cultivatorFriends.friendCultivatorId, mine),
              ),
            ),
          );
      const pair = [actor.userId, peer.userId];
      await tx
        .update(friendRequests)
        .set({
          status: 'cancelled',
          revision: sql`${friendRequests.revision} + 1`,
          updatedAt: new Date(),
        })
        .where(
          and(
            inArray(friendRequests.requesterUserId, pair),
            inArray(friendRequests.recipientUserId, pair),
            eq(friendRequests.status, 'pending'),
          ),
        );
      await tx
        .update(mentorshipRequests)
        .set({
          status: 'cancelled',
          revision: sql`${mentorshipRequests.revision} + 1`,
        })
        .where(
          and(
            inArray(mentorshipRequests.mentorUserId, pair),
            inArray(mentorshipRequests.discipleUserId, pair),
            eq(mentorshipRequests.status, 'pending'),
          ),
        );
      await tx
        .update(mentorshipRelations)
        .set({
          status: 'dissolved',
          endedAt: new Date(),
          endReason: 'blocked',
          revision: sql`${mentorshipRelations.revision} + 1`,
        })
        .where(
          and(
            inArray(mentorshipRelations.mentorUserId, pair),
            inArray(mentorshipRelations.discipleUserId, pair),
            eq(mentorshipRelations.status, 'active'),
          ),
        );
      await enqueueSocialNotification(tx, actor.userId, {
        cultivatorId: actor.cultivatorId,
        kind: 'friends',
      });
      await enqueueSocialNotification(tx, peer.userId, {
        cultivatorId: peer.id,
        kind: 'friends',
      });
      await enqueueSocialNotification(tx, actor.userId, {
        cultivatorId: actor.cultivatorId,
        kind: 'mentorship',
      });
      await enqueueSocialNotification(tx, peer.userId, {
        cultivatorId: peer.id,
        kind: 'mentorship',
      });
    });
    return { message: '已屏蔽该账号，不再接收新的直接联系' };
  }

  async unblock(userId: string, blockId: string) {
    await db.transaction(async (tx) => {
      await lockSocialAccounts(tx, [userId]);
      await tx
        .delete(socialBlocks)
        .where(
          and(eq(socialBlocks.id, blockId), eq(socialBlocks.userId, userId)),
        );
      await enqueueSocialNotification(tx, userId, {
        cultivatorId: null,
        kind: 'friends',
      });
    });
    return { message: '已解除屏蔽，好友关系需重新申请' };
  }
}
