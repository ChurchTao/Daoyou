import {
  QUALITY_VALUES,
  type Quality,
  type RealmType,
} from '@shared/types/constants';

export const ACTIVITY_REWARD_TIER_VALUES = [
  'ordinary_dungeon',
  'sect_commission',
  'sect_minor_tournament',
  'sect_major_tournament',
  'inter_sect_tournament',
  'inter_sect_grand_dungeon',
] as const;

export type ActivityRewardTier = (typeof ACTIVITY_REWARD_TIER_VALUES)[number];

export type ActivityRewardSlot = 'standard' | 'unique';

export const REALM_BASE_REWARD_QUALITY_CAP: Readonly<
  Record<RealmType, Quality>
> = {
  炼气: '玄品',
  筑基: '真品',
  金丹: '地品',
  元婴: '天品',
  化神: '仙品',
  炼虚: '神品',
  合体: '神品',
  大乘: '神品',
  渡劫: '神品',
};

const ACTIVITY_STANDARD_QUALITY_OFFSET: Readonly<
  Record<ActivityRewardTier, number>
> = {
  ordinary_dungeon: 0,
  sect_commission: 0,
  sect_minor_tournament: 0,
  sect_major_tournament: 0,
  inter_sect_tournament: 1,
  inter_sect_grand_dungeon: 1,
};

export function resolveActivityRewardQualityCap(input: {
  realm: RealmType;
  activityTier: ActivityRewardTier;
  slot?: ActivityRewardSlot;
}): Quality {
  const baseIndex = QUALITY_VALUES.indexOf(
    REALM_BASE_REWARD_QUALITY_CAP[input.realm],
  );
  const uniqueOffset =
    input.activityTier === 'inter_sect_grand_dungeon' && input.slot === 'unique'
      ? 1
      : 0;
  const targetIndex = Math.min(
    QUALITY_VALUES.length - 1,
    baseIndex +
      ACTIVITY_STANDARD_QUALITY_OFFSET[input.activityTier] +
      uniqueOffset,
  );
  return QUALITY_VALUES[targetIndex]!;
}

export function isActivityRewardQualityAllowed(input: {
  realm: RealmType;
  activityTier: ActivityRewardTier;
  quality: Quality;
  slot?: ActivityRewardSlot;
}): boolean {
  return (
    QUALITY_VALUES.indexOf(input.quality) <=
    QUALITY_VALUES.indexOf(resolveActivityRewardQualityCap(input))
  );
}

export function allowsActivityUniqueRewardUsageOverride(input: {
  activityTier: ActivityRewardTier;
  slot: ActivityRewardSlot;
  rewardKind: 'inheritance' | 'gongfa' | 'artifact' | 'consumable';
}): boolean {
  return (
    input.activityTier === 'inter_sect_grand_dungeon' &&
    input.slot === 'unique' &&
    input.rewardKind !== 'consumable'
  );
}
