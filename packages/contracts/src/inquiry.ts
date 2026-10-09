import { z } from 'zod';
import { INQUIRY_CONTAINER_JUDGEMENTS } from '@daoyou/game-domain/inquiry';

export const InquiryOpenRequestSchema = z
  .object({ mapNodeId: z.string().min(1) })
  .strict();

export const InquiryActionRequestSchema = z
  .object({
    runId: z.uuid(),
    actionId: z.string().min(1).max(80),
    expectedRevision: z.number().int().nonnegative(),
  })
  .strict();

export const InquiryVerdictRequestSchema = z
  .object({
    runId: z.uuid(),
    expectedRevision: z.number().int().nonnegative(),
    answerId: z.string().min(1).max(40),
    container: z.enum(INQUIRY_CONTAINER_JUDGEMENTS),
  })
  .strict();

export const InquiryLeaveRequestSchema = z
  .object({
    runId: z.uuid(),
    expectedRevision: z.number().int().nonnegative(),
  })
  .strict();
