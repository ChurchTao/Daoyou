import { AUCTION_ITEM_TYPES } from '@daoyou/game-domain/auction';
import { QUALITY_VALUES } from '@daoyou/constants/qualities';
import { z } from 'zod';

export const ListingsSchema = z.object({
  scope: z.enum(['all', 'mine']).default('all'),
  assetType: z.enum(['item', 'beast']).optional(),
  itemType: z.enum(AUCTION_ITEM_TYPES).optional(),
  itemCategory: z.string().trim().min(1).max(50).optional(),
  itemQuality: z.enum(QUALITY_VALUES).optional(),
  itemName: z.string().trim().min(1).max(200).optional(),
  sellerName: z.string().trim().min(1).max(100).optional(),
  minPrice: z.number().int().min(0).optional(),
  maxPrice: z.number().int().min(0).optional(),
  sortBy: z.enum(['price_asc', 'price_desc', 'latest']).optional(),
  page: z.number().int().min(1).optional(),
  limit: z.number().int().min(1).max(100).optional(),
});
