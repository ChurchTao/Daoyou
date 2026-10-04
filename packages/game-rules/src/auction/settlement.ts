import type { AuctionSettlementQuote } from '@daoyou/game-domain/auction';
import { AUCTION_MIN_QUALITY, AUCTION_QUALITY_UNIT_PRICE_CAPS, AUCTION_TAX_BRACKETS } from '@daoyou/game-content/auction/config';

import { AUCTION_MAX_UNIT_PRICE } from '@daoyou/game-domain/auction';



import { QUALITY_ORDER, type Quality } from '@daoyou/constants/qualities';




export function isAuctionListableQuality(quality: Quality): boolean {
  return QUALITY_ORDER[quality] >= QUALITY_ORDER[AUCTION_MIN_QUALITY];
}




export function getAuctionUnitPriceCap(quality: Quality): number {
  return AUCTION_QUALITY_UNIT_PRICE_CAPS[quality] ?? AUCTION_MAX_UNIT_PRICE;
}




export function getAuctionMarginalRateBps(unitPrice: number): number {
  const normalizedPrice = Math.max(0, Math.floor(unitPrice));
  return (
    AUCTION_TAX_BRACKETS.find((bracket) => normalizedPrice <= bracket.upTo)
      ?.rateBps ?? AUCTION_TAX_BRACKETS[AUCTION_TAX_BRACKETS.length - 1].rateBps
  );
}




export function calculateAuctionSettlement(
  unitPrice: number,
  quantity: number,
): AuctionSettlementQuote {
  const normalizedPrice = Math.max(0, Math.floor(unitPrice));
  const normalizedQuantity = Math.max(0, Math.floor(quantity));
  const grossAmount = normalizedPrice * normalizedQuantity;

  let lowerBound = 0;
  let remainingUnitPrice = normalizedPrice;
  let feeNumeratorPerUnit = 0;

  for (const bracket of AUCTION_TAX_BRACKETS) {
    if (remainingUnitPrice <= 0) break;
    const bracketWidth = Number.isFinite(bracket.upTo)
      ? bracket.upTo - lowerBound
      : remainingUnitPrice;
    const taxableAmount = Math.min(remainingUnitPrice, bracketWidth);
    feeNumeratorPerUnit += taxableAmount * bracket.rateBps;
    remainingUnitPrice -= taxableAmount;
    lowerBound = bracket.upTo;
  }

  const feeAmount = Math.floor(
    (feeNumeratorPerUnit * normalizedQuantity) / 10_000,
  );

  return {
    unitPrice: normalizedPrice,
    quantity: normalizedQuantity,
    grossAmount,
    feeAmount,
    sellerAmount: grossAmount - feeAmount,
    marginalRatePercent: getAuctionMarginalRateBps(normalizedPrice) / 100,
  };
}
