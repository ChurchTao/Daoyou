import type { ResourceTopic } from '@shared/contracts/resources';
import {
  defaultResourceReducer,
  loadResourceEndpoint,
  resolveTopicScope,
} from './definitionCore';
import type { ResourceDefinition } from './store';

function endpointResource<TTopic extends ResourceTopic>(
  topic: TTopic,
  endpoint: string,
): ResourceDefinition<TTopic, void> {
  return {
    topic,
    resolveScope: (scopes) => resolveTopicScope(topic, scopes),
    normalizeParams: () => undefined,
    load: (scope, _params, signal) =>
      loadResourceEndpoint(topic, endpoint, scope, signal),
    reduce: defaultResourceReducer,
  };
}

export const sectContextResource = endpointResource(
  'sect.membership',
  '/api/sects/current/context',
);
export const sectInfrastructureResource = endpointResource(
  'sect.infrastructure',
  '/api/sects/current/infrastructure',
);
export const sectTasksResource = endpointResource(
  'sect.tasks',
  '/api/sects/current/tasks',
);
export const sectShopResource = endpointResource(
  'sect.shop',
  '/api/sects/current/shop',
);
export const sectConstructionMemberResource = endpointResource(
  'sect.construction-member',
  '/api/sects/current/construction-member',
);
export const sectContributionRankingResource = endpointResource(
  'sect.contribution-ranking',
  '/api/sects/current/contribution-ranking',
);

export interface SectMembersParams {
  page: number;
  pageSize: number;
}

export const sectMembersResource: ResourceDefinition<
  'sect.members',
  SectMembersParams
> = {
  topic: 'sect.members',
  resolveScope: (scopes) => resolveTopicScope('sect.members', scopes),
  normalizeParams: (params) => ({
    page: Math.max(1, Math.trunc(params.page)),
    pageSize: Math.min(50, Math.max(1, Math.trunc(params.pageSize))),
  }),
  load: (scope, params, signal) =>
    loadResourceEndpoint(
      'sect.members',
      `/api/sects/current/members?page=${params.page}&pageSize=${params.pageSize}`,
      scope,
      signal,
    ),
  reduce(current, change) {
    if (change.operation === 'invalidate') return { status: 'stale' };
    return defaultResourceReducer(current, change);
  },
};
