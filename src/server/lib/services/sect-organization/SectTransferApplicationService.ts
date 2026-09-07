import type { DbExecutor, DbTransaction } from '@server/lib/drizzle/db';
import {
  consumables,
  creationProducts,
  sectAbilityLoadouts,
  sectMemberships,
  sectMeridianLoadouts,
  sectMethodProgress,
  sectPathProgress,
  sectStipendClaims,
  sectTaskRecords,
} from '@server/lib/drizzle/schema';
import { ensureSectFacilities } from '@server/lib/repositories/sectOrganizationRepository';
import {
  findMembershipForSect,
  loadCultivatorSectState,
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
  buildSectTransferPlan,
  resolveSectTaskClaimReward,
  SectTaskRecordPayloadSchema,
  type SectRuntime,
} from '@shared/engine/sect';
import type { Consumable } from '@shared/types/cultivator';
import { and, asc, eq, sql } from 'drizzle-orm';
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
  const conditions = [
    eq(consumables.cultivatorId, cultivatorId),
    eq(consumables.type, '符箓'),
    sql`${consumables.quantity} > 0`,
    sql`${consumables.spec}->>'kind' = 'talisman'`,
    sql`${consumables.spec}->>'scenario' = ${CHEAT_HEAVEN_TALISMAN_SCENARIO}`,
    sql`${consumables.spec}->>'sessionMode' = 'consume_on_action'`,
  ];
  if (consumableId) conditions.push(eq(consumables.id, consumableId));
  const [row] = await q
    .select()
    .from(consumables)
    .where(and(...conditions))
    .orderBy(asc(consumables.createdAt), asc(consumables.id))
    .limit(1);
  return row;
}

async function requireTransferPlan(args: {
  cultivatorId: string;
  targetSectId: string;
  reversePaths: boolean;
  runtime: SectRuntime;
  q: DbExecutor | DbTransaction;
}) {
  const source = await loadCultivatorSectState(
    args.cultivatorId,
    args.q,
    args.runtime,
  );
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
  const plan = buildSectTransferPlan({
    source,
    sourceDefinition: sourceModule.definition,
    targetDefinition: targetModule.definition,
    reversePathMapping: args.reversePaths,
  });
  return { source, sourceModule, targetModule, plan };
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

async function clearSectProgress(membershipId: string, tx: DbTransaction) {
  await tx
    .delete(sectAbilityLoadouts)
    .where(eq(sectAbilityLoadouts.membershipId, membershipId));
  await tx
    .delete(sectMeridianLoadouts)
    .where(eq(sectMeridianLoadouts.membershipId, membershipId));
  await tx
    .delete(sectPathProgress)
    .where(eq(sectPathProgress.membershipId, membershipId));
  await tx
    .delete(sectMethodProgress)
    .where(eq(sectMethodProgress.membershipId, membershipId));
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
    args.cultivatorId,
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
  const { source, targetModule, plan } = await requireTransferPlan({
    ...args,
    q: args.tx,
  });
  await assertInventoryIdle(args.cultivatorId);
  const v6 = await planV6SectTransfer(
    args.cultivatorId,
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
  if (existingTarget) await clearSectProgress(existingTarget.id, args.tx);

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
    activePathId: plan.activePathId ?? null,
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

  const methodRows = plan.methodLevels
    .filter((method) => method.level > 0)
    .map((method) => ({
      membershipId: targetMembership.id,
      methodId: method.targetMethodId,
      level: method.level,
    }));
  if (methodRows.length)
    await args.tx.insert(sectMethodProgress).values(methodRows);
  for (const path of plan.targetPaths) {
    await args.tx.insert(sectPathProgress).values({
      membershipId: targetMembership.id,
      pathId: path.pathId,
      unlockedLayerIds: path.unlockedLayerIds,
      tacticId: path.tacticId,
      activeMeridianSlot: 1,
    });
    await args.tx.insert(sectMeridianLoadouts).values(
      path.meridianLoadouts.map((loadout) => ({
        membershipId: targetMembership.id,
        pathId: path.pathId,
        slot: loadout.slot,
        nodeIds: [],
        version: 1,
      })),
    );
  }

  // 历史任务迁至新玉牒，仅用于保持同周期领取边界；进行中任务已转为放弃。
  await args.tx
    .update(sectTaskRecords)
    .set({ membershipId: targetMembership.id, updatedAt: new Date() })
    .where(eq(sectTaskRecords.membershipId, source.membershipId));
  await args.tx
    .update(sectStipendClaims)
    .set({ membershipId: targetMembership.id })
    .where(eq(sectStipendClaims.membershipId, source.membershipId));
  await args.tx
    .update(creationProducts)
    .set({ isEquipped: false })
    .where(
      and(
        eq(creationProducts.cultivatorId, args.cultivatorId),
        eq(creationProducts.productType, 'skill'),
      ),
    );
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
  const targetState = await loadCultivatorSectState(
    args.cultivatorId,
    args.tx,
    args.runtime,
  );
  if (!targetState) throw new Error('转宗完成后无法读取新的宗门传承');
  const rank = targetState.discipleRank ?? 'registered';
  const membership = {
    sectId: targetState.sectId,
    membershipId: targetState.membershipId,
    status: targetState.status,
    joinedAt: targetState.joinedAt,
    discipleRank: rank,
    contribution: targetState.contribution,
    lifetimeContribution:
      targetState.lifetimeContribution ?? targetState.contribution,
    office: targetState.office ?? 'none',
    promotedAt: targetState.promotedAt,
    permissions: targetModule.organization.capabilities.snapshot(rank),
    configVersion: targetState.configVersion,
  } satisfies SectContextData;
  return {
    sect: targetState,
    membership,
    consumedTalismanId: talisman.id,
    remainingTalisman: consumed.remaining as Consumable | null,
    sourceSectId: source.sectId,
  };
}
