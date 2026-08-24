import { describe, expect, test } from 'vitest';
import { getAuctionUnitPriceCap } from './auctionConfig';
import {
  getSystemAuctionListingCount,
  getSystemAuctionUnitPrice,
  SYSTEM_AUCTION_ITEM_TYPES,
  SYSTEM_AUCTION_QUALITIES,
  SYSTEM_AUCTION_RESTORE_RATE_BY_QUALITY,
  SYSTEM_AUCTION_STOCK_BY_QUALITY,
} from './systemAuctionConfig';

describe('system auction config', () => {
  test('stock decreases as quality rises', () => {
    const listingCounts = SYSTEM_AUCTION_QUALITIES.map((quality) =>
      getSystemAuctionListingCount(quality),
    );
    const materialQuantities = SYSTEM_AUCTION_QUALITIES.map(
      (quality) => SYSTEM_AUCTION_STOCK_BY_QUALITY[quality].materialQuantity,
    );
    const consumableQuantities = SYSTEM_AUCTION_QUALITIES.map(
      (quality) => SYSTEM_AUCTION_STOCK_BY_QUALITY[quality].consumableQuantity,
    );

    expect(SYSTEM_AUCTION_QUALITIES).toEqual(['凡品', '灵品', '玄品']);
    expect(SYSTEM_AUCTION_ITEM_TYPES).toEqual(['material', 'consumable']);
    expect(listingCounts).toEqual([10, 9, 7]);
    for (const values of [
      listingCounts,
      materialQuantities,
      consumableQuantities,
    ]) {
      expect(
        values.every(
          (value, index) => index === 0 || value <= values[index - 1]!,
        ),
      ).toBe(true);
    }
  });

  test('all generated prices stay within auction quality caps', () => {
    for (const quality of SYSTEM_AUCTION_QUALITIES) {
      for (const itemType of SYSTEM_AUCTION_ITEM_TYPES) {
        expect(
          getSystemAuctionUnitPrice({ itemType, quality }),
        ).toBeLessThanOrEqual(getAuctionUnitPriceCap(quality));
      }
    }
  });

  test('resource restoration uses normalized rates', () => {
    const rates = SYSTEM_AUCTION_QUALITIES.map(
      (quality) => SYSTEM_AUCTION_RESTORE_RATE_BY_QUALITY[quality],
    );
    expect(rates).toEqual([0.12, 0.2, 0.3]);
    expect(rates.every((rate) => rate > 0 && rate <= 1)).toBe(true);
  });
});
