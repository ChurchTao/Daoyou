import { z } from 'zod';

export const CombatAutoRequestSchema = z
  .object({
    type: z.literal('AUTO'),
    round: z.number().int().positive(),
    expectedRevision: z.number().int().nonnegative(),
  })
  .strict();
