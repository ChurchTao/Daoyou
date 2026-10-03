import type { ApiSuccess } from './http.js';
import type { PlayerStateMutationResponse } from './player.js';
import type { ResourceReadResponse } from './resources/index.js';
import type { TaskInstance } from '@daoyou/shared/types/task';

export type TaskListResponse = ResourceReadResponse<'player.tasks'>;

export type TaskDetailResponse = ApiSuccess<{
  task: TaskInstance;
}>;

export type TaskChallengeResponse = ApiSuccess<import('./combatV6Breakthrough.js').BreakthroughSessionView>;

export type TaskRewardClaimResponse = PlayerStateMutationResponse<{
  task: TaskInstance;
  rewards: string[];
}>;
