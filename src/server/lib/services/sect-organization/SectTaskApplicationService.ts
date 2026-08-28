import type { ResourceChangeDescriptor } from '@shared/contracts/resources';
import type { SectTaskActionData } from '@shared/contracts/sect';
import {
  SECT_TASK_ABANDON_COOLDOWN_MS,
  SectTask,
  SectTaskRecordPayloadSchema,
  resolveSectTaskAbandonAvailability,
  type SectTaskDefinition,
} from '@shared/engine/sect';
import { z } from 'zod';
import { ClaimSectTaskRewardHandler } from './ClaimSectTaskRewardHandler';
import { SectCapabilityAuthorizer } from './SectCapabilityAuthorizer';
import {
  emptySectCommandEffects,
  mergeSectCommandEffects,
  type SectCommandEffects,
} from './SectCommandEffects';
import type { SectDomainEventDispatcherFactory } from './SectDomainEventDispatcher';
import {
  invalidSectTask,
  requireSectMembership,
  resolveCurrentSectTaskExecution,
  sectTaskPeriodKey,
} from './SectTaskApplicationSupport';
import { SectTaskOfferService } from './SectTaskOfferService';
import type {
  SectTaskOfferPolicyRegistry,
  SectTaskRewardPolicyRegistry,
} from './SectTaskSettlement';
import {
  toSectTaskView,
  toUnpersistedSectTaskView,
} from './SectTaskViewAssembler';
import type {
  SectCommandContext,
  SectMembershipRecord,
  SectTaskRecord,
} from './ports';
import type { SectTaskExecutorRegistry } from './task-executors/SectTaskExecutor';

export class FulfillSectTaskHandler {
  constructor(private readonly events: SectDomainEventDispatcherFactory) {}

  async execute(args: {
    userId: string;
    cultivatorId: string;
    membership: SectMembershipRecord;
    definition: SectTaskDefinition;
    record: SectTaskRecord;
    context: SectCommandContext;
    completionSource?: {
      kind: 'task_action' | 'dungeon_run';
      id: string;
      mapNodeId?: string;
      rootActivityId?: string;
    };
  }): Promise<{
    record: SectTaskRecord;
    changedTaskRecords: SectTaskRecord[];
    effects: SectCommandEffects;
  }> {
    const aggregate = SectTask.rehydrate({
      id: args.record.id,
      definitionId: args.record.taskId,
      membershipId: args.record.membershipId,
      kind: args.record.kind,
      periodKey: args.record.periodKey,
      target: args.record.payload.target,
      state: 'active',
      progress: args.record.progress,
    });
    if (!aggregate.complete()) invalidSectTask('该宗门任务已经达成');
    const completed = await args.context.tasks.complete(
      args.record.id,
      args.definition.target,
    );
    if (!completed) invalidSectTask('该宗门任务已经达成');
    const dispatcher = this.events.forTask({
      userId: args.userId,
      cultivatorId: args.cultivatorId,
      membership: args.membership,
      command: args.context,
      completionSource: args.completionSource,
    });
    const effects = await dispatcher.dispatch(aggregate.pullEvents());
    return {
      record: completed,
      changedTaskRecords: dispatcher.changedTaskRecords,
      effects,
    };
  }
}

const acceptInput = z.object({}).strict();

export class ExecuteSectTaskActionHandler {
  private readonly offers: SectTaskOfferService;

  constructor(
    private readonly executors: SectTaskExecutorRegistry,
    private readonly fulfillment: FulfillSectTaskHandler,
    private readonly claims: ClaimSectTaskRewardHandler,
    offerPolicies: SectTaskOfferPolicyRegistry,
    rewardPolicies: SectTaskRewardPolicyRegistry,
    private readonly authorizer = new SectCapabilityAuthorizer(),
  ) {
    this.offers = new SectTaskOfferService(offerPolicies, rewardPolicies);
  }

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
  ): Promise<{
    result: SectTaskActionData;
    resourceChanges: ResourceChangeDescriptor[];
  }> {
    const membership = await requireSectMembership(
      command.cultivatorId,
      context,
    );
    const organization = context.modules.require(membership.sectId);
    const definition = organization.tasks.get(command.taskId);
    if (!definition) invalidSectTask('未知宗门委托', 400);
    const periodKey = sectTaskPeriodKey(definition, context);
    let record = await context.tasks.find(
      membership.id,
      periodKey,
      definition.id,
    );

    if (command.actionKey === 'accept') {
      if (definition.enrollment !== 'manual')
        invalidSectTask('该任务不需要领取', 400);
      const execution = record
        ? undefined
        : resolveCurrentSectTaskExecution(definition, context);
      const executor = this.executors.require(
        record?.payload.offer.executorKey ?? execution!.executorKey,
      );
      this.authorizer.assertOrganization(
        organization,
        membership.discipleRank,
        executor.requiredCapability(definition),
      );
      const parsed = acceptInput.safeParse(command.input);
      if (!parsed.success) invalidSectTask('领取参数无效', 400);
      if (record) {
        const primaryTask = toSectTaskView({
          definition,
          record,
          executor,
          now: context.clock.now(),
          state: record.claimedAt
            ? 'claimed'
            : record.status === 'completed'
              ? 'claimable'
              : 'active',
          enabled: true,
        });
        return this.complete({
          primaryTask,
          changedTasks: [primaryTask],
          outcome: {
            renderer: 'sect.outcome.accepted',
            data: { accepted: true },
          },
        });
      }
      const progress = await context.cultivators.loadProgress(
        command.cultivatorId,
      );
      if (!progress) invalidSectTask('角色境界状态不存在', 500);
      const attempt = await context.tasks.nextAttempt(
        membership.id,
        periodKey,
        definition.id,
      );
      const offer = this.offers.create({
        definition,
        membershipId: membership.id,
        periodKey,
        attempt,
        realm: progress.realm,
        realmStage: progress.stage,
        executorKey: execution!.executorKey,
        offer: execution!.offer,
      });
      const payload = await executor.initializePayload({
        userId: command.userId,
        cultivatorId: command.cultivatorId,
        requestId: command.requestId,
        membership,
        definition,
        payload: this.offers.payload(definition, offer),
        ports: context,
      });
      record = await context.tasks.create({
        membershipId: membership.id,
        taskId: definition.id,
        kind: definition.kind,
        periodKey,
        attempt,
        payload,
      });
      const primaryTask = toSectTaskView({
        definition,
        record,
        executor,
        now: context.clock.now(),
        state: 'active',
        enabled: true,
      });
      return this.complete({
        primaryTask,
        changedTasks: [primaryTask],
        outcome: {
          renderer: 'sect.outcome.accepted',
          data: { accepted: true },
        },
      });
    }

    let executor;
    if (!record) {
      const execution = resolveCurrentSectTaskExecution(definition, context);
      executor = this.executors.require(execution.executorKey);
      this.authorizer.assertOrganization(
        organization,
        membership.discipleRank,
        executor.requiredCapability(definition),
      );
      if (definition.enrollment === 'manual')
        invalidSectTask('尚未领取对应宗门委托', 400);
      const progress = await context.cultivators.loadProgress(
        command.cultivatorId,
      );
      if (!progress) invalidSectTask('角色境界状态不存在', 500);
      const attempt = await context.tasks.nextAttempt(
        membership.id,
        periodKey,
        definition.id,
      );
      const offer = this.offers.create({
        definition,
        membershipId: membership.id,
        periodKey,
        attempt,
        realm: progress.realm,
        realmStage: progress.stage,
        executorKey: execution.executorKey,
        offer: execution.offer,
      });
      const payload = await executor.initializePayload({
        userId: command.userId,
        cultivatorId: command.cultivatorId,
        requestId: command.requestId,
        membership,
        definition,
        payload: this.offers.payload(definition, offer),
        ports: context,
      });
      record = await context.tasks.create({
        membershipId: membership.id,
        taskId: definition.id,
        kind: definition.kind,
        periodKey,
        attempt,
        payload,
      });
    } else {
      executor = this.executors.require(record.payload.offer.executorKey);
      this.authorizer.assertOrganization(
        organization,
        membership.discipleRank,
        executor.requiredCapability(definition),
      );
    }

    if (command.actionKey === 'claim') {
      const claimed = await this.claims.execute({
        command,
        context,
        membership,
        definition,
        executor,
        record,
      });
      return this.complete(claimed.result, claimed.effects);
    }
    if (command.actionKey === 'abandon') {
      if (definition.enrollment !== 'manual')
        invalidSectTask('该任务不支持放弃', 400);
      if (record.status !== 'active')
        invalidSectTask(
          record.claimedAt ? '该宗门任务已经结清' : '已完成任务无法放弃',
        );
      if (!acceptInput.safeParse(command.input).success)
        invalidSectTask('放弃参数无效', 400);
      const now = context.clock.now();
      const availability = resolveSectTaskAbandonAvailability(
        record.createdAt,
        now,
      );
      if (!availability.allowed) {
        const remainingMinutes = Math.max(
          1,
          Math.ceil(availability.remainingMs / 60_000),
        );
        invalidSectTask(
          `领取满 15 分钟后方可放弃，还需等待约 ${remainingMinutes} 分钟`,
        );
      }
      const acceptedBefore = new Date(
        now.getTime() - SECT_TASK_ABANDON_COOLDOWN_MS,
      );
      if (!(await context.tasks.abandon(record.id, acceptedBefore)))
        invalidSectTask('任务状态已经变化，请重试');
      const primaryTask = toUnpersistedSectTaskView({
        definition,
        periodKey,
        state: 'offered',
        enabled: true,
      });
      return this.complete({
        primaryTask,
        changedTasks: [primaryTask],
        outcome: {
          renderer: 'sect.outcome.abandoned',
          data: { abandoned: true },
        },
      });
    }
    if (record.status === 'completed')
      invalidSectTask(
        record.claimedAt ? '该宗门任务已经结清' : '该宗门任务奖励待领取',
      );
    const parsed = executor
      .inputSchema(command.actionKey)
      .safeParse(command.input);
    if (!parsed.success)
      invalidSectTask(
        parsed.error.issues[0]?.message ?? '任务操作参数无效',
        400,
      );
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
    if (!decision.completed && decision.completionSettlement === 'claim-reward')
      invalidSectTask('未达成的宗门任务不能结算奖励', 500);
    if (decision.payload) {
      const updated = await context.tasks.updatePayload(
        record.id,
        SectTaskRecordPayloadSchema.parse(decision.payload),
      );
      if (!updated) invalidSectTask('任务状态已经变化，请重试');
      record = updated;
    }
    let linkedTaskRecords: SectTaskRecord[] = [];
    let effects = decision.effects ?? emptySectCommandEffects();
    if (decision.completed) {
      const fulfilled = await this.fulfillment.execute({
        userId: command.userId,
        cultivatorId: command.cultivatorId,
        membership,
        definition,
        record,
        context,
        completionSource: {
          kind: 'task_action',
          id: command.requestId,
        },
      });
      record = fulfilled.record;
      effects = mergeSectCommandEffects(effects, fulfilled.effects);
      linkedTaskRecords = fulfilled.changedTaskRecords;
      const linkedTasks = this.toChangedTaskViews(
        linkedTaskRecords,
        organization,
        context.clock.now(),
      );
      if (decision.completionSettlement === 'claim-reward') {
        const claimed = await this.claims.execute({
          command,
          context,
          membership,
          definition,
          executor,
          record,
          changedTasks: linkedTasks,
        });
        return this.complete(
          claimed.result,
          mergeSectCommandEffects(effects, claimed.effects),
        );
      }
    }
    const primaryTask = toSectTaskView({
      definition,
      record,
      executor,
      now: context.clock.now(),
      state: record.status === 'completed' ? 'claimable' : 'active',
      enabled: true,
    });
    return this.complete(
      {
        primaryTask,
        changedTasks: mergeChangedTasks(
          primaryTask,
          this.toChangedTaskViews(
            linkedTaskRecords,
            organization,
            context.clock.now(),
          ),
        ),
        outcome: decision.outcome,
      },
      effects,
    );
  }

  private complete(
    data: Omit<SectTaskActionData, 'settlement'> | SectTaskActionData,
    effects: SectCommandEffects = emptySectCommandEffects(),
  ): {
    result: SectTaskActionData;
    resourceChanges: ResourceChangeDescriptor[];
  } {
    const result: SectTaskActionData = {
      ...data,
      settlement: effects.settlement,
    };
    return {
      result,
      resourceChanges: [
        {
          resourceTopic: 'sect.tasks',
          eventType: 'sect.task_action',
          operation: 'upsert-items',
          payload: {
            items: result.changedTasks,
            idKey: 'definitionId',
          },
        },
        ...effects.resourceChanges,
      ],
    };
  }

  private toChangedTaskViews(
    records: readonly SectTaskRecord[],
    organization: ReturnType<SectCommandContext['modules']['require']>,
    now: Date,
  ) {
    return records.map((record) => {
      const definition = organization.tasks.get(record.taskId);
      if (!definition)
        invalidSectTask(`联动任务定义不存在：${record.taskId}`, 500);
      return toSectTaskView({
        definition,
        record,
        executor: this.executors.require(record.payload.offer.executorKey),
        now,
        state: record.claimedAt
          ? 'claimed'
          : record.status === 'completed'
            ? 'claimable'
            : 'active',
        enabled: true,
      });
    });
  }
}

function mergeChangedTasks(
  primaryTask: SectTaskActionData['primaryTask'],
  linkedTasks: SectTaskActionData['changedTasks'],
): SectTaskActionData['changedTasks'] {
  const tasks = new Map(linkedTasks.map((task) => [task.definitionId, task]));
  tasks.set(primaryTask.definitionId, primaryTask);
  return [...tasks.values()];
}
