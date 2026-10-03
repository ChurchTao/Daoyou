import type { DbTransaction } from '@server/lib/drizzle/db.js';
import { createTransactionalMessage } from '@server/lib/repositories/transactionalMessageRepository.js';
import type {
  DomainEventData,
  DomainEventType,
} from '@daoyou/shared/contracts/domainEvents';
import {
  DOMAIN_EVENT_DEFINITIONS,
  parseDomainEventEnvelope,
} from '@daoyou/shared/contracts/domainEvents';
import { randomUUID } from 'node:crypto';

export interface DomainEventWriter {
  create<TType extends DomainEventType>(input: {
    type: TType;
    aggregate: { type: string; id: string };
    data: DomainEventData<TType>;
    deduplicationKey?: string;
    correlationId?: string;
    causationId?: string;
  }): Promise<{ id: string }>;
}

export async function createDomainEvent<TType extends DomainEventType>(
  input: {
    type: TType;
    aggregate: { type: string; id: string };
    data: DomainEventData<TType>;
    deduplicationKey?: string;
    correlationId?: string;
    causationId?: string;
  },
  tx: DbTransaction,
): Promise<{ id: string }> {
  const id = randomUUID();
  const definition = DOMAIN_EVENT_DEFINITIONS[input.type];
  const event = parseDomainEventEnvelope({
    id,
    type: input.type,
    version: definition.version,
    subject: definition.subject,
    occurredAt: new Date().toISOString(),
    aggregate: input.aggregate,
    ...(input.correlationId ? { correlationId: input.correlationId } : {}),
    ...(input.causationId ? { causationId: input.causationId } : {}),
    data: input.data,
  });

  return createTransactionalMessage(
    {
      id,
      messageKey: input.type,
      destination: definition.subject,
      payload: event,
      deduplicationKey: input.deduplicationKey,
    },
    tx,
  );
}

export function createPostgresDomainEventWriter(
  tx: DbTransaction,
): DomainEventWriter {
  return {
    create: (input) => createDomainEvent(input, tx),
  };
}
