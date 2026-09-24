import type { DailyTaskDifficulty } from '@shared/engine/cultivation/exp-gain-strategies/types';
import {
  assertSectRealmQualityRules,
  assertStandardSectTaskRequirementCurve,
  calculateRealmSectTaskReward,
  calculateSectDeliveryDifficulty,
  generateSectDeliveryRequirement,
  type SectDeliveryRequirement,
  type SectDomainEvent,
  type SectTaskDefinition,
  type SectTaskRewardCadence,
  type SectTaskRewardSnapshot,
} from '@shared/engine/sect';
import type { RealmStage, RealmType } from '@shared/types/constants';
import { z, type ZodType } from 'zod';
import { organizationError } from './applicationSupport';
import type { SectMembershipRecord, SectQueryContext } from './ports';

export interface SectTaskOfferPolicyContext {
  membershipId: string;
  taskId: string;
  periodKey: string;
  attempt: number;
  realm: RealmType;
  realmStage: RealmStage;
  rulesVersion: number;
}

export interface SectTaskOfferPolicyResult {
  requirement?: SectDeliveryRequirement;
  difficulty: DailyTaskDifficulty;
}

export interface SectTaskOfferPolicy<TInput = unknown> {
  readonly key: string;
  readonly version: number;
  readonly inputSchema: ZodType<TInput>;
  create(
    context: SectTaskOfferPolicyContext,
    input: TInput,
  ): SectTaskOfferPolicyResult;
}

class Registry<T extends { key: string }> {
  private readonly values = new Map<string, T>();

  constructor(
    values: readonly T[],
    private readonly label: string,
  ) {
    for (const value of values) this.register(value);
  }

  register(value: T): void {
    if (this.values.has(value.key))
      throw new Error(`${this.label}重复注册：${value.key}`);
    this.values.set(value.key, value);
  }

  has(key: string): boolean {
    return this.values.has(key);
  }

  require(key: string): T {
    const value = this.values.get(key);
    if (!value) organizationError(`未注册${this.label}：${key}`, 500);
    return value;
  }
}

export class SectTaskOfferPolicyRegistry extends Registry<SectTaskOfferPolicy> {
  constructor(values: readonly SectTaskOfferPolicy[] = []) {
    super(values, '宗门任务告示策略');
  }
}

const deliveryOfferInput = z.object({
  kind: z.enum(['pill', 'equipment', 'material']),
});

export class DeliverySectTaskOfferPolicy implements SectTaskOfferPolicy<
  z.infer<typeof deliveryOfferInput>
> {
  readonly key = 'sect.offer.delivery';
  readonly version = 2;
  readonly inputSchema = deliveryOfferInput;

  constructor() {
    assertSectRealmQualityRules();
    assertStandardSectTaskRequirementCurve();
  }

  create(
    context: SectTaskOfferPolicyContext,
    input: z.infer<typeof deliveryOfferInput>,
  ): SectTaskOfferPolicyResult {
    const requirement = generateSectDeliveryRequirement({
      kind: input.kind,
      realm: context.realm,
      realmStage: context.realmStage,
      seed: [
        context.membershipId,
        context.taskId,
        context.periodKey,
        context.attempt,
        context.rulesVersion,
      ].join(':'),
    });
    return {
      requirement,
      difficulty: calculateSectDeliveryDifficulty(requirement),
    };
  }
}

export interface SectTaskRewardPolicyContext {
  realm: RealmType;
  realmStage: RealmStage;
  difficulty: DailyTaskDifficulty;
  cadence: SectTaskRewardCadence;
}

export interface SectTaskRewardPolicy<TInput = unknown> {
  readonly key: string;
  readonly version: number;
  readonly inputSchema: ZodType<TInput>;
  calculate(
    context: SectTaskRewardPolicyContext,
    input: TInput,
  ): SectTaskRewardSnapshot;
}

export class SectTaskRewardPolicyRegistry extends Registry<SectTaskRewardPolicy> {
  constructor(values: readonly SectTaskRewardPolicy[] = []) {
    super(values, '宗门任务奖励策略');
  }
}

const realmRewardInput = z.object({
  baseContribution: z.number().int().nonnegative(),
});

export class RealmSectTaskRewardPolicy implements SectTaskRewardPolicy<
  z.infer<typeof realmRewardInput>
> {
  readonly key = 'sect.reward.realm-task';
  readonly version = 3;
  readonly inputSchema = realmRewardInput;

  calculate(
    context: SectTaskRewardPolicyContext,
    input: z.infer<typeof realmRewardInput>,
  ): SectTaskRewardSnapshot {
    return calculateRealmSectTaskReward({
      ...context,
      reward: input,
    });
  }
}

export interface SectTaskFulfillmentContext {
  membership: SectMembershipRecord;
  definition: SectTaskDefinition;
  taskRecordId: string;
}

export interface SectTaskFulfillmentStrategy<TInput = unknown> {
  readonly key: string;
  readonly inputSchema: ZodType<TInput>;
  apply(
    context: SectTaskFulfillmentContext,
    input: TInput,
  ): Promise<readonly SectDomainEvent[]>;
}

export class SectTaskFulfillmentRegistry extends Registry<SectTaskFulfillmentStrategy> {
  constructor(values: readonly SectTaskFulfillmentStrategy[] = []) {
    super(values, '宗门任务达成策略');
  }
}

const progressSignalInput = z.object({
  source: z.string().min(1).max(128),
  amount: z.number().int().positive().default(1),
});

export class ProgressSignalFulfillmentStrategy implements SectTaskFulfillmentStrategy<
  z.infer<typeof progressSignalInput>
> {
  readonly key = 'sect.fulfillment.progress-signal';
  readonly inputSchema = progressSignalInput;

  async apply(
    context: SectTaskFulfillmentContext,
    input: z.infer<typeof progressSignalInput>,
  ): Promise<readonly SectDomainEvent[]> {
    return [
      {
        type: 'SectTaskProgressSignaled',
        membershipId: context.membership.id,
        source: input.source,
        amount: input.amount,
      },
    ];
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

export class SectTaskProgressRegistry extends Registry<SectTaskProgressStrategy> {
  constructor(values: readonly SectTaskProgressStrategy[] = []) {
    super(values, '宗门任务进度策略');
  }
}

export class CompletedDailyTaskProgressStrategy implements SectTaskProgressStrategy {
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
