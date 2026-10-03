import { describe, expect, it } from 'vitest';
import { calculateRealmSectTaskReward } from '../organization/taskRewards.js';
import {
  MINING_TIER_MATERIAL_QUANTITY,
  miningRealmQualities,
  miningRewardQuality,
  miningRewardQualityPreference,
  scaleMiningTaskReward,
} from './MiningRewards.js';

describe('sect spirit mining rewards', () => {
  it('maps score tiers through each realm quality ladder', () => {
    expect(miningRealmQualities('炼气')).toEqual(['凡品', '灵品']);
    expect(
      ['D', 'C', 'B', 'A', 'S'].map((tier) =>
        miningRewardQuality('炼气', tier as 'D' | 'C' | 'B' | 'A' | 'S'),
      ),
    ).toEqual(['凡品', '凡品', '灵品', '灵品', '灵品']);
    expect(
      ['D', 'C', 'B', 'A', 'S'].map((tier) =>
        miningRewardQuality('炼虚', tier as 'D' | 'C' | 'B' | 'A' | 'S'),
      ),
    ).toEqual(['玄品', '真品', '地品', '天品', '仙品']);
    expect(miningRewardQualityPreference('炼虚', 'B')).toEqual([
      '地品',
      '真品',
      '天品',
      '玄品',
      '仙品',
    ]);
    expect(MINING_TIER_MATERIAL_QUANTITY).toEqual({
      D: 1,
      C: 1,
      B: 1,
      A: 2,
      S: 2,
    });
  });

  it('scales all numeric rewards monotonically and preserves stone floor', () => {
    const base = calculateRealmSectTaskReward({
      realm: '金丹',
      realmStage: '初期',
      difficulty: 'normal',
      cadence: 'daily',
      reward: { baseContribution: 30 },
    });
    const rewards = ['D', 'C', 'B', 'A', 'S'].map((tier) =>
      scaleMiningTaskReward(base, tier as 'D' | 'C' | 'B' | 'A' | 'S'),
    );

    for (let index = 1; index < rewards.length; index += 1) {
      expect(rewards[index]!.contribution).toBeGreaterThanOrEqual(
        rewards[index - 1]!.contribution,
      );
      expect(rewards[index]!.cultivationExp).toBeGreaterThanOrEqual(
        rewards[index - 1]!.cultivationExp,
      );
    }
    for (const reward of rewards) {
      expect(reward.spiritStones % 100).toBe(0);
      expect(reward.spiritStones).toBeGreaterThanOrEqual(
        reward.cultivationExp * 5,
      );
    }
  });
});
