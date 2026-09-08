import { consumeResourceMutation } from '@app/lib/resources/mutations';
import type {
  TaskChallengeResponse,
  TaskRewardClaimResponse,
} from '@shared/contracts/task';
import { getNextMajorRealm } from '@shared/lib/breakthroughPill';
import {
  TUTORIAL_TASK_ORDER,
  hasClaimedTutorialReward,
} from '@shared/lib/noviceGuidance';
import type { Cultivator } from '@shared/types/cultivator';
import type { TaskInstance } from '@shared/types/task';

async function readJsonOrThrow<T>(response: Response): Promise<T> {
  const payload = await response.json();
  if (!response.ok || !payload?.success) {
    throw new Error(
      typeof payload?.error === 'string'
        ? payload.error
        : `HTTP ${response.status}`,
    );
  }
  return payload as T;
}

export async function startTaskChallenge(taskId: string) {
  const response = await fetch(`/api/tasks/${taskId}/challenge`, {
    method: 'POST',
  });
  const payload = await readJsonOrThrow<TaskChallengeResponse>(response);
  return payload;
}

const taskChallengeRequests = new Map<string, Promise<TaskChallengeResponse>>();

export async function startTaskChallengeOnce(taskId: string) {
  const key = taskId.trim();
  const inFlight = taskChallengeRequests.get(key);
  if (inFlight) {
    return inFlight;
  }

  const request = startTaskChallenge(taskId).finally(() => {
    taskChallengeRequests.delete(key);
  });

  taskChallengeRequests.set(key, request);
  return request;
}

export async function claimTaskReward(taskId: string) {
  const response = await fetch(`/api/tasks/${taskId}/claim-reward`, {
    method: 'POST',
  });
  const payload = await readJsonOrThrow<TaskRewardClaimResponse>(response);
  await consumeResourceMutation(payload);
  return payload;
}

export function findCurrentMajorBreakthroughTask(
  cultivator:
    | Pick<Cultivator, 'realm' | 'realm_stage'>
    | null
    | undefined,
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

export function findNextTutorialTask(
  tasks: TaskInstance[],
): TaskInstance | null {
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
