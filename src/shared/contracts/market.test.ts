import { describe, expect, it } from 'vitest';
import { MarketBuySchema } from './market';

const purchase = {
  requestId: 'b1f82f67-5e78-4d4e-8b94-14de5589aa61',
  layer: 'common',
  expectedTotal: 32,
  items: [{ listingId: 'first', quantity: 1 }],
};
describe('坊市购买指令边界', () => {
  it('单件与多选使用同一指令，禁止空列表与重复商品', () => {
    expect(MarketBuySchema.safeParse(purchase).success).toBe(true);
    expect(
      MarketBuySchema.safeParse({
        ...purchase,
        items: [...purchase.items, { listingId: 'second', quantity: 1 }],
      }).success,
    ).toBe(true);
    expect(MarketBuySchema.safeParse({ ...purchase, items: [] }).success).toBe(
      false,
    );
    expect(
      MarketBuySchema.safeParse({
        ...purchase,
        items: [...purchase.items, ...purchase.items],
      }).success,
    ).toBe(false);
  });
  it('每批限购一件，不接受客户端商品事实、单价或黑市指令', () => {
    for (const quantity of [-1, 0, 0.5, 2])
      expect(
        MarketBuySchema.safeParse({
          ...purchase,
          items: [{ listingId: 'first', quantity }],
        }).success,
      ).toBe(false);
    expect(
      MarketBuySchema.safeParse({
        ...purchase,
        items: [{ ...purchase.items[0], price: 1 }],
      }).success,
    ).toBe(false);
    expect(
      MarketBuySchema.safeParse({ ...purchase, layer: 'black' }).success,
    ).toBe(false);
  });
  it('限制请求身份、批次大小与确认金额', () => {
    expect(
      MarketBuySchema.safeParse({ ...purchase, requestId: '' }).success,
    ).toBe(false);
    expect(
      MarketBuySchema.safeParse({ ...purchase, expectedTotal: -1 }).success,
    ).toBe(false);
    expect(
      MarketBuySchema.safeParse({
        ...purchase,
        items: Array.from({ length: 41 }, (_, i) => ({
          listingId: String(i),
          quantity: 1,
        })),
      }).success,
    ).toBe(false);
  });
});
