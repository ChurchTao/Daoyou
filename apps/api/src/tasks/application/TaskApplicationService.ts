import type { DbTransaction } from '@server/lib/drizzle/db.js';
import type { ResourceChangeDescriptor } from '@daoyou/contracts/resources';
import { playerCommandExecutor } from '@server/player/application/state/CommandExecutors.js';
import { readPlayerTaskSummary } from '@server/player/application/PlayerResourceReaderService.js';
import { TaskService } from '@server/tasks/application/TaskService.js';

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
