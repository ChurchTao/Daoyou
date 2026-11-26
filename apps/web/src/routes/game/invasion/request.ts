import { apiFetch } from '@app/lib/api/fetch';
import type { InvasionCommand } from '@daoyou/contracts/invasion';

export async function requestInvasion<T>(
  path = '',
  command?: InvasionCommand,
  signal?: AbortSignal,
): Promise<T> {
  const response = await apiFetch(`/api/ancient-demon-invasion${path}`, {
    signal,
    ...(command
      ? {
          method: 'POST',
          headers: { 'content-type': 'application/json' },
          body: JSON.stringify(command),
        }
      : {}),
  });
  const data = await response.json();
  if (!response.ok)
    throw new Error(data.message ?? data.error ?? '暂时未能联系镇魔营地');
  return data as T;
}

export function invasionClock(ms: number, roundUp = false) {
  const seconds = Math.max(0, (roundUp ? Math.ceil : Math.floor)(ms / 1000));
  return `${Math.floor(seconds / 60)}:${String(seconds % 60).padStart(2, '0')}`;
}
