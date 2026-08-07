import { z } from 'zod';

export const BattleMatchSessionSchema = z.object({
  gameName: z.literal('battle-v5-match'),
  matchID: z.string().min(1),
  playerID: z.string().regex(/^\d+$/),
  playerCredentials: z.string().min(1),
  serverOrigin: z.string().url(),
});

export type BattleMatchSessionV1 = z.infer<typeof BattleMatchSessionSchema>;
