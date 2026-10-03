import { BLACK_MARKET_NPC_IDS } from '@daoyou/shared/types/blackMarket';
import { z } from 'zod';

export const OpenSessionSchema = z.object({
  npcId: z.enum(BLACK_MARKET_NPC_IDS),
});
export const InteractSchema = z
  .object({
    message: z.string().trim().min(1).max(240).optional(),
    offeredPrice: z.number().int().min(1).max(2_000_000_000).optional(),
    version: z.number().int().min(1),
  })
  .superRefine((value, context) => {
    if (!value.message && !value.offeredPrice)
      context.addIssue({
        code: 'custom',
        message: '请说点什么，或给出灵石报价',
      });
  });
export const LeaveSchema = z.object({ version: z.number().int().min(1) });
export const CommitSchema = z.object({
  version: z.number().int().min(1),
  expectedPrice: z.number().int().min(1).max(2_000_000_000),
});
