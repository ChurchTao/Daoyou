import type { DbTransaction } from '@server/lib/drizzle/db';
import type { ResourceChangeDescriptor } from '@shared/contracts/resources';
import { playerCommandExecutor } from './CommandExecutors';
import { readPlayerTaskSummary } from './PlayerResourceReaderService';
import { TaskService } from './TaskService';

export function claimTaskRewardCommand(args: {
  userId: string;
  cultivatorId: string;
  taskId: string;
}) {
  return playerCommandExecutor.executeWithLock({
    userId: args.userId,
    cultivatorId: args.cultivatorId,
    source: 'task_claim_reward',
    command: (tx) =>
      executeTaskRewardClaimCommand({
        cultivatorId: args.cultivatorId,
        taskId: args.taskId,
        tx,
      }),
  });
}

export async function executeTaskRewardClaimCommand(args: {
  cultivatorId: string;
  taskId: string;
  tx: DbTransaction;
}): Promise<{
  result: Awaited<ReturnType<typeof TaskService.claimTaskReward>>;
  resourceChanges: ResourceChangeDescriptor[];
}> {
  const result = await TaskService.claimTaskReward(
    args.cultivatorId,
    args.taskId,
    args.tx,
  );
  const taskSummary = await readPlayerTaskSummary(args.cultivatorId, args.tx);

  return {
    result,
    resourceChanges: [
      {
        resourceTopic: 'player.task-summary',
        eventType: 'tasks.reward_claimed',
        operation: 'replace',
        payload: taskSummary,
      },
      {
        resourceTopic: 'player.tasks',
        eventType: 'tasks.reward_claimed',
        operation: 'upsert-items',
        payload: {
          idKey: 'id',
          items: [result.task],
        },
      },
    ],
  };
}
