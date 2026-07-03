import { describe, expect, it } from 'vitest';
import { formatCompactGameNumber, formatFullGameNumber } from './numberFormat';

describe('game number formatting', () => {
  it('keeps small numbers exact with grouping', () => {
    expect(formatCompactGameNumber(0)).toBe('0');
    expect(formatCompactGameNumber(1234)).toBe('1,234');
    expect(formatCompactGameNumber(9999)).toBe('9,999');
  });

  it('uses Chinese compact units for large numbers', () => {
    expect(formatCompactGameNumber(12_345)).toBe('1.23万');
    expect(formatCompactGameNumber(123_456)).toBe('12.3万');
    expect(formatCompactGameNumber(1_234_567)).toBe('123万');
    expect(formatCompactGameNumber(123_456_789)).toBe('1.23亿');
  });

  it('formats negative and non-finite numbers predictably', () => {
    expect(formatCompactGameNumber(-12_345)).toBe('-1.23万');
    expect(formatCompactGameNumber(Number.NaN)).toBe('0');
  });

  it('keeps full numbers grouped for exact values', () => {
    expect(formatFullGameNumber(123_456_789)).toBe('123,456,789');
  });
});
