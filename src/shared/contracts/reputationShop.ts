import {
  ITEM_EXCHANGE_SHOP_MAX_PRICE,
  ITEM_EXCHANGE_SHOP_MAX_STACK_QUANTITY,
  ItemExchangeShopItemMutationSchema,
  ItemExchangeShopItemStatusSchema,
  type ItemExchangeShopItemView,
} from '@shared/contracts/itemExchangeShop';
import { z } from 'zod';

export const ReputationShopItemStatusSchema = ItemExchangeShopItemStatusSchema;

export const ReputationShopListQuerySchema = z.object({
  status: ReputationShopItemStatusSchema.optional(),
});

export const REPUTATION_SHOP_MAX_PRICE = ITEM_EXCHANGE_SHOP_MAX_PRICE;
export const REPUTATION_SHOP_MAX_STACK_QUANTITY =
  ITEM_EXCHANGE_SHOP_MAX_STACK_QUANTITY;

export const ReputationShopItemMutationSchema =
  ItemExchangeShopItemMutationSchema;

export const ReputationShopBuyParamsSchema = z.object({
  id: z.string().uuid(),
});

export const ReputationShopBuyBodySchema = z
  .object({ requestId: z.string().uuid() })
  .strict();

export type ReputationShopItemStatus = z.infer<
  typeof ReputationShopItemStatusSchema
>;
export type ReputationShopItemMutation = z.infer<
  typeof ReputationShopItemMutationSchema
>;

export type ReputationShopItemView = ItemExchangeShopItemView;

export interface ReputationShopListResponse {
  items: ReputationShopItemView[];
  reputation: number;
}

export interface ReputationShopBuyResponse {
  purchasedItem: ReputationShopItemView;
  destinations: Array<'bag' | 'storage'>;
  reputation: number;
}
