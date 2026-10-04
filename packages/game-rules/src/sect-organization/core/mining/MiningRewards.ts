import { QUALITY_ORDER } from '@daoyou/constants/qualities';
import type { Quality } from '@daoyou/constants/qualities';
import type { RealmType } from '@daoyou/constants/realms';
import { SECT_REALM_QUALITY_RULES } from '../organization/taskRequirements.js';
import type { SectTaskRewardSnapshot } from '@daoyou/game-domain/sects/tasks';
import type { MiningScoreTier } from './MiningGameRules.js';

export const MINING_TIER_REWARD_MULTIPLIER = {
  D: 0.75,
  C: 1,
  B: 1.15,
  A: 1.3,
  S: 1.5,
} as const satisfies Record<MiningScoreTier, number>;

export const MINING_TIER_MATERIAL_QUANTITY = {
  D: 1,
  C: 1,
  B: 1,
  A: 2,
  S: 2,
} as const satisfies Record<MiningScoreTier, number>;

const MINING_TIER_QUALITY_POSITION = {
  D: 0,
  C: 0.25,
  B: 0.5,
  A: 0.75,
  S: 1,
} as const satisfies Record<MiningScoreTier, number>;

export function miningRealmQualities(realm: RealmType): Quality[] {
  return Object.keys(SECT_REALM_QUALITY_RULES[realm].weights).sort(
    (left, right) =>
      QUALITY_ORDER[left as Quality] - QUALITY_ORDER[right as Quality],
  ) as Quality[];
}

export function miningRewardQuality(
  realm: RealmType,
  tier: MiningScoreTier,
): Quality {
  const qualities = miningRealmQualities(realm);
  const index = Math.round(
    (qualities.length - 1) * MINING_TIER_QUALITY_POSITION[tier],
  );
  return qualities[index]!;
}

export function miningRewardQualityPreference(
  realm: RealmType,
  tier: MiningScoreTier,
): Quality[] {
  const target = miningRewardQuality(realm, tier);
  return miningRealmQualities(realm).sort((left, right) => {
    const leftDistance = Math.abs(QUALITY_ORDER[left] - QUALITY_ORDER[target]);
    const rightDistance = Math.abs(
      QUALITY_ORDER[right] - QUALITY_ORDER[target],
    );
    return (
      leftDistance - rightDistance || QUALITY_ORDER[left] - QUALITY_ORDER[right]
    );
  });
}

function roundToHundred(value: number): number {
  return Math.round(value / 100) * 100;
}

function roundUpToHundred(value: number): number {
  return Math.ceil(value / 100) * 100;
}

export function scaleMiningTaskReward(
  base: SectTaskRewardSnapshot,
  tier: MiningScoreTier,
): Pick<
  SectTaskRewardSnapshot,
  'contribution' | 'cultivationExp' | 'spiritStones'
> {
  const multiplier = MINING_TIER_REWARD_MULTIPLIER[tier];
  const cultivationExp = Math.floor(base.cultivationExp * multiplier);
  return {
    contribution: Math.round(base.contribution * multiplier),
    cultivationExp,
    spiritStones: Math.max(
      roundToHundred(base.spiritStones * multiplier),
      roundUpToHundred(cultivationExp * 5),
    ),
  };
}
