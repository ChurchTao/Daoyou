import { z } from 'zod';

export const RecycleSelectionSchema = z
  .object({
    id: z.string().min(1).max(160),
    revision: z.number().int().nonnegative(),
    quantity: z.number().int().min(1).max(99),
  })
  .strict();
export const RecycleRequestSchema = z.discriminatedUnion('phase', [
  z
    .object({
      phase: z.literal('preview'),
      items: z
        .array(RecycleSelectionSchema)
        .min(1)
        .max(40)
        .refine(
          (items) =>
            new Set(items.map((item) => item.id)).size === items.length,
          '同一物品不可重复选择',
        ),
    })
    .strict(),
  z.object({ phase: z.literal('confirm'), quoteId: z.uuid() }).strict(),
]);
export type RecycleSelection = z.infer<typeof RecycleSelectionSchema>;
export type RecycleQuote = {
  id: string;
  expiresAt: number;
  items: (RecycleSelection & {
    name: string;
    unitPrice: number;
    comment?: string;
  })[];
  total: number;
};
export type RecycleResult = {
  total: number;
  quantity: number;
  remainingSpiritStones: number;
};
