import { consumePlayerStateMutation } from '@app/lib/player-state/store';
import { fetchJsonCached } from '@app/lib/client/requestCache';
import type {
  SectCatalogData,
  SectCurrentData,
  SectDetailData,
  SectConstructionData,
  SectMembersData,
  SectOverviewData,
  SectShopData,
  SectTasksData,
  SectTaskActionData,
} from '@shared/contracts/sect';

const taskBattleRequests = new Map<string, Promise<SectTaskActionData>>();

async function fetchData<T>(url: string, signal?: AbortSignal): Promise<T> {
  const payload = await fetchJsonCached<{
    success: boolean;
    data?: T;
    error?: string;
  }>(url, { key: `sect:${url}`, signal });
  if (!payload?.success)
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
  ).then((response) => consumePlayerStateMutation<SectTaskActionData>(response))
    .finally(() => taskBattleRequests.delete(key));
  taskBattleRequests.set(key, request);
  return request;
}
