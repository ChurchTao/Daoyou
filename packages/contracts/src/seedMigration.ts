import type { Quality } from '@daoyou/constants/qualities';
import { z } from 'zod';

export const ExchangeSeedSchema = z
  .object({
    requestId: z.uuid(),
    source: z.enum(['vault', 'inventory']),
    id: z.string().min(1).max(160),
    quantity: z.number().int().min(1).max(999),
    expectedQuantity: z.number().int().positive(),
    revision: z.number().int().nonnegative().optional(),
  })
  .strict()
  .superRefine((input, ctx) => {
    if (input.quantity > input.expectedQuantity)
      ctx.addIssue({ code: 'custom', message: '转化数量不能超过来源数量' });
    if (input.source === 'inventory' && input.revision === undefined)
      ctx.addIssue({ code: 'custom', message: '背包灵种需要物品版本' });
    if (input.source === 'vault' && input.revision !== undefined)
      ctx.addIssue({ code: 'custom', message: '旧宝库灵种不接受物品版本' });
    if (input.source === 'vault' && !z.uuid().safeParse(input.id).success)
      ctx.addIssue({ code: 'custom', message: '旧宝库灵种身份无效' });
  });

export type ExchangeSeed = z.infer<typeof ExchangeSeedSchema>;
export type SeedMigrationRequest = ExchangeSeed;

export interface SeedMigrationSource {
  source: 'vault' | 'inventory';
  id: string;
  name: string;
  quality: string;
  quantity: number;
  revision?: number;
  location: 'vault' | 'bag' | 'storage';
  problem: string | null;
}

export interface SeedMigrationView {
  ownerId: string;
  blockedReason: string | null;
  pending: SeedMigrationSource[];
}

export interface SeedMigrationResult {
  quantity: number;
  seeds: {
    speciesId: string;
    name: string;
    quality: Quality;
    quantity: number;
  }[];
  locations: ('bag' | 'storage')[];
}
