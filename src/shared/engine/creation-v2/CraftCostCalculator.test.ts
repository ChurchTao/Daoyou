import { describe, expect, it } from 'vitest';
import {
  calculateCraftCost,
  calculateFateAdjustedCraftCost,
} from './CraftCostCalculator';

describe('creation craft cost calculator', () => {
  it('keeps low-rank enlightenment discounts visible for comprehension costs', () => {
    expect(calculateCraftCost('凡品', 'comprehension')).toBe(5);
    expect(calculateFateAdjustedCraftCost('凡品', 'comprehension', 0.96)).toBe(4);
    expect(calculateFateAdjustedCraftCost('灵品', 'comprehension', 0.96)).toBe(9);
  });

  it('never discounts a positive craft cost below one', () => {
    expect(calculateFateAdjustedCraftCost('凡品', 'comprehension', 0.01)).toBe(1);
  });
});
