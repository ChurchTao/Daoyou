import { z } from 'zod';
import { QUALITY_VALUES } from '@daoyou/constants/qualities';

export const SectTaskRewardSnapshotSchema = z
  .object({
    policyKey: z.string().min(1).max(128),
    policyVersion: z.number().int().positive(),
    difficulty: z.enum(['easy', 'normal', 'hard', 'elite']),
    contribution: z.number().int().nonnegative(),
    cultivationExp: z.number().int().nonnegative(),
    spiritStones: z.number().int().nonnegative(),
    summary: z.array(z.string().min(1).max(128)).max(8),
    grants: z
      .array(
        z
          .object({
            quantity: z.number().int().positive().max(99),
            grant: z
              .object({
                kind: z.literal('sect.reward.material'),
                name: z.string().min(1).max(100),
                quality: z.enum(QUALITY_VALUES),
                description: z.string().min(1).max(500),
                type: z.enum(['herb', 'ore', 'aux']),
                element: z.string().min(1).max(10).optional(),
                libraryItemId: z.string().min(1).max(120),
              })
              .strict(),
          })
          .strict(),
      )
      .max(4)
      .default([]),
  })
  .strict();

export type SectTaskRewardSnapshot = z.infer<
  typeof SectTaskRewardSnapshotSchema
>;
