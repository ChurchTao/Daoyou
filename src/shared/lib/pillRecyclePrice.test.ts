import { QUALITY_VALUES, type Quality } from '@shared/types/constants';
import { describe, expect, it } from 'vitest';
import { BASE_PRICES } from '../engine/material/creation/config';
import { calculatePillRecycleUnitPrice } from './pillRecyclePrice';
import { PILL_QUALITY_BASE_SCORE } from './pillScore';

describe('calculatePillRecycleUnitPrice', () => {
  it.each(QUALITY_VALUES)(
    '以同品质材料基础价的 50%% 作为%s丹药基准回收价',
    (quality: Quality) => {
      expect(
        calculatePillRecycleUnitPrice(
          quality,
          PILL_QUALITY_BASE_SCORE[quality],
        ),
      ).toBe(Math.floor(BASE_PRICES[quality] * 0.5));
    },
  );

  it('将低评分修正限制在 0.75 倍', () => {
    expect(calculatePillRecycleUnitPrice('玄品', 0)).toBe(375);
  });

  it('将高评分报价限制在材料锚点的安全回收上限内', () => {
    expect(calculatePillRecycleUnitPrice('神品', 9999)).toBe(600_000);
  });

  it('对非有限评分按最低修正估价', () => {
    expect(calculatePillRecycleUnitPrice('灵品', Number.NaN)).toBe(112);
  });
});
