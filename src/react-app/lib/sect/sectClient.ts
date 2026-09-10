import { consumeResourceMutation } from '@app/lib/resources/mutations';
import type {
  SectSubmissionCandidatesData,
  SectTaskActionData,
} from '@shared/contracts/sect';

const taskBattleRequests = new Map<string, Promise<SectTaskActionData>>();

export function fetchSectSubmissionCandidates(
  taskId: string,
  signal?: AbortSignal,
): Promise<SectSubmissionCandidatesData> {
  return fetch(
    `/api/sects/current/tasks/${encodeURIComponent(taskId)}/submission-candidates`,
    { signal },
  ).then(async (response) => {
    const payload = await response.json();
    if (!response.ok || !payload?.success)
      throw new Error(payload?.error ?? '宗门卷宗读取失败');
    return payload.data as SectSubmissionCandidatesData;
  });
}

export function startSectTaskBattleOnce(
  taskId: string,
  attemptId: string,
): Promise<SectTaskActionData> {
  const key = `${taskId}:${attemptId}`;
  const current = taskBattleRequests.get(key);
  if (current) return current;
  const request = fetch(
    `/api/sects/current/tasks/${encodeURIComponent(taskId)}/actions/execute`,
    {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Idempotency-Key': attemptId,
      },
      body: JSON.stringify({ input: {} }),
    },
  )
    .then((response) => consumeResourceMutation<SectTaskActionData>(response))
    .finally(() => taskBattleRequests.delete(key));
  taskBattleRequests.set(key, request);
  return request;
}
