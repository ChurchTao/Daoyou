import { AUCTION_CATALOG_UNIT_PRICE_CAP } from '@daoyou/game-content/auction/config';
import { ITEM_DEFINITIONS } from '@daoyou/game-content/items';
import { AUCTION_MAX_UNIT_PRICE } from '@daoyou/game-domain/auction';
import { describe, expect, it } from 'vitest';
import { buildSpiritFruitSpec } from '../spirit-field/spiritFruit.js';
import {
  auctionBlockReason,
  auctionItemPriceCap,
  auctionItemQuality,
  auctionListingStackLimit,
  auctionPurchaseQuantityLimit,
  AuctionSnapshotSchema,
} from './items.js';

describe('新版寄售规则', () => {
  it('无品质品类开放寄售，难估价货品与固定货品使用不同单价上限', () => {
    for (const definition of ITEM_DEFINITIONS.filter((d) =>
      [
        'equipment',
        'blueprint',
        'manual_jade',
        'beast_book',
        'inscription',
        'beast_refinement',
        'beast_rejuvenation',
        'beast_lure',
      ].includes(d.kind),
    )) {
      const item = {
        definitionId: definition.id,
        instanceData: null,
        location: 'bag',
      };
      const appraisal = ['equipment', 'manual_jade', 'beast_book'].includes(
        definition.kind,
      );
      expect(auctionItemQuality(item)).toBeNull();
      expect(auctionItemPriceCap(item)).toBe(
        appraisal ? AUCTION_MAX_UNIT_PRICE : AUCTION_CATALOG_UNIT_PRICE_CAP,
      );
      expect(auctionBlockReason(item)).toBeNull();
    }
    expect(AUCTION_MAX_UNIT_PRICE).toBe(99_990_000);
    expect(AUCTION_CATALOG_UNIT_PRICE_CAP).toBe(9_999_999);
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
      auctionItemPriceCap({
        ...item,
        instanceData: { ...item.instanceData, rank: '神品' },
      }),
    ).toBe(AUCTION_CATALOG_UNIT_PRICE_CAP);
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

it('购买件数跟随同一堆叠上限，并受剩余数量与成交总额约束', () => {
  const book = ITEM_DEFINITIONS.find((item) => item.kind === 'beast_book')!;
  expect(
    auctionPurchaseQuantityLimit({
      definitionId: 'material.v1',
      remainingQuantity: 999,
      unitPrice: 1,
    }),
  ).toBe(999);
  expect(
    auctionPurchaseQuantityLimit({
      definitionId: book.id,
      remainingQuantity: 99,
      unitPrice: 1,
    }),
  ).toBe(99);
  expect(
    auctionPurchaseQuantityLimit({
      definitionId: 'equipment.v6',
      remainingQuantity: 1,
      unitPrice: 1,
    }),
  ).toBe(1);
  expect(
    auctionPurchaseQuantityLimit({
      definitionId: 'material.v1',
      remainingQuantity: 40,
      unitPrice: 100,
    }),
  ).toBe(40);
  expect(
    auctionPurchaseQuantityLimit({
      definitionId: 'material.v1',
      remainingQuantity: 999,
      unitPrice: 1_600_000,
    }),
  ).toBe(625);
  expect(
    auctionPurchaseQuantityLimit({
      definitionId: book.id,
      remainingQuantity: 99,
      unitPrice: AUCTION_MAX_UNIT_PRICE,
    }),
  ).toBe(1);
});
