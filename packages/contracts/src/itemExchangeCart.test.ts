import { describe, expect, it } from 'vitest';
import { ReputationShopCartBuyBodySchema } from './reputationShop.js';
import { SectShopCartBuyBodySchema } from './sectShop.js';

const line = {
  id: '6d5f4e18-1c2b-4a69-9d0e-7f6a5b4c3d2e',
  count: 2,
};
const second = {
  id: '11111111-1111-4111-8111-111111111111',
  count: 1,
};

describe('兑换清单边界', () => {
  it('接受多件与多次，拒绝空单、重复和超限', () => {
    const cart = { expectedTotal: 30, items: [line, second] };
    expect(SectShopCartBuyBodySchema.safeParse(cart).success).toBe(true);
    expect(
      ReputationShopCartBuyBodySchema.safeParse({
        ...cart,
        requestId: 'b1f82f67-5e78-4d4e-8b94-14de5589aa61',
      }).success,
    ).toBe(true);
    expect(SectShopCartBuyBodySchema.safeParse({ ...cart, items: [] }).success).toBe(
      false,
    );
    expect(
      SectShopCartBuyBodySchema.safeParse({
        ...cart,
        items: [line, line],
      }).success,
    ).toBe(false);
    expect(
      SectShopCartBuyBodySchema.safeParse({
        ...cart,
        items: [{ ...line, count: 100 }],
      }).success,
    ).toBe(false);
    expect(
      SectShopCartBuyBodySchema.safeParse({ ...cart, expectedTotal: 0 }).success,
    ).toBe(false);
    expect(
      ReputationShopCartBuyBodySchema.safeParse(cart).success,
    ).toBe(false);
  });
});
