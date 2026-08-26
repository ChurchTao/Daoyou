import {
  ContributionBalance,
  SectTask,
  type SectDomainEvent,
} from '@shared/engine/sect';
import { organizationError } from './applicationSupport';
import type { SectTaskItemRewardGrantStrategyRegistry } from './TaskRewardStrategies';
import type {
  SectCommandContext,
  SectEconomyCommandContext,
  SectMembershipCommandContext,
  SectMembershipRecord,
  SectTaskRecord,
} from './ports';
import {
  emptySectCommandEffects,
  mergeSectCommandEffects,
  type SectCommandEffects,
} from './SectCommandEffects';
import { resolveCurrentSectTaskExecution } from './SectTaskApplicationSupport';
import { SectTaskOfferService } from './SectTaskOfferService';
import type {
  SectTaskFulfillmentRegistry,
  SectTaskOfferPolicyRegistry,
  SectTaskProgressRegistry,
  SectTaskRewardPolicyRegistry,
} from './SectTaskSettlement';

type SectDomainEventType = SectDomainEvent['type'];
type SectDomainEventOf<TType extends SectDomainEventType> = Extract<
  SectDomainEvent,
  { type: TType }
>;
type SectDerivedEvents =
  | void
  | readonly SectDomainEvent[]
  | {
      events?: readonly SectDomainEvent[];
      effects?: SectCommandEffects;
    }
  | Promise<
      | void
      | readonly SectDomainEvent[]
      | {
          events?: readonly SectDomainEvent[];
          effects?: SectCommandEffects;
        }
    >;

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

  async dispatch(
    initial: readonly SectDomainEvent[],
  ): Promise<SectCommandEffects> {
    const queue = [...initial];
    let effects = emptySectCommandEffects();
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
        if (Array.isArray(derived)) {
          queue.push(...derived);
        } else if (derived) {
          const result = derived as {
            events?: readonly SectDomainEvent[];
            effects?: SectCommandEffects;
          };
          if (result.events) queue.push(...result.events);
          effects = mergeSectCommandEffects(effects, result.effects);
        }
      }
    }
    return effects;
  }
}

export class SectTaskDomainEventDispatcher extends SectDomainEventDispatcher {
  readonly changedTaskRecords: SectTaskRecord[] = [];
}

export interface SectDomainEventDispatcherFactory {
  forTask(args: {
    userId: string;
    cultivatorId: string;
    membership: SectMembershipRecord;
    command: SectCommandContext;
  }): SectTaskDomainEventDispatcher;
  forMembership(
    command: SectMembershipCommandContext,
  ): SectDomainEventDispatcher;
  forShop(command: SectEconomyCommandContext): SectDomainEventDispatcher;
  forStipend(args: {
    cultivatorId: string;
    command: SectEconomyCommandContext;
  }): SectDomainEventDispatcher;
}

function taskDefinitions(
  command: SectCommandContext,
  membership: SectMembershipRecord,
) {
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

class StandardSectDomainEventDispatcherFactory implements SectDomainEventDispatcherFactory {
  constructor(
    private readonly fulfillments: SectTaskFulfillmentRegistry,
    private readonly progress: SectTaskProgressRegistry,
    private readonly rewards: SectTaskItemRewardGrantStrategyRegistry,
    private readonly offers: SectTaskOfferService,
    private readonly limit = 64,
  ) {}

  forTask(args: {
    userId: string;
    cultivatorId: string;
    membership: SectMembershipRecord;
    command: SectCommandContext;
  }): SectTaskDomainEventDispatcher {
    const { command, membership } = args;
    const dispatcher = new SectTaskDomainEventDispatcher(
      [
        defineSectDomainEventHandler('SectTaskFulfilled', async (event) => {
          const definition = command.modules
            .require(membership.sectId)
            .tasks.get(event.taskId);
          if (!definition)
            organizationError(`任务结算定义不存在：${event.taskId}`, 500);
          const derived: SectDomainEvent[] = [];
          for (const rule of definition.fulfillment) {
            const strategy = this.fulfillments.require(rule.strategy);
            const parsed = strategy.inputSchema.safeParse(rule.input ?? {});
            if (!parsed.success)
              organizationError(`任务结算配置无效：${rule.strategy}`, 500);
            derived.push(
              ...(await strategy.apply(
                {
                  membership,
                  definition,
                  taskRecordId: event.taskRecordId,
                },
                parsed.data,
              )),
            );
          }
          return derived;
        }),
        defineSectDomainEventHandler(
          'SectTaskProgressSignaled',
          async (event) => {
            const derived: SectDomainEvent[] = [];
            for (const definition of taskDefinitions(
              command,
              membership,
            ).filter(
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
                await this.progress
                  .require(definition.progress!.strategy)
                  .current({
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
                    state: 'active',
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
              if (
                aggregate.status() === 'active' &&
                current > aggregate.progress()
              )
                aggregate.advance(current - aggregate.progress());
              const completedNow =
                aggregate.status() === 'active' &&
                aggregate.progress() >= definition.target;
              if (completedNow) aggregate.complete();
              let payload;
              if (existing) {
                payload = existing.payload;
              } else {
                const progressFacts = await command.cultivators.loadProgress(
                  args.cultivatorId,
                );
                if (!progressFacts)
                  organizationError('角色境界状态不存在', 500);
                const execution = resolveCurrentSectTaskExecution(
                  definition,
                  command,
                );
                payload = this.offers.payload(
                  definition,
                  this.offers.create({
                    definition,
                    membershipId: membership.id,
                    periodKey: key,
                    attempt: 1,
                    realm: progressFacts.realm,
                    realmStage: progressFacts.stage,
                    executorKey: execution.executorKey,
                    offer: execution.offer,
                  }),
                );
              }
              const row = await command.tasks.upsertProgress({
                membershipId: membership.id,
                taskId: definition.id,
                kind: definition.kind === 'promotion' ? 'promotion' : 'weekly',
                periodKey: key,
                progress: aggregate.progress(),
                target: definition.target,
                completed: aggregate.status() === 'claimable',
                payload,
              });
              dispatcher.changedTaskRecords.push(row);
              aggregate.pullEvents();
              if (completedNow)
                derived.push({
                  type: 'SectTaskFulfilled',
                  taskId: definition.id,
                  taskRecordId: row.id,
                  membershipId: membership.id,
                  kind: definition.kind,
                });
            }
            return derived;
          },
        ),
        defineSectDomainEventHandler('SectTaskRewardClaimed', async (event) => {
          const reward = event.reward;
          if (!reward) return [];
          const events: SectDomainEvent[] = [
            ...(reward.contribution > 0
              ? [
                  {
                    type: 'SectContributionGranted' as const,
                    membershipId: event.membershipId,
                    amount: reward.contribution,
                    reason: 'sect_task_reward',
                    referenceId: event.taskRecordId,
                  },
                ]
              : []),
            ...(reward.spiritStones > 0
              ? [
                  {
                    type: 'SectSpiritStonesGranted' as const,
                    cultivatorId: event.cultivatorId,
                    amount: reward.spiritStones,
                  },
                ]
              : []),
            ...(reward.cultivationExp > 0
              ? [
                  {
                    type: 'SectCultivationExpGranted' as const,
                    userId: event.userId,
                    cultivatorId: event.cultivatorId,
                    amount: reward.cultivationExp,
                  },
                ]
              : []),
          ];
          let effects = emptySectCommandEffects();
          for (const item of reward.grants) {
            effects = mergeSectCommandEffects(
              effects,
              await this.rewards.require(item.grant.kind).grant({
                cultivatorId: event.cultivatorId,
                quantity: item.quantity,
                grant: item.grant,
                rewards: command.rewards,
                source: 'sect_task',
              }),
            );
          }
          return { events, effects };
        }),
        defineSectDomainEventHandler(
          'SectContributionGranted',
          async (event) => {
            ContributionBalance.of(0).credit(event.amount);
            const granted = await command.rewards.grantContribution(
              event.membershipId,
              event.amount,
              event.reason,
              event.referenceId,
            );
            return { effects: granted.effects };
          },
        ),
        defineSectDomainEventHandler(
          'SectSpiritStonesGranted',
          async (event) => {
            const granted = await command.rewards.grantSpiritStones(
              event.cultivatorId,
              event.amount,
            );
            return { effects: granted.effects };
          },
        ),
        defineSectDomainEventHandler(
          'SectCultivationExpGranted',
          async (event) => {
            const granted = await command.rewards.grantCultivationExp(
              event.userId,
              event.cultivatorId,
              event.amount,
            );
            return { effects: granted.effects };
          },
        ),
      ],
      this.limit,
    );
    return dispatcher;
  }

  forMembership(
    command: SectMembershipCommandContext,
  ): SectDomainEventDispatcher {
    return new SectDomainEventDispatcher(
      [
        defineSectDomainEventHandler(
          'SectMembershipPromoted',
          async (event) => {
            if (
              !(await command.memberships.promote(
                event.membershipId,
                event.rank,
              ))
            )
              organizationError('弟子职阶状态已经变化，请重试');
          },
        ),
      ],
      this.limit,
    );
  }

  forShop(command: SectEconomyCommandContext): SectDomainEventDispatcher {
    return new SectDomainEventDispatcher(
      [
        defineSectDomainEventHandler('SectContributionSpent', async (event) => {
          const balance = await command.economy.spendContribution(
            event.membershipId,
            event.amount,
            event.reason,
            event.referenceId,
          );
          if (balance === null) organizationError('宗门贡献不足', 400);
          const effects = emptySectCommandEffects();
          effects.settlement.contribution = balance.contribution;
          effects.resourceChanges.push({
            resourceTopic: 'sect.membership',
            eventType: 'sect.shop_contribution_spent',
            operation: 'merge',
            payload: {
              contribution: balance.contribution,
              lifetimeContribution: balance.lifetimeContribution,
            },
          });
          return { effects };
        }),
      ],
      this.limit,
    );
  }

  forStipend(args: {
    cultivatorId: string;
    command: SectEconomyCommandContext;
  }): SectDomainEventDispatcher {
    return new SectDomainEventDispatcher(
      [
        defineSectDomainEventHandler('SectStipendClaimed', async (event) => {
          if (
            !(await args.command.economy.recordStipendClaim({
              membershipId: event.membershipId,
              weekKey: event.weekKey,
              spiritStones: event.rewardSnapshot.spiritStones,
            }))
          )
            organizationError('本周俸禄已经领取');
          return {
            effects: (
              await args.command.rewards.grantSpiritStones(
                args.cultivatorId,
                event.rewardSnapshot.spiritStones,
                'sect_stipend',
              )
            ).effects,
          };
        }),
      ],
      this.limit,
    );
  }

}

export function createStandardSectDomainEventDispatcher(args: {
  fulfillments: SectTaskFulfillmentRegistry;
  progress: SectTaskProgressRegistry;
  rewards: SectTaskItemRewardGrantStrategyRegistry;
  offerPolicies: SectTaskOfferPolicyRegistry;
  rewardPolicies: SectTaskRewardPolicyRegistry;
  limit?: number;
}): SectDomainEventDispatcherFactory {
  return new StandardSectDomainEventDispatcherFactory(
    args.fulfillments,
    args.progress,
    args.rewards,
    new SectTaskOfferService(args.offerPolicies, args.rewardPolicies),
    args.limit,
  );
}
