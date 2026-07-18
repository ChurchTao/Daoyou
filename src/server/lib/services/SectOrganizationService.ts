import type { DbExecutor, DbTransaction } from '@server/lib/drizzle/db';
import { getExecutor } from '@server/lib/drizzle/db';
import * as organizationRepository from '@server/lib/repositories/sectOrganizationRepository';
import * as sectRepository from '@server/lib/repositories/sectRepository';
import { addMaterialStackToInventory } from '@server/lib/services/materialInventory';
import {
  addConsumableToInventory,
  getPlayerRuntimeCultivatorByIdUnsafe,
  updateCultivationExp,
} from '@server/lib/services/cultivatorService';
import type {
  SectConstructionData,
  SectMemberData,
  SectOverviewData,
  SectShopItemData,
  SectTaskId,
  SectTaskRecordData,
  SectTasksData,
} from '@shared/contracts/sect';
import { calculateSceneCultivationExp } from '@shared/engine/cultivation/ExpBudgetCalculator';
import {
  getSectFacilityBonus,
  getEffectiveSectMethodLevelCap,
  hasSectRank,
  realmMeetsSectRank,
  SECT_FACILITY_KEYS,
  SECT_RANK_REQUIREMENTS,
  type SectConstructionProjectState,
  type SectDiscipleRank,
  type SectFacilityState,
  type UpgradeableSectFacilityKey,
} from '@shared/engine/sect';
import { isPillSpec } from '@shared/lib/consumables';
import { simulateBattleV5 } from '@shared/lib/battle/simulateBattleV5';
import type { Cultivator, Material } from '@shared/types/cultivator';
import { QUALITY_ORDER, REALM_ORDER, type Quality } from '@shared/types/constants';
import { SectError } from './SectError';
import { getSectFacilityBonuses } from './SectFacilityService';
import {
  getSectDateKey,
  getSectBountyMode,
  getSectDonationDemands,
  getSectStipendBase,
  getSectWeekKey,
  SECT_DAILY_TASKS,
  SECT_DONATION_DAILY_CAP,
  SECT_FACILITY_PRIORITY,
  SECT_PROJECT_BASE_TARGET,
  SECT_SHOP_ITEMS,
  SECT_WEEKLY_TASKS,
  type SectShopDefinition,
} from './SectOrganizationConfig';

type Membership = NonNullable<
  Awaited<ReturnType<typeof sectRepository.findMembership>>
>;

function organizationError(message: string, status = 409): never {
  throw new SectError('SECT_ORGANIZATION_INVALID', message, status);
}

async function requireMembership(
  cultivatorId: string,
  q: DbExecutor | DbTransaction,
): Promise<Membership> {
  const membership = await sectRepository.findMembership(cultivatorId, q);
  if (!membership) organizationError('尚未拜入宗门');
  return membership;
}

function mapFacilities(
  rows: Awaited<ReturnType<typeof organizationRepository.listSectFacilities>>,
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

function mapProject(
  row: Awaited<ReturnType<typeof organizationRepository.findActiveSectProject>>,
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

function nextRank(rank: SectDiscipleRank): SectDiscipleRank | null {
  return ({ registered: 'outer', outer: 'inner', inner: 'true', true: null } as const)[
    rank
  ];
}

async function getPromotionMissing(
  membership: Membership,
  realm: Cultivator['realm'],
  stage: Cultivator['realm_stage'],
  q: DbExecutor | DbTransaction,
): Promise<string[]> {
  const target = nextRank(membership.discipleRank as SectDiscipleRank);
  if (!target) return [];
  const requirement =
    SECT_RANK_REQUIREMENTS[target as Exclude<SectDiscipleRank, 'registered'>];
  const missing: string[] = [];
  if (!realmMeetsSectRank(realm, stage, requirement.minRealm))
    missing.push(`境界达到${requirement.minRealm}`);
  if (membership.contribution < requirement.contribution)
    missing.push(`当前贡献达到${requirement.contribution}`);
  if (requirement.dailyCompletions) {
    const completed = await organizationRepository.countCompletedDailySectTasks(
      membership.id,
      q,
    );
    if (completed < requirement.dailyCompletions)
      missing.push(`完成宗门日常 ${completed}/${requirement.dailyCompletions}`);
  }
  if (
    requirement.requiresTournament &&
    !(await organizationRepository.hasCompletedSectTask(
      membership.id,
      'weekly_tournament',
      q,
    ))
  )
    missing.push('完成一次宗门小比');
  if (
    requirement.requiresBounty &&
    !(await organizationRepository.hasCompletedSectTask(
      membership.id,
      'weekly_bounty',
      q,
    ))
  )
    missing.push('完成一次悬赏令');
  if (
    requirement.requiresElderTrial &&
    !(await organizationRepository.hasCompletedSectTask(
      membership.id,
      'elder_trial',
      q,
    ))
  )
    missing.push('通过长老试炼');
  return missing;
}

async function ensureCurrentProject(
  sectId: string,
  tx: DbExecutor | DbTransaction,
): Promise<SectConstructionProjectState | null> {
  await organizationRepository.ensureSectFacilities(sectId, tx);
  const active = await organizationRepository.findActiveSectProject(sectId, tx);
  if (active) return mapProject(active);
  const weekKey = getSectWeekKey();
  const latest = await organizationRepository.findLatestCompletedSectProject(
    sectId,
    tx,
  );
  if (latest?.completedAt && getSectWeekKey(latest.completedAt) === weekKey)
    return null;

  const facilities = await organizationRepository.listSectFacilities(sectId, tx);
  const levels = new Map(facilities.map((row) => [row.facilityKey, row.level]));
  const candidate = [...SECT_FACILITY_PRIORITY]
    .filter((key) => (levels.get(key) ?? 1) < 5)
    .sort((a, b) => {
      const levelDiff = (levels.get(a) ?? 1) - (levels.get(b) ?? 1);
      return levelDiff || SECT_FACILITY_PRIORITY.indexOf(a) - SECT_FACILITY_PRIORITY.indexOf(b);
    })[0];
  if (!candidate) return null;
  const targetLevel = (levels.get(candidate) ?? 1) + 1;
  const since = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000);
  const activeMembers = Math.max(
    1,
    Math.min(
      100,
      await organizationRepository.countRecentlyActiveSectMembers(
        sectId,
        since,
        tx,
      ),
    ),
  );
  const created = await organizationRepository.createSectProject(
    {
      sectId,
      facilityKey: candidate,
      targetLevel,
      target: (SECT_PROJECT_BASE_TARGET[targetLevel] ?? 1500) * activeMembers,
      startedWeekKey: weekKey,
    },
    tx,
  );
  return mapProject(created);
}

function taskTarget(taskId: SectTaskId): number {
  return SECT_WEEKLY_TASKS.find((task) => task.id === taskId)?.target ?? 1;
}

function mapTaskRecord(
  row: Awaited<ReturnType<typeof organizationRepository.listSectTaskRecords>>[number],
): SectTaskRecordData {
  const payload = (row.payload ?? {}) as Record<string, unknown>;
  return {
    id: row.id,
    taskId: row.taskId as SectTaskId,
    kind: row.kind as SectTaskRecordData['kind'],
    periodKey: row.periodKey,
    status: row.status as SectTaskRecordData['status'],
    progress: row.progress,
    target: Number(payload.target ?? taskTarget(row.taskId as SectTaskId)),
    completedAt: row.completedAt?.toISOString(),
    payload,
  };
}

function cloneOpponent(
  source: Cultivator,
  name: string,
  multiplier: number,
): Cultivator {
  const opponent = structuredClone(source);
  opponent.id = globalThis.crypto?.randomUUID?.() ?? `sect-${Date.now()}`;
  opponent.name = name;
  opponent.title = '宗门试炼残影';
  opponent.attributes = {
    vitality: Math.max(1, Math.floor(source.attributes.vitality * multiplier)),
    spirit: Math.max(1, Math.floor(source.attributes.spirit * multiplier)),
    wisdom: Math.max(1, Math.floor(source.attributes.wisdom * multiplier)),
    speed: Math.max(1, Math.floor(source.attributes.speed * multiplier)),
    willpower: Math.max(1, Math.floor(source.attributes.willpower * multiplier)),
  };
  return opponent;
}

function taskReward(taskId: SectTaskId): number {
  return (
    SECT_DAILY_TASKS.find((task) => task.id === taskId)?.contributionReward ??
    SECT_WEEKLY_TASKS.find((task) => task.id === taskId)?.reward ??
    0
  );
}

async function grantTaskReward(args: {
  userId: string;
  cultivatorId: string;
  membership: Membership;
  taskId: SectTaskId;
  referenceId: string;
  daily: boolean;
  tx: DbTransaction;
}) {
  const contribution = taskReward(args.taskId);
  if (contribution > 0)
    await organizationRepository.addSectContribution(
      args.membership.id,
      contribution,
      args.daily ? 'daily_task' : 'weekly_task',
      args.referenceId,
      args.tx,
    );
  if (!args.daily) return;
  const progress = await sectRepository.loadSectCultivatorProgress(
    args.cultivatorId,
    args.tx,
  );
  if (!progress) return;
  const exp = calculateSceneCultivationExp('daily_task', {
    realm: progress.realm,
    realmStage: progress.stage,
    difficulty: 'easy',
  }).baseExp;
  await organizationRepository.addCultivatorSpiritStones(
    args.cultivatorId,
    (REALM_ORDER[progress.realm] + 1) * 1000,
    args.tx,
  );
  if (exp > 0)
    await updateCultivationExp(
      args.userId,
      args.cultivatorId,
      exp,
      undefined,
      args.tx,
    );
}

async function syncWeeklyDiligence(
  membership: Membership,
  weekKey: string,
  tx: DbTransaction,
) {
  const progress = await organizationRepository.countCompletedDailySectTasksSince(
    membership.id,
    weekKey,
    tx,
  );
  const existing = await organizationRepository.findSectTaskRecord(
    membership.id,
    weekKey,
    'weekly_diligence',
    tx,
  );
  const row = await organizationRepository.upsertSectTaskProgress(
    {
      membershipId: membership.id,
      taskId: 'weekly_diligence',
      kind: 'weekly',
      periodKey: weekKey,
      progress: Math.min(5, progress),
      target: 5,
    },
    tx,
  );
  if (row.status === 'completed' && existing?.status !== 'completed')
    await organizationRepository.addSectContribution(
      membership.id,
      20,
      'weekly_task',
      row.id,
      tx,
    );
}

async function completeTaskOnce(args: {
  userId: string;
  cultivatorId: string;
  membership: Membership;
  record: NonNullable<Awaited<ReturnType<typeof organizationRepository.findSectTaskRecord>>>;
  daily: boolean;
  tx: DbTransaction;
}) {
  const completed = await organizationRepository.completeSectTaskRecord(
    args.record.id,
    1,
    args.tx,
  );
  if (!completed) organizationError('该宗门任务已经完成');
  await grantTaskReward({
    ...args,
    taskId: completed.taskId as SectTaskId,
    referenceId: completed.id,
  });
  if (args.daily)
    await syncWeeklyDiligence(args.membership, getSectWeekKey(), args.tx);
  return mapTaskRecord(completed);
}

function rotatingShopItems(weekKey: string): SectShopDefinition[] {
  const fixed = SECT_SHOP_ITEMS.filter((item) => !item.rotating);
  const rotating = SECT_SHOP_ITEMS.filter((item) => item.rotating);
  if (rotating.length <= 2) return [...fixed, ...rotating];
  const seed = [...weekKey].reduce((sum, char) => sum + char.charCodeAt(0), 0);
  const first = seed % rotating.length;
  return [fixed, rotating[first], rotating[(first + 1) % rotating.length]].flat();
}

export const SectOrganizationService = {
  async ensureWeeklyProject(
    sectId: string,
    q: DbExecutor = getExecutor(),
  ) {
    return ensureCurrentProject(sectId, q);
  },

  async getOverview(
    cultivator: Pick<Cultivator, 'id' | 'realm' | 'realm_stage'>,
    realmMethodLevelCap: number,
    q: DbExecutor = getExecutor(),
  ): Promise<SectOverviewData> {
    const membership = await requireMembership(cultivator.id!, q);
    const sect = await sectRepository.loadCultivatorSectState(cultivator.id!, q);
    if (!sect) organizationError('宗门状态不存在');
    const facilities = mapFacilities(
      await organizationRepository.listSectFacilities(membership.sectId, q),
    );
    const project = mapProject(
      await organizationRepository.findActiveSectProject(membership.sectId, q),
    );
    const archiveLevel = facilities.find((item) => item.key === 'archive')?.level ?? 1;
    const veinLevel = facilities.find((item) => item.key === 'spirit_vein')?.level ?? 1;
    const gardenLevel = facilities.find((item) => item.key === 'herb_garden')?.level ?? 1;
    const weekKey = getSectWeekKey();
    const claimed = await organizationRepository.hasClaimedSectStipend(
      membership.id,
      weekKey,
      q,
    );
    const spiritStones = Math.floor(
      getSectStipendBase(sect.discipleRank ?? 'registered') *
        (1 + getSectFacilityBonus('spirit_vein', veinLevel)),
    );
    const rank = sect.discipleRank ?? 'registered';
    const herbQuantity = gardenLevel + (rank === 'inner' ? 3 : 0);
    return {
      sect,
      facilities,
      project,
      realmMethodLevelCap,
      methodLevelCap: getEffectiveSectMethodLevelCap({
        realmCap: realmMethodLevelCap,
        rank: sect.discipleRank ?? 'registered',
        archiveLevel,
      }),
      stipend: {
        weekKey,
        claimed,
        spiritStones,
        herbQuantity,
        bonusRewards: [
          ...(rank === 'outer' ? ['基础回气丹 ×1'] : []),
          ...(rank === 'inner' ? ['内门基础材料 ×3'] : []),
          ...(rank === 'true' ? ['真品凌霄灵蕴草'] : []),
        ],
      },
      nextRank: nextRank(sect.discipleRank ?? 'registered'),
      promotionMissing: await getPromotionMissing(
        membership,
        cultivator.realm,
        cultivator.realm_stage,
        q,
      ),
    };
  },

  async promote(
    cultivator: Pick<Cultivator, 'id' | 'realm' | 'realm_stage'>,
    tx: DbTransaction,
  ) {
    const membership = await requireMembership(cultivator.id!, tx);
    const current = membership.discipleRank as SectDiscipleRank;
    const target = nextRank(current);
    if (!target) organizationError('已是真传弟子');
    const missing = await getPromotionMissing(
      membership,
      cultivator.realm,
      cultivator.realm_stage,
      tx,
    );
    if (missing.length) organizationError(`尚需：${missing.join('、')}`, 400);
    await organizationRepository.promoteSectMembership(membership.id, target, tx);
    return sectRepository.loadCultivatorSectState(cultivator.id!, tx);
  },

  async getTasks(cultivatorId: string, q: DbExecutor = getExecutor()): Promise<SectTasksData> {
    const membership = await requireMembership(cultivatorId, q);
    const rank = membership.discipleRank as SectDiscipleRank;
    const dateKey = getSectDateKey();
    const weekKey = getSectWeekKey();
    const records = await organizationRepository.listSectTaskRecords(membership.id, q);
    const daily = records.find(
      (row) => row.kind === 'daily' && row.periodKey === dateKey,
    );
    const weeklyDiligenceProgress =
      await organizationRepository.countCompletedDailySectTasksSince(
        membership.id,
        weekKey,
        q,
      );
    const bountyMode = getSectBountyMode(weekKey);
    const weekly = SECT_WEEKLY_TASKS.map((definition) => {
      const row = records.find(
        (record) =>
          record.taskId === definition.id && record.periodKey === weekKey,
      );
      return row
        ? mapTaskRecord(row)
        : {
            id: definition.id,
            taskId: definition.id,
            kind: 'weekly' as const,
            periodKey: weekKey,
            status: 'active' as const,
            progress:
              definition.id === 'weekly_diligence'
                ? Math.min(definition.target, weeklyDiligenceProgress)
                : 0,
            target: definition.target,
            payload:
              definition.id === 'weekly_bounty'
                ? { mode: bountyMode, minQuality: '玄品', quantity: 2 }
                : undefined,
          };
    });
    const elder = records.find((row) => row.taskId === 'elder_trial');
    return {
      dateKey,
      weekKey,
      dailyOffers: SECT_DAILY_TASKS.map((offer) => {
        const available = hasSectRank(rank, offer.requiredRank) && !daily;
        return {
          ...offer,
          available,
          unavailableReason: daily
            ? '今日已经领取委托'
            : available
              ? undefined
              : `须达${offer.requiredRank === 'outer' ? '外门' : '内门'}弟子`,
        };
      }),
      dailyTask: daily ? mapTaskRecord(daily) : null,
      weeklyTasks: weekly,
      promotionTask: elder ? mapTaskRecord(elder) : null,
    };
  },

  async acceptDaily(cultivatorId: string, taskId: SectTaskId, tx: DbTransaction) {
    const membership = await requireMembership(cultivatorId, tx);
    const offer = SECT_DAILY_TASKS.find((item) => item.id === taskId);
    if (!offer) organizationError('未知宗门日常委托', 400);
    if (!hasSectRank(membership.discipleRank as SectDiscipleRank, offer.requiredRank))
      organizationError('当前弟子职阶尚不能领取该委托', 400);
    const dateKey = getSectDateKey();
    if (await organizationRepository.findDailySectTask(membership.id, dateKey, tx))
      organizationError('今日已经领取过宗门委托');
    const seed = [...`${membership.id}:${dateKey}`].reduce(
      (sum, char) => sum + char.charCodeAt(0),
      0,
    );
    const targetMoves = [seed % 9, (seed + 3) % 9, (seed + 6) % 9];
    const row = await organizationRepository.createSectTaskRecord(
      {
        membershipId: membership.id,
        taskId,
        kind: 'daily',
        periodKey: dateKey,
        payload:
          taskId === 'gate_sweep'
            ? { target: 1, targetMoves }
            : {
                target: 1,
                minQuality: '凡品',
                quantity: 1,
                ...(taskId === 'pill_delivery'
                  ? { pillFamily: seed % 2 === 0 ? 'healing' : 'mana' }
                  : {}),
              },
      },
      tx,
    );
    return mapTaskRecord(row!);
  },

  async completeSweep(
    userId: string,
    cultivatorId: string,
    moves: number[],
    tx: DbTransaction,
  ) {
    const membership = await requireMembership(cultivatorId, tx);
    const record = await organizationRepository.findSectTaskRecord(
      membership.id,
      getSectDateKey(),
      'gate_sweep',
      tx,
    );
    if (!record) organizationError('今日未领取清扫山门委托', 400);
    const targetMoves = ((record.payload as Record<string, unknown>).targetMoves ?? []) as number[];
    if (targetMoves.some((move) => !moves.includes(move)))
      organizationError('云阶尚有落叶未清理干净', 400);
    return completeTaskOnce({
      userId,
      cultivatorId,
      membership,
      record,
      daily: true,
      tx,
    });
  },

  async submitTaskItem(
    userId: string,
    cultivatorId: string,
    taskId: SectTaskId,
    itemId: string,
    quantity: number,
    tx: DbTransaction,
  ) {
    const membership = await requireMembership(cultivatorId, tx);
    const periodKey = taskId.startsWith('weekly_') ? getSectWeekKey() : getSectDateKey();
    let record = await organizationRepository.findSectTaskRecord(
      membership.id,
      periodKey,
      taskId,
      tx,
    );
    if (!record && taskId === 'weekly_bounty')
      record = await organizationRepository.createSectTaskRecord(
        {
          membershipId: membership.id,
          taskId,
          kind: 'weekly',
          periodKey,
          payload: {
            target: 1,
            mode: getSectBountyMode(periodKey),
            minQuality: '玄品',
            quantity: 2,
          },
        },
        tx,
      );
    if (!record) organizationError('未领取对应宗门委托', 400);
    const payload = (record.payload ?? {}) as Record<string, unknown>;
    const requiredQuantity = Number(payload.quantity ?? 1);
    if (quantity !== requiredQuantity)
      organizationError(`该委托须一次提交 ${requiredQuantity} 份`, 400);
    if (taskId === 'pill_delivery') {
      const item = await organizationRepository.findOwnedConsumable(cultivatorId, itemId, tx);
      if (!item || !isPillSpec(item.spec as never))
        organizationError('所选物品不是有效丹药', 400);
      const minQuality = (payload.minQuality ?? '凡品') as Quality;
      if ((QUALITY_ORDER[item.quality as Quality] ?? -1) < QUALITY_ORDER[minQuality])
        organizationError('丹药品质不足', 400);
      if (
        payload.pillFamily &&
        (item.spec as { family?: unknown }).family !== payload.pillFamily
      )
        organizationError('丹药类型不符合委托要求', 400);
      if (!(await organizationRepository.consumeOwnedConsumable(item.id, quantity, tx)))
        organizationError('丹药数量不足', 400);
    } else if (taskId === 'artifact_delivery') {
      const item = await organizationRepository.findOwnedArtifact(cultivatorId, itemId, tx);
      if (!item) organizationError('未找到该法宝', 400);
      if (item.isEquipped) organizationError('已装备法宝不能提交', 400);
      const minQuality = (payload.minQuality ?? '凡品') as Quality;
      if ((QUALITY_ORDER[item.quality as Quality] ?? -1) < QUALITY_ORDER[minQuality])
        organizationError('法宝品阶不足', 400);
      if (!(await organizationRepository.consumeOwnedArtifact(item.id, tx)))
        organizationError('法宝状态已变化，请重试', 400);
    } else if (taskId === 'weekly_bounty') {
      if (payload.mode !== 'material')
        organizationError('本周悬赏为叛徒残影战，不接受材料提交', 400);
      const item = await organizationRepository.findOwnedMaterial(cultivatorId, itemId, tx);
      if (!item || item.quantity < quantity)
        organizationError('悬赏所需材料不足', 400);
      const minQuality = (payload.minQuality ?? '玄品') as Quality;
      if ((QUALITY_ORDER[item.rank as Quality] ?? -1) < QUALITY_ORDER[minQuality])
        organizationError('悬赏材料品质不足', 400);
      if (!(await organizationRepository.consumeOwnedMaterial(item.id, quantity, tx)))
        organizationError('材料状态已变化，请重试', 400);
    } else organizationError('该任务不接受物品提交', 400);
    return completeTaskOnce({
      userId,
      cultivatorId,
      membership,
      record,
      daily: record.kind === 'daily',
      tx,
    });
  },

  async challengeTask(
    userId: string,
    cultivatorId: string,
    taskId: SectTaskId,
    tx: DbTransaction,
  ) {
    const membership = await requireMembership(cultivatorId, tx);
    const isDaily = taskId === 'mine_patrol';
    const periodKey = isDaily
      ? getSectDateKey()
      : taskId === 'elder_trial'
        ? 'permanent'
        : getSectWeekKey();
    let record = await organizationRepository.findSectTaskRecord(
      membership.id,
      periodKey,
      taskId,
      tx,
    );
    if (!record && ['weekly_tournament', 'weekly_bounty', 'elder_trial'].includes(taskId)) {
      if (taskId === 'elder_trial') {
        const rank = membership.discipleRank as SectDiscipleRank;
        if (rank !== 'inner') organizationError('只有内门弟子可参加长老试炼', 400);
        if (membership.contribution < 3000) organizationError('当前贡献尚未达到 3000', 400);
      }
      if (taskId === 'weekly_bounty' && getSectBountyMode(periodKey) !== 'battle')
        organizationError('本周悬赏为稀有材料交付', 400);
      record = await organizationRepository.createSectTaskRecord(
        {
          membershipId: membership.id,
          taskId,
          kind: taskId === 'elder_trial' ? 'promotion' : 'weekly',
          periodKey,
          payload: { target: 1, mode: 'battle' },
        },
        tx,
      );
    }
    if (!record) organizationError('未领取对应战斗委托', 400);
    if (
      taskId === 'weekly_bounty' &&
      (record.payload as Record<string, unknown>).mode !== 'battle'
    )
      organizationError('本周悬赏为稀有材料交付', 400);
    if (record.status === 'completed') organizationError('该试炼已经完成');
    const player = await getPlayerRuntimeCultivatorByIdUnsafe(cultivatorId, tx);
    if (!player) organizationError('角色不存在', 400);
    let source = player.cultivator;
    let name = '矿脉侵扰妖兽';
    let multiplier = 0.75;
    if (taskId === 'weekly_tournament') {
      name = '同门试剑傀儡';
      multiplier = 0.95;
    } else if (taskId === 'weekly_bounty') {
      const mirrorId = await organizationRepository.findSectMirrorCultivatorId(
        membership.sectId,
        cultivatorId,
        tx,
      );
      const mirror = mirrorId
        ? await getPlayerRuntimeCultivatorByIdUnsafe(mirrorId, tx)
        : null;
      source = mirror?.cultivator ?? player.cultivator;
      name = '叛徒残影';
      multiplier = 1;
    } else if (taskId === 'elder_trial') {
      name = '传功长老剑影';
      multiplier = 1.05;
    }
    const opponent = cloneOpponent(source, name, multiplier);
    const battle = simulateBattleV5(player.cultivator, opponent);
    const won = battle.winner.id === player.cultivator.id;
    let task = mapTaskRecord(record);
    if (won)
      task = await completeTaskOnce({
        userId,
        cultivatorId,
        membership,
        record,
        daily: isDaily,
        tx,
      });
    return { task, battle, won };
  },

  async getShop(cultivatorId: string, q: DbExecutor = getExecutor()) {
    const membership = await requireMembership(cultivatorId, q);
    const rank = membership.discipleRank as SectDiscipleRank;
    const weekKey = getSectWeekKey();
    const items: SectShopItemData[] = [];
    for (const item of rotatingShopItems(weekKey)) {
      if (!hasSectRank(rank, item.requiredRank)) continue;
      const purchased = await organizationRepository.getPurchasedSectShopQuantity(
        membership.id,
        weekKey,
        item.id,
        q,
      );
      items.push({
        id: item.id,
        name: item.grant.name,
        description: item.grant.description,
        requiredRank: item.requiredRank,
        price: item.price,
        stock: item.stock,
        purchased,
        kind: item.grant.kind === 'pill' ? 'pill' : 'material',
        rotating: item.rotating,
      });
    }
    return { weekKey, contribution: membership.contribution, items };
  },

  async purchaseShopItem(
    userId: string,
    cultivatorId: string,
    itemId: string,
    quantity: number,
    requestId: string | undefined,
    tx: DbTransaction,
  ) {
    const membership = await requireMembership(cultivatorId, tx);
    if (
      requestId &&
      (await organizationRepository.findSectShopPurchaseByRequestId(
        membership.id,
        requestId,
        tx,
      ))
    )
      return this.getShop(cultivatorId, tx);
    const item = rotatingShopItems(getSectWeekKey()).find((entry) => entry.id === itemId);
    if (!item) organizationError('本周宝库没有该物品', 400);
    if (!hasSectRank(membership.discipleRank as SectDiscipleRank, item.requiredRank))
      organizationError('弟子职阶不足', 400);
    const purchased = await organizationRepository.getPurchasedSectShopQuantity(
      membership.id,
      getSectWeekKey(),
      item.id,
      tx,
    );
    if (purchased + quantity > item.stock) organizationError('本周个人库存不足', 400);
    const cost = item.price * quantity;
    if (
      (await organizationRepository.spendSectContribution(
        membership.id,
        cost,
        'sect_shop',
        `${getSectWeekKey()}:${item.id}`,
        tx,
      )) === null
    )
      organizationError('宗门贡献不足', 400);
    const purchase = await organizationRepository.addSectShopPurchase(
      membership.id,
      getSectWeekKey(),
      item.id,
      quantity,
      requestId,
      tx,
    );
    if (!purchase) organizationError('该笔兑换已经处理');
    if (item.grant.kind === 'material') {
      await addMaterialStackToInventory(
        cultivatorId,
        {
          name: item.grant.name,
          type: item.grant.type,
          rank: item.grant.quality,
          element: item.grant.element as Material['element'],
          description: item.grant.description,
          details: { source: 'sect_shop' },
          quantity,
        },
        tx,
      );
    } else {
      await addConsumableToInventory(
        userId,
        cultivatorId,
        {
          id: globalThis.crypto?.randomUUID?.() ?? `sect-pill-${Date.now()}`,
          name: item.grant.name,
          type: '丹药',
          prompt: '宗门宝库制式丹药',
          quality: item.grant.quality,
          description: item.grant.description,
          spec: item.grant.spec,
          quantity,
        },
        tx,
      );
    }
    return this.getShop(cultivatorId, tx);
  },

  async getConstruction(
    cultivatorId: string,
    q: DbExecutor = getExecutor(),
  ): Promise<SectConstructionData> {
    const membership = await requireMembership(cultivatorId, q);
    const facilities = mapFacilities(
      await organizationRepository.listSectFacilities(membership.sectId, q),
    );
    return {
      facilities,
      project: mapProject(
        await organizationRepository.findActiveSectProject(membership.sectId, q),
      ),
      demands: getSectDonationDemands(membership.sectId),
      donatedContributionToday:
        await organizationRepository.sumSectDonationContributionForDate(
          membership.id,
          getSectDateKey(),
          q,
        ),
      dailyContributionCap: SECT_DONATION_DAILY_CAP,
      recentActivity: (
        await organizationRepository.listRecentSectDonations(
          membership.sectId,
          12,
          q,
        )
      ).map((item) => ({
        ...item,
        createdAt: item.createdAt.toISOString(),
      })),
    };
  },

  async donate(
    cultivatorId: string,
    input: { demandId: string; itemId?: string; quantity: number; requestId?: string },
    tx: DbTransaction,
  ) {
    const membership = await requireMembership(cultivatorId, tx);
    if (
      input.requestId &&
      (await organizationRepository.findSectDonationByRequestId(
        membership.id,
        input.requestId,
        tx,
      ))
    )
      return this.getConstruction(cultivatorId, tx);
    const project = await ensureCurrentProject(membership.sectId, tx);
    if (!project) organizationError('本周工程已经完成，请待下周长老议定新工程');
    const demand = getSectDonationDemands(membership.sectId).find(
      (item) => item.id === input.demandId,
    );
    if (!demand) organizationError('今日没有这项宗门需求', 400);
    const units = input.quantity;
    const contribution = demand.contribution * units;
    const current = await organizationRepository.sumSectDonationContributionForDate(
      membership.id,
      getSectDateKey(),
      tx,
    );
    if (current + contribution > SECT_DONATION_DAILY_CAP)
      organizationError(`每日建设贡献上限为 ${SECT_DONATION_DAILY_CAP}`, 400);
    let snapshot: Record<string, unknown> = { kind: demand.kind, units };
    if (demand.kind === 'spirit_stones') {
      const amount = demand.quantity * units;
      if (!(await organizationRepository.spendCultivatorSpiritStones(cultivatorId, amount, tx)))
        organizationError('灵石不足', 400);
      snapshot = { ...snapshot, amount };
    } else if (demand.kind === 'material') {
      if (!input.itemId) organizationError('请选择要捐献的材料', 400);
      const item = await organizationRepository.findOwnedMaterial(cultivatorId, input.itemId, tx);
      if (!item || item.type !== 'herb') organizationError('该需求只接收灵草', 400);
      const minQuality = (demand.minQuality ?? '凡品') as Quality;
      if ((QUALITY_ORDER[item.rank as Quality] ?? -1) < QUALITY_ORDER[minQuality])
        organizationError('材料品质不足', 400);
      const amount = demand.quantity * units;
      if (!(await organizationRepository.consumeOwnedMaterial(item.id, amount, tx)))
        organizationError('材料数量不足', 400);
      snapshot = { ...snapshot, itemId: item.id, name: item.name, amount };
    } else if (demand.kind === 'pill') {
      if (!input.itemId) organizationError('请选择要捐献的丹药', 400);
      const item = await organizationRepository.findOwnedConsumable(cultivatorId, input.itemId, tx);
      if (!item || !isPillSpec(item.spec as never)) organizationError('该物品不是有效丹药', 400);
      const minQuality = (demand.minQuality ?? '凡品') as Quality;
      if ((QUALITY_ORDER[item.quality as Quality] ?? -1) < QUALITY_ORDER[minQuality])
        organizationError('丹药品质不足', 400);
      if (
        demand.pillFamily &&
        (item.spec as { family?: unknown }).family !== demand.pillFamily
      )
        organizationError('丹药类型不符合长老需求', 400);
      if (!(await organizationRepository.consumeOwnedConsumable(item.id, units, tx)))
        organizationError('丹药数量不足', 400);
      snapshot = { ...snapshot, itemId: item.id, name: item.name };
    } else {
      if (!input.itemId || units !== 1) organizationError('每次只能捐献一件法宝', 400);
      const item = await organizationRepository.findOwnedArtifact(cultivatorId, input.itemId, tx);
      if (!item) organizationError('未找到该法宝', 400);
      if (item.isEquipped) organizationError('已装备法宝不能捐献', 400);
      const minQuality = (demand.minQuality ?? '凡品') as Quality;
      if ((QUALITY_ORDER[item.quality as Quality] ?? -1) < QUALITY_ORDER[minQuality])
        organizationError('法宝品阶不足', 400);
      if (!(await organizationRepository.consumeOwnedArtifact(item.id, tx)))
        organizationError('法宝状态已变化，请重试', 400);
      snapshot = { ...snapshot, itemId: item.id, name: item.name, quality: item.quality };
    }
    const donation = await organizationRepository.insertSectDonation(
      {
        membershipId: membership.id,
        projectId: project.id,
        dateKey: getSectDateKey(),
        demandId: demand.id,
        contribution,
        constructionPoints: demand.constructionPoints * units,
        itemSnapshot: snapshot,
        requestId: input.requestId,
      },
      tx,
    );
    if (!donation) organizationError('该笔捐献已经处理');
    const advanced = await organizationRepository.advanceSectProject(
      project.id,
      demand.constructionPoints * units,
      tx,
    );
    if (!advanced) organizationError('工程状态已变化，请重试');
    await organizationRepository.addSectContribution(
      membership.id,
      contribution,
      'construction_donation',
      donation.id,
      tx,
    );
    return this.getConstruction(cultivatorId, tx);
  },

  async claimStipend(userId: string, cultivatorId: string, tx: DbTransaction) {
    const membership = await requireMembership(cultivatorId, tx);
    await organizationRepository.ensureSectFacilities(membership.sectId, tx);
    const facilities = mapFacilities(
      await organizationRepository.listSectFacilities(membership.sectId, tx),
    );
    const veinLevel = facilities.find((item) => item.key === 'spirit_vein')?.level ?? 1;
    const gardenLevel = facilities.find((item) => item.key === 'herb_garden')?.level ?? 1;
    const rank = membership.discipleRank as SectDiscipleRank;
    const stones = Math.floor(
      getSectStipendBase(rank) *
        (1 + getSectFacilityBonus('spirit_vein', veinLevel)),
    );
    const herbQuantity = gardenLevel + (rank === 'inner' ? 3 : 0);
    const weekKey = getSectWeekKey();
    const claim = await organizationRepository.createSectStipendClaim(
      {
        membershipId: membership.id,
        weekKey,
        spiritStones: stones,
        rewards: [{ kind: 'material', name: '宗门灵草', quantity: herbQuantity }],
      },
      tx,
    );
    if (!claim) organizationError('本周俸禄已经领取');
    await organizationRepository.addCultivatorSpiritStones(cultivatorId, stones, tx);
    if (herbQuantity > 0)
      await addMaterialStackToInventory(
        cultivatorId,
        {
          name: rank === 'true' ? '凌霄灵蕴草' : '宗门灵草',
          type: 'herb',
          rank: rank === 'true' ? '真品' : '凡品',
          element: '木',
          description: '宗门药田按周分发的修行灵草。',
          details: { source: 'sect_stipend' },
          quantity: herbQuantity,
        },
        tx,
      );
    if (rank === 'outer') {
      const pill = SECT_SHOP_ITEMS.find((item) => item.id === 'outer_recovery_pill');
      if (pill?.grant.kind === 'pill')
        await addConsumableToInventory(
          userId,
          cultivatorId,
          {
            id: globalThis.crypto?.randomUUID?.() ?? `stipend-${Date.now()}`,
            name: pill.grant.name,
            type: '丹药',
            prompt: '外门弟子周俸',
            quality: pill.grant.quality,
            description: pill.grant.description,
            spec: pill.grant.spec,
            quantity: 1,
          },
          tx,
        );
    }
    return { weekKey, spiritStones: stones, herbQuantity };
  },

  async listMembers(
    cultivatorId: string,
    page: number,
    pageSize: number,
    q: DbExecutor = getExecutor(),
  ) {
    const membership = await requireMembership(cultivatorId, q);
    const result = await organizationRepository.listSectMembers(
      membership.sectId,
      page,
      pageSize,
      q,
    );
    return {
      items: result.rows.map(
        (row): SectMemberData => ({
          ...row,
          joinedAt: row.joinedAt?.toISOString(),
        }),
      ),
      page,
      pageSize,
      total: result.total,
    };
  },

  async getFacilityBonuses(cultivatorId: string, q: DbExecutor = getExecutor()) {
    return getSectFacilityBonuses(cultivatorId, q);
  },

  async applyCraftDiscount(
    cultivatorId: string,
    cost: number,
    q: DbExecutor = getExecutor(),
  ) {
    const { craftDiscount } = await this.getFacilityBonuses(cultivatorId, q);
    return Math.max(0, Math.floor(cost * (1 - craftDiscount)));
  },
};

export type SectOrganizationServiceInstance = typeof SectOrganizationService;
