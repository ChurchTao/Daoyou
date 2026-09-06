import {
  resourceStore,
  type ResourceDefinition,
  type ResourceSnapshot,
} from '@app/lib/resources/store';
import type {
  ResourceCacheKey,
  ResourceDataMap,
  ResourceTopic,
} from '@shared/contracts/resources';
import { useCallback, useMemo, useSyncExternalStore } from 'react';

const unavailableSnapshot: ResourceSnapshot<never> = {
  status: 'idle',
  version: 0,
  isRefreshing: false,
};

export type ResourceQuery<T> = ResourceSnapshot<T> & {
  loading: boolean;
  reload(): Promise<void>;
  retry(): Promise<void>;
  invalidate(): void;
  setData(data: T): void;
};

export function useResource<TTopic extends ResourceTopic, TParams>(
  definition: ResourceDefinition<TTopic, TParams>,
  params: TParams,
  enabled = true,
): ResourceQuery<ResourceDataMap[TTopic]> {
  useSyncExternalStore(
    resourceStore.subscribeScopes,
    resourceStore.getScopeRevision,
    resourceStore.getScopeRevision,
  );
  const key = enabled ? resourceStore.register(definition, params) : null;
  const subscribe = useCallback(
    (listener: () => void) =>
      enabled && key ? resourceStore.subscribe(key, listener) : () => undefined,
    [enabled, key],
  );
  const getSnapshot = useCallback(
    () =>
      key
        ? resourceStore.getSnapshot<ResourceDataMap[TTopic]>(key)
        : unavailableSnapshot,
    [key],
  );
  const snapshot = useSyncExternalStore(subscribe, getSnapshot, getSnapshot);
  // Resource notifications change snapshots, not the identity of resource actions.
  // Effects may depend on reload; recreating it on loading/ready updates causes loops.
  const actions = useMemo(() => {
    const reload = () => (key ? resourceStore.reload(key) : Promise.resolve());
    return {
      reload,
      retry: reload,
      invalidate: () => {
        if (key) resourceStore.invalidate(key);
      },
      setData: (data: ResourceDataMap[TTopic]) =>
        key ? resourceStore.setData(key, data) : undefined,
    };
  }, [key]);
  return useMemo(
    () => ({
      ...snapshot,
      loading: snapshot.status === 'idle' || snapshot.status === 'loading',
      ...actions,
    }),
    [snapshot, actions],
  );
}

export function useSingletonResource<TTopic extends ResourceTopic>(
  definition: ResourceDefinition<TTopic, void>,
  enabled = true,
): ResourceQuery<ResourceDataMap[TTopic]> {
  return useResource(definition, undefined, enabled);
}

export function readResourceSnapshot<T>(
  key: ResourceCacheKey,
): ResourceSnapshot<T> {
  return resourceStore.getSnapshot<T>(key);
}
