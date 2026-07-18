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
} from '@shared/contracts/sect';

type SectExperienceData = SectExperienceResponse['data'];
const experienceRequests = new Map<string, Promise<SectExperienceData>>();

async function fetchData<T>(url: string): Promise<T> {
  const response = await fetch(url);
  const payload = await response.json();
  if (!response.ok || !payload?.success)
    throw new Error(payload?.error ?? '宗门卷宗读取失败');
  return payload.data as T;
}

export function fetchSectCatalog(): Promise<SectCatalogData> {
  return fetchData('/api/sects/catalog');
}

export function fetchSectCurrent(): Promise<SectCurrentData> {
  return fetchData('/api/sects/current');
}

export function fetchSectOverview(): Promise<SectOverviewData> {
  return fetchData('/api/sects/current/overview');
}

export function fetchSectTasks(): Promise<SectTasksData> {
  return fetchData('/api/sects/current/tasks');
}

export function fetchSectShop(): Promise<SectShopData> {
  return fetchData('/api/sects/current/shop');
}

export function fetchSectConstruction(): Promise<SectConstructionData> {
  return fetchData('/api/sects/current/construction');
}

export function fetchSectMembers(page = 1, pageSize = 20): Promise<SectMembersData> {
  const query = new URLSearchParams({ page: String(page), pageSize: String(pageSize) });
  return fetchData(`/api/sects/current/members?${query.toString()}`);
}

export function fetchSectDetail(sectId: string): Promise<SectDetailData> {
  return fetchData(`/api/sects/${encodeURIComponent(sectId)}`);
}

async function startSectTrial(sectId: string): Promise<SectExperienceData> {
  const response = await fetch(
    `/api/sects/${encodeURIComponent(sectId)}/trial`,
    { method: 'POST' },
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
