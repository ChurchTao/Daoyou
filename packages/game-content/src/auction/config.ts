import type { Quality } from '@daoyou/constants/qualities';



export const AUCTION_MIN_QUALITY: Quality = '玄品';



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
