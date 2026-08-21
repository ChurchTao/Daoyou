import { MAX_PLAYER_ITEM_QUANTITY } from '@shared/config/itemQuantity';
import { isSpiritFieldSeedMaterial } from '@shared/engine/spirit-field/seedMaterial';
import { QUALITY_ORDER, type Quality } from '@shared/types/constants';

export const AUCTION_MIN_QUALITY: Quality = '玄品';
export const AUCTION_MAX_UNIT_PRICE = 9_999_999;
export const AUCTION_MAX_PURCHASE_QUANTITY = MAX_PLAYER_ITEM_QUANTITY;
export const AUCTION_MAX_TRANSACTION_TOTAL = 1_000_000_000;

export const AUCTION_QUALITY_UNIT_PRICE_CAPS: Partial<Record<Quality, number>> =
  {
    凡品: 5_000,
    灵品: 10_000,
    玄品: 100_000,
    真品: 200_000,
    地品: 400_000,
    天品: 800_000,
    仙品: 1_600_000,
  };

export const AUCTION_TAX_BRACKETS = [
  { upTo: 10_000, rateBps: 300 },
  { upTo: 100_000, rateBps: 500 },
  { upTo: 500_000, rateBps: 800 },
  { upTo: 2_000_000, rateBps: 1_200 },
  { upTo: Number.POSITIVE_INFINITY, rateBps: 1_500 },
] as const;

export interface AuctionSettlementQuote {
  unitPrice: number;
  quantity: number;
  grossAmount: number;
  feeAmount: number;
  sellerAmount: number;
  marginalRatePercent: number;
}

export function isAuctionListableQuality(quality: Quality): boolean {
  return QUALITY_ORDER[quality] >= QUALITY_ORDER[AUCTION_MIN_QUALITY];
}

/** 材料寄售门槛：玄品及以上；灵田种子例外，凡品/灵品亦可上架。 */
export function isAuctionListableMaterial(material: {
  rank: Quality;
  details?: { spiritFieldSeed?: unknown } | null;
}): boolean {
  if (isSpiritFieldSeedMaterial(material)) return true;
  return isAuctionListableQuality(material.rank);
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
