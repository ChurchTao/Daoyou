import {
  calculateAuctionSettlement,
  getAuctionUnitPriceCap,
  isAuctionListableMaterial,
  isAuctionListableQuality,
} from './auctionConfig';
import { buildSpiritFieldSeedMaterialFromPlant } from '@shared/engine/spirit-field/seedMaterial';

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
  });

  it('灵田种子可突破玄品门槛寄售，普通低品材料仍不可', () => {
    const seed = buildSpiritFieldSeedMaterialFromPlant({
      id: 'seed-test',
      name: '青芽草',
      seedName: '青芽草灵种',
      quality: '凡品',
      element: '木',
      minRealm: '炼气',
      baseGrowthMs: 12 * 60_000,
      careSlots: 1,
      careCooldownMs: 3 * 60_000,
      description: '测试灵植。',
      baseYieldMin: 4,
      baseYieldMax: 6,
    });
    expect(isAuctionListableQuality(seed.rank)).toBe(false);
    expect(isAuctionListableMaterial(seed)).toBe(true);
    expect(
      isAuctionListableMaterial({
        rank: '凡品',
        details: {},
      }),
    ).toBe(false);
  });
});
