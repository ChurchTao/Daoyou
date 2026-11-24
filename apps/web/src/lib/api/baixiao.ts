import { apiFetch } from '@app/lib/api/fetch';

export async function requestBaixiao<T>(
  path: string,
  init?: RequestInit,
): Promise<T> {
  const response = await apiFetch(path, init);
  const data = await response.json().catch(() => null);
  if (!response.ok) {
    const message =
      typeof data?.message === 'string' ? data.message : data?.error;
    throw new Error(
      typeof message === 'string' ? message : '暂时无法连接百晓盛会。',
    );
  }
  return data as T;
}

export function baixiaoPost(body: object, keepalive = false): RequestInit {
  return {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
    keepalive,
  };
}
