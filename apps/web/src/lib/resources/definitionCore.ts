import { apiFetch } from '@app/lib/api/fetch';
import { RESOURCE_DATA_SCHEMAS } from '@app/lib/resources/schemas';
import { applyResourceChange, RESOURCE_TOPIC_SCOPE_KIND, type ResourceChange, type ResourceDataMap, type ResourceReadResponse, type ResourceScope, type ResourceScopeKind, type ResourceTopic } from '@daoyou/contracts/resources';
import type {
  ResourceReducerResult,
  ResourceRuntimeScopes,
} from './store';

const resolveScopeKind = (
  kind: ResourceScopeKind,
  scopes: Readonly<ResourceRuntimeScopes>,
): ResourceScope | null => {
  if (kind === 'global') return { kind, id: 'global' };
  const id =
    kind === 'account'
      ? scopes.accountId
      : kind === 'cultivator'
        ? scopes.cultivatorId
        : scopes.sectId;
  return id ? { kind, id } : null;
};

export const resolveTopicScope = (
  topic: ResourceTopic,
  scopes: Readonly<ResourceRuntimeScopes>,
): ResourceScope | null =>
  resolveScopeKind(RESOURCE_TOPIC_SCOPE_KIND[topic], scopes);

export const defaultResourceReducer = <TTopic extends ResourceTopic>(
  current: ResourceDataMap[TTopic] | undefined,
  change: ResourceChange<TTopic>,
): ResourceReducerResult<ResourceDataMap[TTopic]> => {
  if (change.operation === 'invalidate') return { status: 'stale' };
  const data = applyResourceChange(current, change);
  return data === undefined
    ? { status: 'stale' }
    : { status: 'applied', data };
};

export async function loadResourceEndpoint<TTopic extends ResourceTopic>(
  topic: TTopic,
  endpoint: string,
  scope: ResourceScope,
  signal: AbortSignal,
): Promise<{
  data: ResourceDataMap[TTopic];
  resourceVersion: number;
  scopeVersion: number;
}> {
  const response = await apiFetch(endpoint, { signal });
  const json = (await response.json()) as
    | ResourceReadResponse<TTopic>
    | { success: false; error: string };
  if (!response.ok || !json.success) {
    throw new Error('error' in json ? json.error : `HTTP ${response.status}`);
  }
  if (
    json.resource.topic !== topic ||
    json.resource.scope.kind !== scope.kind ||
    json.resource.scope.id !== scope.id
  ) {
    throw new Error(`资源地址不匹配: ${topic}`);
  }
  return {
    data: RESOURCE_DATA_SCHEMAS[topic].parse(
      json.data,
    ) as ResourceDataMap[TTopic],
    resourceVersion: json.resource.resourceVersion,
    scopeVersion: json.resource.scopeVersion,
  };
}
