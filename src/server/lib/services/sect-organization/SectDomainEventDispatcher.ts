import {
  ContributionBalance,
  SectTask,
  type SectDomainEvent,
} from '@shared/engine/sect';
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

type SectDomainEventType = SectDomainEvent['type'];
type SectDomainEventOf<TType extends SectDomainEventType> = Extract<
  SectDomainEvent,
  { type: TType }
>;
type SectDerivedEvents =
  | void
  | readonly SectDomainEvent[]
  | Promise<void | readonly SectDomainEvent[]>;

export interface SectDomainEventHandler<TType extends SectDomainEventType> {
  readonly eventType: TType;
  handle(event: SectDomainEventOf<TType>): SectDerivedEvents;
}

export type SectDomainEventHandlerContribution = {
  [TType in SectDomainEventType]: SectDomainEventHandler<TType>;
}[SectDomainEventType];

export function defineSectDomainEventHandler<TType extends SectDomainEventType>(
  eventType: TType,
  handle: (event: SectDomainEventOf<TType>) => SectDerivedEvents,
): SectDomainEventHandler<TType> {
  return { eventType, handle };
}

/** A command-bound FIFO dispatcher. Its handlers close over transaction-bound ports. */
export class SectDomainEventDispatcher {
  private readonly handlers = new Map<
    SectDomainEventType,
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

  async dispatch(initial: readonly SectDomainEvent[]): Promise<void> {
    const queue = [...initial];
    let processed = 0;
    while (queue.length > 0) {
      if (++processed > this.limit)
        organizationError(`单次宗门事务事件超过 ${this.limit} 个`, 500);
      const event = queue.shift()!;
      const handlers = this.handlers.get(event.type) ?? [];
      if (handlers.length === 0)
        organizationError(`宗门领域事件没有处理器：${event.type}`, 500);
      for (const handler of handlers) {
        const derived = await handler.handle(event as never);
        if (derived) queue.push(...derived);
      }
    }
  }
}

export interface SectDomainEventDispatcherFactory {
  forTask(args: {
    userId: string;
    cultivatorId: string;
    membership: SectMembershipRecord;
    command: SectCommandContext;
  }): SectDomainEventDispatcher;
  forMembership(command: SectMembershipCommandContext): SectDomainEventDispatcher;
  forShop(command: SectEconomyCommandContext): SectDomainEventDispatcher;
  forStipend(args: {
    userId: string;
    cultivatorId: string;
    command: SectEconomyCommandContext;
  }): SectDomainEventDispatcher;
  forConstruction(
    command: SectConstructionCommandContext,
  ): SectDomainEventDispatcher;
}

function taskDefinitions(command: SectCommandContext, membership: SectMembershipRecord) {
  const catalog = command.modules.require(membership.sectId).tasks;
  return [
    ...catalog.listDaily(),
    ...catalog.listWeekly(),
    ...catalog.listPromotion(),
  ];
}

function periodKey(
  kind: 'daily' | 'weekly' | 'promotion',
  command: SectCommandContext,
) {
  if (kind === 'daily') return command.clock.dateKey();
  if (kind === 'weekly') return command.clock.weekKey();
  return 'permanent';
}

class StandardSectDomainEventDispatcherFactory
  implements SectDomainEventDispatcherFactory
{
  constructor(
    private readonly settlements: SectTaskSettlementRegistry,
    private readonly progress: SectTaskProgressRegistry,
    private readonly rewards: SectRewardGrantStrategyRegistry,
    private readonly limit = 64,
  ) {}

  forTask(args: {
    userId: string;
    cultivatorId: string;
    membership: SectMembershipRecord;
    command: SectCommandContext;
  }): SectDomainEventDispatcher {
    const { command, membership } = args;
    return new SectDomainEventDispatcher([
      defineSectDomainEventHandler('SectTaskCompleted', async (event) => {
        const definition = command.modules
          .require(membership.sectId)
          .tasks.get(event.taskId);
        if (!definition)
          organizationError(`任务结算定义不存在：${event.taskId}`, 500);
        const derived: SectDomainEvent[] = [];
        for (const rule of definition.completion) {
          const strategy = this.settlements.require(rule.strategy);
          const parsed = strategy.inputSchema.safeParse(rule.input ?? {});
          if (!parsed.success)
            organizationError(`任务结算配置无效：${rule.strategy}`, 500);
          derived.push(
            ...(await strategy.settle(
              {
                userId: args.userId,
                cultivatorId: args.cultivatorId,
                membership,
                definition,
                taskRecordId: event.taskRecordId,
                ports: command,
              },
              parsed.data,
            )),
          );
        }
        return derived;
      }),
      defineSectDomainEventHandler('SectTaskProgressSignaled', async (event) => {
        const derived: SectDomainEvent[] = [];
        for (const definition of taskDefinitions(command, membership).filter(
          (candidate) => candidate.progress?.source === event.source,
        )) {
          const key = periodKey(definition.kind, command);
          const existing = await command.tasks.find(
            membership.id,
            key,
            definition.id,
          );
          if (existing?.status === 'completed') continue;
          const current = Math.min(
            definition.target,
            await this.progress.require(definition.progress!.strategy).current({
              membership,
              definition,
              context: command,
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
                membershipId: membership.id,
                kind: definition.kind,
                periodKey: key,
                target: definition.target,
              });
          if (!existing) aggregate.accept(key);
          if (aggregate.status() === 'active' && current > aggregate.progress())
            aggregate.advance(current - aggregate.progress());
          const completedNow =
            aggregate.status() === 'active' &&
            aggregate.progress() >= definition.target;
          if (completedNow) aggregate.complete();
          const row = await command.tasks.upsertProgress({
            membershipId: membership.id,
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
              membershipId: membership.id,
              kind: definition.kind,
            });
        }
        return derived;
      }),
      defineSectDomainEventHandler('SectContributionGranted', async (event) => {
        ContributionBalance.of(0).credit(event.amount);
        await command.rewards.grantContribution(
          event.membershipId,
          event.amount,
          event.reason,
          event.referenceId,
        );
      }),
      defineSectDomainEventHandler('SectSpiritStonesGranted', async (event) => {
        await command.rewards.grantSpiritStones(event.cultivatorId, event.amount);
      }),
      defineSectDomainEventHandler('SectCultivationExpGranted', async (event) => {
        await command.rewards.grantCultivationExp(
          event.userId,
          event.cultivatorId,
          event.amount,
        );
      }),
    ], this.limit);
  }

  forMembership(command: SectMembershipCommandContext): SectDomainEventDispatcher {
    return new SectDomainEventDispatcher([
      defineSectDomainEventHandler('SectMembershipPromoted', async (event) => {
        if (!(await command.memberships.promote(event.membershipId, event.rank)))
          organizationError('弟子职阶状态已经变化，请重试');
      }),
    ], this.limit);
  }

  forShop(command: SectEconomyCommandContext): SectDomainEventDispatcher {
    return new SectDomainEventDispatcher([
      defineSectDomainEventHandler('SectContributionSpent', async (event) => {
        if (
          !(await command.economy.spendContribution(
            event.membershipId,
            event.amount,
            event.reason,
            event.referenceId,
          ))
        )
          organizationError('宗门贡献不足', 400);
      }),
    ], this.limit);
  }

  forStipend(args: {
    userId: string;
    cultivatorId: string;
    command: SectEconomyCommandContext;
  }): SectDomainEventDispatcher {
    return new SectDomainEventDispatcher([
      defineSectDomainEventHandler('SectStipendClaimed', async (event) => {
        if (
          !(await args.command.economy.recordStipendClaim({
            membershipId: event.membershipId,
            weekKey: event.weekKey,
            spiritStones: event.rewardSnapshot.spiritStones,
            rewards: [...event.rewardSnapshot.rewards],
          }))
        )
          organizationError('本周俸禄已经领取');
        for (const reward of event.rewardSnapshot.rewards)
          await this.rewards.require(reward.grant.kind).grant({
            userId: args.userId,
            cultivatorId: args.cultivatorId,
            quantity: reward.quantity,
            grant: reward.grant,
            rewards: args.command.rewards,
            ids: args.command.ids,
            source: 'sect_stipend',
          });
      }),
    ], this.limit);
  }

  forConstruction(
    command: SectConstructionCommandContext,
  ): SectDomainEventDispatcher {
    return new SectDomainEventDispatcher([
      defineSectDomainEventHandler('SectDonationAccepted', async (event) => {
        const donation = await command.construction.recordDonation({
          id: event.donationId,
          membershipId: event.membershipId,
          projectId: event.projectId,
          dateKey: event.dateKey,
          demandId: event.demand.id,
          contribution: event.contribution,
          constructionPoints: event.constructionPoints,
          itemSnapshot: event.itemSnapshot,
        });
        if (!donation) organizationError('该笔捐献已经处理');
        if (
          !(await command.construction.saveProjectProgress(
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
      }),
      defineSectDomainEventHandler('SectContributionGranted', async (event) => {
        ContributionBalance.of(0).credit(event.amount);
        await command.construction.grantContribution(
          event.membershipId,
          event.amount,
          event.reason,
          event.referenceId,
        );
      }),
      defineSectDomainEventHandler('SectProjectCompleted', async (event) => {
        if (
          !(await command.construction.completeProject(
            event.projectId,
            command.clock.now(),
          ))
        )
          organizationError('工程完成状态已经变化，请重试');
      }),
      defineSectDomainEventHandler('SectFacilityUpgraded', async (event) => {
        if (
          !(await command.construction.upgradeFacility(
            event.sectId,
            event.facilityKey,
            event.level,
          ))
        )
          organizationError('设施等级已经变化，请重试');
      }),
    ], this.limit);
  }
}

export function createStandardSectDomainEventDispatcher(args: {
  settlements: SectTaskSettlementRegistry;
  progress: SectTaskProgressRegistry;
  rewards: SectRewardGrantStrategyRegistry;
  limit?: number;
}): SectDomainEventDispatcherFactory {
  return new StandardSectDomainEventDispatcherFactory(
    args.settlements,
    args.progress,
    args.rewards,
    args.limit,
  );
}
