import { z } from 'zod';
import { REALM_VALUES, type RealmType } from '../types/constants';

export const RankingChallengeSchema = z
  .object({
    requestId: z.uuid(),
    targetId: z.uuid().nullable(),
    realm: z.enum(REALM_VALUES),
  })
  .strict();
export type RankingChallengeRequest = z.infer<typeof RankingChallengeSchema>;
export type RankingChallengeResult = {
  requestId: string;
  realm: RealmType;
  day: string;
  type: 'direct_entry' | 'battle_result';
  battleId?: string;
  outcome?: 'victory' | 'defeat' | 'draw';
  affectsRanking: boolean;
  challengerRank: number | null;
  targetRank: number | null;
  remainingChallenges: number;
  change: 'challenge_win' | 'vacancy_entry' | 'direct_entry' | null;
};
