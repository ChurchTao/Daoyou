import { hasStoryGift } from './gifts.js';

/** 主线里写的奖励、赠礼编号有没有着落。 */
export function hasStoryReward(id: string): boolean {
  return hasStoryGift(id);
}
