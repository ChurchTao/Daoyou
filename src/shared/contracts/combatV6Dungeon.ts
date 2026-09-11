import { z } from 'zod';
import type { CombatV6TrainingSessionViewV1 } from './combatV6';
export const DungeonActionRequestSchema = z
  .object({
    choiceId: z.number().int(),
    actionId: z.uuid(),
    runId: z.uuid(),
    round: z.number().int().positive(),
  })
  .strict();
export const DungeonBeginBattleRequestSchema = z
  .object({ encounterId: z.uuid() })
  .strict();
export interface DungeonEncounterView {
  id: string;
  description: string;
  enemies: string[];
  hp: { current: number; max: number };
  mp: { current: number; max: number };
  beast: string | null;
}
export type DungeonSessionView = Omit<
  CombatV6TrainingSessionViewV1,
  'encounterId' | 'tier'
>;
