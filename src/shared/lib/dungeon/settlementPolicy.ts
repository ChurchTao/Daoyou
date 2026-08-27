export const DUNGEON_REWARD_TIERS = ['S', 'A', 'B', 'C', 'D'] as const;

export type DungeonRewardTier = (typeof DUNGEON_REWARD_TIERS)[number];
export type DungeonEndDisposition =
  'completed' | 'retreated_after_battle' | 'abandoned_before_battle';

export const DUNGEON_TIER_MIN_TOTAL_MATERIALS: Record<
  DungeonRewardTier,
  number
> = {
  S: 4,
  A: 3,
  B: 2,
  C: 0,
  D: 0,
};

export function getRequiredDungeonExtraRewards(args: {
  tier: DungeonRewardTier;
  accumulatedRewardCount: number;
  remainingRewardSlots: number;
}): number {
  const required = Math.max(
    0,
    DUNGEON_TIER_MIN_TOTAL_MATERIALS[args.tier] -
      Math.max(0, args.accumulatedRewardCount),
  );
  return Math.min(required, Math.max(0, args.remainingRewardSlots));
}

export function normalizeDungeonRewardTier(args: {
  proposedTier: DungeonRewardTier;
  totalMaterialCount: number;
  endDisposition: DungeonEndDisposition;
}): DungeonRewardTier {
  if (args.endDisposition === 'abandoned_before_battle') return 'D';

  let tier = args.proposedTier;
  if (
    args.endDisposition === 'retreated_after_battle' &&
    (tier === 'S' || tier === 'A' || tier === 'B')
  ) {
    tier = 'C';
  }

  const materialCount = Math.max(0, args.totalMaterialCount);
  if (tier === 'S' && materialCount < 4) {
    tier = materialCount >= 3 ? 'A' : materialCount >= 2 ? 'B' : 'C';
  }
  if (tier === 'A' && materialCount < 3) {
    tier = materialCount >= 2 ? 'B' : 'C';
  }
  if (tier === 'B' && materialCount < 2) {
    tier = 'C';
  }

  return tier;
}

export function buildDungeonPerformanceTags(args: {
  tier: DungeonRewardTier;
  dangerScore: number;
  materialCount: number;
  committedCostCount: number;
  endDisposition: DungeonEndDisposition;
}): string[] {
  const tags: string[] = [];
  if (args.tier === 'D' && args.materialCount === 0) tags.push('空手而归');
  if (args.endDisposition === 'retreated_after_battle') tags.push('及时止损');
  if (args.dangerScore >= 75) tags.push('险象环生');
  if (args.materialCount >= 3) tags.push('收获颇丰');
  if (args.committedCostCount >= 2) tags.push('代价不菲');
  if (args.endDisposition === 'completed') tags.push('功成身退');

  return Array.from(new Set(tags)).slice(0, 3);
}
