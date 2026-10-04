import { expect, it } from 'vitest';
import { AuctionBeastListSchema } from './auction.js';
const id = '00000000-0000-4000-8000-000000000003';
const buyer = '00000000-0000-4000-8000-000000000002';
// Any client-supplied beast payload is rejected regardless of its contents.
const starter = {
  id,
  ownerCultivatorId: '00000000-0000-4000-8000-000000000001',
};
it('上架只接受引用且公私对象不能混用', () => {
  const request = {
    requestId: id,
    beastId: id,
    expectedRevision: 0,
    price: 100,
    visibility: 'public',
  };
  expect(AuctionBeastListSchema.safeParse(request).success).toBe(true);
  for (const patch of [
    { beast: starter },
    { quantity: 1 },
    { price: 0 },
    { price: 10000000 },
    { visibility: 'private' },
    { targetCultivatorId: buyer },
  ])
    expect(
      AuctionBeastListSchema.safeParse({ ...request, ...patch }).success,
    ).toBe(false);
  expect(
    AuctionBeastListSchema.safeParse({
      ...request,
      visibility: 'private',
      targetCultivatorId: buyer,
    }).success,
  ).toBe(true);
});
