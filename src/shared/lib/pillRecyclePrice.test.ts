import { QUALITY_VALUES, type Quality } from '@shared/types/constants';
import { describe, expect, it } from 'vitest';
import { calculatePillRecycleUnitPrice } from './pillRecyclePrice';
import { PILL_QUALITY_BASE_SCORE } from './pillScore';

describe('calculatePillRecycleUnitPrice', () => {
  const expectedByQuality: Record<Quality, number> = {
    凡品: 1050,
    灵品: 2457,
    玄品: 2808,
    真品: 6534,
    地品: 16632,
    天品: 40230,
    仙品: 84240,
    神品: 240840,
  };

  it.each(QUALITY_VALUES)('以单位药蕴锚定%s丹药回收价', (quality: Quality) => {
    expect(
      calculatePillRecycleUnitPrice(quality, PILL_QUALITY_BASE_SCORE[quality]),
    ).toBe(expectedByQuality[quality]);
  });

  it('将低评分修正限制在 0.75 倍', () => {
    expect(calculatePillRecycleUnitPrice('玄品', 0)).toBe(2106);
  });

  it('将高评分修正限制在 1.25 倍', () => {
    expect(calculatePillRecycleUnitPrice('神品', 9999)).toBe(240840);
  });

  it('对非有限评分按最低修正估价', () => {
    expect(calculatePillRecycleUnitPrice('灵品', Number.NaN)).toBe(1842);
  });

  it('keeps score and appearance modifiers below the 60 percent anchor cap', () => {
    const base = calculatePillRecycleUnitPrice('天品', PILL_QUALITY_BASE_SCORE.天品);
    expect(calculatePillRecycleUnitPrice('天品', 0, 'low')).toBeLessThan(base);
    expect(calculatePillRecycleUnitPrice('天品', 999999, 'perfect')).toBe(base);
  });

  it('is monotonic by quality at the standard score', () => {
    const prices = QUALITY_VALUES.map((quality) =>
      calculatePillRecycleUnitPrice(quality, PILL_QUALITY_BASE_SCORE[quality]),
    );
    expect(prices).toEqual([...prices].sort((a, b) => a - b));
  });

  it.each(QUALITY_VALUES)('keeps every score and appearance quote within the 40%-60% anchor band for %s', (quality: Quality) => {
    const standardAnchor = calculatePillRecycleUnitPrice(
      quality,
      PILL_QUALITY_BASE_SCORE[quality],
      undefined,
    ) / 0.6;
    for (const score of [0, PILL_QUALITY_BASE_SCORE[quality], 999999]) {
      for (const appearance of ['low', 'middle', 'high', 'perfect'] as const) {
        const price = calculatePillRecycleUnitPrice(quality, score, appearance);
        expect(price).toBeGreaterThanOrEqual(Math.floor(standardAnchor * 0.4));
        expect(price).toBeLessThanOrEqual(Math.floor(standardAnchor * 0.6));
      }
    }
  });
});
