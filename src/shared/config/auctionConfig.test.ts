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

  it('灵植种子同样只有玄品及以上可以寄售', () => {
    const seed = buildSpiritFieldSeedMaterialFromPlant({
      id: 'seed-test',
      seedName: '青芽草灵种',
      seedDescription: '一枚青色种籽。',
      clueTexts: ['遇到温和灵机时微微发热', '似乎喜爱山间清气'],
      quality: '凡品',
      element: '木',
      minRealm: '炼气',
      stageDurationMs: { germination: 4 * 60_000, nourishing: 4 * 60_000, forming: 4 * 60_000 },
      growthForm: 'herb',
      harvestPart: 'leaf',
      preferredMethods: ['seasonal_nurture'],
      avoidedMethods: [],
      preferredHabitats: ['mountain'],
      avoidedHabitats: [],
      growthTraits: ['qi-sensitive'],
      useTags: ['alchemy'],
      outcomeBiases: ['herb'],
      creationTags: ['Material.Semantic.Wood'],
      baseYieldMin: 4,
      baseYieldMax: 6,
    });
    expect(isAuctionListableQuality(seed.rank)).toBe(false);
    expect(isAuctionListableMaterial(seed)).toBe(false);
    const highSeed = { ...seed, rank: '玄品' as const };
    expect(isAuctionListableMaterial(highSeed)).toBe(true);
    expect(
      isAuctionListableMaterial({
        rank: '凡品',
        details: {},
      }),
    ).toBe(false);
  });
});
