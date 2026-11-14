import { apiFetch } from '@app/lib/api/fetch';
import { useAuth } from '@app/lib/auth/useAuth';
import { fetchJsonCached } from '@app/lib/client/requestCache';
import { realtimeClient } from '@app/lib/realtime/realtimeClient';
import { consumeResourceMutation } from '@app/lib/resources/mutations';
import { usePlayerSession } from '@app/lib/resources/player';
import { useCallback, useEffect, useRef, useState } from 'react';

const changeListeners = new Set<() => void>();

export function notifySocialChange() {
  for (const listener of changeListeners) listener();
}

export async function socialRequest<T>(
  path: string,
  body?: unknown,
  method = 'POST',
): Promise<T> {
  const response = await apiFetch(path, {
    method,
    ...(body === undefined
      ? {}
      : {
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(body),
        }),
  });
  const result = await response.json();
  if (!response.ok) {
    throw new Error(
      typeof result.error === 'string'
        ? result.error
        : typeof result.message === 'string'
          ? result.message
          : '操作未完成，请稍后重试',
    );
  }
  if (result.success === true && result.state)
    await consumeResourceMutation(result);
  notifySocialChange();
  return result as T;
}

/** Social histories have their own APIs; never put them in a TTL player cache. */
export function useSocialQuery<T>(path: string | null) {
  const { user } = useAuth();
  const actorId = usePlayerSession().data?.activeCultivator?.id ?? null;
  const identity = `${user?.id ?? ''}:${actorId ?? ''}`;
  const [snapshot, setSnapshot] = useState<{
    identity: string;
    path: string | null;
    data?: T;
    error?: string;
    loading: boolean;
  }>({ identity, path, loading: Boolean(path) });
  const controllerRef = useRef<AbortController | null>(null);
  const load = useCallback(async () => {
    if (!path || !user) return;
    controllerRef.current?.abort();
    const controller = new AbortController();
    controllerRef.current = controller;
    setSnapshot((current) => ({
      identity,
      path,
      ...(current.identity === identity && current.path === path
        ? { data: current.data }
        : {}),
      loading: true,
    }));
    try {
      const data = await fetchJsonCached<T>(path, {
        key: `social:${identity}:${path}`,
        signal: controller.signal,
      });
      if (!controller.signal.aborted)
        setSnapshot({ identity, path, data, loading: false });
    } catch (error) {
      if (!controller.signal.aborted)
        setSnapshot((current) => ({
          identity,
          path,
          data:
            current.identity === identity && current.path === path
              ? current.data
              : undefined,
          error: error instanceof Error ? error.message : '读取失败',
          loading: false,
        }));
    }
  }, [path, user, identity]);

  useEffect(() => {
    if (!path || !user) return;
    const refresh = () => {
      if (document.visibilityState === 'visible') void load();
    };
    void load();
    changeListeners.add(refresh);
    const offChange = realtimeClient.subscribe('social.changed', refresh);
    const offReady = realtimeClient.subscribe('ready', refresh);
    document.addEventListener('visibilitychange', refresh);
    const timer = window.setInterval(refresh, 30_000);
    return () => {
      controllerRef.current?.abort();
      changeListeners.delete(refresh);
      offChange();
      offReady();
      document.removeEventListener('visibilitychange', refresh);
      window.clearInterval(timer);
    };
  }, [path, user, load]);

  const current = snapshot.identity === identity && snapshot.path === path;
  return {
    data: current ? snapshot.data : undefined,
    error: current ? snapshot.error : undefined,
    loading: current ? snapshot.loading : Boolean(path),
    reload: load,
  };
}
