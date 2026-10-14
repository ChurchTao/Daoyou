import {
  ITEM_EXCHANGE_CART_MAX_COUNT,
  ITEM_EXCHANGE_CART_MAX_LINES,
} from '@daoyou/game-domain/shops/exchange';
import { z } from 'zod';

const exchangeCartLine = z
  .object({
    id: z.string().uuid(),
    count: z.number().int().min(1).max(ITEM_EXCHANGE_CART_MAX_COUNT),
  })
  .strict();

export const ItemExchangeCartItemsSchema = z
  .array(exchangeCartLine)
  .min(1)
  .max(ITEM_EXCHANGE_CART_MAX_LINES)
  .refine(
    (items) => new Set(items.map((item) => item.id)).size === items.length,
    '兑换列表中存在重复商品',
  );

export const ItemExchangeExpectedTotalSchema = z
  .number()
  .int()
  .positive()
  .max(2_147_483_647);

export const ItemExchangeCartBodySchema = z
  .object({
    expectedTotal: ItemExchangeExpectedTotalSchema,
    items: ItemExchangeCartItemsSchema,
  })
  .strict();

export type ItemExchangeCartBody = z.infer<typeof ItemExchangeCartBodySchema>;
