import type { DbTransaction } from '@server/lib/drizzle/db.js';
import { lockCultivatorForStateMutation } from '@server/lib/repositories/playerStateRepository.js';
import {
  isDomainEventType,
  type DomainEventEnvelope,
} from '@daoyou/contracts/events';
import type { FeatureCommandResult } from '@server/player/application/state/CommandExecutors.js';
import { TaskService } from '@server/tasks/application/TaskService.js';

export async function projectTaskDomainEvent(
  event: DomainEventEnvelope,
  tx: DbTransaction,
): Promise<FeatureCommandResult<{ status: 'applied' | 'ignored' }>> {
  if (isDomainEventType(event, 'alchemy.craft.completed')) {
    await lockCultivatorForStateMutation(tx, event.data.cultivatorId);
    const resourceChanges = await TaskService.synchronizeResourceChanges(
      event.data.cultivatorId,
      tx,
    );
    return {
      result: { status: resourceChanges.length ? 'applied' : 'ignored' },
      resourceChanges,
    };
  }

  // 破境不再消费秘境、论道或历练结算。activity.* 消费者仍会收到这些事件，
  // 这里明确忽略，避免当成未知事件重试。主线剧情由同一消费者另行投影。
  if (
    isDomainEventType(event, 'ranking.challenge.completed') ||
    isDomainEventType(event, 'dungeon.run.settled') ||
    isDomainEventType(event, 'yield.claimed')
  ) {
    return { result: { status: 'ignored' }, resourceChanges: [] };
  }

  throw new Error(`任务投影不支持领域事件: ${event.type}`);
}
