import { FRIEND_SEARCH_COOLDOWN_SECONDS } from '@daoyou/shared/config/socialConfig';
import { HttpException, Injectable } from '@nestjs/common';
import { acquireRedisCooldown } from '@server/lib/redis/cooldownLimiter.js';
import {
  addFriendPair,
  getInviteTarget,
  listFriends,
  removeFriendPair,
  searchActiveCultivatorsByExactName,
} from '@server/social/application/FriendService.js';

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
    return {
      results: await searchActiveCultivatorsByExactName(cultivatorId, name),
    };
  }

  invite(cultivatorId: string, target: string) {
    return getInviteTarget(cultivatorId, target);
  }

  async add(cultivatorId: string, target: string) {
    return {
      friend: await addFriendPair(cultivatorId, target),
      message: '已加入好友名录',
    };
  }

  async remove(cultivatorId: string, target: string) {
    await removeFriendPair(cultivatorId, target);
    return { message: '已移出好友名录' };
  }
}
