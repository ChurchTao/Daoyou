import { FRIEND_SEARCH_COOLDOWN_SECONDS } from '@daoyou/game-content/social/config';
import { HttpException, Injectable } from '@nestjs/common';
import type { ActiveCultivatorRef } from '@server/lib/auth/types.js';
import { db } from '@server/lib/drizzle/db.js';
import { acquireRedisCooldown } from '@server/lib/redis/cooldownLimiter.js';
import {
  getInviteTarget,
  listFriends,
  removeFriendPair,
  searchActiveCultivatorsByExactName,
} from '@server/social/application/FriendService.js';
import {
  createFriendRequest,
  friendRequestDTO,
  pendingFriendRequest,
} from './application/FriendRequestService.js';
import {
  assertSocialContactAllowed,
  lockSocialAccounts,
  readSocialActor,
} from './application/SocialTransaction.js';
import { enqueueSocialNotification } from './social-notifications.js';

@Injectable()
export class FriendsService {
  async list(cultivatorId: string) {
    return { friends: await listFriends(cultivatorId) };
  }

  async search(cultivatorId: string, name: string) {
    const cooldown = await acquireRedisCooldown({
      key: `friends:search:cooldown:${cultivatorId}`,
      cooldownSeconds: FRIEND_SEARCH_COOLDOWN_SECONDS,
      allowWhenRedisUnavailable: true,
    });
    if (!cooldown.allowed)
      throw new HttpException(
        { error: `请 ${cooldown.remainingSeconds} 秒后再搜索` },
        429,
      );
    const results = await searchActiveCultivatorsByExactName(
      cultivatorId,
      name,
    );
    for (const target of results) {
      const decorated = await this.invite(cultivatorId, target.id);
      target.relationship = decorated.relationship;
      target.isFriend = decorated.isFriend;
      target.request = 'request' in decorated ? decorated.request : undefined;
    }
    return { results };
  }

  async invite(cultivatorId: string, target: string) {
    const result = await getInviteTarget(cultivatorId, target);
    const current = await readSocialActor(db, cultivatorId);
    const peer = await readSocialActor(db, target);
    if (current && peer) {
      try {
        await assertSocialContactAllowed(db, current.userId, peer.userId);
      } catch (error) {
        if (!(error instanceof HttpException) || error.getStatus() !== 403)
          throw error;
        return {
          ...result,
          relationship: 'unavailable' as const,
          isFriend: false,
        };
      }
    }
    if (result.isFriend) return result;
    const request = await pendingFriendRequest(db, cultivatorId, target);
    return request
      ? {
          ...result,
          relationship:
            request.requesterCultivatorId === cultivatorId
              ? ('outgoing' as const)
              : ('incoming' as const),
          request: await friendRequestDTO(db, request, cultivatorId),
        }
      : result;
  }

  add(actor: ActiveCultivatorRef, target: string, requestId: string) {
    return createFriendRequest(
      { userId: actor.userId, cultivatorId: actor.cultivatorId },
      target,
      requestId,
    );
  }

  async remove(actor: ActiveCultivatorRef, target: string) {
    const peer = await readSocialActor(db, target);
    await db.transaction(async (tx) => {
      await lockSocialAccounts(tx, [
        actor.userId,
        ...(peer ? [peer.userId] : []),
      ]);
      await removeFriendPair(actor.cultivatorId, target, tx);
      await enqueueSocialNotification(tx, actor.userId, {
        cultivatorId: actor.cultivatorId,
        kind: 'friends',
      });
      if (peer)
        await enqueueSocialNotification(tx, peer.userId, {
          cultivatorId: target,
          kind: 'friends',
        });
    });
    return { message: '已移出好友名录' };
  }
}
