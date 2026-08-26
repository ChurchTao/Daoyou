import {
  buildDungeonPerformanceTags,
  getRequiredDungeonExtraRewards,
  normalizeDungeonRewardTier,
} from './settlementPolicy';

describe('dungeon settlement policy', () => {
  it.each([
    ['S', 0, 5, 2],
    ['S', 1, 4, 1],
    ['A', 0, 5, 1],
    ['B', 1, 4, 0],
    ['C', 0, 5, 0],
  ] as const)(
    'requires deterministic extra rewards for tier %s',
    (tier, accumulatedRewardCount, remainingRewardSlots, expected) => {
      expect(
        getRequiredDungeonExtraRewards({
          tier,
          accumulatedRewardCount,
          remainingRewardSlots,
        }),
      ).toBe(expected);
    },
  );

  it('downgrades a high rating when no material reward exists', () => {
    expect(
      normalizeDungeonRewardTier({
        proposedTier: 'S',
        totalMaterialCount: 0,
        endDisposition: 'completed',
      }),
    ).toBe('C');
    expect(
      normalizeDungeonRewardTier({
        proposedTier: 'S',
        totalMaterialCount: 1,
        endDisposition: 'completed',
      }),
    ).toBe('A');
  });

  it('caps retreat and abandonment ratings', () => {
    expect(
      normalizeDungeonRewardTier({
        proposedTier: 'S',
        totalMaterialCount: 3,
        endDisposition: 'retreated_after_battle',
      }),
    ).toBe('C');
    expect(
      normalizeDungeonRewardTier({
        proposedTier: 'A',
        totalMaterialCount: 2,
        endDisposition: 'abandoned_before_battle',
      }),
    ).toBe('D');
  });

  it('generates only deterministic Chinese display tags', () => {
    const tags = buildDungeonPerformanceTags({
      tier: 'A',
      dangerScore: 80,
      materialCount: 3,
      committedCostCount: 2,
      endDisposition: 'completed',
    });

    expect(tags).toEqual(['险象环生', '收获颇丰', '代价不菲']);
    expect(tags.every((tag) => /[\u3400-\u9fff]/u.test(tag))).toBe(true);
  });
});
