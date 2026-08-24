import { ALCHEMY_EFFECT_BASE_BY_QUALITY } from '@shared/config/alchemyEffectConfig';
import { getAuctionUnitPriceCap } from '@shared/config/auctionConfig';
import {
  BASE_PRICES,
  TYPE_MULTIPLIERS,
} from '@shared/engine/material/creation/config';
import type { MaterialType, Quality } from '@shared/types/constants';

export const SYSTEM_AUCTION_USER_ID = '00000000-0000-4000-8000-000000000101';
export const SYSTEM_AUCTION_CULTIVATOR_ID =
  '00000000-0000-4000-8000-000000000102';
export const SYSTEM_AUCTION_SELLER_NAME = '天道商会';

export const SYSTEM_AUCTION_REFRESH_INTERVAL_MS = 2 * 60 * 60 * 1_000;
export const SYSTEM_AUCTION_LISTING_DURATION_MS =
  SYSTEM_AUCTION_REFRESH_INTERVAL_MS + 10 * 60 * 1_000;

export const SYSTEM_AUCTION_QUALITIES = [
  '凡品',
  '灵品',
  '玄品',
] as const satisfies readonly Quality[];
export type SystemAuctionQuality = (typeof SYSTEM_AUCTION_QUALITIES)[number];

export const SYSTEM_AUCTION_ITEM_TYPES = ['material', 'consumable'] as const;

export interface SystemAuctionStockTier {
  materialListings: number;
  materialQuantity: number;
  consumableListings: number;
  consumableQuantity: number;
}

/** 品质越高，货单数和单个货单的库存越少。 */
export const SYSTEM_AUCTION_STOCK_BY_QUALITY: Record<
  SystemAuctionQuality,
  SystemAuctionStockTier
> = {
  凡品: {
    materialListings: 7,
    materialQuantity: 50,
    consumableListings: 3,
    consumableQuantity: 25,
  },
  灵品: {
    materialListings: 6,
    materialQuantity: 30,
    consumableListings: 3,
    consumableQuantity: 15,
  },
  玄品: {
    materialListings: 5,
    materialQuantity: 15,
    consumableListings: 2,
    consumableQuantity: 8,
  },
};

/** restore_resource 的 percent 模式使用 0~1 比例值，而不是百分数文本。 */
export const SYSTEM_AUCTION_RESTORE_RATE_BY_QUALITY: Record<
  SystemAuctionQuality,
  number
> = {
  凡品: ALCHEMY_EFFECT_BASE_BY_QUALITY.凡品.restorePercent,
  灵品: ALCHEMY_EFFECT_BASE_BY_QUALITY.灵品.restorePercent,
  玄品: ALCHEMY_EFFECT_BASE_BY_QUALITY.玄品.restorePercent,
};

export function isSystemAuctionSeller(cultivatorId: string): boolean {
  return cultivatorId === SYSTEM_AUCTION_CULTIVATOR_ID;
}

export function getSystemAuctionUnitPrice(args: {
  itemType: (typeof SYSTEM_AUCTION_ITEM_TYPES)[number];
  quality: Quality;
  materialType?: MaterialType;
}): number {
  const basePrice = BASE_PRICES[args.quality];
  const multiplier =
    args.itemType === 'material'
      ? 1.25 * TYPE_MULTIPLIERS[args.materialType ?? 'herb']
      : 2.5;
  return Math.min(
    Math.floor(basePrice * multiplier),
    getAuctionUnitPriceCap(args.quality),
  );
}

export function getSystemAuctionListingCount(quality: Quality): number {
  if (!(quality in SYSTEM_AUCTION_STOCK_BY_QUALITY)) return 0;
  const tier =
    SYSTEM_AUCTION_STOCK_BY_QUALITY[
      quality as keyof typeof SYSTEM_AUCTION_STOCK_BY_QUALITY
    ];
  return tier.materialListings + tier.consumableListings;
}
