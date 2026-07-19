import type { DbExecutor, DbTransaction } from '@server/lib/drizzle/db';
import type { SectOrganizationRepositoryPort } from '@server/lib/repositories/SectOrganizationRepositoryPort';
import type * as sectRepositoryType from '@server/lib/repositories/sectRepository';
import {
  type getPlayerRuntimeCultivatorByIdUnsafe,
  type updateCultivationExp,
} from '@server/lib/services/cultivatorService';
import type {
  SectTaskId,
  SectTaskRecordData,
  SectTasksData,
} from '@shared/contracts/sect';
import { calculateSceneCultivationExp } from '@shared/engine/cultivation/ExpBudgetCalculator';
import {
  hasSectRank,
  type SectDiscipleRank,
} from '@shared/engine/sect';
import { isPillSpec } from '@shared/lib/consumables';
import type { simulateBattleV5 } from '@shared/lib/battle/simulateBattleV5';
import { SeededBattleRandomSource } from '@shared/engine/battle-v5/core/BattleRandom';
import {
  simulateSweepTrace,
  SWEEP_MAX_TICKS,
  SWEEP_RULES_VERSION,
  SWEEP_TICK_RATE,
  type SweepInputSegment,
} from '@shared/engine/sect';
import type { Cultivator } from '@shared/types/cultivator';
import { QUALITY_ORDER, REALM_ORDER, type Quality } from '@shared/types/constants';
import { SectError } from '../SectError';
import {
  getSectDateKey,
  getSectBountyMode,
  getSectWeekKey,
} from './SectOrganizationClock';
import type { SectOrganizationModule } from '@shared/engine/sect';
import { sectTaskExecutorRegistry } from './task-executors/SectTaskExecutor';
import type { SectBenefitService } from './SectBenefitService';
import type { SectRuntime } from '@shared/engine/sect';

export interface SectTaskWorkflowDependencies {
  runtime: SectRuntime;
  organizationRepository: SectOrganizationRepositoryPort;
  membershipRepository: typeof sectRepositoryType;
  benefits: SectBenefitService;
  getPlayer: typeof getPlayerRuntimeCultivatorByIdUnsafe;
  updateCultivationExp: typeof updateCultivationExp;
  simulateBattle: typeof simulateBattleV5;
  getExecutor(): DbExecutor;
}

export function createSectTaskWorkflow(
  context: SectTaskWorkflowDependencies,
) {
  const organizationRepository = context.organizationRepository;
  const sectRepository = context.membershipRepository;
  const sectBenefitService = context.benefits;
  const productionSectRuntime = context.runtime;
  const getPlayerRuntimeCultivatorByIdUnsafe = context.getPlayer;
  const updateCultivationExp = context.updateCultivationExp;
  const simulateBattleV5 = context.simulateBattle;
  const getExecutor = context.getExecutor;

  type Membership = NonNullable<
    Awaited<ReturnType<typeof sectRepository.findMembership>>
  >;

  function organizationFor(sectId: string): SectOrganizationModule {
    return productionSectRuntime.registry.require(sectId).organization;
  }

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

  function nextRank(rank: SectDiscipleRank): SectDiscipleRank | null {
    return ({ registered: 'outer', outer: 'inner', inner: 'true', true: null } as const)[
      rank
    ];
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
      target: Number(payload.target ?? 1),
      completedAt: row.completedAt?.toISOString(),
      payload,
    };
  }

  function cloneOpponent(
    source: Cultivator,
    name: string,
    multiplier: number,
    id?: string,
  ): Cultivator {
    const opponent = structuredClone(source);
    opponent.id = id ?? globalThis.crypto?.randomUUID?.() ?? `sect-${Date.now()}`;
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

  function createRealmScaledNpc(
    player: Cultivator,
    name: string,
    multiplier: number,
    id: string,
  ): Cultivator {
    const opponent = cloneOpponent(player, name, multiplier, id);
    opponent.sect = undefined;
    opponent.skills = [];
    opponent.cultivations = [];
    opponent.inventory = { ...opponent.inventory, artifacts: [] };
    return opponent;
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
    const contribution =
      organizationFor(args.membership.sectId).tasks.get(args.taskId)
        ?.contributionReward ?? 0;
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
    const definition = organizationFor(membership.sectId).tasks.findByRole(
      'weekly_diligence',
    );
    if (!definition) return;
    const progress = await organizationRepository.countCompletedDailySectTasksSince(
      membership.id,
      weekKey,
      tx,
    );
    const existing = await organizationRepository.findSectTaskRecord(
      membership.id,
      weekKey,
      definition.id,
      tx,
    );
    const row = await organizationRepository.upsertSectTaskProgress(
      {
        membershipId: membership.id,
        taskId: definition.id,
        kind: 'weekly',
        periodKey: weekKey,
        progress: Math.min(definition.target, progress),
        target: definition.target,
      },
      tx,
    );
    if (row.status === 'completed' && existing?.status !== 'completed')
      await organizationRepository.addSectContribution(
        membership.id,
        definition.contributionReward,
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

  const sectTaskWorkflow = {
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
      const organization = organizationFor(membership.sectId);
      const weekly = organization.tasks.listWeekly().map((definition) => {
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
                definition.completionRole === 'weekly_diligence'
                  ? Math.min(definition.target, weeklyDiligenceProgress)
                  : 0,
              target: definition.target,
              payload:
                definition.rotation === 'battle_material'
                  ? { mode: bountyMode, minQuality: '玄品', quantity: 2 }
                  : undefined,
            };
      });
      const promotionDefinition = organization.tasks.findByRole(
        'promotion_elder_trial',
      );
      const elder = records.find(
        (row) =>
          row.kind === 'promotion' &&
          (!promotionDefinition || row.taskId === promotionDefinition.id),
      );
      return {
        dateKey,
        weekKey,
        dailyOffers: organization.tasks.listDaily().map((offer) => {
          const available = hasSectRank(rank, offer.requiredRank) && !daily;
          return {
            id: offer.id,
            name: offer.name,
            description: offer.description,
            kind: offer.kind,
            requiredRank: offer.requiredRank,
            contributionReward: offer.contributionReward,
            action: offer.executor,
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
      const offer = organizationFor(membership.sectId).tasks.get(taskId);
      if (!offer || offer.kind !== 'daily') organizationError('未知宗门日常委托', 400);
      const executor = sectTaskExecutorRegistry.require(offer.executor);
      if (!organizationFor(membership.sectId).permissions.allows(
        membership.discipleRank as SectDiscipleRank,
        executor.requiredPermission(offer),
      ))
        organizationError('当前弟子职阶尚不能领取该委托', 400);
      const dateKey = getSectDateKey();
      if (await organizationRepository.findDailySectTask(membership.id, dateKey, tx))
        organizationError('今日已经领取过宗门委托');
      const seed = [...`${membership.id}:${dateKey}`].reduce(
        (sum, char) => sum + char.charCodeAt(0),
        0,
      );
      const row = await organizationRepository.createSectTaskRecord(
        {
          membershipId: membership.id,
          taskId,
          kind: 'daily',
          periodKey: dateKey,
          payload: executor.acceptancePayload(offer, { seed }),
        },
        tx,
      );
      return mapTaskRecord(row!);
    },

    async startSweep(cultivatorId: string, tx: DbTransaction) {
      const membership = await requireMembership(cultivatorId, tx);
      const record = await organizationRepository.findDailySectTask(
        membership.id,
        getSectDateKey(),
        tx,
      );
      if (
        !record ||
        organizationFor(membership.sectId).tasks.get(record.taskId as SectTaskId)
          ?.executor !== 'sweep'
      )
        organizationError('今日未领取清扫类宗门委托', 400);
      if (record.status === 'completed') organizationError('今日清扫勤务已经完成');
      const sessionId = globalThis.crypto.randomUUID();
      const seed = `${record.id}:${sessionId}`;
      const startedAt = new Date();
      const expiresAt = new Date(Date.now() + 10 * 60 * 1000);
      const payload = {
        ...((record.payload ?? {}) as Record<string, unknown>),
        sweepSession: {
          sessionId,
          seed,
          rulesVersion: SWEEP_RULES_VERSION,
          startedAt: startedAt.toISOString(),
          expiresAt: expiresAt.toISOString(),
        },
      };
      if (!(await organizationRepository.updateSectTaskPayload(record.id, payload, tx)))
        organizationError('清扫任务状态已变化，请重试');
      return {
        sessionId,
        seed,
        rulesVersion: SWEEP_RULES_VERSION,
        tickRate: SWEEP_TICK_RATE,
        maxTicks: SWEEP_MAX_TICKS,
        expiresAt: expiresAt.toISOString(),
      };
    },

    async completeSweep(
      userId: string,
      cultivatorId: string,
      input: {
        sessionId: string;
        rulesVersion: number;
        segments: SweepInputSegment[];
      },
      tx: DbTransaction,
    ) {
      const membership = await requireMembership(cultivatorId, tx);
      const record = await organizationRepository.findDailySectTask(
        membership.id,
        getSectDateKey(),
        tx,
      );
      if (
        !record ||
        organizationFor(membership.sectId).tasks.get(record.taskId as SectTaskId)
          ?.executor !== 'sweep'
      )
        organizationError('今日未领取清扫类宗门委托', 400);
      const session = (
        (record.payload as Record<string, unknown> | null)?.sweepSession ?? {}
      ) as Record<string, unknown>;
      if (session.sessionId !== input.sessionId)
        organizationError('清扫场次与当前任务不匹配', 400);
      if (
        session.rulesVersion !== input.rulesVersion ||
        input.rulesVersion !== SWEEP_RULES_VERSION
      )
        organizationError('清扫规则版本已更新，请重新开始', 400);
      if (typeof session.expiresAt !== 'string' || new Date(session.expiresAt) < new Date())
        organizationError('清扫场次已过期，请重新开始', 400);
      if (typeof session.seed !== 'string') organizationError('清扫场次数据缺失', 400);
      if (typeof session.startedAt !== 'string')
        organizationError('清扫场次起始时间缺失', 400);
      const submittedTicks = input.segments.reduce(
        (sum, segment) => sum + segment.ticks,
        0,
      );
      const elapsedTicks = Math.floor(
        (Date.now() - new Date(session.startedAt).getTime()) /
          (1_000 / SWEEP_TICK_RATE),
      );
      if (submittedTicks > elapsedTicks + SWEEP_TICK_RATE * 2)
        organizationError('清扫轨迹时长与实际场次不符', 400);
      const simulation = simulateSweepTrace(session.seed, input.segments);
      if (!simulation.success)
        organizationError(
          simulation.reason === 'timeout'
            ? '清扫已超时，可重新挑战且不会消耗今日委托'
            : '云阶尚有落叶未清理干净',
          400,
        );
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
      const taskDefinition = organizationFor(membership.sectId).tasks.get(taskId);
      if (!taskDefinition) organizationError('未知宗门委托', 400);
      const deliveryExecutor =
        taskDefinition.alternateExecutor ?? taskDefinition.executor;
      sectBenefitService.assertPermission(
        membership,
        sectTaskExecutorRegistry.require(deliveryExecutor).requiredPermission(
          taskDefinition,
        ),
      );
      const periodKey =
        taskDefinition.kind === 'weekly' ? getSectWeekKey() : getSectDateKey();
      let record = await organizationRepository.findSectTaskRecord(
        membership.id,
        periodKey,
        taskId,
        tx,
      );
      if (
        !record &&
        taskDefinition.kind === 'weekly' &&
        taskDefinition.rotation === 'battle_material' &&
        getSectBountyMode(periodKey) === 'material'
      )
        record = await organizationRepository.createSectTaskRecord(
          {
            membershipId: membership.id,
            taskId,
            kind: 'weekly',
            periodKey,
            payload: {
              target: taskDefinition.target,
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
      if (deliveryExecutor === 'submit_pill') {
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
      } else if (deliveryExecutor === 'submit_artifact') {
        const item = await organizationRepository.findOwnedArtifact(cultivatorId, itemId, tx);
        if (!item) organizationError('未找到该法宝', 400);
        if (item.isEquipped) organizationError('已装备法宝不能提交', 400);
        const minQuality = (payload.minQuality ?? '凡品') as Quality;
        if ((QUALITY_ORDER[item.quality as Quality] ?? -1) < QUALITY_ORDER[minQuality])
          organizationError('法宝品阶不足', 400);
        if (!(await organizationRepository.consumeOwnedArtifact(item.id, tx)))
          organizationError('法宝状态已变化，请重试', 400);
      } else if (deliveryExecutor === 'submit_material') {
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
      attemptId = 'default',
    ) {
      const membership = await requireMembership(cultivatorId, tx);
      const taskDefinition = organizationFor(membership.sectId).tasks.get(taskId);
      if (!taskDefinition || taskDefinition.executor !== 'battle')
        organizationError('该宗门任务不是战斗委托', 400);
      sectBenefitService.assertPermission(
        membership,
        sectTaskExecutorRegistry.require(taskDefinition.executor).requiredPermission(
          taskDefinition,
        ),
      );
      const isDaily = taskDefinition.kind === 'daily';
      const periodKey =
        taskDefinition.kind === 'daily'
          ? getSectDateKey()
          : taskDefinition.kind === 'promotion'
            ? 'permanent'
            : getSectWeekKey();
      let record = await organizationRepository.findSectTaskRecord(
        membership.id,
        periodKey,
        taskId,
        tx,
      );
      if (!record && taskDefinition.kind !== 'daily') {
        if (taskDefinition.kind === 'promotion') {
          const rank = membership.discipleRank as SectDiscipleRank;
          const target = nextRank(rank);
          if (!target) organizationError('当前没有可进行的晋升试炼', 400);
          const requirement = organizationFor(membership.sectId).ranks.requirement(
            target as Exclude<SectDiscipleRank, 'registered'>,
          );
          if (membership.contribution < requirement.contribution)
            organizationError(
              `当前贡献尚未达到 ${requirement.contribution}`,
              400,
            );
        }
        if (
          taskDefinition.rotation === 'battle_material' &&
          getSectBountyMode(periodKey) !== 'battle'
        )
          organizationError('本周悬赏为稀有材料交付', 400);
        record = await organizationRepository.createSectTaskRecord(
          {
            membershipId: membership.id,
            taskId,
            kind: taskDefinition.kind,
            periodKey,
            payload: { target: taskDefinition.target, mode: 'battle' },
          },
          tx,
        );
      }
      if (!record) organizationError('未领取对应战斗委托', 400);
      if (
        taskDefinition.rotation === 'battle_material' &&
        (record.payload as Record<string, unknown>).mode !== 'battle'
      )
        organizationError('本周悬赏为稀有材料交付', 400);
      if (record.status === 'completed') organizationError('该试炼已经完成');
      const player = await getPlayerRuntimeCultivatorByIdUnsafe(cultivatorId, tx);
      if (!player) organizationError('角色不存在', 400);
      const scenario = productionSectRuntime.registry
        .require(membership.sectId)
        .organization.battles.get(taskId);
      if (!scenario) organizationError('该宗门任务不是战斗委托', 400);
      let source: Cultivator | null = null;
      if (scenario.kind === 'member_mirror') {
        const mirrorId = await organizationRepository.findSectMirrorCultivatorId(
          membership.sectId,
          cultivatorId,
          tx,
        );
        const mirror = mirrorId
          ? await getPlayerRuntimeCultivatorByIdUnsafe(mirrorId, tx)
          : null;
        source = mirror?.cultivator ?? null;
      }
      const seed = `${record.id}:${attemptId}`;
      const opponentId = `sect-task-${record.id}-${attemptId}`;
      const opponent = source
        ? cloneOpponent(
            source,
            scenario.opponentName,
            scenario.attributeMultiplier,
            opponentId,
          )
        : createRealmScaledNpc(
            player.cultivator,
            scenario.fallback?.opponentName ?? scenario.opponentName,
            scenario.fallback?.attributeMultiplier ?? scenario.attributeMultiplier,
            opponentId,
          );
      const battle = simulateBattleV5(
        player.cultivator,
        opponent,
        undefined,
        new SeededBattleRandomSource(seed),
      );
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
      return {
        task,
        battle,
        won,
        challengeTitle: scenario.title,
        rewardGranted: won,
      };
    },

  };
  return sectTaskWorkflow;
}

export type SectTaskWorkflow = ReturnType<typeof createSectTaskWorkflow>;
