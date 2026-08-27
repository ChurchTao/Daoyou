import { REALM_DAILY_EXP_BUDGET } from '@shared/config/cultivationExpGain';
import type { DungeonDifficultyTier } from '@shared/lib/game/mapSystem';
import { REALM_ORDER, type RealmType } from '@shared/types/constants';

export const DUNGEON_COST_RANK_VALUES = ['minor', 'standard', 'major'] as const;

export type DungeonCostRank = (typeof DUNGEON_COST_RANK_VALUES)[number];

export type DungeonRankedResourceType =
  'spirit_stones' | 'lifespan' | 'cultivation_exp' | 'comprehension_insight';

export const DUNGEON_LIFESPAN_COST_MAX = 120;

const DUNGEON_DIFFICULTY_COST_MULTIPLIER: Record<
  DungeonDifficultyTier,
  number
> = {
  easy: 0.75,
  normal: 1,
  hard: 1.25,
  elite: 1.5,
  boss: 1.8,
};

const DUNGEON_COST_RANK_MULTIPLIER: Record<DungeonCostRank, number> = {
  minor: 0.5,
  standard: 1,
  major: 1.75,
};

const DUNGEON_LIFESPAN_COST_BASE: Record<RealmType, number> = {
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

const DUNGEON_MATERIAL_QUALITY_VALUES = [
  '凡品',
  '灵品',
  '玄品',
  '真品',
  '地品',
  '天品',
  '仙品',
] as const;

type DungeonMaterialQuality = (typeof DUNGEON_MATERIAL_QUALITY_VALUES)[number];

function resolveCostMultiplier(
  difficulty: DungeonDifficultyTier,
  rank: DungeonCostRank,
) {
  return (
    DUNGEON_DIFFICULTY_COST_MULTIPLIER[difficulty] *
    DUNGEON_COST_RANK_MULTIPLIER[rank]
  );
}

function roundSpiritStones(value: number) {
  const step = value < 100 ? 10 : value < 1_000 ? 50 : 100;
  return Math.max(step, Math.round(value / step) * step);
}

export function calculateDungeonResourceCost(args: {
  type: DungeonRankedResourceType;
  realm: RealmType;
  difficulty: DungeonDifficultyTier;
  rank: DungeonCostRank;
}): number {
  const realmIndex = REALM_ORDER[args.realm];
  const multiplier = resolveCostMultiplier(args.difficulty, args.rank);

  switch (args.type) {
    case 'spirit_stones':
      return roundSpiritStones(250 * 2 ** realmIndex * multiplier);
    case 'lifespan':
      return Math.min(
        DUNGEON_LIFESPAN_COST_MAX,
        Math.max(
          1,
          Math.round(DUNGEON_LIFESPAN_COST_BASE[args.realm] * multiplier),
        ),
      );
    case 'cultivation_exp':
      return Math.max(
        1,
        Math.round(REALM_DAILY_EXP_BUDGET[args.realm] * 0.02 * multiplier),
      );
    case 'comprehension_insight':
      return Math.min(
        20,
        Math.max(1, Math.round((1 + Math.floor(realmIndex / 2)) * multiplier)),
      );
  }
}

export function calculateDungeonMaterialCost(args: {
  realm: RealmType;
  difficulty: DungeonDifficultyTier;
  rank: DungeonCostRank;
}): { requiredQuality: DungeonMaterialQuality; value: number } {
  const realmIndex = REALM_ORDER[args.realm];
  const difficultyShift =
    args.difficulty === 'easy'
      ? -1
      : args.difficulty === 'elite' || args.difficulty === 'boss'
        ? 1
        : 0;
  const rankShift = args.rank === 'minor' ? -1 : args.rank === 'major' ? 1 : 0;
  const qualityIndex = Math.max(
    0,
    Math.min(
      DUNGEON_MATERIAL_QUALITY_VALUES.length - 1,
      Math.floor(realmIndex / 2) + difficultyShift + rankShift,
    ),
  );
  const requiredQuality =
    DUNGEON_MATERIAL_QUALITY_VALUES[qualityIndex] ?? '凡品';
  const value = Math.max(
    1,
    Math.min(
      3,
      Math.round(
        resolveCostMultiplier(args.difficulty, args.rank) *
          (1 + realmIndex * 0.03),
      ),
    ),
  );

  return { requiredQuality, value };
}

export function calculateDungeonStatLoss(args: {
  realm: RealmType;
  difficulty: DungeonDifficultyTier;
  rank: DungeonCostRank;
}): number {
  const realmFactor = 1 + REALM_ORDER[args.realm] * 0.02;
  const rawValue =
    0.04 * resolveCostMultiplier(args.difficulty, args.rank) * realmFactor;
  return Math.max(0.01, Math.min(0.2, Math.round(rawValue * 100) / 100));
}
