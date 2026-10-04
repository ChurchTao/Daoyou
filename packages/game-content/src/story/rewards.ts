import {
  STORY_REWARD_PACK,
  type StoryRewardPack,
} from '../rewards/story-pack.js';

export function hasStoryReward(
  id: string,
  pack: StoryRewardPack = STORY_REWARD_PACK,
): boolean {
  return pack.payouts.some((payout) => payout.id === id);
}
