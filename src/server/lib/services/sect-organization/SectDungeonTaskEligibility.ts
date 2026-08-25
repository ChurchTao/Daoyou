import { getExecutor, type DbExecutor } from '@server/lib/drizzle/db';
import { STANDARD_SECT_DUNGEON_TASK_ID } from '@shared/engine/sect';
import { productionSectRuntime } from '@shared/engine/sect/content';
import { createPostgresSectQueryContext } from './PostgresSectOrganizationAdapters';

export async function hasActiveSectDungeonTask(
  cultivatorId: string,
  q: DbExecutor = getExecutor(),
): Promise<boolean> {
  const context = createPostgresSectQueryContext({
    q,
    runtime: productionSectRuntime,
  });
  const membership = await context.memberships.findByCultivator(cultivatorId);
  if (!membership) return false;

  const definition = context.modules
    .require(membership.sectId)
    .tasks.get(STANDARD_SECT_DUNGEON_TASK_ID);
  if (
    definition?.kind !== 'daily' ||
    definition.executorKey !== 'sect.dungeon'
  ) {
    return false;
  }

  const record = await context.tasks.find(
    membership.id,
    context.clock.dateKey(),
    STANDARD_SECT_DUNGEON_TASK_ID,
  );
  return record?.status === 'active';
}
