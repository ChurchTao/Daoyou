import { sectContextResource } from '@app/lib/resources/definitions';
import { useSingletonResource } from '@app/lib/resources/hooks';
import { usePlayerSession } from '@app/lib/resources/player';
import { getSectOrganizationDefinition } from '@daoyou/game-content/sect-organization/definitions';
import type { CultivatorSectState } from '@daoyou/game-domain/sects';
import { useMemo } from 'react';

export function useSectContextQuery(enabled = true) {
  const context = useSingletonResource(sectContextResource, enabled);
  const versionError = getSectConfigVersionError(context.data);
  return useMemo(
    () => ({
      ...context,
      error: versionError ?? context.error,
      status: versionError ? ('error' as const) : context.status,
    }),
    [context, versionError],
  );
}

export function useActiveSectContextQuery(enabled = true) {
  const session = usePlayerSession(enabled);
  const hasSect = enabled && Boolean(session.data?.activeCultivator?.sectId);
  const context = useSectContextQuery(hasSect);
  return useMemo(
    () => ({
      ...context,
      hasSect,
      sessionLoading: session.loading,
      sessionError: session.error,
    }),
    [context, hasSect, session.error, session.loading],
  );
}

export function getSectDefinition(
  context: NonNullable<ReturnType<typeof useSectContextQuery>['data']>,
) {
  return getSectOrganizationDefinition(context.sectId);
}

export function membershipState(
  context: NonNullable<ReturnType<typeof useSectContextQuery>['data']>,
): CultivatorSectState {
  return {
    membershipId: context.membershipId,
    sectId: context.sectId,
    status: context.status,
    joinedAt: context.joinedAt,
    discipleRank: context.discipleRank,
    contribution: context.contribution,
    lifetimeContribution: context.lifetimeContribution,
    office: context.office,
    promotedAt: context.promotedAt,
    configVersion: context.configVersion,
  };
}

function getSectConfigVersionError(
  context:
    NonNullable<ReturnType<typeof useSectContextQuery>['data']> | undefined,
): string | undefined {
  if (!context) return undefined;
  const definition = getSectOrganizationDefinition(context.sectId);
  return definition.configVersion === context.configVersion
    ? undefined
    : '客户端宗门配置已更新，请刷新页面';
}
