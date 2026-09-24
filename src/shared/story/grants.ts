import { rollDrops } from '../drops';
import { SeededRng } from '../engine/combat-v6/core';
import type { ItemGrant } from '../inventory';
import {
  STORY_REWARD_PACK,
  STORY_SPIRIT_STONE_REWARD,
  storyDropPool,
  type StoryRewardPack,
} from '../rewards/story-pack';

export interface PlannedStoryReward {
  items: ItemGrant[];
  spiritStones: number;
}

function hashSeed(text: string): number {
  let hash = 2166136261;
  for (const char of text) {
    hash ^= char.charCodeAt(0);
    hash = Math.imul(hash, 16777619);
  }
  return hash >>> 0;
}

export function hasStoryReward(
  id: string,
  pack: StoryRewardPack = STORY_REWARD_PACK,
): boolean {
  return pack.payouts.some((payout) => payout.id === id);
}

export function storyReward(
  id: string,
  seed: string,
  pack: StoryRewardPack = STORY_REWARD_PACK,
): PlannedStoryReward {
  const payout = pack.payouts.find((entry) => entry.id === id);
  if (!payout) throw new Error(`没有这份奖励：${id}`);
  const pool = storyDropPool(payout);
  const rolled = rollDrops(pool, (groupId) => {
    const rng = new SeededRng(
      hashSeed(`${seed}:${id}:${pool.version}:${groupId}`),
    );
    return () => rng.next();
  });
  const items: ItemGrant[] = [];
  let spiritStones = 0;
  for (const reward of rolled.rewards) {
    if (reward.rewardId === STORY_SPIRIT_STONE_REWARD) {
      spiritStones += reward.quantity;
      continue;
    }
    const material = pack.materials[reward.rewardId];
    if (material) {
      const existing = items.find(
        (item) =>
          item.definitionId === 'material.v1' &&
          JSON.stringify(item.instanceData) === JSON.stringify(material),
      );
      if (existing) existing.quantity += reward.quantity;
      else {
        items.push({
          definitionId: 'material.v1',
          quantity: reward.quantity,
          instanceData: material,
        });
      }
      continue;
    }
    const existing = items.find(
      (item) => item.definitionId === reward.rewardId && !item.instanceData,
    );
    if (existing) existing.quantity += reward.quantity;
    else {
      items.push({
        definitionId: reward.rewardId,
        quantity: reward.quantity,
      });
    }
  }
  return { items, spiritStones };
}
