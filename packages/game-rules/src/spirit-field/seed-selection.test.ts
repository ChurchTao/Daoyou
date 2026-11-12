import { SPIRIT_GARDEN_MARKET_SEED_QUALITY_WEIGHTS } from '@daoyou/game-content/spirit-field/config';
import { describe, expect, it } from 'vitest';
import { pickSpiritGardenSeedQuality } from './seed-selection.js';

describe('garden catalog seed quality selection', () => {
  it('uses the requested guaranteed quality', () => {
    expect(
      pickSpiritGardenSeedQuality({ guaranteedRank: '玄品' }, () => 0),
    ).toBe('玄品');
  });

  it('keeps random quality inside the requested market range', () => {
    const skeletons = Array.from({ length: 20 }, () =>
      pickSpiritGardenSeedQuality(
        { rankRange: { min: '灵品', max: '真品' } },
        () => 0.95,
      ),
    );
    expect(
      skeletons.every((quality) => ['灵品', '玄品', '真品'].includes(quality)),
    ).toBe(true);
  });

  it('gives divine seeds exactly 2% of heaven-shelf draws after restricting the quality range', () => {
    let sample = 0;
    const skeletons = Array.from({ length: 10_000 }, () =>
      pickSpiritGardenSeedQuality(
        {
          rankRange: { min: '地品', max: '神品' },
          qualityChanceMap: SPIRIT_GARDEN_MARKET_SEED_QUALITY_WEIGHTS,
        },
        () => (sample++ + 0.5) / 10_000,
      ),
    );
    expect(skeletons.filter((entry) => entry === '神品')).toHaveLength(200);
    expect(
      skeletons.every((entry) =>
        ['地品', '天品', '仙品', '神品'].includes(entry),
      ),
    ).toBe(true);
    const draw = (roll: number) =>
      pickSpiritGardenSeedQuality(
        {
          rankRange: { min: '地品', max: '神品' },
          qualityChanceMap: SPIRIT_GARDEN_MARKET_SEED_QUALITY_WEIGHTS,
        },
        () => roll,
      );
    expect(draw(0.98 - Number.EPSILON)).toBe('仙品');
    expect(draw(0.98 + Number.EPSILON)).toBe('神品');
  });

  it('keeps common and treasure shelf quality ratios when divine availability changes', () => {
    for (const [range, expected] of [
      [
        { min: '凡品', max: '玄品' },
        { 凡品: 375, 灵品: 375, 玄品: 250 },
      ],
      [
        { min: '玄品', max: '地品' },
        { 玄品: 588, 真品: 294, 地品: 118 },
      ],
    ] as const) {
      let sample = 0;
      const skeletons = Array.from({ length: 1000 }, () =>
        pickSpiritGardenSeedQuality(
          {
            rankRange: range,
            qualityChanceMap: SPIRIT_GARDEN_MARKET_SEED_QUALITY_WEIGHTS,
          },
          () => (sample++ + 0.5) / 1000,
        ),
      );
      for (const [quality, count] of Object.entries(expected))
        expect(skeletons.filter((entry) => entry === quality)).toHaveLength(
          count,
        );
    }
  });
});
