import type {
  SectTaskActionData,
  SectTasksData,
  SectTaskViewData,
} from '@shared/contracts/sect';
import {
  SectTask,
  type SectTaskDefinition,
} from '@shared/engine/sect';
import { SectError } from '../SectError';
import type { SectDomainEventDispatcherFactory } from './SectDomainEventDispatcher';
import type {
  SectCommandContext,
  SectMembershipRecord,
  SectQueryContext,
  SectTaskRecord,
} from './ports';
import type {
  SectTaskExecutor,
  SectTaskExecutorRegistry,
} from './task-executors/SectTaskExecutor';
import type { SectTaskProgressRegistry } from './SectTaskSettlement';
import { SectCapabilityAuthorizer } from './SectCapabilityAuthorizer';

function invalid(message: string, status = 409): never {
  throw new SectError('SECT_ORGANIZATION_INVALID', message, status);
}

function taskPeriodKey(
  definition: SectTaskDefinition,
  context: Pick<SectQueryContext, 'clock'>,
): string {
  if (definition.kind === 'daily') return context.clock.dateKey();
  if (definition.kind === 'weekly') return context.clock.weekKey();
  return 'permanent';
}

function resolvedExecution(
  definition: SectTaskDefinition,
  context: Pick<SectQueryContext, 'clock'>,
) {
  const execution = (
    definition.availability?.resolve({
      dateKey: context.clock.dateKey(),
      weekKey: context.clock.weekKey(),
    }) ?? { executorKey: definition.executorKey }
  );
  if (
    definition.availability &&
    !definition.availability.executorKeys.includes(execution.executorKey)
  )
    invalid(
      `任务 ${definition.id} 返回未声明的执行器：${execution.executorKey}`,
      500,
    );
  return execution;
}

function syntheticRecord(
  membership: SectMembershipRecord,
  definition: SectTaskDefinition,
  context: Pick<SectQueryContext, 'clock'>,
  payload: Record<string, unknown> = {},
): SectTaskRecord {
  return {
    id: `offered:${definition.id}`,
    membershipId: membership.id,
    taskId: definition.id,
    kind: definition.kind,
    periodKey: taskPeriodKey(definition, context),
    status: 'active',
    progress: 0,
    payload: { target: definition.target, ...payload },
  };
}

function toView(args: {
  definition: SectTaskDefinition;
  record: SectTaskRecord;
  state: SectTaskViewData['state'];
  executor: SectTaskExecutor;
  enabled: boolean;
  disabledReason?: string;
  offered?: boolean;
}): SectTaskViewData {
  const actions = args.state === 'completed'
    ? []
    : args.offered
      ? [
          {
            key: 'accept',
            renderer: 'sect.action.accept',
            label: '领取委托',
            enabled: args.enabled,
            ...(args.disabledReason ? { disabledReason: args.disabledReason } : {}),
          },
        ]
      : args.executor.actions(args.definition, args.record).map((action) => ({
          ...action,
          enabled: args.enabled,
          ...(args.disabledReason ? { disabledReason: args.disabledReason } : {}),
        }));
  return {
    id: args.record.id,
    definitionId: args.definition.id,
    kind: args.definition.kind,
    state: args.state,
    periodKey: args.record.periodKey,
    progress: {
      current: args.record.progress,
      target: Number(args.record.payload.target ?? args.definition.target),
    },
    presentation: {
      title: args.definition.presentation.title,
      description: args.definition.presentation.description,
      contributionReward: args.definition.contributionReward,
      rewardSummary: args.definition.presentation.rewardSummary,
    },
    actions,
  };
}

async function requireMembership(
  cultivatorId: string,
  context: Pick<SectQueryContext, 'memberships'>,
): Promise<SectMembershipRecord> {
  const membership = await context.memberships.findByCultivator(cultivatorId);
  if (!membership) invalid('尚未拜入宗门');
  return membership;
}

export class GetSectTasksQueryHandler {
  constructor(
    private readonly executors: SectTaskExecutorRegistry,
    private readonly progress: SectTaskProgressRegistry,
    private readonly authorizer = new SectCapabilityAuthorizer(),
  ) {}

  async execute(
    cultivatorId: string,
    context: SectQueryContext,
  ): Promise<SectTasksData> {
    const membership = await requireMembership(cultivatorId, context);
    const organization = context.modules.require(membership.sectId);
    this.authorizer.assertOrganization(
      organization,
      membership.discipleRank,
      'sect.tasks.use',
    );
    const records = await context.tasks.list(membership.id);
    const dateKey = context.clock.dateKey();
    const weekKey = context.clock.weekKey();
    const currentDaily = records.find(
      (record) => record.kind === 'daily' && record.periodKey === dateKey,
    );
    const build = async (
      definition: SectTaskDefinition,
      offered: boolean,
    ): Promise<SectTaskViewData> => {
      const periodKey = taskPeriodKey(definition, context);
      const execution = resolvedExecution(definition, context);
      const executor = this.executors.require(execution.executorKey);
      const persisted = records.find(
        (record) => record.taskId === definition.id && record.periodKey === periodKey,
      );
      const record = persisted ?? syntheticRecord(membership, definition, context, execution.parameters);
      if (!persisted && definition.progress)
        record.progress = Math.min(
          definition.target,
          await this.progress.require(definition.progress.strategy).current({
            membership,
            definition,
            context,
          }),
        );
      const capabilityAllowed = organization.capabilities.allows(
        membership.discipleRank,
        executor.requiredCapability(definition),
      );
      const dailyBlocked = definition.kind === 'daily' && Boolean(currentDaily && !persisted);
      const enabled = capabilityAllowed && !dailyBlocked;
      const permission = organization.capabilities.snapshot(membership.discipleRank)[
        executor.requiredCapability(definition)
      ];
      const disabledReason = dailyBlocked
        ? '今日已经领取其他委托'
        : capabilityAllowed
          ? undefined
          : permission?.reason ?? '当前弟子职阶尚未开放';
      return toView({
        definition,
        record,
        executor,
        offered: offered && !persisted,
        state: persisted?.status === 'completed'
          ? 'completed'
          : enabled
            ? offered && !persisted
              ? 'offered'
              : 'active'
            : 'locked',
        enabled,
        disabledReason,
      });
    };

    return {
      dateKey,
      weekKey,
      sections: {
        daily: await Promise.all(
          organization.tasks.listDaily().map((definition) => build(definition, true)),
        ),
        weekly: await Promise.all(
          organization.tasks.listWeekly().map((definition) => build(definition, false)),
        ),
        promotion: await Promise.all(
          organization.tasks.listPromotion().map((definition) => build(definition, false)),
        ),
      },
    };
  }
}

export class ProcessSectTaskCompletionHandler {
  constructor(private readonly events: SectDomainEventDispatcherFactory) {}

  async execute(args: {
    userId: string;
    cultivatorId: string;
    membership: SectMembershipRecord;
    definition: SectTaskDefinition;
    record: SectTaskRecord;
    context: SectCommandContext;
  }): Promise<SectTaskRecord> {
    const aggregate = SectTask.rehydrate({
      id: args.record.id,
      definitionId: args.record.taskId,
      membershipId: args.record.membershipId,
      kind: args.record.kind,
      periodKey: args.record.periodKey,
      target: Number(args.record.payload.target ?? args.definition.target),
      state: args.record.status,
      progress: args.record.progress,
    });
    if (!aggregate.complete()) invalid('该宗门任务已经完成');
    const completed = await args.context.tasks.complete(args.record.id, args.definition.target);
    if (!completed) invalid('该宗门任务已经完成');

    await this.events.forTask({
      userId: args.userId,
      cultivatorId: args.cultivatorId,
      membership: args.membership,
      command: args.context,
    }).dispatch(aggregate.pullEvents());
    return completed;
  }
}

export class ExecuteSectTaskActionHandler {
  constructor(
    private readonly executors: SectTaskExecutorRegistry,
    private readonly completion: ProcessSectTaskCompletionHandler,
    private readonly authorizer = new SectCapabilityAuthorizer(),
  ) {}

  async execute(
    command: {
      userId: string;
      cultivatorId: string;
      taskId: string;
      actionKey: string;
      requestId: string;
      input: Record<string, unknown>;
    },
    context: SectCommandContext,
  ): Promise<SectTaskActionData> {
    const membership = await requireMembership(command.cultivatorId, context);
    const organization = context.modules.require(membership.sectId);
    const definition = organization.tasks.get(command.taskId);
    if (!definition) invalid('未知宗门委托', 400);
    const execution = resolvedExecution(definition, context);
    const executor = this.executors.require(execution.executorKey);
    const capability = executor.requiredCapability(definition);
    this.authorizer.assertOrganization(
      organization,
      membership.discipleRank,
      capability,
    );
    const periodKey = taskPeriodKey(definition, context);

    if (command.actionKey === 'accept') {
      if (definition.kind !== 'daily') invalid('该任务不需要领取', 400);
      if (await context.tasks.findDaily(membership.id, periodKey))
        invalid('今日已经领取过宗门委托');
      const seed = [...`${membership.id}:${periodKey}`].reduce(
        (sum, char) => sum + char.charCodeAt(0),
        0,
      );
      const offered = SectTask.offered({
        id: `offered:${definition.id}`,
        definitionId: definition.id,
        membershipId: membership.id,
        kind: definition.kind,
        periodKey,
        target: definition.target,
      });
      offered.accept(periodKey);
      const record = await context.tasks.create({
        membershipId: membership.id,
        taskId: definition.id,
        kind: definition.kind,
        periodKey,
        payload: executor.prepareAcceptance(definition, {
          seed,
          parameters: execution.parameters,
        }),
      });
      return {
        task: toView({
          definition,
          record,
          executor,
          state: 'active',
          enabled: true,
        }),
        outcome: { renderer: 'sect.outcome.accepted', data: { accepted: true } },
      };
    }

    let record = await context.tasks.find(membership.id, periodKey, definition.id);
    if (!record) {
      if (definition.kind === 'daily') invalid('尚未领取对应宗门委托', 400);
      const seed = [...`${membership.id}:${periodKey}`].reduce(
        (sum, char) => sum + char.charCodeAt(0),
        0,
      );
      const offered = SectTask.offered({
        id: `offered:${definition.id}`,
        definitionId: definition.id,
        membershipId: membership.id,
        kind: definition.kind,
        periodKey,
        target: definition.target,
      });
      offered.accept(periodKey);
      record = await context.tasks.create({
        membershipId: membership.id,
        taskId: definition.id,
        kind: definition.kind,
        periodKey,
        payload: executor.prepareAcceptance(definition, {
          seed,
          parameters: execution.parameters,
        }),
      });
    }
    if (record.status === 'completed') invalid('该宗门任务已经完成');
    const parsed = executor.inputSchema(command.actionKey).safeParse(command.input);
    if (!parsed.success)
      invalid(parsed.error.issues[0]?.message ?? '任务操作参数无效', 400);
    const decision = await executor.execute(
      command.actionKey,
      {
        userId: command.userId,
        cultivatorId: command.cultivatorId,
        requestId: command.requestId,
        membership,
        record,
        definition,
        ports: context,
      },
      parsed.data,
    );
    if (decision.payload) {
      const updated = await context.tasks.updatePayload(record.id, decision.payload);
      if (!updated) invalid('任务状态已经变化，请重试');
      record = updated;
    }
    if (decision.completed)
      record = await this.completion.execute({
        userId: command.userId,
        cultivatorId: command.cultivatorId,
        membership,
        definition,
        record,
        context,
      });
    return {
      task: toView({
        definition,
        record,
        executor,
        state: record.status === 'completed' ? 'completed' : 'active',
        enabled: true,
      }),
      outcome: decision.outcome,
    };
  }
}
