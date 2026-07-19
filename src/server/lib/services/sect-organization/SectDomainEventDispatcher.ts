import {
  SectTask,
  type SectDomainEvent,
  type SectDonationDemandDefinition,
} from '@shared/engine/sect';
import type { SectStipendQuote } from './applicationSupport';
import { organizationError } from './applicationSupport';
import type { SectRewardGrantStrategyRegistry } from './EconomyStrategies';
import type {
  SectCommandContext,
  SectConstructionCommandContext,
  SectEconomyCommandContext,
  SectMembershipCommandContext,
  SectMembershipRecord,
} from './ports';
import type {
  SectTaskProgressRegistry,
  SectTaskSettlementRegistry,
} from './SectTaskSettlement';

export type SectDomainEventDispatchContext =
  | {
      scope: 'task';
      userId: string;
      cultivatorId: string;
      membership: SectMembershipRecord;
      command: SectCommandContext;
    }
  | {
      scope: 'membership';
      command: SectMembershipCommandContext;
    }
  | {
      scope: 'shop';
      command: SectEconomyCommandContext;
    }
  | {
      scope: 'stipend';
      userId: string;
      cultivatorId: string;
      quote: SectStipendQuote;
      command: SectEconomyCommandContext;
    }
  | {
      scope: 'construction';
      dateKey: string;
      demand: SectDonationDemandDefinition;
      itemSnapshot: Record<string, unknown>;
      state: { donationId?: string };
      command: SectConstructionCommandContext;
    };

export interface SectDomainEventHandlerContribution {
  readonly eventType: SectDomainEvent['type'];
  handle(
    event: SectDomainEvent,
    context: SectDomainEventDispatchContext,
  ): void | readonly SectDomainEvent[] | Promise<void | readonly SectDomainEvent[]>;
}

export class SectDomainEventDispatcher {
  private readonly handlers = new Map<
    SectDomainEvent['type'],
    SectDomainEventHandlerContribution[]
  >();

  constructor(
    contributions: readonly SectDomainEventHandlerContribution[],
    private readonly limit = 64,
  ) {
    for (const contribution of contributions) {
      const registered = this.handlers.get(contribution.eventType) ?? [];
      registered.push(contribution);
      this.handlers.set(contribution.eventType, registered);
    }
  }

  async dispatch(
    initial: readonly SectDomainEvent[],
    context: SectDomainEventDispatchContext,
  ): Promise<void> {
    const queue = [...initial];
    let processed = 0;
    while (queue.length > 0) {
      if (++processed > this.limit)
        organizationError(`单次宗门事务事件超过 ${this.limit} 个`, 500);
      const event = queue.shift()!;
      for (const handler of this.handlers.get(event.type) ?? []) {
        const derived = await handler.handle(event, context);
        if (derived) queue.push(...derived);
      }
    }
  }
}

function taskDefinitions(context: Extract<SectDomainEventDispatchContext, { scope: 'task' }>) {
  const catalog = context.command.modules.require(context.membership.sectId).tasks;
  return [
    ...catalog.listDaily(),
    ...catalog.listWeekly(),
    ...catalog.listPromotion(),
  ];
}

function periodKey(
  kind: 'daily' | 'weekly' | 'promotion',
  context: Extract<SectDomainEventDispatchContext, { scope: 'task' }>,
) {
  if (kind === 'daily') return context.command.clock.dateKey();
  if (kind === 'weekly') return context.command.clock.weekKey();
  return 'permanent';
}

export function createStandardSectDomainEventDispatcher(args: {
  settlements: SectTaskSettlementRegistry;
  progress: SectTaskProgressRegistry;
  rewards: SectRewardGrantStrategyRegistry;
  contributions?: readonly SectDomainEventHandlerContribution[];
  limit?: number;
}) {
  const core: SectDomainEventHandlerContribution[] = [
    {
      eventType: 'SectTaskCompleted',
      async handle(event, context) {
        if (event.type !== 'SectTaskCompleted' || context.scope !== 'task') return;
        const definition = context.command.modules
          .require(context.membership.sectId)
          .tasks.get(event.taskId);
        if (!definition) organizationError(`任务结算定义不存在：${event.taskId}`, 500);
        const derived: SectDomainEvent[] = [];
        for (const rule of definition.completion) {
          const strategy = args.settlements.require(rule.strategy);
          const parsed = strategy.inputSchema.safeParse(rule.input ?? {});
          if (!parsed.success)
            organizationError(`任务结算配置无效：${rule.strategy}`, 500);
          derived.push(
            ...(await strategy.settle(
              {
                userId: context.userId,
                cultivatorId: context.cultivatorId,
                membership: context.membership,
                definition,
                taskRecordId: event.taskRecordId,
                ports: context.command,
              },
              parsed.data,
            )),
          );
        }
        return derived;
      },
    },
    {
      eventType: 'SectTaskProgressSignaled',
      async handle(event, context) {
        if (event.type !== 'SectTaskProgressSignaled' || context.scope !== 'task') return;
        const derived: SectDomainEvent[] = [];
        for (const definition of taskDefinitions(context).filter(
          (candidate) => candidate.progress?.source === event.source,
        )) {
          const key = periodKey(definition.kind, context);
          const existing = await context.command.tasks.find(
            context.membership.id,
            key,
            definition.id,
          );
          if (existing?.status === 'completed') continue;
          const current = Math.min(
            definition.target,
            await args.progress.require(definition.progress!.strategy).current({
              membership: context.membership,
              definition,
              context: context.command,
            }),
          );
          const aggregate = existing
            ? SectTask.rehydrate({
                id: existing.id,
                definitionId: existing.taskId,
                membershipId: existing.membershipId,
                kind: existing.kind,
                periodKey: existing.periodKey,
                target: definition.target,
                state: existing.status,
                progress: existing.progress,
              })
            : SectTask.offered({
                id: `progress:${definition.id}:${key}`,
                definitionId: definition.id,
                membershipId: context.membership.id,
                kind: definition.kind,
                periodKey: key,
                target: definition.target,
              });
          if (!existing) aggregate.accept(key);
          if (aggregate.status() === 'active' && current > aggregate.progress())
            aggregate.advance(current - aggregate.progress());
          const completedNow =
            aggregate.status() === 'active' && aggregate.progress() >= definition.target;
          if (completedNow) aggregate.complete();
          const row = await context.command.tasks.upsertProgress({
            membershipId: context.membership.id,
            taskId: definition.id,
            kind: definition.kind === 'promotion' ? 'promotion' : 'weekly',
            periodKey: key,
            progress: aggregate.progress(),
            target: definition.target,
            completed: aggregate.status() === 'completed',
            payload: { target: definition.target },
          });
          aggregate.pullEvents();
          if (completedNow)
            derived.push({
              type: 'SectTaskCompleted',
              taskId: definition.id,
              taskRecordId: row.id,
              membershipId: context.membership.id,
              kind: definition.kind,
            });
        }
        return derived;
      },
    },
    {
      eventType: 'SectContributionGranted',
      async handle(event, context) {
        if (event.type !== 'SectContributionGranted') return;
        if (context.scope === 'task')
          await context.command.rewards.grantContribution(
            event.membershipId,
            event.amount,
            event.reason,
            event.referenceId,
          );
        else if (context.scope === 'construction')
          await context.command.construction.grantContribution(
            event.membershipId,
            event.amount,
            event.reason,
            event.referenceId,
          );
      },
    },
    {
      eventType: 'SectSpiritStonesGranted',
      async handle(event, context) {
        if (event.type !== 'SectSpiritStonesGranted' || context.scope !== 'task') return;
        await context.command.rewards.grantSpiritStones(
          event.cultivatorId,
          event.amount,
        );
      },
    },
    {
      eventType: 'SectCultivationExpGranted',
      async handle(event, context) {
        if (event.type !== 'SectCultivationExpGranted' || context.scope !== 'task') return;
        await context.command.rewards.grantCultivationExp(
          event.userId,
          event.cultivatorId,
          event.amount,
        );
      },
    },
    {
      eventType: 'SectMembershipPromoted',
      async handle(event, context) {
        if (event.type !== 'SectMembershipPromoted' || context.scope !== 'membership') return;
        if (!(await context.command.memberships.promote(event.membershipId, event.rank)))
          organizationError('弟子职阶状态已经变化，请重试');
      },
    },
    {
      eventType: 'SectContributionSpent',
      async handle(event, context) {
        if (event.type !== 'SectContributionSpent' || context.scope !== 'shop') return;
        if (
          !(await context.command.economy.spendContribution(
            event.membershipId,
            event.amount,
            event.reason,
            event.referenceId,
          ))
        )
          organizationError('宗门贡献不足', 400);
      },
    },
    {
      eventType: 'SectStipendClaimed',
      async handle(event, context) {
        if (event.type !== 'SectStipendClaimed' || context.scope !== 'stipend') return;
        if (
          !(await context.command.economy.recordStipendClaim({
            membershipId: event.membershipId,
            weekKey: event.weekKey,
            spiritStones: context.quote.spiritStones,
            rewards: [...context.quote.rewards],
          }))
        )
          organizationError('本周俸禄已经领取');
        for (const reward of context.quote.rewards)
          await args.rewards.require(reward.grant.kind).grant({
            userId: context.userId,
            cultivatorId: context.cultivatorId,
            quantity: reward.quantity,
            grant: reward.grant,
            rewards: context.command.rewards,
            ids: context.command.ids,
            source: 'sect_stipend',
          });
      },
    },
    {
      eventType: 'SectDonationAccepted',
      async handle(event, context) {
        if (event.type !== 'SectDonationAccepted' || context.scope !== 'construction') return;
        const donation = await context.command.construction.recordDonation({
          membershipId: event.membershipId,
          projectId: event.projectId,
          dateKey: context.dateKey,
          demandId: context.demand.id,
          contribution: event.contribution,
          constructionPoints: event.constructionPoints,
          itemSnapshot: context.itemSnapshot,
        });
        if (!donation) organizationError('该笔捐献已经处理');
        context.state.donationId = donation.id;
        if (
          !(await context.command.construction.saveProjectProgress(
            event.projectId,
            event.projectProgress,
          ))
        )
          organizationError('工程状态已变化，请重试');
        return [{
          type: 'SectContributionGranted',
          membershipId: event.membershipId,
          amount: event.contribution,
          reason: 'construction_donation',
          referenceId: donation.id,
        }];
      },
    },
    {
      eventType: 'SectProjectCompleted',
      async handle(event, context) {
        if (event.type !== 'SectProjectCompleted' || context.scope !== 'construction') return;
        if (
          !(await context.command.construction.completeProject(
            event.projectId,
            context.command.clock.now(),
          ))
        )
          organizationError('工程完成状态已经变化，请重试');
      },
    },
    {
      eventType: 'SectFacilityUpgraded',
      async handle(event, context) {
        if (event.type !== 'SectFacilityUpgraded' || context.scope !== 'construction') return;
        if (
          !(await context.command.construction.upgradeFacility(
            event.sectId,
            event.facilityKey,
            event.level,
          ))
        )
          organizationError('设施等级已经变化，请重试');
      },
    },
  ];
  return new SectDomainEventDispatcher(
    [...core, ...(args.contributions ?? [])],
    args.limit,
  );
}
