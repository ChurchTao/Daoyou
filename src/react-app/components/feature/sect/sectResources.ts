import {
  sectConstructionMemberResource,
  sectContributionRankingResource,
  sectContextResource,
  sectInfrastructureResource,
  sectMembersResource,
  sectProgressionResource,
  sectShopResource,
  sectTasksResource,
  type SectMembersParams,
} from '@app/lib/resources/definitions';
import {
  useResource,
  useSingletonResource,
  type ResourceQuery,
} from '@app/lib/resources/hooks';
import { usePlayerSession } from '@app/lib/resources/player';
import { getSectPresentation } from '@app/lib/sect/sectPresentation';
import {
  SectPromotionEvaluationDataSchema,
  SectStipendDataSchema,
} from '@shared/contracts/sect';
import {
  createAbilitySlots,
  resolveSectBenefitSnapshot,
  resolveSectPresentation,
  type CultivatorSectState,
  type ResolvedSectPresentation,
} from '@shared/engine/sect';
import { productionSectRuntime } from '@shared/engine/sect/content';
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import type { z } from 'zod';

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
  const hasSect =
    enabled && Boolean(session.data?.activeCultivator?.sectId);
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

export function useSectInfrastructureQuery() {
  return useSingletonResource(sectInfrastructureResource);
}

export function useSectProgressionQuery(enabled = true) {
  return useSingletonResource(sectProgressionResource, enabled);
}

export function useSectTasksQuery() {
  return useSingletonResource(sectTasksResource);
}

export function useSectStipendQuery(enabled = true) {
  return useSectInteractionQuery(
    '/api/sects/current/stipend',
    SectStipendDataSchema,
    enabled,
  );
}

export function useSectPromotionEvaluationQuery(enabled = true) {
  return useSectInteractionQuery(
    '/api/sects/current/promotion-evaluation',
    SectPromotionEvaluationDataSchema,
    enabled,
  );
}

export function useSectShopQuery() {
  return useSingletonResource(sectShopResource);
}

export function useSectConstructionMemberQuery() {
  const query = useSingletonResource(sectConstructionMemberResource);
  const { data, invalidate, reload } = query;
  const dateKey = getShanghaiDateKey();
  useEffect(() => {
    if (data && data.dateKey !== dateKey) void reload();
    const timer = window.setTimeout(() => {
      invalidate();
      void reload();
    }, millisecondsUntilShanghaiMidnight());
    return () => window.clearTimeout(timer);
  }, [data, dateKey, invalidate, reload]);
  return query;
}

export function useSectContributionRankingQuery(enabled = true) {
  return useSingletonResource(sectContributionRankingResource, enabled);
}

export function useSectMembersQuery(params: SectMembersParams, enabled = true) {
  return useResource(sectMembersResource, params, enabled);
}

export function getSectDefinition(
  context: NonNullable<ReturnType<typeof useSectContextQuery>['data']>,
) {
  return productionSectRuntime.registry.require(context.sectId).definition;
}

function getShanghaiDateKey(now = new Date()): string {
  return new Intl.DateTimeFormat('en-CA', {
    timeZone: 'Asia/Shanghai',
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  }).format(now);
}

function millisecondsUntilShanghaiMidnight(now = new Date()): number {
  const shifted = new Date(now.getTime() + 8 * 60 * 60 * 1_000);
  const nextMidnight =
    Date.UTC(
      shifted.getUTCFullYear(),
      shifted.getUTCMonth(),
      shifted.getUTCDate() + 1,
    ) -
    8 * 60 * 60 * 1_000;
  return Math.max(1_000, nextMidnight - now.getTime());
}

export function resolveSectBenefits(
  context: NonNullable<ReturnType<typeof useSectContextQuery>['data']>,
  infrastructure: NonNullable<
    ReturnType<typeof useSectInfrastructureQuery>['data']
  >,
) {
  const module = productionSectRuntime.registry.require(context.sectId);
  const levels = new Map(
    infrastructure.facilities.map((facility) => [facility.key, facility.level]),
  );
  return resolveSectBenefitSnapshot(
    module.organization,
    context.discipleRank,
    levels,
  );
}

export function buildSectProgressionState(
  context: NonNullable<ReturnType<typeof useSectContextQuery>['data']>,
  progression: NonNullable<ReturnType<typeof useSectProgressionQuery>['data']>,
): CultivatorSectState {
  return {
    ...membershipState(context),
    activePathId: progression.activePathId,
    methods: progression.methods,
    paths: progression.paths,
    abilityLoadout: progression.abilityLoadout,
  };
}

export function getSectPresentationForContext(
  context: { sectId: string } | undefined,
): ResolvedSectPresentation {
  return context?.sectId
    ? getSectPresentation(context.sectId)
    : resolveSectPresentation('standard');
}

function membershipState(
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
    methods: {},
    paths: [],
    abilityLoadout: createAbilitySlots([]),
  };
}

function useSectInteractionQuery<T>(
  endpoint: string,
  schema: z.ZodType<T>,
  enabled: boolean,
): ResourceQuery<T> {
  const [snapshot, setSnapshot] = useState<{
    status: ResourceQuery<T>['status'];
    data?: T;
    error?: string;
  }>({ status: 'idle' });
  const controllerRef = useRef<AbortController | undefined>(undefined);
  const requestSequenceRef = useRef(0);
  const load = useCallback(async () => {
    if (!enabled) return;
    controllerRef.current?.abort();
    const controller = new AbortController();
    const sequence = requestSequenceRef.current + 1;
    requestSequenceRef.current = sequence;
    controllerRef.current = controller;
    setSnapshot((current) => ({
      ...current,
      status: current.data === undefined ? 'loading' : 'stale',
      error: undefined,
    }));
    try {
      const response = await fetch(endpoint, { signal: controller.signal });
      const json = (await response.json()) as
        { success: true; data: unknown } | { success: false; error: string };
      if (!response.ok || !json.success) {
        throw new Error(
          'error' in json ? json.error : `HTTP ${response.status}`,
        );
      }
      if (
        controller.signal.aborted ||
        sequence !== requestSequenceRef.current
      ) {
        return;
      }
      setSnapshot({ status: 'ready', data: schema.parse(json.data) });
    } catch (error) {
      if (
        controller.signal.aborted ||
        sequence !== requestSequenceRef.current
      ) {
        return;
      }
      setSnapshot((current) => ({
        ...current,
        status: current.data === undefined ? 'error' : 'stale',
        error: error instanceof Error ? error.message : '宗门信息读取失败',
      }));
    }
  }, [enabled, endpoint, schema]);

  useEffect(() => {
    if (!enabled) {
      controllerRef.current?.abort();
      setSnapshot({ status: 'idle' });
      return;
    }
    void load();
    return () => controllerRef.current?.abort();
  }, [enabled, load]);

  return useMemo(
    () => ({
      ...snapshot,
      version: 0,
      isRefreshing: snapshot.status === 'stale',
      loading: snapshot.status === 'idle' || snapshot.status === 'loading',
      reload: load,
      retry: load,
      invalidate: () =>
        setSnapshot((current) => ({ ...current, status: 'stale' })),
      setData: (data: T) => setSnapshot({ status: 'ready', data }),
    }),
    [load, snapshot],
  );
}

function getSectConfigVersionError(
  context:
    NonNullable<ReturnType<typeof useSectContextQuery>['data']> | undefined,
): string | undefined {
  if (!context) return undefined;
  const definition = productionSectRuntime.registry.require(
    context.sectId,
  ).definition;
  return definition.configVersion === context.configVersion
    ? undefined
    : '客户端宗门配置已更新，请刷新页面';
}
