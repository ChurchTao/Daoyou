import {
  ITEM_EXCHANGE_SHOP_MAX_PRICE,
  ITEM_EXCHANGE_SHOP_MAX_STACK_QUANTITY,
  ItemExchangeShopItemMutationSchema,
  ItemExchangeShopItemStatusSchema,
  type ItemExchangeShopItemMutation,
  type ItemExchangeShopItemStatus,
  type ItemExchangeShopItemView,
} from '@shared/contracts/itemExchangeShop';
import { z } from 'zod';

export const SectShopItemStatusSchema = ItemExchangeShopItemStatusSchema;
export const SectShopListQuerySchema = z.object({
  status: SectShopItemStatusSchema.optional(),
});
export const SectShopItemMutationSchema = ItemExchangeShopItemMutationSchema;
export const SectShopBuyParamsSchema = z.object({
  id: z.string().uuid(),
});

export const SECT_SHOP_MAX_PRICE = ITEM_EXCHANGE_SHOP_MAX_PRICE;
export const SECT_SHOP_MAX_STACK_QUANTITY =
  ITEM_EXCHANGE_SHOP_MAX_STACK_QUANTITY;

export type SectShopItemStatus = ItemExchangeShopItemStatus;
export type SectShopItemMutation = ItemExchangeShopItemMutation;
export type SectShopItemData = ItemExchangeShopItemView;

export interface SectShopData {
  weekKey: string;
  contribution: number;
  items: SectShopItemData[];
}

export interface SectShopBuyResponse {
  destinations: Array<'bag' | 'storage'>;
  purchasedItem: SectShopItemData;
  contribution: number;
}
