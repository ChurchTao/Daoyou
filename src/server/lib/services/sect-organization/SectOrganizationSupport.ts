import type { DbExecutor, DbTransaction } from '@server/lib/drizzle/db';
import type { SectOrganizationRepositoryPort } from '@server/lib/repositories/SectOrganizationRepositoryPort';
import type * as sectRepository from '@server/lib/repositories/sectRepository';
import type { SectTaskId, SectTaskRecordData } from '@shared/contracts/sect';
import {
  SECT_FACILITY_KEYS,
  type SectConstructionProjectState,
  type SectFacilityState,
  type SectOrganizationModule,
  type SectRuntime,
  type UpgradeableSectFacilityKey,
} from '@shared/engine/sect';
import { SectError } from '../SectError';

export type SectMembershipRepositoryPort = typeof sectRepository;

export interface SectOrganizationContext {
  runtime: SectRuntime;
  organizationRepository: SectOrganizationRepositoryPort;
  membershipRepository: SectMembershipRepositoryPort;
}

export type SectMembership = NonNullable<
  Awaited<ReturnType<SectMembershipRepositoryPort['findMembership']>>
>;

export function organizationFor(
  context: SectOrganizationContext,
  sectId: string,
): SectOrganizationModule {
  return context.runtime.registry.require(sectId).organization;
}

export function organizationError(message: string, status = 409): never {
  throw new SectError('SECT_ORGANIZATION_INVALID', message, status);
}

export async function requireMembership(
  context: SectOrganizationContext,
  cultivatorId: string,
  q: DbExecutor | DbTransaction,
): Promise<SectMembership> {
  const membership = await context.membershipRepository.findMembership(
    cultivatorId,
    q,
  );
  if (!membership) organizationError('尚未拜入宗门');
  return membership;
}

export function mapFacilities(
  rows: Awaited<
    ReturnType<SectOrganizationRepositoryPort['listSectFacilities']>
  >,
): SectFacilityState[] {
  const byKey = new Map(rows.map((row) => [row.facilityKey, row]));
  return SECT_FACILITY_KEYS.map((key) => {
    const row = byKey.get(key);
    return {
      key,
      level: key === 'formation' ? 0 : (row?.level ?? 1),
      updatedAt: row?.updatedAt?.toISOString(),
    };
  });
}

export function mapProject(
  row: Awaited<
    ReturnType<SectOrganizationRepositoryPort['findActiveSectProject']>
  >,
): SectConstructionProjectState | null {
  if (!row) return null;
  return {
    id: row.id,
    sectId: row.sectId,
    facilityKey: row.facilityKey as UpgradeableSectFacilityKey,
    targetLevel: row.targetLevel,
    progress: row.progress,
    target: row.target,
    status: row.status as 'active' | 'completed',
    startedWeekKey: row.startedWeekKey,
    completedAt: row.completedAt?.toISOString(),
  };
}

export function mapTaskRecord(
  row: Awaited<
    ReturnType<SectOrganizationRepositoryPort['listSectTaskRecords']>
  >[number],
): SectTaskRecordData {
  const payload = (row.payload ?? {}) as Record<string, unknown>;
  return {
    id: row.id,
    taskId: row.taskId as SectTaskId,
    kind: row.kind as SectTaskRecordData['kind'],
    periodKey: row.periodKey,
    status: row.status as SectTaskRecordData['status'],
    progress: row.progress,
    target: Number(payload.target ?? 1),
    completedAt: row.completedAt?.toISOString(),
    payload,
  };
}

export function nextRank(rank: import('@shared/engine/sect').SectDiscipleRank) {
  return ({ registered: 'outer', outer: 'inner', inner: 'true', true: null } as const)[
    rank
  ];
}
