import type { DbTransaction } from '@server/lib/drizzle/db';
import {
  bumpResourceVersions,
  insertResourceChanges,
  type ScopedResourceChangeDescriptor,
  type ScopeVersionCommit,
} from '@server/lib/repositories/playerStateRepository';
import type { PlayerResourceMutationMeta } from '@shared/contracts/player';
import { refreshCombatV6CharacterResources } from './combat-v6/CombatV6CharacterResourceRefresh';
import { withCharacterPanelInvalidations } from '@shared/lib/characterResourceChanges';
import { withBagInvalidations } from '@shared/lib/bagResourceChanges';
import {
  RESOURCE_TOPIC_SCOPE_KIND,
  type ResourceChange,
  type ResourceChangeDescriptor,
  type ResourceScope,
} from '@shared/contracts/resources';

export type ResourceEventActor = {
  userId?: string | null;
  cultivatorId?: string | null;
};

export type ResourceScopeDefaults = {
  accountId?: string | null;
  cultivatorId?: string | null;
};

export type ResourceCommitResult = {
  changes: ResourceChange[];
  baselines: PlayerResourceMutationMeta['baselines'];
};

export class ResourceEventCommitter {
  async commit(
    tx: DbTransaction,
    input: {
      actor?: ResourceEventActor;
      source: string;
      requestId?: string | null;
      changes: readonly ResourceChangeDescriptor[];
      scopeDefaults?: ResourceScopeDefaults;
    },
  ): Promise<ResourceCommitResult> {
    if (input.changes.length === 0) {
      return { changes: [], baselines: [] };
    }
    assertCompleteQiBaselines(input.changes);
    const originalChanges = resolveResourceChangeScopes(
      input.changes,
      input.scopeDefaults,
    );
    const changedCharacters = new Set(originalChanges.filter(change =>
      change.scope.kind === 'cultivator' &&
      ['player.profile', 'player.sect-combat'].includes(change.resourceTopic),
    ).map(change => change.scope.id));
    for (const id of changedCharacters) await refreshCombatV6CharacterResources(id, tx);
    const scopedChanges = withBagInvalidations(withCharacterPanelInvalidations(originalChanges));
    const commits = await bumpResourceVersions(tx, scopedChanges);
    const changes = await insertResourceChanges(tx, {
      actorUserId: input.actor?.userId,
      actorCultivatorId: input.actor?.cultivatorId,
      commits,
      changes: scopedChanges.map((change) => ({
        ...change,
        source: input.source,
        requestId: input.requestId ?? null,
      })),
    });
    return {
      changes,
      baselines: baselinesFromCommits(commits),
    };
  }
}

function assertCompleteQiBaselines(
  changes: readonly ResourceChangeDescriptor[],
): void {
  for (const change of changes) {
    if (
      change.resourceTopic !== 'player.currency' ||
      change.operation !== 'merge'
    ) {
      continue;
    }
    const hasQi = Object.prototype.hasOwnProperty.call(change.payload, 'qi');
    const hasQiBaseline = Object.prototype.hasOwnProperty.call(
      change.payload,
      'qiLastRefreshedAt',
    );
    if (hasQi !== hasQiBaseline) {
      throw new Error(
        'player.currency 灵气事件必须同时提供 qi 与 qiLastRefreshedAt',
      );
    }
  }
}

export function resolveResourceChangeScopes(
  changes: readonly ResourceChangeDescriptor[],
  defaults: ResourceScopeDefaults = {},
): ScopedResourceChangeDescriptor[] {
  return changes.map((change) => {
    if (change.scope) return change as ScopedResourceChangeDescriptor;
    const kind = String(
      RESOURCE_TOPIC_SCOPE_KIND[change.resourceTopic],
    ) as ResourceScope['kind'];
    if (kind === 'global') {
      return {
        ...change,
        scope: { kind, id: 'global' },
      } as ScopedResourceChangeDescriptor;
    }
    if (kind === 'sect') {
      throw new Error(
        `宗门共享资源必须显式声明 scope: ${change.resourceTopic}`,
      );
    }
    const id = kind === 'account' ? defaults.accountId : defaults.cultivatorId;
    if (!id) {
      throw new Error(
        `${kind} 资源必须显式声明 scope 或提供默认作用域: ${change.resourceTopic}`,
      );
    }
    return {
      ...change,
      scope: { kind, id },
    } as ScopedResourceChangeDescriptor;
  });
}

function baselinesFromCommits(
  commits: Map<string, ScopeVersionCommit>,
): PlayerResourceMutationMeta['baselines'] {
  return [...commits.values()].map(({ scope, scopeVersion }) => ({
    scope,
    scopeVersion,
  }));
}

export function baselinesFromResourceChanges(
  changes: readonly ResourceChange[],
): PlayerResourceMutationMeta['baselines'] {
  const baselines = new Map<
    string,
    { scope: ResourceScope; scopeVersion: number }
  >();
  for (const change of changes) {
    const key = `${change.scope.kind}:${change.scope.id}`;
    const current = baselines.get(key);
    if (!current || current.scopeVersion < change.scopeVersion) {
      baselines.set(key, {
        scope: change.scope,
        scopeVersion: change.scopeVersion,
      });
    }
  }
  return [...baselines.values()];
}

export const resourceEventCommitter = new ResourceEventCommitter();
