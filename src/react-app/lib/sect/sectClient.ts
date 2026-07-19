import { consumePlayerStateMutation } from '@app/lib/player-state/store';
import type {
  SectCatalogData,
  SectCurrentData,
  SectDetailData,
  SectExperienceResponse,
  SectConstructionData,
  SectMembersData,
  SectOverviewData,
  SectShopData,
  SectTasksData,
  SectTaskChallengeData,
} from '@shared/contracts/sect';

type SectExperienceData = SectExperienceResponse['data'];
const experienceRequests = new Map<string, Promise<SectExperienceData>>();
const taskBattleRequests = new Map<string, Promise<SectTaskChallengeData>>();

async function fetchData<T>(url: string, signal?: AbortSignal): Promise<T> {
  const response = await fetch(url, { signal });
  const payload = await response.json();
  if (!response.ok || !payload?.success)
    throw new Error(payload?.error ?? '宗门卷宗读取失败');
  return payload.data as T;
}

export function fetchSectCatalog(signal?: AbortSignal): Promise<SectCatalogData> {
  return fetchData('/api/sects/catalog', signal);
}

export function fetchSectCurrent(signal?: AbortSignal): Promise<SectCurrentData> {
  return fetchData('/api/sects/current', signal);
}

export function fetchSectOverview(signal?: AbortSignal): Promise<SectOverviewData> {
  return fetchData('/api/sects/current/overview', signal);
}

export function fetchSectTasks(signal?: AbortSignal): Promise<SectTasksData> {
  return fetchData('/api/sects/current/tasks', signal);
}

export function fetchSectShop(signal?: AbortSignal): Promise<SectShopData> {
  return fetchData('/api/sects/current/shop', signal);
}

export function fetchSectConstruction(signal?: AbortSignal): Promise<SectConstructionData> {
  return fetchData('/api/sects/current/construction', signal);
}

export function fetchSectMembers(page = 1, pageSize = 20, signal?: AbortSignal): Promise<SectMembersData> {
  const query = new URLSearchParams({ page: String(page), pageSize: String(pageSize) });
  return fetchData(`/api/sects/current/members?${query.toString()}`, signal);
}

export function fetchSectDetail(sectId: string): Promise<SectDetailData> {
  return fetchData(`/api/sects/${encodeURIComponent(sectId)}`);
}

async function startSectTrial(sectId: string): Promise<SectExperienceData> {
  const response = await fetch(
    `/api/sects/${encodeURIComponent(sectId)}/trial`,
    { method: 'POST', headers: { 'Idempotency-Key': crypto.randomUUID() } },
  );
  return consumePlayerStateMutation<SectExperienceData>(response);
}

export function startSectTrialOnce(
  sectId: string,
): Promise<SectExperienceData> {
  const current = experienceRequests.get(sectId);
  if (current) return current;
  const request = startSectTrial(sectId).finally(() =>
    experienceRequests.delete(sectId),
  );
  experienceRequests.set(sectId, request);
  return request;
}

export function startSectTaskBattleOnce(
  taskId: string,
  attemptId: string,
): Promise<SectTaskChallengeData> {
  const key = `${taskId}:${attemptId}`;
  const current = taskBattleRequests.get(key);
  if (current) return current;
  const request = fetch(
    `/api/sects/current/tasks/${encodeURIComponent(taskId)}/challenge`,
    {
      method: 'POST',
      headers: { 'Idempotency-Key': attemptId },
    },
  )
    .then((response) => consumePlayerStateMutation<SectTaskChallengeData>(response))
    .finally(() => taskBattleRequests.delete(key));
  taskBattleRequests.set(key, request);
  return request;
}
