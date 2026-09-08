import { z } from 'zod';
import type {
  BreakthroughChallengeId,
  BreakthroughSnapshot,
} from '../engine/combat-v6/breakthrough/host';
import type { CombatV6TrainingSessionViewV1 } from './combatV6';

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
export interface BreakthroughRuntime {
  version: 'breakthrough-session-v1';
  battleId: string;
  userId: string;
  cultivatorId: string;
  taskId: string;
  objectiveId: string;
  challengeId: BreakthroughChallengeId;
  revision: number;
  startedAt: string;
  snapshot: BreakthroughSnapshot;
}
export type BreakthroughSessionView = Omit<
  CombatV6TrainingSessionViewV1,
  'encounterId' | 'tier'
> & {
  taskId: string;
  challengeTitle: string;
  settlement?: 'pending' | 'settled';
};
