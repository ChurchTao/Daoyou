import { calculateSceneCultivationExp } from '@shared/engine/cultivation/ExpBudgetCalculator';
import type {
  SectDomainEvent,
  SectTaskDefinition,
} from '@shared/engine/sect';
import { REALM_ORDER } from '@shared/types/constants';
import { z, type ZodType } from 'zod';
import { organizationError } from './applicationSupport';
import type {
  SectCommandContext,
  SectMembershipRecord,
  SectQueryContext,
} from './ports';

export interface SectTaskSettlementContext {
  userId: string;
  cultivatorId: string;
  membership: SectMembershipRecord;
  definition: SectTaskDefinition;
  taskRecordId: string;
  ports: SectCommandContext;
}

export interface SectTaskSettlementStrategy<TInput = unknown> {
  readonly key: string;
  readonly inputSchema: ZodType<TInput>;
  settle(
    context: SectTaskSettlementContext,
    input: TInput,
  ): Promise<readonly SectDomainEvent[]>;
}

export class SectTaskSettlementRegistry {
  private readonly strategies = new Map<string, SectTaskSettlementStrategy>();

  constructor(strategies: readonly SectTaskSettlementStrategy[] = []) {
    for (const strategy of strategies) this.register(strategy);
  }

  register(strategy: SectTaskSettlementStrategy): void {
    if (this.strategies.has(strategy.key))
      throw new Error(`宗门任务结算策略重复注册：${strategy.key}`);
    this.strategies.set(strategy.key, strategy);
  }

  has(key: string): boolean {
    return this.strategies.has(key);
  }

  require(key: string): SectTaskSettlementStrategy {
    const strategy = this.strategies.get(key);
    if (!strategy) organizationError(`未注册宗门任务结算策略：${key}`, 500);
    return strategy;
  }
}

const contributionInput = z.object({
  amount: z.number().int().positive(),
  reason: z.string().min(1).max(64),
});

export class ContributionTaskSettlementStrategy
  implements SectTaskSettlementStrategy<z.infer<typeof contributionInput>>
{
  readonly inputSchema = contributionInput;

  constructor(readonly key = 'sect.settlement.contribution') {}

  async settle(
    context: SectTaskSettlementContext,
    input: z.infer<typeof contributionInput>,
  ): Promise<readonly SectDomainEvent[]> {
    return [{
      type: 'SectContributionGranted',
      membershipId: context.membership.id,
      amount: input.amount,
      reason: input.reason,
      referenceId: context.taskRecordId,
    }];
  }
}

const realmDailyInput = z.object({ difficulty: z.literal('easy') });

export class RealmDailyRewardSettlementStrategy
  implements SectTaskSettlementStrategy<z.infer<typeof realmDailyInput>>
{
  readonly key = 'sect.settlement.realm-daily-reward';
  readonly inputSchema = realmDailyInput;

  async settle(
    context: SectTaskSettlementContext,
    input: z.infer<typeof realmDailyInput>,
  ): Promise<readonly SectDomainEvent[]> {
    const progress = await context.ports.cultivators.loadProgress(
      context.cultivatorId,
    );
    if (!progress) return [];
    const cultivationExp = calculateSceneCultivationExp('daily_task', {
      realm: progress.realm,
      realmStage: progress.stage,
      difficulty: input.difficulty,
    }).baseExp;
    return [
      {
        type: 'SectSpiritStonesGranted',
        cultivatorId: context.cultivatorId,
        amount: (REALM_ORDER[progress.realm] + 1) * 1_000,
      },
      ...(cultivationExp > 0
        ? [{
            type: 'SectCultivationExpGranted' as const,
            userId: context.userId,
            cultivatorId: context.cultivatorId,
            amount: cultivationExp,
          }]
        : []),
    ];
  }
}

const progressSignalInput = z.object({
  source: z.string().min(1).max(128),
  amount: z.number().int().positive().default(1),
});

export class ProgressSignalSettlementStrategy
  implements SectTaskSettlementStrategy<z.infer<typeof progressSignalInput>>
{
  readonly key = 'sect.settlement.progress-signal';
  readonly inputSchema = progressSignalInput;

  async settle(
    context: SectTaskSettlementContext,
    input: z.infer<typeof progressSignalInput>,
  ): Promise<readonly SectDomainEvent[]> {
    return [{
      type: 'SectTaskProgressSignaled',
      membershipId: context.membership.id,
      source: input.source,
      amount: input.amount,
    }];
  }
}

export interface SectTaskProgressStrategy {
  readonly key: string;
  current(args: {
    membership: SectMembershipRecord;
    definition: SectTaskDefinition;
    context: SectQueryContext;
  }): Promise<number>;
}

export class SectTaskProgressRegistry {
  private readonly strategies = new Map<string, SectTaskProgressStrategy>();

  constructor(strategies: readonly SectTaskProgressStrategy[] = []) {
    for (const strategy of strategies) this.register(strategy);
  }

  register(strategy: SectTaskProgressStrategy): void {
    if (this.strategies.has(strategy.key))
      throw new Error(`宗门任务进度策略重复注册：${strategy.key}`);
    this.strategies.set(strategy.key, strategy);
  }

  has(key: string): boolean {
    return this.strategies.has(key);
  }

  require(key: string): SectTaskProgressStrategy {
    const strategy = this.strategies.get(key);
    if (!strategy) organizationError(`未注册宗门任务进度策略：${key}`, 500);
    return strategy;
  }
}

export class CompletedDailyTaskProgressStrategy
  implements SectTaskProgressStrategy
{
  readonly key = 'sect.progress.completed-daily';

  async current(args: {
    membership: SectMembershipRecord;
    context: SectQueryContext;
  }): Promise<number> {
    return args.context.tasks.countCompletedDailySince(
      args.membership.id,
      args.context.clock.weekKey(),
    );
  }
}
