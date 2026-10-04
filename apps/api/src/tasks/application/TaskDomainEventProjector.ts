import type { DbTransaction } from '@server/lib/drizzle/db.js';
import { lockCultivatorForStateMutation } from '@server/lib/repositories/playerStateRepository.js';
import {
  isDomainEventType,
  type DomainEventEnvelope,
} from '@daoyou/contracts/events';
import type { ResourceChangeDescriptor } from '@daoyou/contracts/resources';
import type { FeatureCommandResult } from '@server/player/application/state/CommandExecutors.js';
import { readPlayerTaskSummary } from '@server/player/application/PlayerResourceReaderService.js';
import { TaskService } from '@server/tasks/application/TaskService.js';

export async function projectTaskDomainEvent(
  event: DomainEventEnvelope,
  tx: DbTransaction,
): Promise<FeatureCommandResult<{ status: 'applied' | 'ignored' }>> {
  if (isDomainEventType(event, 'alchemy.craft.completed')) {
    await lockCultivatorForStateMutation(tx, event.data.cultivatorId);
    await TaskService.recordTaskEvent(
      event.data.cultivatorId,
      'alchemy_crafted',
      { tx },
    );
    return taskProjectionResult(event.data.cultivatorId, tx);
  }

  if (isDomainEventType(event, 'ranking.challenge.completed')) {
    return {
      result: { status: 'ignored' as const },
      resourceChanges: [],
    };
  }

  if (isDomainEventType(event, 'dungeon.run.settled')) {
    await lockCultivatorForStateMutation(tx, event.data.cultivatorId);
    if (event.data.outcome === 'completed') {
      await TaskService.recordDungeonCompletion(
        event.data.cultivatorId,
        event.data.mapNodeId,
        { tx },
      );
    }
    await TaskService.recordTaskEvent(
      event.data.cultivatorId,
      'dungeon_completed',
      { tx },
    );
    return taskProjectionResult(event.data.cultivatorId, tx);
  }

  if (isDomainEventType(event, 'yield.claimed')) {
    return {
      result: { status: 'ignored' as const },
      resourceChanges: [],
    };
  }

  throw new Error(`任务投影不支持领域事件: ${event.type}`);
}

async function taskProjectionResult(
  cultivatorId: string,
  tx: DbTransaction,
): Promise<FeatureCommandResult<{ status: 'applied' | 'ignored' }>> {
  const taskSummary = await readPlayerTaskSummary(cultivatorId, tx);
  const scope = { kind: 'cultivator' as const, id: cultivatorId };
  return {
    result: { status: 'applied' as const },
    resourceChanges: [
      {
        scope,
        resourceTopic: 'player.tasks',
        eventType: 'tasks.progress_changed',
        operation: 'invalidate',
      },
      {
        scope,
        resourceTopic: 'player.task-summary',
        eventType: 'tasks.progress_changed',
        operation: 'replace',
        payload: taskSummary,
      },
    ] satisfies ResourceChangeDescriptor[],
  };
}
