import type { DomainEventData } from '@daoyou/game-domain/events';
import type { DbTransaction } from '@server/lib/drizzle/db.js';
import { createDomainEvent } from '@server/lib/mq/domainEventWriter.js';

/** A committed training fact; downstream projections decide what it means. */
export async function recordGrowthObserved(
  tx: DbTransaction,
  data: DomainEventData<'cultivator.growth.observed'>,
  deduplicationKey?: string,
) {
  return createDomainEvent(
    {
      type: 'cultivator.growth.observed',
      aggregate: { type: 'cultivator', id: data.cultivatorId },
      data: {
        cultivatorId: data.cultivatorId,
        discipline: data.discipline,
        value: data.value,
      },
      deduplicationKey,
    },
    tx,
  );
}
