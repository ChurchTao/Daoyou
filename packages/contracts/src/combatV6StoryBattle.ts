import type { StoryBattleSnapshot } from '@daoyou/game-domain/combat/challenges';
import type { StoryBattleOutcome } from '@daoyou/game-domain/story';

import type { CombatV6TrainingSessionViewV1 } from './combatV6.js';

export interface StoryBattleRuntime {
  version: 'story-session-v1';
  sessionId: string;
  userId: string;
  cultivatorId: string;
  battleId: string;
  revision: number;
  startedAt: string;
  snapshot: StoryBattleSnapshot;
  /** 打出结果之后才有。 */
  result?: StoryBattleOutcome;
  settled: boolean;
}

export type StoryBattleSessionView = Omit<
  CombatV6TrainingSessionViewV1,
  'encounterId' | 'tier'
> & {
  battleId: string;
  title: string;
  settlement?: 'pending' | 'settled';
  /** 这一场在主线里算什么结果。 */
  result?: StoryBattleOutcome;
  /** 输了要不要再打一次才能往下走。 */
  retry: boolean;
};
