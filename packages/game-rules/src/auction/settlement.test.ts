import { seedFactsOf } from '@daoyou/game-domain/inventory';
import { buildSpiritGardenSeed } from '../spirit-field/garden.js';
import { auctionBlockReason, auctionItemPriceCap } from './items.js';
import {
  calculateAuctionSettlement,
  getAuctionUnitPriceCap,
  isAuctionListableQuality,
} from './settlement.js';

describe('auctionConfig', () => {
  it('按单价超额累进计税并乘以成交数量', () => {
    expect(calculateAuctionSettlement(100_000, 3)).toEqual({
      unitPrice: 100_000,
      quantity: 3,
      grossAmount: 300_000,
      feeAmount: 14_400,
      sellerAmount: 285_600,
      marginalRatePercent: 5,
    });
  });

  it('超过200万的部分按12%计税', () => {
    expect(calculateAuctionSettlement(3_000_000, 1)).toEqual({
      unitPrice: 3_000_000,
      quantity: 1,
      grossAmount: 3_000_000,
      feeAmount: 336_800,
      sellerAmount: 2_663_200,
      marginalRatePercent: 12,
    });
  });

  it('跨税档后卖家到手金额仍然递增', () => {
    const before = calculateAuctionSettlement(100_000, 1);
    const after = calculateAuctionSettlement(100_001, 1);
    expect(after.sellerAmount).toBeGreaterThan(before.sellerAmount);
  });

  it('品质上限作用于单价而不是整单总价', () => {
    const unitPrice = getAuctionUnitPriceCap('天品');
    const quote = calculateAuctionSettlement(unitPrice, 40);
    expect(unitPrice).toBe(800_000);
    expect(quote.grossAmount).toBe(32_000_000);
    expect(getAuctionUnitPriceCap('神品')).toBe(9_999_999);
  });

  it('灵植种子同样只有玄品及以上可以寄售', () => {
    const seed = buildSpiritGardenSeed('licorice', '凡品');
    expect(isAuctionListableQuality(seed.rank)).toBe(false);
    const item = {
      definitionId: 'seed.v1',
      location: 'bag',
      instanceData: seedFactsOf(seed),
    };
    expect(auctionBlockReason(item)).toContain('玄品');
    const highSeed = {
      ...item,
      instanceData: seedFactsOf(
        buildSpiritGardenSeed('jade_marrow_lingzhi', '玄品'),
      ),
    };
    expect(auctionBlockReason(highSeed)).toBeNull();
    expect(auctionItemPriceCap(highSeed)).toBe(100000);
    expect(() =>
      auctionItemPriceCap({
        ...item,
        instanceData: {
          ...item.instanceData,
          seedSpec: {
            ...item.instanceData.seedSpec,
            plant: { ...item.instanceData.seedSpec.plant, id: 'invalid' },
          },
        },
      }),
    ).toThrow();
  });
});
