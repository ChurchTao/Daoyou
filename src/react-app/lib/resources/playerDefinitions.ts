import type {
  PlayerResourceKey,
  PlayerResourceMap,
  PlayerResourcesResponse,
} from '@shared/contracts/player';
import {
  reduceTaskResourceList,
  RESOURCE_DATA_SCHEMAS,
  type ResourceDataMap,
  type ResourceScope,
} from '@shared/contracts/resources';
import type { TaskStatus } from '@shared/types/task';
import {
  defaultResourceReducer,
  loadResourceEndpoint,
  resolveTopicScope,
} from './definitionCore';
import { observePlayerResourceServerTime } from './recoveryClock';
import type { ResourceDefinition } from './store';

type PlayerTopic<K extends PlayerResourceKey> = `player.${K}`;
type PlayerBatchResult<K extends PlayerResourceKey> = {
  data: PlayerResourceMap[K];
  resourceVersion: number;
  scopeVersion: number;
};
type PendingPlayerResource = {
  key: PlayerResourceKey;
  scope: ResourceScope;
  signal: AbortSignal;
  resolve(value: PlayerBatchResult<PlayerResourceKey>): void;
  reject(reason: unknown): void;
};

let pendingPlayerResources: PendingPlayerResource[] = [];
let playerBatchScheduled = false;

function loadPlayerResource<K extends PlayerResourceKey>(
  key: K,
  scope: ResourceScope,
  signal: AbortSignal,
): Promise<PlayerBatchResult<K>> {
  return new Promise((resolve, reject) => {
    pendingPlayerResources.push({
      key,
      scope,
      signal,
      resolve: resolve as PendingPlayerResource['resolve'],
      reject,
    });
    if (!playerBatchScheduled) {
      playerBatchScheduled = true;
      queueMicrotask(flushPlayerResourceBatch);
    }
  });
}

async function flushPlayerResourceBatch(): Promise<void> {
  playerBatchScheduled = false;
  const batch = pendingPlayerResources;
  pendingPlayerResources = [];
  for (const item of batch) {
    if (item.signal.aborted) {
      item.reject(new DOMException('玩家资源请求已取消', 'AbortError'));
    }
  }
  const active = batch.filter((item) => !item.signal.aborted);
  if (active.length === 0) return;
  const controller = new AbortController();
  const abortBatchWhenUnused = () => {
    if (active.every((item) => item.signal.aborted)) controller.abort();
  };
  const abortHandlers = new Map<PendingPlayerResource, () => void>();
  for (const item of active) {
    const abortItem = () => {
      item.reject(new DOMException('玩家资源请求已取消', 'AbortError'));
      abortBatchWhenUnused();
    };
    abortHandlers.set(item, abortItem);
    item.signal.addEventListener('abort', abortItem, { once: true });
  }
  const keys = Array.from(new Set(active.map((item) => item.key)));
  try {
    const response = await fetch(
      `/api/player/resources?keys=${encodeURIComponent(keys.join(','))}`,
      { signal: controller.signal },
    );
    const json = (await response.json()) as
      PlayerResourcesResponse | { success: false; error: string };
    if (!response.ok || !json.success) {
      throw new Error('error' in json ? json.error : `HTTP ${response.status}`);
    }
    observePlayerResourceServerTime(json.data.serverTime);
    for (const item of active) {
      if (item.signal.aborted) continue;
      const resource = json.data.resources[item.key];
      if (!resource) {
        item.reject(new Error(`玩家资源响应缺失: ${item.key}`));
        continue;
      }
      const topic = `player.${item.key}` as PlayerTopic<typeof item.key>;
      if (
        resource.resource.topic !== topic ||
        resource.resource.scope.kind !== item.scope.kind ||
        resource.resource.scope.id !== item.scope.id
      ) {
        item.reject(new Error(`玩家资源地址不匹配: ${topic}`));
        continue;
      }
      item.resolve({
        data: RESOURCE_DATA_SCHEMAS[topic].parse(
          resource.data,
        ) as PlayerResourceMap[typeof item.key],
        resourceVersion: resource.resource.resourceVersion,
        scopeVersion: resource.resource.scopeVersion,
      });
    }
  } catch (error) {
    for (const item of active) {
      if (!item.signal.aborted) item.reject(error);
    }
  } finally {
    for (const item of active) {
      const abortItem = abortHandlers.get(item);
      if (abortItem) item.signal.removeEventListener('abort', abortItem);
    }
  }
}

function playerDefinition<K extends PlayerResourceKey>(
  key: K,
): ResourceDefinition<PlayerTopic<K>, void> {
  const topic = `player.${key}` as PlayerTopic<K>;
  return {
    topic,
    resolveScope: (scopes) => resolveTopicScope(topic, scopes),
    normalizeParams: () => undefined,
    load: (scope, _params, signal) =>
      loadPlayerResource(key, scope, signal) as Promise<{
        data: ResourceDataMap[PlayerTopic<K>];
        resourceVersion: number;
        scopeVersion: number;
      }>,
    reduce: defaultResourceReducer,
  };
}

export const playerSessionResource = playerDefinition('session');
export const playerProfileResource: ResourceDefinition<'player.profile', void> =
  {
    ...playerDefinition('profile'),
    reduce(current, change) {
      if (change.operation !== 'merge') {
        return defaultResourceReducer(current, change);
      }
      if (!current) return { status: 'stale' };
      return {
        status: 'applied',
        data: {
          ...current,
          cultivator: change.payload.cultivator
            ? { ...current.cultivator, ...change.payload.cultivator }
            : current.cultivator,
        },
      };
    },
  };
export const playerConditionResource = playerDefinition('condition');
export const playerProgressResource = playerDefinition('progress');
export const playerCurrencyResource: ResourceDefinition<
  'player.currency',
  void
> = {
  ...playerDefinition('currency'),
  reduce(current, change) {
    if (change.operation === 'merge') {
      const hasQi = Object.prototype.hasOwnProperty.call(change.payload, 'qi');
      const hasQiBaseline = Object.prototype.hasOwnProperty.call(
        change.payload,
        'qiLastRefreshedAt',
      );
      if (hasQi !== hasQiBaseline) {
        return { status: 'stale' };
      }
    }
    return defaultResourceReducer(current, change);
  },
};
export const playerLoadoutResource = playerDefinition('loadout');
export const playerCombatV6BuildResource = playerDefinition('combat-v6-build');
export const playerMailSummaryResource = playerDefinition('mail-summary');
export const playerTaskSummaryResource = playerDefinition('task-summary');

export interface PlayerTasksParams {
  status?: TaskStatus;
}

export const playerTasksResource: ResourceDefinition<
  'player.tasks',
  PlayerTasksParams
> = {
  topic: 'player.tasks',
  resolveScope: (scopes) => resolveTopicScope('player.tasks', scopes),
  normalizeParams: (params) => ({
    ...(params.status ? { status: params.status } : {}),
  }),
  load: (scope, params, signal) => {
    const query = new URLSearchParams();
    if (params.status) query.set('status', params.status);
    const suffix = query.size > 0 ? `?${query.toString()}` : '';
    return loadResourceEndpoint(
      'player.tasks',
      `/api/tasks${suffix}`,
      scope,
      signal,
    );
  },
  reduce: (current, change, params) =>
    reduceTaskResourceList(current, change, params),
};
