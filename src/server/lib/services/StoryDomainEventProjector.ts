import type { DbTransaction } from '@server/lib/drizzle/db';
import { StoryService } from '@server/lib/services/StoryService';
import {
  isDomainEventType,
  type DomainEventEnvelope,
} from '@shared/contracts/domainEvents';
import type { ResourceChangeDescriptor } from '@shared/contracts/resources';
import { storyMarkForSignal } from '@shared/story/signals';

export async function projectStoryDomainEvent(
  event: DomainEventEnvelope,
  tx: DbTransaction,
): Promise<{ resourceChanges: ResourceChangeDescriptor[] }> {
  const signal = isDomainEventType(event, 'alchemy.craft.completed')
    ? {
        cultivatorId: event.data.cultivatorId,
        fact: storyMarkForSignal({ type: 'alchemy.craft.completed' }),
      }
    : isDomainEventType(event, 'dungeon.run.settled')
      ? {
          cultivatorId: event.data.cultivatorId,
          fact: storyMarkForSignal({
            type: 'dungeon.run.settled',
            outcome: event.data.outcome,
          }),
        }
      : null;
  if (!signal?.fact) return { resourceChanges: [] };
  const noted = await StoryService.noteFact(
    signal.cultivatorId,
    signal.fact,
    tx,
  );
  return { resourceChanges: noted?.changes ?? [] };
}
