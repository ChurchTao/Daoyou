import type { DbTransaction } from '@server/lib/drizzle/db.js';
import type { DomainEventEnvelope } from '@daoyou/shared/contracts/domainEvents';
import type { ResourceChangeDescriptor } from '@daoyou/shared/contracts/resources';
import { readPlayerMailSummary } from '@server/player/application/PlayerResourceReaderService.js';

export async function projectMailCreated(
  event: DomainEventEnvelope<'mail.created'>,
  tx: DbTransaction,
) {
  const summary = await readPlayerMailSummary(event.data.cultivatorId, tx);
  return {
    result: { status: 'applied' as const },
    resourceChanges: [
      {
        scope: { kind: 'cultivator', id: event.data.cultivatorId },
        resourceTopic: 'player.mail-summary',
        eventType: 'mail.created',
        operation: 'replace',
        payload: summary,
      },
    ] satisfies ResourceChangeDescriptor[],
  };
}
