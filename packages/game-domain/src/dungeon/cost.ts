export const DUNGEON_COST_RANK_VALUES = ['minor', 'standard', 'major'] as const;

export type DungeonCostRank = (typeof DUNGEON_COST_RANK_VALUES)[number];

export type DungeonRankedResourceType =
  'spirit_stones' | 'lifespan' | 'cultivation_exp' | 'comprehension_insight';
