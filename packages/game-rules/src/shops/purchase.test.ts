import { describe, expect, it } from 'vitest';
import { quoteExchangeCart, getItemExchangePurchaseWeek } from './purchase.js';

describe('item exchange shop rules', () => {
  it('uses Monday as the Shanghai weekly boundary', () => {
    expect(
      getItemExchangePurchaseWeek(new Date('2026-07-26T15:59:59.999Z')),
    ).toBe('2026-07-20');
    expect(
      getItemExchangePurchaseWeek(new Date('2026-07-26T16:00:00.000Z')),
    ).toBe('2026-07-27');
  });

  it('quotes a cart from server prices and rejects a stale total', () => {
    expect(
      quoteExchangeCart(
        [
          { price: 20, count: 2 },
          { price: 5, count: 1 },
        ],
        45,
      ),
    ).toEqual({ ok: true, total: 45 });
    expect(quoteExchangeCart([{ price: 20, count: 2 }], null)).toEqual({
      ok: true,
      total: 40,
    });
    expect(quoteExchangeCart([{ price: 20, count: 2 }], 39).ok).toBe(false);
    expect(quoteExchangeCart([], 0)).toEqual({ ok: false, reason: 'invalid' });
    expect(quoteExchangeCart([{ price: 20, count: 100 }], 2000)).toEqual({
      ok: false,
      reason: 'invalid',
    });
  });
});
