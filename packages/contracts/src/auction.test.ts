import { AUCTION_MAX_UNIT_PRICE } from '@daoyou/game-domain/auction';
import { expect, it } from 'vitest';
import {
  AuctionBuyOrderCreateSchema,
  AuctionBuyOrderSupplySchema,
  AuctionBuySchema,
  AuctionListSchema,
} from './auction.js';
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
it('收购目标只能引用背包物品或在售货单', () => {
  const base = {
    requestId: '00000000-0000-4000-8000-000000000001',
    price: 100,
    quantity: 10,
  };
  expect(
    AuctionBuyOrderCreateSchema.safeParse({
      ...base,
      source: {
        kind: 'bag',
        itemId: '00000000-0000-4000-8000-000000000002',
        revision: 0,
      },
    }).success,
  ).toBe(true);
  expect(
    AuctionBuyOrderCreateSchema.safeParse({
      ...base,
      source: {
        kind: 'listing',
        listingId: '00000000-0000-4000-8000-000000000003',
      },
    }).success,
  ).toBe(true);
  for (const patch of [
    { source: undefined },
    { source: { kind: 'bag', itemId: base.requestId } },
    { source: { kind: 'bag', itemId: base.requestId, revision: -1 } },
    { source: { kind: 'listing', listingId: base.requestId, extra: true } },
    { source: { kind: 'bag', itemId: base.requestId, revision: 0 }, price: 0 },
    { source: { kind: 'bag', itemId: base.requestId, revision: 0 }, quantity: 0 },
    { source: { kind: 'bag', itemId: base.requestId, revision: 0 }, target: {} },
  ])
    expect(AuctionBuyOrderCreateSchema.safeParse({ ...base, ...patch }).success).toBe(
      false,
    );
});

it('条件收购必须携带材料条件且不绑定具体物品，精确收购必须指定目标', () => {
  const base = {
    requestId: '00000000-0000-4000-8000-000000000001',
    price: 100,
    quantity: 10,
  };
  const source = {
    kind: 'bag' as const,
    itemId: '00000000-0000-4000-8000-000000000002',
    revision: 0,
  };
  const condition = {
    type: 'herb' as const,
    quality: '玄品' as const,
    element: 'any' as const,
  };
  expect(
    AuctionBuyOrderCreateSchema.safeParse({
      ...base,
      targetMode: 'condition',
      condition,
    }).success,
  ).toBe(true);
  expect(
    AuctionBuyOrderCreateSchema.safeParse({
      ...base,
      targetMode: 'condition',
      condition: { ...condition, type: null, element: 'none' },
    }).success,
  ).toBe(true);
  expect(
    AuctionBuyOrderCreateSchema.safeParse({
      ...base,
      targetMode: 'condition',
    }).success,
  ).toBe(false);
  expect(
    AuctionBuyOrderCreateSchema.safeParse({
      ...base,
      source,
      targetMode: 'condition',
      condition,
    }).success,
  ).toBe(false);
  expect(
    AuctionBuyOrderCreateSchema.safeParse({
      ...base,
      source,
      condition,
    }).success,
  ).toBe(false);
  for (const patch of [
    { type: 'seed' },
    { type: 'unknown' },
    { element: '光' },
    { quality: undefined },
    { extra: true },
  ])
    expect(
      AuctionBuyOrderCreateSchema.safeParse({
        ...base,
        targetMode: 'condition',
        condition: { ...condition, ...patch },
      }).success,
    ).toBe(false);
});

it('供货必须携带物品版本与重试标识', () => {
  const body = {
    requestId: '00000000-0000-4000-8000-000000000001',
    itemId: '00000000-0000-4000-8000-000000000002',
    revision: 0,
    quantity: 10,
  };
  expect(AuctionBuyOrderSupplySchema.safeParse(body).success).toBe(true);
  for (const patch of [
    { requestId: undefined },
    { itemId: undefined },
    { revision: undefined },
    { quantity: 0 },
    { quantity: 2_147_483_648 },
  ])
    expect(AuctionBuyOrderSupplySchema.safeParse({ ...body, ...patch }).success).toBe(
      false,
    );
});

it('购买必须携带重试标识，货单拒绝旧快照', () => {
  const body = {
    listingId: '00000000-0000-4000-8000-000000000001',
    requestId: '00000000-0000-4000-8000-000000000002',
    quantity: 1,
  };
  expect(AuctionBuySchema.safeParse(body).success).toBe(true);
  expect(AuctionBuySchema.safeParse({ ...body, quantity: 999 }).success).toBe(
    true,
  );
  expect(
    AuctionBuySchema.safeParse({ ...body, requestId: undefined }).success,
  ).toBe(false);
  expect(AuctionBuySchema.safeParse({ ...body, quantity: 0 }).success).toBe(
    false,
  );
  expect(
    AuctionBuySchema.safeParse({ ...body, quantity: 2_147_483_648 }).success,
  ).toBe(false);
});
