import type {
  SectTaskActionData,
  SectTaskRewardReceipt,
} from '@daoyou/shared/contracts/sect';
import {
  resolveSectTaskClaimReward,
  SectTask,
  type SectTaskDefinition,
} from '@daoyou/shared/engine/sect';
import type { SectCommandEffects } from '@server/sects/organization/SectCommandEffects.js';
import type { SectDomainEventDispatcherFactory } from '@server/sects/organization/SectDomainEventDispatcher.js';
import { invalidSectTask } from '@server/sects/organization/SectTaskApplicationSupport.js';
import { toSectTaskView } from '@server/sects/organization/SectTaskViewAssembler.js';
import type {
  SectCommandContext,
  SectMembershipRecord,
  SectTaskRecord,
} from '@server/sects/organization/ports.js';
import type { SectTaskExecutor } from '@server/sects/organization/task-executors/SectTaskExecutor.js';

export class ClaimSectTaskRewardHandler {
  constructor(private readonly events: SectDomainEventDispatcherFactory) {}

  async execute(args: {
    command: {
      userId: string;
      cultivatorId: string;
    };
    context: SectCommandContext;
    membership: SectMembershipRecord;
    definition: SectTaskDefinition;
    executor: SectTaskExecutor;
    record: SectTaskRecord;
    changedTasks?: SectTaskActionData['changedTasks'];
  }): Promise<{ result: SectTaskActionData; effects: SectCommandEffects }> {
    if (args.record.status !== 'completed')
      invalidSectTask('该宗门任务尚未达成');
    if (args.record.claimedAt) invalidSectTask('该宗门任务奖励已经领取');
    const reward = resolveSectTaskClaimReward(args.record.payload);
    const aggregate = SectTask.rehydrate({
      id: args.record.id,
      definitionId: args.record.taskId,
      membershipId: args.record.membershipId,
      kind: args.record.kind,
      periodKey: args.record.periodKey,
      target: args.record.payload.target,
      state: 'claimable',
      progress: args.record.progress,
    });
    aggregate.claim({
      userId: args.command.userId,
      cultivatorId: args.command.cultivatorId,
      reward,
    });
    const claimedAt = args.context.clock.now();
    const claimed = await args.context.tasks.claim(args.record.id, claimedAt);
    if (!claimed) invalidSectTask('该宗门任务奖励已经领取');
    const effects = await this.events
      .forTask({
        userId: args.command.userId,
        cultivatorId: args.command.cultivatorId,
        membership: args.membership,
        command: args.context,
      })
      .dispatch(aggregate.pullEvents());
    const rewards = {
      contribution: reward?.contribution ?? 0,
      cultivationExp: reward?.cultivationExp ?? 0,
      spiritStones: reward?.spiritStones ?? 0,
    };
    const receipt: SectTaskRewardReceipt = {
      taskRecordId: claimed.id,
      claimedAt: claimedAt.toISOString(),
      rewards,
      lines:
        reward?.summary ??
        (args.definition.kind === 'promotion'
          ? ['晋升资格已经记入宗门卷宗']
          : []),
    };
    const primaryTask = toSectTaskView({
      definition: args.definition,
      record: claimed,
      executor: args.executor,
      now: args.context.clock.now(),
      state: 'claimed',
      enabled: true,
    });
    return {
      result: {
        primaryTask,
        changedTasks: [
          ...(args.changedTasks ?? []).filter(
            (task) => task.definitionId !== primaryTask.definitionId,
          ),
          primaryTask,
        ],
        outcome: {
          renderer: 'sect.outcome.reward-claimed',
          data: { ...receipt },
        },
        settlement: effects.settlement,
      },
      effects,
    };
  }
}
