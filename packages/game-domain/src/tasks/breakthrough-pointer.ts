import { z } from 'zod';

export const BreakthroughBattlePointerSchema = z
  .object({
    battleId: z.uuid(),
    objectiveId: z.string().min(1),
    settled: z.boolean(),
  })
  .strict();

export type BreakthroughBattlePointer = z.infer<
  typeof BreakthroughBattlePointerSchema
>;
