import { describe, expect, it } from 'vitest';
import { AUCTION_MAX_UNIT_PRICE } from '@daoyou/game-domain/auction';
import { buildSpiritFruitSpec } from '../spirit-field/spiritFruit.js';
import { ITEM_DEFINITIONS } from '@daoyou/game-content/items';
import {
  auctionBlockReason,
  auctionItemPriceCap,
  auctionItemQuality,
  auctionListingStackLimit,
  AuctionSnapshotSchema,
} from './items.js';

describe('新版寄售规则', () => {
  it('所有无品质品类开放寄售，不合成品质或按旧品质限价', () => {
    for (const definition of ITEM_DEFINITIONS.filter((d) =>
      [
        'equipment',
        'blueprint',
        'manual_jade',
        'beast_book',
        'inscription',
      ].includes(d.kind),
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
        spec: {
          kind: 'pill',
          family: 'healing',
          operations: [
            {
              type: 'restore_resource',
              resource: 'hp',
              mode: 'percent',
              value: 0.1,
            },
          ],
          consumeRules: { scene: 'out_of_battle_only', quotaCategory: 'none' },
          alchemyMeta: {
            source: 'improvised',
            sourceMaterials: [],
            stability: 100,
            toxicityRating: 0,
            tags: [],
          },
        },
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
          spec: buildSpiritFruitSpec({ family: 'healing', quality: '玄品' }),
        },
      }),
    ).toBeNull();
    expect(
      auctionBlockReason({
        ...item,
        instanceData: {
          ...item.instanceData,
          type: '符箓',
          spec: {
            kind: 'talisman',
            scenario: 'attribute_reset',
            sessionMode: 'consume_on_action',
          },
        },
      }),
    ).toContain('丹药与灵果');
  });
});

it('货单拒绝旧快照', () => {
  expect(AuctionSnapshotSchema.safeParse({ name: '旧法宝' }).success).toBe(
    false,
  );
});

it('上架件数跟随背包堆叠上限', () => {
  const material = {
    version: 'inventory_v1' as const,
    item: {
      definitionId: 'material.v1',
      quantity: 999,
      instanceData: {
        name: '玄铁',
        type: 'ore',
        rank: '玄品',
        element: null,
        description: '',
      },
    },
  };
  expect(auctionListingStackLimit('material.v1')).toBe(999);
  expect(AuctionSnapshotSchema.safeParse(material).success).toBe(true);
  expect(
    AuctionSnapshotSchema.safeParse({
      ...material,
      item: { ...material.item, quantity: 1000 },
    }).success,
  ).toBe(false);
  const book = ITEM_DEFINITIONS.find((item) => item.kind === 'beast_book');
  expect(book?.stackLimit).toBe(99);
  expect(auctionListingStackLimit(book!.id)).toBe(99);
  expect(
    AuctionSnapshotSchema.safeParse({
      version: 'inventory_v1',
      item: { definitionId: book!.id, quantity: 99 },
    }).success,
  ).toBe(true);
  expect(
    AuctionSnapshotSchema.safeParse({
      version: 'inventory_v1',
      item: { definitionId: book!.id, quantity: 100 },
    }).success,
  ).toBe(false);
  expect(auctionListingStackLimit('equipment.v6')).toBe(1);
});
