import { describe, expect, it } from 'vitest';
import {
  allocateRedPacketAmounts,
  validateRedPacketInput,
  type RedPacketInput,
} from './red-packets.js';

describe('red packet rules', () => {
  const input: RedPacketInput = { amount: 50_000, count: 10, mode: 'random' };

  it('accepts the amount and count boundaries', () => {
    for (const amount of [50_000, 10_000_000]) {
      for (const count of [1, 100]) {
        expect(validateRedPacketInput({ ...input, amount, count })).toBeNull();
      }
    }
  });

  it.each([
    49_999,
    10_000_001,
    50_000.5,
    NaN,
    Infinity,
    Number.MAX_SAFE_INTEGER + 1,
  ])('rejects an invalid amount: %s', (amount) => {
    expect(validateRedPacketInput({ ...input, amount })).toBeTruthy();
    expect(() =>
      allocateRedPacketAmounts({ ...input, amount }, () => 1),
    ).toThrow();
  });

  it.each([0, 101, 1.5, NaN, Infinity])(
    'rejects an invalid count: %s',
    (count) => {
      expect(validateRedPacketInput({ ...input, count })).toBeTruthy();
      expect(() =>
        allocateRedPacketAmounts({ ...input, count }, () => 1),
      ).toThrow();
    },
  );

  it('requires an equal packet amount to divide exactly into its count', () => {
    expect(
      validateRedPacketInput({ amount: 50_001, count: 10, mode: 'equal' }),
    ).toBeTruthy();
    expect(() =>
      allocateRedPacketAmounts(
        { amount: 50_001, count: 10, mode: 'equal' },
        () => 1,
      ),
    ).toThrow();
    expect(
      allocateRedPacketAmounts({ ...input, mode: 'equal' }, () => {
        throw new Error('equal packets do not draw randomness');
      }),
    ).toEqual(Array(10).fill(5_000));
  });

  it('gives the full amount to a single recipient without drawing randomness', () => {
    expect(
      allocateRedPacketAmounts({ ...input, count: 1 }, () => {
        throw new Error('single packets do not draw randomness');
      }),
    ).toEqual([50_000]);
  });

  it('conserves the amount for all allowed counts and random boundary draws', () => {
    for (const amount of [50_000, 50_001, 10_000_000]) {
      for (let count = 1; count <= 100; count += 1) {
        for (const choose of ['min', 'max', 'middle'] as const) {
          const amounts = allocateRedPacketAmounts(
            { ...input, amount, count },
            (min, max) => {
              expect(min).toBeGreaterThanOrEqual(1);
              expect(max).toBeGreaterThanOrEqual(min);
              return choose === 'min'
                ? min
                : choose === 'max'
                  ? max
                  : Math.floor((min + max) / 2);
            },
          );
          expect(amounts).toHaveLength(count);
          expect(
            amounts.every((value) => Number.isSafeInteger(value) && value >= 1),
          ).toBe(true);
          expect(amounts.reduce((sum, value) => sum + value, 0)).toBe(amount);
        }
      }
    }
  });

  it('keeps early random draws within a meaningful share of the remaining average', () => {
    const amounts = allocateRedPacketAmounts(input, (min) => min);
    expect(amounts[0]).toBeGreaterThanOrEqual(2_500);
    expect(amounts.at(-1)).toBeLessThan(25_000);
  });

  it.each([0, 10_001, 1.5, NaN])(
    'rejects an invalid random integer: %s',
    (draw) => {
      expect(() => allocateRedPacketAmounts(input, () => draw)).toThrow();
    },
  );
});
