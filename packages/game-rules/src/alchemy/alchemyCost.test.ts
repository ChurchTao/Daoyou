import { describe, expect, it } from 'vitest';
import {
  calculateAlchemyAnalysisQiCost,
  calculateAlchemyCraftQiCost,
} from './alchemyCost.js';

describe('alchemy qi payments', () => {
  it.each([
    [1, 1, 0],
    [2, 1, 1],
    [7, 3, 4],
    [10, 3, 7],
    [33, 10, 23],
    [85, 26, 59],
  ])(
    'splits %i qi into %i upfront and %i on crafting',
    (total, upfront, remaining) => {
      expect(calculateAlchemyAnalysisQiCost(total)).toBe(upfront);
      expect(calculateAlchemyCraftQiCost(total, upfront)).toBe(remaining);
      expect(upfront + remaining).toBe(total);
    },
  );

  it('credits the actual payment on existing receipts', () => {
    expect(calculateAlchemyCraftQiCost(33, 33)).toBe(0);
    expect(calculateAlchemyCraftQiCost(33)).toBe(33);
    expect(calculateAlchemyCraftQiCost(33, 0)).toBe(33);
  });
});
