import {
  buildDungeonPerformanceTags,
  getRequiredDungeonExtraRewards,
  normalizeDungeonRewardTier,
} from './settlementPolicy';

describe('dungeon settlement policy', () => {
  it.each([
    ['S', 0, 6, 4],
    ['S', 2, 4, 2],
    ['A', 0, 6, 3],
    ['B', 1, 5, 1],
    ['C', 0, 6, 0],
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

  it('downgrades ratings that do not meet their material minimum', () => {
    expect(
      normalizeDungeonRewardTier({
        proposedTier: 'S',
        totalMaterialCount: 3,
        endDisposition: 'completed',
      }),
    ).toBe('A');
    expect(
      normalizeDungeonRewardTier({
        proposedTier: 'S',
        totalMaterialCount: 2,
        endDisposition: 'completed',
      }),
    ).toBe('B');
    expect(
      normalizeDungeonRewardTier({
        proposedTier: 'A',
        totalMaterialCount: 2,
        endDisposition: 'completed',
      }),
    ).toBe('B');
    expect(
      normalizeDungeonRewardTier({
        proposedTier: 'B',
        totalMaterialCount: 1,
        endDisposition: 'completed',
      }),
    ).toBe('C');
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
