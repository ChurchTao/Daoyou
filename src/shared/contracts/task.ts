import type { ApiSuccess } from './http';
import type { PlayerStateMutationResponse } from './player';
import type { ResourceReadResponse } from './resources';
import type { TaskInstance } from '@shared/types/task';

export type TaskListResponse = ResourceReadResponse<'player.tasks'>;

export type TaskDetailResponse = ApiSuccess<{
  task: TaskInstance;
}>;

export type TaskChallengeResponse = ApiSuccess<import('./combatV6Breakthrough').BreakthroughSessionView>;

export type TaskRewardClaimResponse = PlayerStateMutationResponse<{
  task: TaskInstance;
  rewards: string[];
}>;
