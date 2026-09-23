import { describe, expect, it } from 'vitest';
import { getItemExchangePurchaseWeek } from './itemExchangeShop';

describe('item exchange shop rules', () => {
  it('uses Monday as the Shanghai weekly boundary', () => {
    expect(
      getItemExchangePurchaseWeek(new Date('2026-07-26T15:59:59.999Z')),
    ).toBe('2026-07-20');
    expect(
      getItemExchangePurchaseWeek(new Date('2026-07-26T16:00:00.000Z')),
    ).toBe('2026-07-27');
  });
});
