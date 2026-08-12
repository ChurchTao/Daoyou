import { z } from 'zod';

export const BattleMatchSessionSchema = z.object({
  protocolVersion: z.literal(2),
  matchId: z.string().min(1),
  playerId: z.string().min(1),
  connectTicket: z.string().min(32),
  websocketUrl: z.string().url(),
});

export type BattleMatchSessionV2 = z.infer<typeof BattleMatchSessionSchema>;
