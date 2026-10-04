import type {
  BreakthroughChallengeId,
  BreakthroughSnapshot,
} from '@daoyou/game-domain/combat/challenges';

import type { CombatV6TrainingSessionViewV1 } from './combatV6.js';

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
