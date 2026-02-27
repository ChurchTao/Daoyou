import { z } from 'zod';

export const HighTierAppraisalSchema = z.object({
  rating: z.enum(['S', 'A', 'B', 'C']).describe('材料评级'),
  comment: z
    .string()
    .min(40)
    .max(160)
    .describe('鉴定评语，需具备仙侠风格'),
  keywords: z
    .array(z.string().min(1).max(12))
    .max(8)
    .describe('用于定价的关键词'),
});

export type HighTierAppraisalAIData = z.infer<typeof HighTierAppraisalSchema>;
