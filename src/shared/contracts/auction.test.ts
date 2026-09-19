import { describe, expect, it } from 'vitest';
import { AUCTION_MAX_UNIT_PRICE } from '../config/auctionConfig';
import { ITEM_DEFINITIONS } from '../items/registry';
import {
  auctionBlockReason,
  AuctionBuySchema,
  auctionItemPriceCap,
  auctionItemQuality,
  AuctionListSchema,
  AuctionSnapshotSchema,
} from './auction';

describe('新版寄售规则', () => {
  it('所有无品质品类开放寄售，不合成品质或按旧品质限价', () => {
    for (const definition of ITEM_DEFINITIONS.filter((d) =>
      ['equipment', 'blueprint', 'manual_jade', 'beast_book'].includes(d.kind),
    )) {
      const item = {
        definitionId: definition.id,
        instanceData: null,
        location: 'bag',
      };
      expect(auctionItemQuality(item)).toBeNull();
      expect(auctionItemPriceCap(item)).toBe(AUCTION_MAX_UNIT_PRICE);
      expect(auctionBlockReason(item)).toBeNull();
    }
  });
  it('有品质材料仍执行玄品起售与品质价格上限', () => {
    const item = {
      definitionId: 'material.v1',
      location: 'bag',
      instanceData: {
        name: '玄铁',
        type: 'ore',
        rank: '玄品',
        element: null,
        description: '',
      },
    };
    expect(auctionBlockReason(item)).toBeNull();
    expect(auctionItemPriceCap(item)).toBe(100000);
    expect(
      auctionBlockReason({
        ...item,
        instanceData: { ...item.instanceData, rank: '灵品' },
      }),
    ).toContain('玄品');
  });
  it('公开种子品质与库存位置、装配限制仍参与准入', () => {
    const seed = {
      definitionId: 'seed.v1',
      location: 'bag',
      instanceData: { rank: '玄品' },
    };
    expect(auctionItemPriceCap(seed)).toBe(100000);
    expect(auctionBlockReason(seed)).toBeNull();
    expect(
      auctionBlockReason({ ...seed, instanceData: { rank: '凡品' } }),
    ).toContain('玄品');
    expect(auctionBlockReason({ ...seed, location: 'storage' })).toBeTruthy();
    expect(
      auctionBlockReason({
        definitionId: 'equipment.v6',
        location: 'bag',
        instanceData: null,
        equipped: true,
      }),
    ).toBeTruthy();
    expect(
      auctionBlockReason({ ...seed, definitionId: 'legacy.artifact' }),
    ).toBeTruthy();
  });
  it('丹药和灵果执行品质限制，符箓即使玄品也不能寄售', () => {
    const item = {
      definitionId: 'consumable.v1',
      location: 'bag',
      instanceData: {
        name: '药品',
        type: '丹药',
        quality: '玄品',
        spec: { kind: 'pill' },
      },
    };
    expect(auctionBlockReason(item)).toBeNull();
    expect(auctionItemPriceCap(item)).toBe(100000);
    expect(
      auctionBlockReason({
        ...item,
        instanceData: { ...item.instanceData, quality: '灵品' },
      }),
    ).toContain('玄品');
    expect(
      auctionBlockReason({
        ...item,
        instanceData: {
          ...item.instanceData,
          type: '灵果',
          spec: { kind: 'spirit_fruit' },
        },
      }),
    ).toBeNull();
    expect(
      auctionBlockReason({
        ...item,
        instanceData: {
          ...item.instanceData,
          type: '符箓',
          spec: { kind: 'talisman' },
        },
      }),
    ).toContain('丹药与灵果');
  });
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
    for (const patch of [
      { instanceData: {} },
      { revision: undefined },
      { requestId: undefined },
      { quantity: 100 },
      { quantity: 0 },
      { quantity: 1.5 },
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
    expect(AuctionSnapshotSchema.safeParse({ name: '旧法宝' }).success).toBe(
      false,
    );
  });
});
