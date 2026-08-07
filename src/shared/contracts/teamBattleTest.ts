import { z } from 'zod';
import type { TeamBattleRecord } from '@shared/engine/battle-team';

export const TeamBattleTestRequestSchema = z
  .object({
    seed: z.union([z.string(), z.number()]).optional(),
    maxTurns: z.number().int().min(1).max(50).optional(),
    preset: z.enum(['default', 'library', 'library5v5']).optional(),
  })
  .optional();

export type TeamBattleTestRequest = z.infer<typeof TeamBattleTestRequestSchema>;

export type TeamBattleTestResponse = {
  success: true;
  data: TeamBattleRecord;
};

export type TeamBattleTestErrorResponse = {
  success: false;
  error: string;
};
