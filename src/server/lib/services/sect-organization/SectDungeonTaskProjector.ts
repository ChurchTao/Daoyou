import type { DbTransaction } from '@server/lib/drizzle/db';
import { findActiveCultivatorOwnerId } from '@server/lib/repositories/cultivatorRepository';
import type { DomainEventEnvelope } from '@shared/contracts/domainEvents';
import type { ResourceChangeDescriptor } from '@shared/contracts/resources';
import {
  STANDARD_SECT_DUNGEON_TASK_ID,
  type SectTaskDefinition,
} from '@shared/engine/sect';
import { productionSectRuntime } from '@shared/engine/sect/content';
import { createPostgresSectCommandContext } from './PostgresSectOrganizationAdapters';
import { productionSectOrganizationPlugins } from './productionSectOrganization';
import { getSectDateKey, getSectWeekKey } from './SectOrganizationClock';
import { FulfillSectTaskHandler } from './SectTaskApplicationService';

type DungeonSettledEvent = DomainEventEnvelope<'dungeon.run.settled'>;

export interface SectDungeonTaskProjection {
  status: 'applied' | 'ignored';
  resourceChanges: ResourceChangeDescriptor[];
}

const fulfillment = new FulfillSectTaskHandler(
  productionSectOrganizationPlugins.events,
);

function anchoredClock(occurredAt: Date) {
  return {
    now: () => occurredAt,
    dateKey: (now = occurredAt) => getSectDateKey(now),
    weekKey: (now = occurredAt) => getSectWeekKey(now),
  };
}

function isDungeonTask(
  definition: SectTaskDefinition | undefined,
): definition is SectTaskDefinition {
  return (
    definition?.kind === 'daily' && definition.executorKey === 'sect.dungeon'
  );
}

export async function projectSectDungeonTaskCompletion(
  event: DungeonSettledEvent,
  tx: DbTransaction,
): Promise<SectDungeonTaskProjection> {
  if (event.data.outcome !== 'completed') {
    return { status: 'ignored', resourceChanges: [] };
  }

  const occurredAt = new Date(event.occurredAt);
  if (!Number.isFinite(occurredAt.getTime())) {
    throw new Error('秘境结算事件时间无效');
  }
  const userId = await findActiveCultivatorOwnerId(event.data.cultivatorId, tx);
  if (!userId) return { status: 'ignored', resourceChanges: [] };

  const context = createPostgresSectCommandContext({
    tx,
    runtime: productionSectRuntime,
    userId,
    clock: anchoredClock(occurredAt),
  });
  const membership = await context.memberships.findByCultivator(
    event.data.cultivatorId,
  );
  if (!membership) return { status: 'ignored', resourceChanges: [] };

  const definition = context.modules
    .require(membership.sectId)
    .tasks.get(STANDARD_SECT_DUNGEON_TASK_ID);
  if (!isDungeonTask(definition)) {
    return { status: 'ignored', resourceChanges: [] };
  }

  const record = await context.tasks.find(
    membership.id,
    context.clock.dateKey(),
    STANDARD_SECT_DUNGEON_TASK_ID,
  );
  if (
    !record ||
    record.status !== 'active' ||
    record.createdAt.getTime() > occurredAt.getTime()
  ) {
    return { status: 'ignored', resourceChanges: [] };
  }

  const result = await fulfillment.execute({
    userId,
    cultivatorId: event.data.cultivatorId,
    membership,
    definition,
    record,
    context,
    completionSource: {
      kind: 'dungeon_run',
      id: event.data.runId,
      mapNodeId: event.data.mapNodeId,
      rootActivityId: event.data.rootActivityId,
    },
  });
  if (result.effects.resourceChanges.length > 0) {
    throw new Error('秘境宗门任务达成产生了未声明作用域的资源变更');
  }

  return {
    status: 'applied',
    resourceChanges: [
      {
        scope: { kind: 'cultivator', id: event.data.cultivatorId },
        resourceTopic: 'sect.tasks',
        eventType: 'sect.dungeon_task_completed',
        operation: 'invalidate',
      },
    ],
  };
}
