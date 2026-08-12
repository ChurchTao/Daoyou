import { z } from 'zod';

export const BATTLE_RESOLUTION_STREAM = 'DAOYOU_BATTLE_RESOLUTION_V1';
export const BATTLE_RESOLUTION_SUBJECT = 'daoyou.battle.resolution.execute.v1';

export const BattleResolutionTaskSchema = z
  .object({
    version: z.literal('battle_resolution_task_v1'),
    taskId: z.string().min(1).max(300),
    matchId: z.string().regex(/^[A-Za-z0-9_-]{1,120}$/),
    commandSetId: z.string().min(1).max(300),
    expectedStorageRevision: z.number().int().nonnegative(),
    expectedMatchRevision: z.number().int().nonnegative(),
    attempt: z.number().int().positive().max(1_000_000),
    enqueuedAt: z.number().int().nonnegative(),
  })
  .strict();

export type BattleResolutionTaskV1 = z.infer<typeof BattleResolutionTaskSchema>;
