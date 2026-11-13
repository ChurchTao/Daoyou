import { authUsers } from '@server/lib/auth/schema.js';
import { db, type DbTransaction } from '@server/lib/drizzle/db.js';
import * as s from '@server/lib/drizzle/schema.js';
import { and, eq, inArray, isNull, or, sql } from 'drizzle-orm';
import { randomUUID } from 'node:crypto';
import { lockSocialAccounts } from './application/SocialTransaction.js';
import { pruneDirectMessageBodies } from './direct-messages.service.js';
import {
  enqueueSocialNotification,
  socialNotificationSubject,
} from './social-notifications.js';

export async function endSocialRelationsForCharacter(
  tx: DbTransaction,
  cultivatorId: string,
  reason: 'death' | 'deleted' | 'transferred' | 'account-deleted',
): Promise<void> {
  const relations = await tx
    .update(s.mentorshipRelations)
    .set({
      status: 'dissolved',
      endedAt: new Date(),
      endReason: reason,
      revision: sql`${s.mentorshipRelations.revision} + 1`,
    })
    .where(
      and(
        eq(s.mentorshipRelations.status, 'active'),
        or(
          eq(s.mentorshipRelations.mentorCultivatorId, cultivatorId),
          eq(s.mentorshipRelations.discipleCultivatorId, cultivatorId),
        ),
      ),
    )
    .returning();
  await tx
    .update(s.mentorshipProfiles)
    .set({ open: false })
    .where(eq(s.mentorshipProfiles.cultivatorId, cultivatorId));
  await tx
    .update(s.mentorshipRequests)
    .set({
      status: 'cancelled',
      revision: sql`${s.mentorshipRequests.revision} + 1`,
    })
    .where(
      and(
        eq(s.mentorshipRequests.status, 'pending'),
        or(
          eq(s.mentorshipRequests.mentorCultivatorId, cultivatorId),
          eq(s.mentorshipRequests.discipleCultivatorId, cultivatorId),
        ),
      ),
    );
  await tx
    .update(s.friendRequests)
    .set({
      status: 'cancelled',
      updatedAt: new Date(),
      revision: sql`${s.friendRequests.revision} + 1`,
    })
    .where(
      and(
        eq(s.friendRequests.status, 'pending'),
        or(
          eq(s.friendRequests.requesterCultivatorId, cultivatorId),
          eq(s.friendRequests.recipientCultivatorId, cultivatorId),
        ),
      ),
    );
  for (const relation of relations) {
    await enqueueSocialNotification(tx, relation.mentorUserId, {
      kind: 'mentorship',
      cultivatorId: relation.mentorCultivatorId,
    });
    await enqueueSocialNotification(tx, relation.discipleUserId, {
      kind: 'mentorship',
      cultivatorId: relation.discipleCultivatorId,
    });
  }
}

async function eraseSocialAccount(
  tx: DbTransaction,
  userId: string,
  characterIds: string[],
) {
  const erasedId = randomUUID();
  for (const id of characterIds)
    await endSocialRelationsForCharacter(tx, id, 'account-deleted');
  const members = await tx
    .select()
    .from(s.directConversationMembers)
    .where(eq(s.directConversationMembers.userId, userId));
  const memberIds = members.map((m) => m.id);
  if (memberIds.length) {
    await tx
      .update(s.directMessages)
      .set({
        textContent: null,
        senderName: '已注销道友',
        expiredAt: new Date(),
      })
      .where(inArray(s.directMessages.senderMemberId, memberIds));
    await tx
      .update(s.directConversationMembers)
      .set({
        userId: null,
        originalCultivatorId: null,
        name: '已注销道友',
      })
      .where(inArray(s.directConversationMembers.id, memberIds));
    for (const member of members) {
      await tx
        .update(s.directConversations)
        .set({ pairKey: `erased:${member.conversationId}` })
        .where(eq(s.directConversations.id, member.conversationId));
      const peers = await tx
        .select()
        .from(s.directConversationMembers)
        .where(
          eq(s.directConversationMembers.conversationId, member.conversationId),
        );
      for (const peer of peers) {
        if (peer.userId)
          await enqueueSocialNotification(tx, peer.userId, {
            kind: 'direct-chat',
            cultivatorId: peer.originalCultivatorId,
            conversationId: member.conversationId,
          });
      }
    }
  }
  if (characterIds.length) {
    await tx
      .delete(s.cultivatorFriends)
      .where(
        or(
          inArray(s.cultivatorFriends.cultivatorId, characterIds),
          inArray(s.cultivatorFriends.friendCultivatorId, characterIds),
        ),
      );
  }
  await tx
    .delete(s.friendRequests)
    .where(
      or(
        eq(s.friendRequests.requesterUserId, userId),
        eq(s.friendRequests.recipientUserId, userId),
      ),
    );
  await tx
    .delete(s.socialBlocks)
    .where(
      or(
        eq(s.socialBlocks.userId, userId),
        eq(s.socialBlocks.blockedUserId, userId),
      ),
    );
  await tx
    .delete(s.mentorshipRequests)
    .where(
      or(
        eq(s.mentorshipRequests.mentorUserId, userId),
        eq(s.mentorshipRequests.discipleUserId, userId),
      ),
    );
  await tx
    .update(s.mentorshipGuidance)
    .set({ content: '', mentorUserId: erasedId })
    .where(eq(s.mentorshipGuidance.mentorUserId, userId));
  await tx
    .update(s.mentorshipGuidance)
    .set({ content: '', discipleUserId: erasedId })
    .where(eq(s.mentorshipGuidance.discipleUserId, userId));
  await tx
    .update(s.mentorshipRelations)
    .set({
      mentorUserId: erasedId,
      mentorCultivatorId: null,
      mentorOriginalCultivatorId: erasedId,
      mentorName: '已注销道友',
    })
    .where(eq(s.mentorshipRelations.mentorUserId, userId));
  await tx
    .update(s.mentorshipRelations)
    .set({
      discipleUserId: erasedId,
      discipleCultivatorId: null,
      discipleOriginalCultivatorId: erasedId,
      discipleName: '已注销道友',
    })
    .where(eq(s.mentorshipRelations.discipleUserId, userId));
  await tx
    .update(s.mentorshipAccountStates)
    .set({ firstMentorUserId: null, firstMentorCultivatorId: null })
    .where(eq(s.mentorshipAccountStates.firstMentorUserId, userId));
  await tx
    .delete(s.mentorshipProfiles)
    .where(eq(s.mentorshipProfiles.userId, userId));
  await tx
    .delete(s.mentorshipAccountStates)
    .where(eq(s.mentorshipAccountStates.userId, userId));
  if (characterIds.length)
    await tx
      .delete(s.achievementUnlocks)
      .where(inArray(s.achievementUnlocks.cultivatorId, characterIds));
  if (characterIds.length)
    await tx.delete(s.achievementMetrics)
      .where(inArray(s.achievementMetrics.cultivatorId, characterIds));
  await tx.delete(s.socialAccounts).where(eq(s.socialAccounts.userId, userId));
  // Notifications carry no text, but their destination is still an account identifier.
  await tx
    .delete(s.transactionalMessages)
    .where(
      and(
        eq(s.transactionalMessages.messageKey, 'social.notification'),
        eq(
          s.transactionalMessages.destination,
          socialNotificationSubject(userId),
        ),
      ),
    );
}

export async function runSocialMaintenance(): Promise<number> {
  let processed = 0;
  processed += await pruneDirectMessageBodies();
  const deletions = await db
    .select({ record: s.accountDeletionRecords })
    .from(s.accountDeletionRecords)
    .leftJoin(authUsers, eq(authUsers.id, s.accountDeletionRecords.userId))
    .where(
      and(
        eq(s.accountDeletionRecords.socialCleanupStatus, 'pending'),
        isNull(authUsers.id),
      ),
    )
    .limit(50);
  for (const { record: deletion } of deletions) {
    // afterDelete can fail after Auth has committed; actual account absence is authoritative.
    const [present] = await db
      .select({ id: authUsers.id })
      .from(authUsers)
      .where(eq(authUsers.id, deletion.userId));
    if (present) continue;
    try {
      await db.transaction(async (tx) => {
        // Drain in-flight social writes before discovering and erasing their records.
        await lockSocialAccounts(tx, [deletion.userId]);
        const [record] = await tx
          .select()
          .from(s.accountDeletionRecords)
          .where(eq(s.accountDeletionRecords.id, deletion.id))
          .for('update');
        if (!record || record.socialCleanupStatus !== 'pending') return;
        await eraseSocialAccount(tx, record.userId, record.cultivatorIds);
        await tx
          .update(s.accountDeletionRecords)
          .set({
            socialCleanupStatus: 'completed',
            socialCleanupCompletedAt: new Date(),
            socialCleanupError: null,
            socialCleanupAttempts: sql`${s.accountDeletionRecords.socialCleanupAttempts} + 1`,
          })
          .where(eq(s.accountDeletionRecords.id, record.id));
      });
      processed++;
    } catch {
      await db
        .update(s.accountDeletionRecords)
        .set({
          socialCleanupAttempts: sql`${s.accountDeletionRecords.socialCleanupAttempts} + 1`,
          socialCleanupError: '社交清理未完成，等待重试',
        })
        .where(eq(s.accountDeletionRecords.id, deletion.id));
    }
  }
  return processed;
}
