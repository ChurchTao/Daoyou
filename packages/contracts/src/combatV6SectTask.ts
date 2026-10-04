
import type { SectBattleSnapshot } from '@daoyou/game-domain/combat/challenges';


import type { CombatV6TrainingSessionViewV1 } from './combatV6.js';

export interface SectTaskBattleRuntime {
  version: 'sect-task-session-v1';
  battleId: string;
  userId: string;
  cultivatorId: string;
  recordId: string;
  taskId: string;
  revision: number;
  startedAt: string;
  snapshot: SectBattleSnapshot;
}

export type SectTaskSessionView = Omit<
  CombatV6TrainingSessionViewV1,
  'encounterId' | 'tier'
> & {
  taskId: string;
  settlement?: 'pending' | 'settled';
};
