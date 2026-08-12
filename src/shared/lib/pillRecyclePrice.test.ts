import { QUALITY_VALUES, type Quality } from '@shared/types/constants';
import { describe, expect, it } from 'vitest';
import { calculateCraftCost } from '../engine/creation-v2/CraftCostCalculator';
import { BASE_PRICES } from '../engine/material/creation/config';
import { calculatePillRecycleUnitPrice } from './pillRecyclePrice';
import { PILL_QUALITY_BASE_SCORE } from './pillScore';

describe('calculatePillRecycleUnitPrice', () => {
  it.each(QUALITY_VALUES)(
    '以同品质材料基础价加一半炼制费作为%s丹药经济锚点',
    (quality: Quality) => {
      const economicAnchor =
        BASE_PRICES[quality] +
        calculateCraftCost(quality, 'spiritStone') / 2;
      expect(
        calculatePillRecycleUnitPrice(
          quality,
          PILL_QUALITY_BASE_SCORE[quality],
        ),
      ).toBe(Math.floor(economicAnchor * 0.5));
    },
  );

  it('将低评分修正限制在 0.75 倍', () => {
    expect(calculatePillRecycleUnitPrice('玄品', 0)).toBe(1_575);
  });

  it('将高评分修正限制在 1.25 倍', () => {
    expect(calculatePillRecycleUnitPrice('神品', 9999)).toBe(689_000);
  });

  it('对非有限评分按最低修正估价', () => {
    expect(calculatePillRecycleUnitPrice('灵品', Number.NaN)).toBe(712);
  });
});
