import { z } from 'zod';


const quantity = z
  .object({
    min: z.number().int().min(1).max(Number.MAX_SAFE_INTEGER),
    max: z.number().int().min(1).max(Number.MAX_SAFE_INTEGER),
  })
  .strict()
  .refine((v) => v.min <= v.max);

const reward = z
  .object({ rewardId: z.string().min(1).max(160), quantity })
  .strict();

const group = z
  .object({
    id: z.string().min(1).max(100),
    chance: z.number().finite().min(0).max(1),
    entries: z
      .array(
        reward.extend({ weight: z.number().finite().positive().max(1000000) }),
      )
      .min(1)
      .max(1000),
  })
  .strict();

export const DropPoolSchema = z
  .object({
    id: z.string().min(1).max(100),
    version: z.number().int().positive(),
    groups: z.array(group).min(1).max(100),
  })
  .strict()
  .refine(
    (v) => new Set(v.groups.map((g) => g.id)).size === v.groups.length,
    'Duplicate drop group ID',
  );

export type DropPool = z.infer<typeof DropPoolSchema>;

export type DropResult = {
  poolId: string;
  version: number;
  rewards: { groupId: string; rewardId: string; quantity: number }[];
};
