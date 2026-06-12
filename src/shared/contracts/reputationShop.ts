import type { ItemLibraryEntry } from '@shared/lib/itemLibrary';
import { ItemLibraryItemIdSchema } from '@shared/lib/itemLibrary';
import { z } from 'zod';

export const ReputationShopItemStatusSchema = z.enum(['active', 'archived']);

export const ReputationShopListQuerySchema = z.object({
  status: ReputationShopItemStatusSchema.optional(),
});

export const REPUTATION_SHOP_MAX_PRICE = 9999;
export const REPUTATION_SHOP_MAX_STACK_QUANTITY = 30;

export const ReputationShopItemMutationSchema = z.object({
  itemLibraryItemId: ItemLibraryItemIdSchema,
  price: z.number().int().min(1).max(REPUTATION_SHOP_MAX_PRICE),
  quantity: z.number().int().min(1).max(REPUTATION_SHOP_MAX_STACK_QUANTITY),
  perUserLimit: z.number().int().min(1).max(100000000).nullable().optional(),
  status: ReputationShopItemStatusSchema.default('active'),
  sortOrder: z.number().int().min(-1000000).max(1000000).default(0),
});

export const ReputationShopBuyParamsSchema = z.object({
  id: z.string().uuid(),
});

export type ReputationShopItemStatus = z.infer<
  typeof ReputationShopItemStatusSchema
>;
export type ReputationShopItemMutation = z.infer<
  typeof ReputationShopItemMutationSchema
>;

export interface ReputationShopItemView {
  id: string;
  itemLibraryItemId: string;
  price: number;
  quantity: number;
  perUserLimit: number | null;
  status: ReputationShopItemStatus;
  sortOrder: number;
  purchasedCount: number;
  remainingPurchases: number | null;
  item: ItemLibraryEntry;
  createdAt: string;
  updatedAt: string;
}

export interface ReputationShopListResponse {
  items: ReputationShopItemView[];
  reputation: number;
}

export interface ReputationShopBuyResponse {
  purchasedItem: ReputationShopItemView;
  reputation: number;
}
