import { z } from 'zod';
import { RewardItemSchema, rewardDisplayItem } from './adminRewards';

export const ItemExchangeShopItemStatusSchema = z.enum(['active', 'archived']);

export const ITEM_EXCHANGE_SHOP_MAX_PRICE = 9999;
export const ITEM_EXCHANGE_SHOP_MAX_STACK_QUANTITY = 30;

export const ItemExchangeShopItemMutationSchema = z
  .object({
    item: RewardItemSchema,
    price: z.number().int().min(1).max(ITEM_EXCHANGE_SHOP_MAX_PRICE),
    perUserLimit: z.number().int().min(1).max(100000000).nullable().optional(),
    status: ItemExchangeShopItemStatusSchema.default('active'),
    sortOrder: z.number().int().min(-1000000).max(1000000).default(0),
  })
  .refine(
    (value) => value.item.quantity <= ITEM_EXCHANGE_SHOP_MAX_STACK_QUANTITY,
    { message: '单次最多发放 30 件', path: ['item', 'quantity'] },
  );

export type ItemExchangeShopItemStatus = z.infer<
  typeof ItemExchangeShopItemStatusSchema
>;
export type ItemExchangeShopItemMutation = z.infer<
  typeof ItemExchangeShopItemMutationSchema
>;

export interface ItemExchangeShopItemView {
  id: string;
  itemLibraryItemId: string | null;
  price: number;
  quantity: number;
  perUserLimit: number | null;
  status: ItemExchangeShopItemStatus;
  sortOrder: number;
  purchasedCount: number;
  remainingPurchases: number | null;
  item: ReturnType<typeof rewardDisplayItem> | null;
  createdAt: string;
  updatedAt: string;
}
