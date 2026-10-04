import { z } from 'zod';

export const FeedbackTypeSchema = z.enum(['bug', 'feature', 'balance', 'other']);

export const FeedbackCreateRequestSchema = z.object({
  type: FeedbackTypeSchema,
  content: z
    .string()
    .trim()
    .min(10, '反馈内容至少需要 10 个字'),
});

export type FeedbackType = z.infer<typeof FeedbackTypeSchema>;
export type FeedbackCreateRequest = z.infer<typeof FeedbackCreateRequestSchema>;
