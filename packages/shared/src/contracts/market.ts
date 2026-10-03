import { z } from 'zod';

const purchaseItem = z
  .object({
    listingId: z.string().min(1).max(160),
    quantity: z.literal(1),
  })
  .strict();
export const MarketBuySchema = z
  .object({
    requestId: z.uuid(),
    layer: z.enum(['common', 'treasure', 'heaven']),
    expectedTotal: z.number().int().nonnegative().max(2147483647),
    items: z.array(purchaseItem).min(1).max(40),
  })
  .strict()
  .refine(
    (value) =>
      new Set(value.items.map((item) => item.listingId)).size ===
      value.items.length,
    '购买列表中存在重复商品',
  );
export type MarketBuyInput = z.infer<typeof MarketBuySchema>;
export type MarketPurchaseResult = {
  totalCost: number;
  deliveries: Array<{
    listingId: string;
    name: string;
    location: 'bag' | 'storage' | 'vault';
  }>;
};
