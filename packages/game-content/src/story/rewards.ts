import {
  STORY_REWARD_PACK,
  STORY_STARTER_BEAST_GRANT,
  type StoryRewardPack,
} from '../rewards/story-pack.js';

export function hasStoryReward(
  id: string,
  pack: StoryRewardPack = STORY_REWARD_PACK,
): boolean {
  return (
    id === STORY_STARTER_BEAST_GRANT ||
    pack.payouts.some((payout) => payout.id === id)
  );
}
