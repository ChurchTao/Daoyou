import type {
  TaskChallengeResponse,
  TaskDetailResponse,
  TaskListResponse,
  TaskRewardClaimResponse,
} from '@shared/contracts/task';
import { consumePlayerStateMutation } from '@app/lib/player-state/store';
import { getNextMajorRealm } from '@shared/lib/breakthroughPill';
import type { Cultivator } from '@shared/types/cultivator';
import type { TaskInstance, TaskStatus } from '@shared/types/task';
import {
  TUTORIAL_TASK_ORDER,
  hasClaimedTutorialReward,
} from '@shared/lib/noviceGuidance';

async function readJsonOrThrow<T>(response: Response): Promise<T> {
  const payload = await response.json();
  if (!response.ok || !payload?.success) {
    throw new Error(
      typeof payload?.error === 'string' ? payload.error : `HTTP ${response.status}`,
    );
  }
  return payload as T;
}

export async function fetchTaskList(status?: TaskStatus) {
  const params = new URLSearchParams();
  if (status) {
    params.set('status', status);
  }

  const response = await fetch(
    params.size > 0 ? `/api/tasks?${params.toString()}` : '/api/tasks',
  );
  return readJsonOrThrow<TaskListResponse>(response);
}

export async function fetchTaskDetail(taskId: string) {
  const response = await fetch(`/api/tasks/${taskId}`);
  return readJsonOrThrow<TaskDetailResponse>(response);
}

export async function startTaskChallenge(taskId: string) {
  const response = await fetch(`/api/tasks/${taskId}/challenge`, {
    method: 'POST',
  });
  return readJsonOrThrow<TaskChallengeResponse>(response);
}

export async function claimTaskReward(taskId: string) {
  const response = await fetch(`/api/tasks/${taskId}/claim-reward`, {
    method: 'POST',
  });
  const payload = await readJsonOrThrow<TaskRewardClaimResponse>(response);
  if (payload.state) {
    await consumePlayerStateMutation(payload);
  }
  return payload;
}

export function findCurrentMajorBreakthroughTask(
  cultivator: Cultivator | null | undefined,
  tasks: TaskInstance[],
): TaskInstance | null {
  if (!cultivator || cultivator.realm_stage !== '圆满') {
    return null;
  }

  const toRealm = getNextMajorRealm(cultivator.realm);
  if (!toRealm) {
    return null;
  }

  return (
    tasks.find(
      (task) =>
        task.category === 'breakthrough_major' &&
        task.metadata.fromRealm === cultivator.realm &&
        task.metadata.toRealm === toRealm,
    ) ?? null
  );
}

export function findNextTutorialTask(tasks: TaskInstance[]): TaskInstance | null {
  const tutorialByDefinition = new Map(
    tasks
      .filter((task) => task.category === 'tutorial')
      .map((task) => [task.definitionId, task]),
  );

  for (const definitionId of TUTORIAL_TASK_ORDER) {
    const task = tutorialByDefinition.get(definitionId);
    if (!task) {
      return null;
    }

    if (!task.snapshot.isCompleted || !hasClaimedTutorialReward(task)) {
      return task;
    }
  }

  return null;
}
