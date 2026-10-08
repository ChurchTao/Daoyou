import { expect, it } from 'vitest';
import { AUCTION_MAX_UNIT_PRICE } from '@daoyou/game-domain/auction';
import { AuctionBuySchema, AuctionListSchema } from './auction.js';
it('上架仅接收版本引用，公开和专属对象不得混用', () => {
  const body = {
    requestId: '00000000-0000-4000-8000-000000000001',
    itemId: '00000000-0000-4000-8000-000000000002',
    revision: 0,
    quantity: 1,
    price: 100,
    visibility: 'public',
  };
  expect(AuctionListSchema.safeParse(body).success).toBe(true);
  expect(AuctionListSchema.safeParse({ ...body, quantity: 999 }).success).toBe(
    true,
  );
  for (const patch of [
    { instanceData: {} },
    { revision: undefined },
    { requestId: undefined },
    { quantity: 0 },
    { quantity: 1.5 },
    { quantity: 2_147_483_648 },
    { price: AUCTION_MAX_UNIT_PRICE + 1 },
    { visibility: 'private' },
    { targetCultivatorId: body.itemId },
  ])
    expect(AuctionListSchema.safeParse({ ...body, ...patch }).success).toBe(
      false,
    );
  expect(
    AuctionListSchema.safeParse({
      ...body,
      visibility: 'private',
      targetCultivatorId: body.itemId,
    }).success,
  ).toBe(true);
});
it('购买必须携带重试标识，货单拒绝旧快照', () => {
  const body = {
    listingId: '00000000-0000-4000-8000-000000000001',
    requestId: '00000000-0000-4000-8000-000000000002',
    quantity: 1,
  };
  expect(AuctionBuySchema.safeParse(body).success).toBe(true);
  expect(
    AuctionBuySchema.safeParse({ ...body, requestId: undefined }).success,
  ).toBe(false);
});
