import type { DbTransaction } from '@server/lib/drizzle/db';
import { projectMainStoryDomainEvent } from '@server/lib/services/StoryService';
import type { DomainEventEnvelope } from '@shared/contracts/domainEvents';
import type { FeatureCommandResult } from './CommandExecutors';

/**
 * Main story consumes already-happened cross-domain facts through MQ.
 * Dungeon, retreat and other gameplay domains never import StoryService.
 */
export async function projectMainStoryIntegrationEvent(
  event: DomainEventEnvelope<'dungeon.run.settled' | 'cultivator.realm.changed'>,
  tx: DbTransaction,
): Promise<FeatureCommandResult<{ status: 'applied' }>> {
  await projectMainStoryDomainEvent(event, tx);
  return { result: { status: 'applied' as const }, resourceChanges: [] };
}
