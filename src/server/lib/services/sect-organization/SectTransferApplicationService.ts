import type { DbExecutor, DbTransaction } from '@server/lib/drizzle/db';
import {
  sectMemberships,
  sectStipendClaims,
  sectTaskRecords,
} from '@server/lib/drizzle/schema';
import { ensureSectFacilities } from '@server/lib/repositories/sectOrganizationRepository';
import {
  findMembership,
  findMembershipForSect,
  loadSectCultivatorProgress,
} from '@server/lib/repositories/sectRepository';
import { consumeConsumableById } from '@server/lib/services/cultivator/CultivatorInventoryRepository';
import { SectError } from '@server/lib/services/SectError';
import {
  CHEAT_HEAVEN_TALISMAN_NAME,
  CHEAT_HEAVEN_TALISMAN_SCENARIO,
} from '@shared/config/sectTransferTalisman';
import type {
  SectContextData,
  SectTransferPreviewData,
} from '@shared/contracts/sect';
import {
  resolveSectTaskClaimReward,
  SectTaskRecordPayloadSchema,
  type SectDiscipleRank,
  type SectRuntime,
} from '@shared/engine/sect';
import type { Consumable } from '@shared/types/cultivator';
import { and, eq } from 'drizzle-orm';
import { findBagTalisman } from '../BagConsumables';
import {
  carryV6SectBuild,
  planV6SectTransfer,
} from '../combat-v6/CombatV6SectTransfer';
import { assertInventoryIdle } from '../InventoryService';
import { getSectDateKey, getSectWeekKey } from './SectOrganizationClock';

async function loadTransferTalisman(
  cultivatorId: string,
  q: DbExecutor | DbTransaction,
  consumableId?: string,
) {
  return (
    await findBagTalisman(
      cultivatorId,
      CHEAT_HEAVEN_TALISMAN_SCENARIO,
      q,
      consumableId,
    )
  ).find(
    (item) =>
      item.spec.kind === 'talisman' &&
      item.spec.sessionMode === 'consume_on_action',
  );
}

async function requireTransferPlan(args: {
  cultivatorId: string;
  targetSectId: string;
  reversePaths: boolean;
  runtime: SectRuntime;
  q: DbExecutor | DbTransaction;
}) {
  const row = await findMembership(args.cultivatorId, args.q);
  const source = row
    ? {
        ...row,
        membershipId: row.id,
        discipleRank: row.discipleRank as SectDiscipleRank,
      }
    : null;
  if (!source)
    throw new SectError('SECT_MEMBERSHIP_REQUIRED', '尚未拜入宗门', 400);
  const sourceModule = args.runtime.registry.require(source.sectId);
  const targetModule = args.runtime.registry.get(args.targetSectId);
  if (!targetModule) throw new SectError('SECT_UNKNOWN', '目标宗门不存在', 400);
  const cultivator = await loadSectCultivatorProgress(
    args.cultivatorId,
    args.q,
  );
  if (!cultivator)
    throw new SectError('SECT_MEMBERSHIP_REQUIRED', '角色不存在', 404);
  const admission = targetModule.checkAdmission({
    playerRace: cultivator.playerRace,
    realm: cultivator.realm,
    stage: cultivator.stage,
  });
  if (!admission.allowed)
    throw new SectError(
      'SECT_REALM_GATE',
      admission.reason ?? '不符合目标宗门准入条件',
      400,
    );
  if (source.sectId === args.targetSectId)
    throw new SectError(
      'SECT_ORGANIZATION_INVALID',
      '已在目标宗门，无需转宗',
      400,
    );
  return { source, sourceModule, targetModule };
}

async function inspectTasks(
  membershipId: string,
  q: DbExecutor | DbTransaction,
) {
  const rows = await q
    .select({
      kind: sectTaskRecords.kind,
      periodKey: sectTaskRecords.periodKey,
      status: sectTaskRecords.status,
      claimedAt: sectTaskRecords.claimedAt,
      payload: sectTaskRecords.payload,
    })
    .from(sectTaskRecords)
    .where(eq(sectTaskRecords.membershipId, membershipId));
  const dateKey = getSectDateKey();
  const weekKey = getSectWeekKey();
  const currentRows = rows.filter((row) => {
    if (row.kind === 'daily') return row.periodKey === dateKey;
    if (row.kind === 'weekly') return row.periodKey === weekKey;
    return row.periodKey === 'permanent';
  });
  return {
    activeTaskCount: currentRows.filter((row) => row.status === 'active')
      .length,
    hasClaimableTasks: currentRows.some((row) => {
      if (row.status !== 'completed' || row.claimedAt) return false;
      const payload = SectTaskRecordPayloadSchema.safeParse(row.payload);
      if (!payload.success) return true;
      return Boolean(resolveSectTaskClaimReward(payload.data));
    }),
  };
}

export async function previewSectTransfer(args: {
  cultivatorId: string;
  targetSectId: string;
  reversePaths: boolean;
  runtime: SectRuntime;
  q: DbExecutor | DbTransaction;
}): Promise<SectTransferPreviewData> {
  const { source, sourceModule, targetModule } =
    await requireTransferPlan(args);
  const v6 = await planV6SectTransfer(
    source.membershipId,
    source.sectId,
    args.targetSectId,
    args.reversePaths,
    args.q,
  );
  const [talisman, tasks] = await Promise.all([
    loadTransferTalisman(args.cultivatorId, args.q),
    inspectTasks(source.membershipId, args.q),
  ]);
  return {
    talisman: {
      available: Boolean(talisman),
      ...(talisman ? { id: talisman.id } : {}),
      name: CHEAT_HEAVEN_TALISMAN_NAME,
    },
    source: { sectId: source.sectId, name: sourceModule.definition.name },
    target: {
      sectId: targetModule.definition.id,
      name: targetModule.definition.name,
    },
    discipleRank: source.discipleRank ?? 'registered',
    contribution: source.contribution,
    lifetimeContribution: source.lifetimeContribution ?? source.contribution,
    methodMappings: v6.source.methods.map((method) => {
      const target = v6.target.methods.find((m) => m.slot === method.slot)!;
      return {
        sourceMethodId: method.id,
        sourceMethodName: method.name,
        targetMethodId: target.id,
        targetMethodName: target.name,
        level: v6.progress.methods[method.id],
      };
    }),
    pathMappings: v6.source.paths.map((path, index) => {
      const target = v6.target.paths[args.reversePaths ? 1 - index : index];
      return {
        sourcePathId: path.id,
        sourcePathName: path.name,
        targetPathId: target.id,
        targetPathName: target.name,
        unlockedLayerCount: v6.next.meridianDepth,
        active: v6.next.activePathId === target.id,
      };
    }),
    ...tasks,
    warnings: [
      '共用经脉深度保留，目标宗门两流派的节点选择清空。',
      '心法等级按槽位保留，已解锁神通自动可用；人物道印、道装和修炼不变。',
      '原宗门职务不会保留。',
      ...(tasks.activeTaskCount > 0
        ? [`${tasks.activeTaskCount}项进行中的宗门任务将自动放弃。`]
        : []),
      ...(tasks.hasClaimableTasks
        ? ['有宗门任务奖励尚未领取，请先领取奖励后再转宗。']
        : []),
    ],
  };
}

export async function executeSectTransfer(args: {
  userId: string;
  cultivatorId: string;
  targetSectId: string;
  reversePaths: boolean;
  consumableId?: string;
  runtime: SectRuntime;
  tx: DbTransaction;
}) {
  const { source, targetModule } = await requireTransferPlan({
    ...args,
    q: args.tx,
  });
  await assertInventoryIdle(args.cultivatorId);
  const v6 = await planV6SectTransfer(
    source.membershipId,
    source.sectId,
    args.targetSectId,
    args.reversePaths,
    args.tx,
  );
  const talisman = await loadTransferTalisman(
    args.cultivatorId,
    args.tx,
    args.consumableId,
  );
  if (!talisman)
    throw new SectError(
      'SECT_INSUFFICIENT_RESOURCES',
      `缺少${CHEAT_HEAVEN_TALISMAN_NAME}`,
      400,
    );
  const tasks = await inspectTasks(source.membershipId, args.tx);
  if (tasks.hasClaimableTasks)
    throw new SectError(
      'SECT_ORGANIZATION_INVALID',
      '尚有宗门任务奖励待领取，请先结清',
      409,
    );

  const existingTarget = await findMembershipForSect(
    args.cultivatorId,
    args.targetSectId,
    args.tx,
  );
  if (existingTarget?.status === 'active')
    throw new SectError(
      'SECT_ORGANIZATION_INVALID',
      '目标宗门玉牒已经处于启用状态',
      409,
    );

  await args.tx
    .update(sectTaskRecords)
    .set({ status: 'abandoned', updatedAt: new Date() })
    .where(
      and(
        eq(sectTaskRecords.membershipId, source.membershipId),
        eq(sectTaskRecords.status, 'active'),
      ),
    );
  await args.tx
    .update(sectMemberships)
    .set({ status: 'transferred', office: 'none', updatedAt: new Date() })
    .where(
      and(
        eq(sectMemberships.id, source.membershipId),
        eq(sectMemberships.status, 'active'),
      ),
    );

  const membershipValues = {
    cultivatorId: args.cultivatorId,
    sectId: args.targetSectId,
    status: 'active',
    joinedAt: new Date(),
    contribution: source.contribution,
    lifetimeContribution: source.lifetimeContribution ?? source.contribution,
    discipleRank: source.discipleRank ?? 'registered',
    office: 'none',
    promotedAt: source.promotedAt ? new Date(source.promotedAt) : null,
    configVersion: targetModule.definition.configVersion,
    updatedAt: new Date(),
  } as const;
  const [targetMembership] = existingTarget
    ? await args.tx
        .update(sectMemberships)
        .set(membershipValues)
        .where(eq(sectMemberships.id, existingTarget.id))
        .returning()
    : await args.tx
        .insert(sectMemberships)
        .values(membershipValues)
        .returning();
  if (!targetMembership) throw new Error('目标宗门玉牒创建失败');
  await carryV6SectBuild(v6, targetMembership.id, args.tx);

  // 历史任务迁至新玉牒，仅用于保持同周期领取边界；进行中任务已转为放弃。
  await args.tx
    .update(sectTaskRecords)
    .set({ membershipId: targetMembership.id, updatedAt: new Date() })
    .where(eq(sectTaskRecords.membershipId, source.membershipId));
  await args.tx
    .update(sectStipendClaims)
    .set({ membershipId: targetMembership.id })
    .where(eq(sectStipendClaims.membershipId, source.membershipId));
  await ensureSectFacilities(
    args.targetSectId,
    targetModule.organization.construction.facilities,
    args.tx,
  );
  const consumed = await consumeConsumableById(
    args.userId,
    args.cultivatorId,
    talisman.id,
    1,
    args.tx,
  );
  const rank = targetMembership.discipleRank as SectDiscipleRank;
  const membership = {
    sectId: targetMembership.sectId,
    membershipId: targetMembership.id,
    status: 'active',
    joinedAt: targetMembership.joinedAt?.toISOString(),
    discipleRank: rank,
    contribution: targetMembership.contribution,
    lifetimeContribution: targetMembership.lifetimeContribution,
    office: 'none',
    promotedAt: targetMembership.promotedAt?.toISOString(),
    permissions: targetModule.organization.capabilities.snapshot(rank),
    configVersion: targetMembership.configVersion,
  } satisfies SectContextData;
  return {
    membership,
    consumedTalismanId: talisman.id,
    remainingTalisman: consumed.remaining as Consumable | null,
    sourceSectId: source.sectId,
  };
}
