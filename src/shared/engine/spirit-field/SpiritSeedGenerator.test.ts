import { describe, expect, it } from 'vitest';
import { SpiritSeedGenerator } from './SpiritSeedGenerator';

describe('SpiritSeedGenerator skeleton', () => {
  it('uses a seed-domain skeleton instead of MaterialSkeleton', () => {
    const [skeleton] = SpiritSeedGenerator.generateRandomSkeletons(
      1,
      {
        guaranteedRank: '玄品',
        specifiedElement: '水',
        regionTags: ['云梦山脉'],
      },
      () => 0.5,
    );

    expect(skeleton).toEqual({
      rank: '玄品',
      quantity: 1,
      forcedElement: '水',
      regionTags: ['云梦山脉'],
    });
    expect('type' in skeleton!).toBe(false);
  });

  it('keeps random quality inside the requested market range', () => {
    const skeletons = SpiritSeedGenerator.generateRandomSkeletons(
      20,
      { rankRange: { min: '灵品', max: '真品' } },
      () => 0.95,
    );
    expect(
      skeletons.every((item) =>
        ['灵品', '玄品', '真品'].includes(item.rank),
      ),
    ).toBe(true);
  });
});
