import { z } from 'zod';

import type { CombatV6DisplayCatalog } from '@daoyou/game-domain/combat';

export type CombatV6ReplayDisplay = CombatV6DisplayCatalog;

/** Competitive battles and cooperative hunts have durable player-facing replays. */
export const COMBAT_V6_REPLAY_SOURCES = [
  'ranking',
  'arena-sparring',
  'hunt',
] as const;

export const CombatV6HistoryQuerySchema = z.object({
  page: z.coerce.number().int().min(1).max(10000).default(1),
  source: z.enum(COMBAT_V6_REPLAY_SOURCES).optional(),
});

export type CombatV6HistoryQuery = z.infer<typeof CombatV6HistoryQuerySchema>;

export type CombatV6HistoryItem = {
  battleId: string;
  sourceType: string;
  finishedAt: string;
  roundCount: number;
  sides: [string[], string[]];
  outcome: 'victory' | 'defeat' | 'draw' | 'aborted';
};

export type CombatV6HistoryPage = {
  items: CombatV6HistoryItem[];
  page: number;
  hasMore: boolean;
};
