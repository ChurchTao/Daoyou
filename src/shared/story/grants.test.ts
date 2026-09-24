import { describe, expect, it } from 'vitest';
import { loadStoryRewardPack } from '../rewards/story-pack';
import { storyReward } from './grants';

describe('story rewards', () => {
  it('rolls the configured herb bundle', () => {
    const reward = storyReward('first-herbs', 'cultivator-a');
    expect(reward.spiritStones).toBe(0);
    expect(reward.items).toEqual([
      expect.objectContaining({
        definitionId: 'material.v1',
        quantity: 3,
        instanceData: expect.objectContaining({
          name: '翠芽草',
          type: 'herb',
        }),
      }),
    ]);
    expect(storyReward('first-herbs', 'cultivator-b')).toEqual(reward);
  });

  it('keeps a weighted payout stable for the same seed', () => {
    const pack = loadStoryRewardPack({
      formatVersion: 1,
      contentRevision: 1,
      materials: {},
      payouts: [
        {
          id: 'mixed',
          poolVersion: 1,
          groups: [
            {
              id: 'stones',
              chance: 1,
              entries: [
                {
                  rewardId: 'currency.spirit-stones',
                  weight: 1,
                  quantity: { min: 20, max: 20 },
                },
              ],
            },
            {
              id: 'book',
              chance: 1,
              entries: [
                {
                  rewardId: 'book.beast.combo',
                  weight: 1,
                  quantity: { min: 1, max: 1 },
                },
                {
                  rewardId: 'book.beast.counter',
                  weight: 1,
                  quantity: { min: 1, max: 1 },
                },
              ],
            },
          ],
        },
      ],
    });
    const first = storyReward('mixed', 'same-seed', pack);
    expect(storyReward('mixed', 'same-seed', pack)).toEqual(first);
    expect(first.spiritStones).toBe(20);
    expect(first.items).toHaveLength(1);
    expect(['book.beast.combo', 'book.beast.counter']).toContain(
      first.items[0]?.definitionId,
    );
  });

  it('rejects an unknown bundle', () => {
    expect(() => storyReward('missing', 'seed')).toThrow('没有这份奖励：missing');
  });

  it('rejects a reward the drop table cannot resolve', () => {
    expect(() =>
      loadStoryRewardPack({
        formatVersion: 1,
        contentRevision: 1,
        materials: {},
        payouts: [
          {
            id: 'broken',
            poolVersion: 1,
            groups: [
              {
                id: 'one',
                chance: 1,
                entries: [
                  {
                    rewardId: 'not-a-real-item',
                    weight: 1,
                    quantity: { min: 1, max: 1 },
                  },
                ],
              },
            ],
          },
        ],
      }),
    ).toThrow('奖励无法识别');
  });
});
