import type {
  DungeonCostRank,
  DungeonDifficultyTier,
} from '@daoyou/game-domain/dungeon';
import type { RealmType } from '@daoyou/constants/realms';

export const DUNGEON_LIFESPAN_COST_MAX = 120;

export const DUNGEON_DIFFICULTY_COST_MULTIPLIER: Record<
  DungeonDifficultyTier,
  number
> = {
  easy: 0.75,
  normal: 1,
  hard: 1.25,
  elite: 1.5,
  boss: 1.8,
};

export const DUNGEON_COST_RANK_MULTIPLIER: Record<DungeonCostRank, number> = {
  minor: 0.5,
  standard: 1,
  major: 1.75,
};

export const DUNGEON_LIFESPAN_COST_BASE: Record<RealmType, number> = {
  炼气: 1,
  筑基: 2,
  金丹: 3,
  元婴: 5,
  化神: 8,
  炼虚: 12,
  合体: 18,
  大乘: 25,
  渡劫: 35,
};

export const DUNGEON_MATERIAL_QUALITY_VALUES = [
  '凡品',
  '灵品',
  '玄品',
  '真品',
  '地品',
  '天品',
  '仙品',
] as const;

export type DungeonMaterialQuality =
  (typeof DUNGEON_MATERIAL_QUALITY_VALUES)[number];
