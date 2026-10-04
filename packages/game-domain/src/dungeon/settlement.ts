export const DUNGEON_REWARD_TIERS = ['S', 'A', 'B', 'C', 'D'] as const;

export type DungeonRewardTier = (typeof DUNGEON_REWARD_TIERS)[number];

export type DungeonEndDisposition =
  'completed' | 'retreated_after_battle' | 'abandoned_before_battle';
